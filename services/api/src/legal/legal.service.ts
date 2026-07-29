import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DataSubjectRequestType,
  LegalDocumentStatus,
  Prisma,
} from '@prisma/client';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import type {
  DataSubjectRequestDto,
  ListLegalDocumentsDto,
  SaveLegalDocumentDto,
} from './legal.dto';
import PDFDocument from 'pdfkit';
import sanitizeHtml from 'sanitize-html';
import { createReadStream } from 'node:fs';

const catalog = [
  ['Termos de Uso', 'termos-de-uso', 'TERMOS', true],
  ['Política de Privacidade', 'politica-de-privacidade', 'PRIVACIDADE', true],
  ['Política de Cookies', 'politica-de-cookies', 'COOKIES', false],
  ['Política de Pagamentos', 'politica-de-pagamentos', 'PAGAMENTOS', false],
  ['Política de Reembolso', 'politica-de-reembolso', 'REEMBOLSO', false],
  ['Política de Sorteios', 'politica-de-sorteios', 'SORTEIOS', false],
  [
    'Política para Organizadores',
    'politica-para-organizadores',
    'ORGANIZADORES',
    false,
  ],
  ['Política de Afiliados', 'politica-de-afiliados', 'AFILIADOS', false],
  ['Política Antifraude', 'politica-antifraude', 'ANTIFRAUDE', false],
  ['Direitos do Titular (LGPD)', 'direitos-do-titular-lgpd', 'LGPD', true],
  ['Política de Segurança', 'politica-de-seguranca', 'SEGURANCA', false],
  ['Política de Conteúdo', 'politica-de-conteudo', 'CONTEUDO', false],
  ['Política de Chargeback', 'politica-de-chargeback', 'CHARGEBACK', false],
  [
    'Política de Cancelamentos',
    'politica-de-cancelamentos',
    'CANCELAMENTOS',
    false,
  ],
  [
    'Política de Entrega de Prêmios',
    'politica-de-entrega-de-premios',
    'PREMIOS',
    false,
  ],
  ['Código de Conduta', 'codigo-de-conduta', 'CONDUTA', false],
] as const;
const placeholder = {
  type: 'document',
  blocks: [
    {
      id: 'placeholder',
      type: 'paragraph',
      text: 'Este conteúdo será definido posteriormente pela equipe jurídica da SorteX.',
    },
  ],
};

@Injectable()
export class LegalService {
  constructor(private readonly prisma: PrismaService) {}
  async ensureCatalog(user: AuthenticatedUser) {
    const count = await this.prisma.legalDocument.count();
    if (count) return;
    await this.prisma.$transaction(
      catalog.map(([title, slug, category, required]) =>
        this.prisma.legalDocument.create({
          data: {
            title,
            subtitle: 'Subtítulo',
            slug,
            category,
            required,
            content: placeholder,
            createdById: user.id,
            updatedById: user.id,
          },
        }),
      ),
    );
  }
  async adminList(user: AuthenticatedUser, query: ListLegalDocumentsDto) {
    await this.ensureCatalog(user);
    return this.prisma.legalDocument.findMany({
      where: {
        status: query.status,
        category: query.category,
        OR: query.search
          ? [
              { title: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: {
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
        _count: { select: { versions: true, acceptances: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }
  published() {
    return this.prisma.legalDocument
      .findMany({
        where: { status: LegalDocumentStatus.PUBLISHED },
        select: {
          id: true,
          title: true,
          subtitle: true,
          slug: true,
          category: true,
          version: true,
          required: true,
          publishedAt: true,
          updatedAt: true,
          versions: {
            where: { status: LegalDocumentStatus.PUBLISHED },
            orderBy: { version: 'desc' },
            take: 1,
            select: { title: true, subtitle: true, version: true },
          },
        },
        orderBy: { title: 'asc' },
      })
      .then((items) =>
        items.map(({ versions, ...item }) => ({
          ...item,
          title: versions[0]?.title ?? item.title,
          subtitle: versions[0]?.subtitle ?? item.subtitle,
          version: versions[0]?.version ?? item.version,
        })),
      );
  }
  async publishedBySlug(slug: string) {
    const item = await this.prisma.legalDocument.findFirst({
      where: { slug, status: LegalDocumentStatus.PUBLISHED },
      include: {
        versions: {
          where: { status: LegalDocumentStatus.PUBLISHED },
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });
    if (!item) throw new NotFoundException('Documento não encontrado.');
    const snapshot = item.versions[0];
    if (!snapshot)
      throw new NotFoundException('Versão publicada não encontrada.');
    return {
      id: item.id,
      title: snapshot.title,
      subtitle: snapshot.subtitle,
      slug: item.slug,
      category: item.category,
      content: snapshot.content,
      version: snapshot.version,
      required: item.required,
      publishedAt: snapshot.createdAt,
      updatedAt: snapshot.createdAt,
    };
  }
  get(id: string) {
    return this.ownedDocument(id);
  }
  async create(user: AuthenticatedUser, dto: SaveLegalDocumentDto) {
    const item = await this.prisma.legalDocument.create({
      data: {
        ...this.payload(dto),
        createdById: user.id,
        updatedById: user.id,
      },
    });
    await this.audit(this.prisma, user, item.id, 'LEGAL_DOCUMENT_CREATED', {
      title: item.title,
      slug: item.slug,
    });
    return item;
  }
  async update(id: string, user: AuthenticatedUser, dto: SaveLegalDocumentDto) {
    const previous = await this.ownedDocument(id);
    const item = await this.prisma.legalDocument.update({
      where: { id },
      data: { ...this.payload(dto), updatedById: user.id },
    });
    await this.audit(this.prisma, user, id, 'LEGAL_DOCUMENT_UPDATED', {
      previousVersion: previous.version,
      title: item.title,
    });
    return item;
  }
  async duplicate(id: string, user: AuthenticatedUser) {
    const item = await this.ownedDocument(id);
    const copy = await this.prisma.legalDocument.create({
      data: {
        title: `${item.title} — Cópia`,
        subtitle: item.subtitle,
        slug: `${item.slug}-copia-${Date.now()}`,
        category: item.category,
        content: item.content as Prisma.InputJsonValue,
        required: false,
        createdById: user.id,
        updatedById: user.id,
      },
    });
    await this.audit(this.prisma, user, copy.id, 'LEGAL_DOCUMENT_DUPLICATED', {
      sourceDocumentId: id,
    });
    return copy;
  }
  async publish(id: string, user: AuthenticatedUser, summary?: string) {
    const item = await this.ownedDocument(id);
    const latest = await this.prisma.legalDocumentVersion.findFirst({
      where: { documentId: id },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const version = latest ? latest.version + 1 : 1;
    return this.prisma.$transaction(async (tx) => {
      await tx.legalDocumentVersion.upsert({
        where: { documentId_version: { documentId: id, version } },
        create: {
          documentId: id,
          version,
          title: item.title,
          subtitle: item.subtitle,
          content: item.content as Prisma.InputJsonValue,
          changeSummary: summary || item.changeSummary,
          status: LegalDocumentStatus.PUBLISHED,
          createdById: user.id,
        },
        update: {
          title: item.title,
          subtitle: item.subtitle,
          content: item.content as Prisma.InputJsonValue,
          changeSummary: summary || item.changeSummary,
          status: LegalDocumentStatus.PUBLISHED,
          createdById: user.id,
        },
      });
      const updated = await tx.legalDocument.update({
        where: { id },
        data: {
          status: LegalDocumentStatus.PUBLISHED,
          version,
          publishedAt: new Date(),
          changeSummary: summary,
          updatedById: user.id,
        },
      });
      await this.audit(tx, user, id, 'LEGAL_DOCUMENT_PUBLISHED', { version });
      return updated;
    });
  }
  async archive(id: string, user: AuthenticatedUser) {
    await this.ownedDocument(id);
    const item = await this.prisma.legalDocument.update({
      where: { id },
      data: { status: LegalDocumentStatus.ARCHIVED, updatedById: user.id },
    });
    await this.audit(this.prisma, user, id, 'LEGAL_DOCUMENT_ARCHIVED');
    return item;
  }
  async remove(id: string, user?: AuthenticatedUser) {
    const item = await this.ownedDocument(id);
    if (item.status === LegalDocumentStatus.PUBLISHED)
      throw new BadRequestException('Arquive o documento antes de excluir.');
    const deleted = await this.prisma.legalDocument.delete({ where: { id } });
    if (user)
      await this.audit(this.prisma, user, id, 'LEGAL_DOCUMENT_DELETED', {
        title: item.title,
      });
    return deleted;
  }
  history(id: string) {
    return this.prisma.legalDocumentVersion.findMany({
      where: { documentId: id },
      include: { createdBy: { select: { name: true } } },
      orderBy: { version: 'desc' },
    });
  }
  async restore(id: string, version: number, user: AuthenticatedUser) {
    const snapshot = await this.prisma.legalDocumentVersion.findUnique({
      where: { documentId_version: { documentId: id, version } },
    });
    if (!snapshot) throw new NotFoundException('Versão não encontrada.');
    const item = await this.prisma.legalDocument.update({
      where: { id },
      data: {
        title: snapshot.title,
        subtitle: snapshot.subtitle,
        content: snapshot.content as Prisma.InputJsonValue,
        changeSummary: `Restauração da versão ${version}`,
        status: LegalDocumentStatus.DRAFT,
        updatedById: user.id,
      },
    });
    await this.audit(this.prisma, user, id, 'LEGAL_DOCUMENT_VERSION_RESTORED', {
      version,
    });
    return item;
  }
  acceptances(id: string) {
    return this.prisma.legalAcceptance.findMany({
      where: { documentId: id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { acceptedAt: 'desc' },
    });
  }
  async pendingUsers(id: string) {
    const doc = await this.ownedDocument(id);
    return this.prisma.user.findMany({
      where: {
        isActive: true,
        legalAcceptances: { none: { documentId: id, version: doc.version } },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  async accept(
    slug: string,
    user: AuthenticatedUser,
    metadata: { ip?: string; userAgent?: string },
  ) {
    const doc = await this.publishedBySlug(slug);
    const parsed = parseAgent(metadata.userAgent);
    return this.prisma.legalAcceptance.upsert({
      where: {
        userId_documentId_version: {
          userId: user.id,
          documentId: doc.id,
          version: doc.version,
        },
      },
      create: {
        userId: user.id,
        documentId: doc.id,
        version: doc.version,
        ip: metadata.ip,
        device: parsed.device,
        browser: parsed.browser,
        operatingSystem: parsed.os,
        userAgent: metadata.userAgent?.slice(0, 500),
      },
      update: {
        acceptedAt: new Date(),
        ip: metadata.ip,
        device: parsed.device,
        browser: parsed.browser,
        operatingSystem: parsed.os,
      },
    });
  }
  myAcceptances(user: AuthenticatedUser) {
    return this.prisma.legalAcceptance.findMany({
      where: { userId: user.id },
      include: {
        document: { select: { title: true, slug: true, category: true } },
      },
      orderBy: { acceptedAt: 'desc' },
    });
  }
  async pending(user: AuthenticatedUser) {
    const required = await this.prisma.legalDocument.findMany({
      where: { required: true, status: LegalDocumentStatus.PUBLISHED },
      select: {
        id: true,
        title: true,
        slug: true,
        version: true,
        changeSummary: true,
        publishedAt: true,
        acceptances: { where: { userId: user.id }, select: { version: true } },
      },
    });
    return required
      .filter(
        (item) =>
          !item.acceptances.some((value) => value.version === item.version),
      )
      .map((item) => ({
        id: item.id,
        title: item.title,
        slug: item.slug,
        version: item.version,
        changeSummary: item.changeSummary,
        publishedAt: item.publishedAt,
      }));
  }
  dataRequest(user: AuthenticatedUser, dto: DataSubjectRequestDto) {
    const type = mapRequestType(dto.type);
    return this.prisma.dataSubjectRequest.create({
      data: { userId: user.id, type, reason: dto.reason },
    });
  }
  myDataRequests(user: AuthenticatedUser) {
    return this.prisma.dataSubjectRequest.findMany({
      where: { userId: user.id },
      orderBy: { requestedAt: 'desc' },
    });
  }
  async pdf(id: string) {
    const item = await this.ownedDocument(id);
    const html =
      item.content &&
      typeof item.content === 'object' &&
      !Array.isArray(item.content) &&
      typeof (item.content as Record<string, unknown>).html === 'string'
        ? String((item.content as Record<string, unknown>).html)
        : '';
    const body = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });
    return new Promise<Buffer>((resolve, reject) => {
      const document = new PDFDocument({
        size: 'A4',
        margin: 56,
        info: { Title: item.title },
      });
      const chunks: Buffer[] = [];
      document.on('data', (chunk: Buffer) => chunks.push(chunk));
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);
      document.fontSize(22).text(item.title);
      if (item.subtitle)
        document
          .moveDown(0.4)
          .fontSize(12)
          .fillColor('#666666')
          .text(item.subtitle);
      document
        .moveDown()
        .fillColor('#111111')
        .fontSize(10)
        .text(`Versão ${item.version} • ${item.status}`);
      document
        .moveDown()
        .fontSize(11)
        .text(body || 'Este conteúdo ainda não foi definido.', {
          align: 'left',
        });
      document.end();
    });
  }
  asset(path: string) {
    return createReadStream(path);
  }
  private payload(dto: SaveLegalDocumentDto) {
    return {
      title: dto.title.trim(),
      subtitle: dto.subtitle?.trim() || null,
      slug: dto.slug,
      category: dto.category,
      content: sanitizeLegalContent(dto.content) as Prisma.InputJsonValue,
      changeSummary: dto.changeSummary?.trim() || null,
      required: dto.required,
    };
  }
  private async ownedDocument(id: string) {
    const item = await this.prisma.legalDocument.findUnique({
      where: { id },
      include: {
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
        _count: { select: { versions: true, acceptances: true } },
      },
    });
    if (!item) throw new NotFoundException('Documento não encontrado.');
    return item;
  }
  private audit(
    tx: Prisma.TransactionClient | PrismaService,
    user: AuthenticatedUser,
    id: string,
    action: string,
    newData?: unknown,
  ) {
    return tx.auditLog.create({
      data: {
        entityType: 'LegalDocument',
        entityId: id,
        action,
        actorUserId: user.id,
        actorRole: user.role,
        newData: newData as Prisma.InputJsonValue,
      },
    });
  }
}

function sanitizeLegalContent(content: Record<string, unknown>) {
  const html = typeof content.html === 'string' ? content.html : undefined;
  if (!html) return content;
  return {
    ...content,
    html: sanitizeHtml(html, {
      allowedTags: [
        'p',
        'br',
        'strong',
        'b',
        'em',
        'i',
        'u',
        'ul',
        'ol',
        'li',
        'table',
        'thead',
        'tbody',
        'tr',
        'th',
        'td',
        'a',
        'img',
        'blockquote',
        'hr',
        'pre',
        'code',
        'h2',
        'h3',
        'h4',
      ],
      allowedAttributes: {
        a: ['href', 'target', 'rel'],
        img: ['src', 'alt', 'title'],
        '*': ['class'],
      },
      allowedSchemes: ['http', 'https'],
      transformTags: {
        a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
      },
    }),
  };
}
function parseAgent(value = '') {
  return {
    device: /mobile|android|iphone/i.test(value) ? 'Celular' : 'Desktop',
    browser: /edg/i.test(value)
      ? 'Edge'
      : /firefox/i.test(value)
        ? 'Firefox'
        : /chrome/i.test(value)
          ? 'Chrome'
          : /safari/i.test(value)
            ? 'Safari'
            : 'Não identificado',
    os: /android/i.test(value)
      ? 'Android'
      : /iphone|ipad/i.test(value)
        ? 'iOS'
        : /windows/i.test(value)
          ? 'Windows'
          : /mac os/i.test(value)
            ? 'macOS'
            : /linux/i.test(value)
              ? 'Linux'
              : 'Não identificado',
  };
}
function mapRequestType(value: string) {
  const map: Record<string, DataSubjectRequestType> = {
    DELETE: 'DELETION',
    PORTABILITY: 'EXPORT',
    CORRECTION: 'CORRECTION',
    REVOKE: 'RESTRICTION',
    REPORT: 'ACCESS',
  };
  const type = map[value];
  if (!type) throw new BadRequestException('Tipo de solicitação inválido.');
  return type;
}
