import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GeneratedMediaStatus,
  MediaRenderJobStatus,
  MediaRenderJobType,
  MediaTemplateStatus,
  MediaTemplateType,
  Prisma,
  UserRole,
} from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { OrganizerStorageService } from '../organizers/organizer-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  BrandProfileDto,
  CreateGeneratedMediaDto,
  CreateTemplateDto,
  ShareLinkDto,
  UpdateGeneratedMediaDto,
} from './dto/media.dto';
const defaults = [
  ['Campanha ao vivo', 'CAMPAIGN_CARD', 'STORY_9_16', 'campaign', 1080, 1920],
  ['Ganhador verificado', 'WINNER_CARD', 'STORY_9_16', 'winner', 1080, 1920],
  [
    'Cota premiada',
    'INSTANT_PRIZE_CARD',
    'SQUARE_1_1',
    'instant-prize',
    1080,
    1080,
  ],
  [
    'Kit do afiliado',
    'AFFILIATE_CARD',
    'PORTRAIT_4_5',
    'affiliate',
    1080,
    1350,
  ],
] as const;
@Injectable()
export class MediaService {
  constructor(
    private readonly p: PrismaService,
    private readonly storage: OrganizerStorageService,
  ) {}
  async templates(u: AuthenticatedUser) {
    await this.ensureTemplates();
    return this.p.mediaTemplate.findMany({
      where: {
        status: MediaTemplateStatus.ACTIVE,
        OR: [
          { organizerId: null, isSystemTemplate: true },
          { organizerId: u.id },
        ],
      },
      orderBy: [{ isSystemTemplate: 'desc' }, { sortOrder: 'asc' }],
    });
  }
  async createTemplate(
    u: AuthenticatedUser,
    d: CreateTemplateDto,
    system = false,
  ) {
    if (system && u.role !== UserRole.ADMIN) throw new ForbiddenException();
    if (!system && u.role !== UserRole.ORGANIZER)
      throw new ForbiddenException();
    this.validateDefinition(d.templateDefinition);
    return this.p.mediaTemplate.create({
      data: {
        ...d,
        organizerId: system ? null : u.id,
        isSystemTemplate: system,
        status: d.status ?? MediaTemplateStatus.ACTIVE,
        templateDefinition: d.templateDefinition as Prisma.InputJsonValue,
      },
    });
  }
  async brand(u: AuthenticatedUser) {
    this.org(u);
    const current = await this.p.organizerBrandProfile.findUnique({
      where: { organizerId: u.id },
    });
    if (current) return current;
    const profile = await this.p.organizerProfile.findUnique({
      where: { userId: u.id },
    });
    return {
      organizerId: u.id,
      primaryLogoUrl: profile?.logoStorageKey
        ? `/api/organizer/logo/${u.id}`
        : null,
      secondaryLogoUrl: null,
      primaryColor: '#6D28D9',
      secondaryColor: '#111827',
      accentColor: '#22C55E',
      textColor: '#FFFFFF',
      publicName: profile?.organizationName || u.name,
      instagramHandle: profile?.instagram || null,
      whatsappMasked: profile?.phone ? `***${profile.phone.slice(-4)}` : null,
      slogan: null,
      useSortexBranding: true,
    };
  }
  brandUpdate(u: AuthenticatedUser, d: BrandProfileDto) {
    this.org(u);
    return this.p.organizerBrandProfile.upsert({
      where: { organizerId: u.id },
      create: { organizerId: u.id, ...d },
      update: d,
    });
  }
  async create(u: AuthenticatedUser, d: CreateGeneratedMediaDto) {
    this.org(u);
    const template = await this.allowedTemplate(u, d.templateId);
    await this.validateTargets(u, d);
    const input = this.sanitizeObject(d.inputData);
    const verificationCode = await this.verification(d);
    const qrCodeValue = verificationCode
      ? `${process.env.APP_URL ?? 'http://localhost:3000'}/verificar/${verificationCode}`
      : undefined;
    return this.p.generatedMedia.create({
      data: {
        organizerId: u.id,
        templateId: template.id,
        type: template.type,
        format: template.format,
        title: this.clean(d.title),
        campaignId: d.campaignId,
        winnerId: d.winnerId,
        instantPrizeResultId: d.instantPrizeResultId,
        affiliateId: d.affiliateId,
        inputData: input as Prisma.InputJsonValue,
        editorConfig: d.editorConfig
          ? (this.sanitizeObject(d.editorConfig) as Prisma.InputJsonValue)
          : undefined,
        verificationCode,
        qrCodeValue,
      },
    });
  }
  list(u: AuthenticatedUser, status?: GeneratedMediaStatus) {
    this.org(u);
    return this.p.generatedMedia.findMany({
      where: {
        organizerId: u.id,
        deletedAt: null,
        ...(status ? { status } : {}),
      },
      include: {
        template: true,
        renderJobs: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }
  async get(u: AuthenticatedUser, id: string) {
    this.org(u);
    const m = await this.p.generatedMedia.findFirst({
      where: { id, organizerId: u.id, deletedAt: null },
      include: { template: true, renderJobs: true, shareLinks: true },
    });
    if (!m) throw new NotFoundException('Mídia não encontrada.');
    return m;
  }
  async update(u: AuthenticatedUser, id: string, d: UpdateGeneratedMediaDto) {
    await this.get(u, id);
    return this.p.generatedMedia.update({
      where: { id },
      data: {
        title: this.clean(d.title),
        inputData: d.inputData
          ? (this.sanitizeObject(d.inputData) as Prisma.InputJsonValue)
          : undefined,
        editorConfig: d.editorConfig
          ? (this.sanitizeObject(d.editorConfig) as Prisma.InputJsonValue)
          : undefined,
        status: d.status,
      },
    });
  }
  async preview(u: AuthenticatedUser, id: string) {
    const m = await this.get(u, id),
      brand = await this.brand(u);
    const svg = this.renderSvg(
      m.template.width,
      m.template.height,
      m.inputData as Record<string, unknown>,
      brand,
      m,
    );
    const stored = await this.storeSvg(u.id, `preview-${id}`, svg);
    return this.p.generatedMedia.update({
      where: { id },
      data: {
        previewUrl: `/media/generated/${id}/file/preview`,
        status: GeneratedMediaStatus.PREVIEW_READY,
        thumbnailUrl: stored.storageKey,
      },
    });
  }
  async render(u: AuthenticatedUser, id: string) {
    const m = await this.get(u, id);
    const jobType =
      m.template.type === MediaTemplateType.VIDEO_FRAME
        ? MediaRenderJobType.VIDEO
        : MediaRenderJobType.STATIC_IMAGE;
    const job = await this.p.mediaRenderJob.create({
      data: {
        generatedMediaId: id,
        jobType,
        status: MediaRenderJobStatus.QUEUED,
      },
    });
    await this.p.generatedMedia.update({
      where: { id },
      data: { status: GeneratedMediaStatus.QUEUED },
    });
    if (jobType === MediaRenderJobType.VIDEO)
      return {
        ...job,
        message: 'Vídeo enfileirado; worker pesado não configurado.',
      };
    return this.processJob(u, job.id);
  }
  async processJob(u: AuthenticatedUser, jobId: string) {
    const job = await this.p.mediaRenderJob.findFirst({
      where: { id: jobId, generatedMedia: { organizerId: u.id } },
      include: { generatedMedia: { include: { template: true } } },
    });
    if (!job) throw new NotFoundException();
    if (job.jobType === MediaRenderJobType.VIDEO)
      throw new BadRequestException(
        'Renderização pesada de vídeo não está habilitada.',
      );
    await this.p.mediaRenderJob.update({
      where: { id: job.id },
      data: {
        status: MediaRenderJobStatus.PROCESSING,
        startedAt: new Date(),
        attempts: { increment: 1 },
      },
    });
    try {
      const brand = await this.brand(u);
      const svg = this.renderSvg(
        job.generatedMedia.template.width,
        job.generatedMedia.template.height,
        job.generatedMedia.inputData as Record<string, unknown>,
        brand,
        job.generatedMedia,
      );
      const stored = await this.storeSvg(u.id, job.generatedMedia.id, svg);
      await this.p.generatedMedia.update({
        where: { id: job.generatedMedia.id },
        data: {
          status: GeneratedMediaStatus.READY,
          outputUrl: `/media/generated/${job.generatedMedia.id}/file/output`,
          thumbnailUrl: stored.storageKey,
          generatedAt: new Date(),
          errorMessage: null,
        },
      });
      return this.p.mediaRenderJob.update({
        where: { id: job.id },
        data: {
          status: MediaRenderJobStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
    } catch (e) {
      await this.p.generatedMedia.update({
        where: { id: job.generatedMedia.id },
        data: {
          status: GeneratedMediaStatus.FAILED,
          errorMessage: e instanceof Error ? e.message : 'Falha',
        },
      });
      return this.p.mediaRenderJob.update({
        where: { id: job.id },
        data: {
          status: MediaRenderJobStatus.FAILED,
          failedAt: new Date(),
          errorMessage: e instanceof Error ? e.message : 'Falha',
        },
      });
    }
  }
  async duplicate(u: AuthenticatedUser, id: string) {
    const m = await this.get(u, id);
    return this.p.generatedMedia.create({
      data: {
        organizerId: u.id,
        campaignId: m.campaignId,
        winnerId: m.winnerId,
        instantPrizeResultId: m.instantPrizeResultId,
        affiliateId: m.affiliateId,
        templateId: m.templateId,
        type: m.type,
        format: m.format,
        status: GeneratedMediaStatus.DRAFT,
        title: `Cópia de ${m.title || m.template.name}`,
        inputData: m.inputData as Prisma.InputJsonValue,
        editorConfig: (m.editorConfig as Prisma.InputJsonValue) ?? undefined,
        verificationCode: m.verificationCode,
        qrCodeValue: m.qrCodeValue,
      },
    });
  }
  async share(u: AuthenticatedUser, id: string, d: ShareLinkDto) {
    const m = await this.get(u, id);
    const code = randomBytes(6).toString('hex');
    const destination = d.destinationUrl || m.outputUrl || m.previewUrl;
    if (!destination)
      throw new BadRequestException('Gere uma prévia antes de compartilhar.');
    const link = await this.p.shareLink.create({
      data: {
        organizerId: u.id,
        generatedMediaId: id,
        campaignId: d.campaignId || m.campaignId,
        code,
        destinationUrl: destination,
        channel: d.channel,
      },
    });
    await this.audit('GeneratedMedia', id, 'SHARE_LINK_CREATED', u, {
      shareLinkId: link.id,
      channel: d.channel,
    });
    return {
      ...link,
      publicUrl: `${process.env.APP_URL ?? 'http://localhost:3000'}/s/${code}`,
    };
  }
  async click(code: string, visitor?: string) {
    const link = await this.p.shareLink.findUnique({ where: { code } });
    if (!link || (link.expiresAt && link.expiresAt < new Date()))
      throw new NotFoundException();
    const hash = visitor
      ? createHash('sha256').update(visitor).digest('hex').slice(0, 24)
      : undefined;
    const prior = hash
      ? await this.p.shareLinkClick.findFirst({
          where: { shareLinkId: link.id, visitorHash: hash },
        })
      : null;
    await this.p.$transaction([
      this.p.shareLinkClick.create({
        data: { shareLinkId: link.id, visitorHash: hash },
      }),
      this.p.shareLink.update({
        where: { id: link.id },
        data: {
          clicks: { increment: 1 },
          uniqueClicks: prior ? undefined : { increment: 1 },
        },
      }),
    ]);
    return { destinationUrl: link.destinationUrl };
  }
  async winnerContent(u: AuthenticatedUser, winnerId: string) {
    this.org(u);
    const w = await this.p.winner.findFirst({
      where: { id: winnerId, campaign: { organizerId: u.id } },
      include: { campaign: true, buyer: true },
    });
    if (!w) throw new NotFoundException();
    if (!w.publicDisclosureAuthorized)
      throw new ForbiddenException(
        'O ganhador não autorizou divulgação pública.',
      );
    return {
      winnerId: w.id,
      campaignId: w.campaignId,
      nome: w.publicDisplayName || 'Ganhador',
      cidade: w.publicCity,
      numero: w.winningNumber,
      premio: w.prizeName,
      campanha: w.campaign.title,
      status: w.status,
      codigo: w.publicVerificationCode,
      videoUrl: w.testimonialVideoUrl,
      imageUrl: w.testimonialImageUrl,
    };
  }
  async campaignContent(u: AuthenticatedUser, id: string) {
    this.org(u);
    const c = await this.p.campaign.findFirst({
      where: { id, organizerId: u.id },
      include: { organizer: { include: { organizerProfile: true } } },
    });
    if (!c) throw new NotFoundException();
    return {
      campaignId: c.id,
      campanha: c.title,
      premio: c.mainPrizeName,
      valorCota: Number(c.numberPrice),
      pix: c.cashAlternative ? Number(c.cashAlternative) : null,
      percentual: c.totalNumbers
        ? Math.round((c.soldNumbers / c.totalNumbers) * 100)
        : 0,
      data: c.drawDate,
      organizador:
        c.organizer.organizerProfile?.organizationName || c.organizer.name,
      coverImage: c.coverImage,
    };
  }
  async file(u: AuthenticatedUser, id: string) {
    const m = await this.get(u, id);
    const key = m.thumbnailUrl;
    if (!key) throw new NotFoundException();
    const path = this.storage.resolve(key);
    if (!existsSync(path)) throw new NotFoundException();
    return {
      stream: createReadStream(path),
      mimeType: 'image/svg+xml',
      name: `sortex-${id}.svg`,
    };
  }
  async archive(u: AuthenticatedUser, id: string) {
    await this.get(u, id);
    return this.p.generatedMedia.update({
      where: { id },
      data: { deletedAt: new Date(), status: GeneratedMediaStatus.CANCELLED },
    });
  }
  private async ensureTemplates() {
    if (await this.p.mediaTemplate.count({ where: { isSystemTemplate: true } }))
      return;
    for (const [d, t, f, c, w, h] of defaults)
      await this.p.mediaTemplate.create({
        data: {
          name: d,
          type: t,
          format: f,
          category: c,
          status: MediaTemplateStatus.ACTIVE,
          isSystemTemplate: true,
          width: w,
          height: h,
          templateDefinition: {
            version: 1,
            blocks: ['brand', 'title', 'content', 'verification'],
          },
          isDefault: true,
        },
      });
  }
  private async allowedTemplate(u: AuthenticatedUser, id: string) {
    const t = await this.p.mediaTemplate.findFirst({
      where: {
        id,
        status: MediaTemplateStatus.ACTIVE,
        OR: [
          { organizerId: u.id },
          { organizerId: null, isSystemTemplate: true },
        ],
      },
    });
    if (!t) throw new NotFoundException('Template não encontrado.');
    return t;
  }
  private async validateTargets(
    u: AuthenticatedUser,
    d: CreateGeneratedMediaDto,
  ) {
    if (
      d.campaignId &&
      !(await this.p.campaign.findFirst({
        where: { id: d.campaignId, organizerId: u.id },
      }))
    )
      throw new ForbiddenException();
    if (
      d.winnerId &&
      !(await this.p.winner.findFirst({
        where: { id: d.winnerId, campaign: { organizerId: u.id } },
      }))
    )
      throw new ForbiddenException();
    if (
      d.affiliateId &&
      !(await this.p.affiliate.findFirst({
        where: { id: d.affiliateId, organizerId: u.id },
      }))
    )
      throw new ForbiddenException();
  }
  private async verification(d: CreateGeneratedMediaDto) {
    if (!d.winnerId) return undefined;
    return this.p.winner
      .findUnique({
        where: { id: d.winnerId },
        select: { publicVerificationCode: true },
      })
      .then((x) => x?.publicVerificationCode);
  }
  private renderSvg(
    w: number,
    h: number,
    input: Record<string, unknown>,
    brand: any,
    m: any,
  ) {
    const title = this.xml(
      String(input.titulo || input.campanha || m.title || 'SorteX'),
    );
    const prize = this.xml(String(input.premio || ''));
    const detail = this.xml(String(input.texto || input.numero || ''));
    const verify = m.verificationCode
      ? `Verificação: ${this.xml(m.verificationCode)}`
      : 'Material oficial SorteX';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="${brand.secondaryColor}"/><rect x="${w * 0.06}" y="${h * 0.05}" width="${w * 0.88}" height="${h * 0.9}" rx="48" fill="${brand.primaryColor}"/><text x="${w * 0.1}" y="${h * 0.12}" fill="${brand.textColor}" font-family="Arial,sans-serif" font-size="${Math.round(w * 0.045)}" font-weight="700">${this.xml(brand.publicName)}</text><text x="${w * 0.9}" y="${h * 0.12}" text-anchor="end" fill="white" font-family="Arial" font-size="${Math.round(w * 0.04)}" font-weight="900">SorteX</text><text x="${w / 2}" y="${h * 0.42}" text-anchor="middle" fill="white" font-family="Arial" font-size="${Math.round(w * 0.075)}" font-weight="900">${title}</text><text x="${w / 2}" y="${h * 0.52}" text-anchor="middle" fill="${brand.accentColor}" font-family="Arial" font-size="${Math.round(w * 0.06)}" font-weight="800">${prize}</text><text x="${w / 2}" y="${h * 0.62}" text-anchor="middle" fill="white" font-family="Arial" font-size="${Math.round(w * 0.04)}">${detail}</text><rect x="${w * 0.12}" y="${h * 0.78}" width="${w * 0.76}" height="${h * 0.1}" rx="24" fill="white" fill-opacity=".14"/><text x="${w / 2}" y="${h * 0.84}" text-anchor="middle" fill="white" font-family="Arial" font-size="${Math.round(w * 0.026)}">${verify}</text></svg>`;
  }
  private async storeSvg(org: string, name: string, svg: string) {
    return this.storage.save(
      `media-${org}`,
      {
        buffer: Buffer.from(svg),
        mimetype: 'image/svg+xml',
        size: Buffer.byteLength(svg),
        originalname: `${name}.svg`,
      },
      {
        maxSize: 2 * 1024 * 1024,
        allowedMimeTypes: { 'image/svg+xml': 'svg' },
      },
    );
  }
  private sanitizeObject(v: Record<string, unknown>) {
    return JSON.parse(
      JSON.stringify(v, (k, x) => (typeof x === 'string' ? this.clean(x) : x)),
    );
  }
  private validateDefinition(v: Record<string, unknown>) {
    if (!v.version || !Array.isArray(v.blocks))
      throw new BadRequestException('Definição de template inválida.');
  }
  private clean(v?: string) {
    return v
      ?.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/[<>]/g, '')
      .trim();
  }
  private xml(v: string) {
    return v.replace(
      /[&<>"']/g,
      (c) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&apos;',
        })[c]!,
    );
  }
  private org(u: AuthenticatedUser) {
    if (u.role !== UserRole.ORGANIZER) throw new ForbiddenException();
  }
  private audit(
    entityType: string,
    entityId: string,
    action: string,
    u: AuthenticatedUser,
    metadata: any,
  ) {
    return this.p.auditLog.create({
      data: {
        entityType,
        entityId,
        action,
        actorUserId: u.id,
        actorRole: u.role,
        metadata,
      },
    });
  }
}
