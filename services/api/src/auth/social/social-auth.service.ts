import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth.service';
import { RegisterDto } from '../dto/register.dto';
import {
  digest,
  OidcClient,
  providerConfig,
  providerDefinition,
  type SocialProvider,
} from './oidc-client';
const random = () => randomBytes(32).toString('base64url');
function proof(value: unknown) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value))
    throw new UnauthorizedException('Inicie o acesso novamente.');
  return value;
}
export function socialProvider(value: string): SocialProvider {
  if (value !== 'google' && value !== 'apple')
    throw new BadRequestException('Provedor inválido.');
  return value;
}

@Injectable()
export class SocialAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly oidc: OidcClient,
  ) {}
  availability() {
    return Object.fromEntries(
      (['google', 'apple'] as const).map((provider) => {
        try {
          providerConfig(provider);
          return [provider, { enabled: true }];
        } catch {
          return [
            provider,
            { enabled: false, reason: 'Configuração externa pendente' },
          ];
        }
      }),
    );
  }
  async start(provider: SocialProvider, browserProof: string) {
    const config = providerConfig(provider);
    const browserHash = digest(proof(browserProof));
    const active = await this.prisma.socialAuthAttempt.count({
      where: { browserHash, completedAt: null, expiresAt: { gt: new Date() } },
    });
    if (active >= 8)
      throw new BadRequestException(
        'Aguarde alguns minutos antes de tentar novamente.',
      );
    // Remove personal/transient material from expired challenges, retaining only
    // a spent audit envelope. Identity/session/account records are not touched.
    await this.prisma.socialAuthAttempt.updateMany({
      where: {
        expiresAt: { lt: new Date() },
        OR: [
          { nonce: { not: '' } },
          { email: { not: null } },
          { subject: { not: null } },
        ],
      },
      data: {
        email: null,
        name: null,
        subject: null,
        nonce: '',
        verifier: '',
        ticketHash: null,
      },
    });
    const state = random(),
      nonce = random(),
      verifier = random();
    await this.prisma.socialAuthAttempt.create({
      data: {
        id: digest(state),
        provider,
        browserHash,
        nonce,
        verifier,
        expiresAt: new Date(Date.now() + 600000),
      },
    });
    const url = new URL(providerDefinition[provider].authorization);
    const params = {
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope:
        provider === 'google' ? 'openid email profile' : 'openid email name',
      state,
      nonce,
    };
    Object.entries(params).forEach(([key, value]) =>
      url.searchParams.set(key, value),
    );
    if (provider === 'google') {
      url.searchParams.set(
        'code_challenge',
        Buffer.from(digest(verifier), 'hex').toString('base64url'),
      );
      url.searchParams.set('code_challenge_method', 'S256');
    } else url.searchParams.set('response_mode', 'form_post');
    return { authorizationUrl: url.toString() };
  }
  async callback(
    provider: SocialProvider,
    body: {
      state: string;
      code: string;
      browserProof: string;
      nameHint?: string;
    },
  ) {
    const id = digest(proof(body.state)),
      browserHash = digest(proof(body.browserProof));
    if (
      typeof body.code !== 'string' ||
      body.code.length < 1 ||
      body.code.length > 4096
    )
      throw new BadRequestException('Resposta do provedor inválida.');
    const claim = await this.prisma.socialAuthAttempt.updateMany({
      where: {
        id,
        provider,
        browserHash,
        claimedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { claimedAt: new Date() },
    });
    if (claim.count !== 1)
      throw new UnauthorizedException(
        'Acesso expirado ou já utilizado. Inicie novamente.',
      );
    const attempt = await this.prisma.socialAuthAttempt.findUniqueOrThrow({
      where: { id },
    });
    const identity = await this.oidc.exchange(
      provider,
      body.code,
      attempt.nonce,
      attempt.verifier,
    );
    const existing = await this.prisma.socialIdentity.findUnique({
      where: { provider_subject: { provider, subject: identity.subject } },
    });
    if (existing) {
      const tokens = await this.prisma.$transaction(
        (tx) => this.auth.socialSession(existing.userId, tx),
        { timeout: 15000 },
      );
      await this.prisma.socialAuthAttempt.update({
        where: { id },
        data: { nonce: '', verifier: '', completedAt: new Date() },
      });
      return { kind: 'session', ...tokens };
    }
    // Email coincidence never links an existing SorteX user.
    if (!identity.email)
      throw new UnauthorizedException(
        'O provedor não forneceu um e-mail verificado. Use e-mail e senha.',
      );
    const ticket = random();
    // Apple's first response can include a name outside the signed token. It is
    // only an editable form hint; it never establishes identity or email.
    const name =
      identity.name ||
      (provider === 'apple' && typeof body.nameHint === 'string'
        ? body.nameHint.trim().slice(0, 120)
        : null);
    await this.prisma.socialAuthAttempt.update({
      where: { id },
      data: {
        subject: identity.subject,
        email: identity.email,
        name,
        nonce: '',
        verifier: '',
        ticketHash: digest(ticket),
        expiresAt: new Date(Date.now() + 900000),
      },
    });
    return { kind: 'registration', registrationToken: ticket };
  }
  private async pending(ticket: string, browserProof: string) {
    const attempt = await this.prisma.socialAuthAttempt.findFirst({
      where: {
        ticketHash: digest(proof(ticket)),
        browserHash: digest(proof(browserProof)),
        expiresAt: { gt: new Date() },
        completedAt: null,
        subject: { not: null },
        email: { not: null },
      },
    });
    if (!attempt)
      throw new UnauthorizedException(
        'O acesso social expirou. Inicie novamente.',
      );
    return attempt;
  }
  async details(ticket: string, browserProof: string) {
    const attempt = await this.pending(ticket, browserProof);
    const conflict = await this.prisma.user.findUnique({
      where: { email: attempt.email! },
      select: { id: true },
    });
    return {
      provider: attempt.provider,
      email: attempt.email,
      name: attempt.name,
      linkRequired: Boolean(conflict),
    };
  }
  async complete(
    ticket: string,
    browserProof: string,
    fields: Record<string, unknown>,
  ) {
    const attempt = await this.pending(ticket, browserProof);
    if (
      !fields ||
      typeof fields !== 'object' ||
      Array.isArray(fields) ||
      ['email', 'password', 'passwordConfirmation'].some((k) => k in fields)
    )
      throw new BadRequestException('Envie somente os dados complementares.');
    const password = randomBytes(48).toString('base64url'); // unknown to anyone; no credential is derived from provider data
    if (fields.role === undefined || fields.role === null) {
      throw new BadRequestException(
        'Escolha Comprador ou Organizador para concluir o cadastro.',
      );
    }
    const dto = plainToInstance(RegisterDto, {
      ...fields,
      email: attempt.email,
      password,
      passwordConfirmation: password,
    });
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length)
      throw new BadRequestException(
        errors.flatMap((error) => Object.values(error.constraints ?? {})),
      );
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const claimed = await tx.socialAuthAttempt.updateMany({
            where: {
              id: attempt.id,
              completedAt: null,
              expiresAt: { gt: new Date() },
            },
            data: {
              completedAt: new Date(),
              email: null,
              name: null,
              subject: null,
              ticketHash: null,
            },
          });
          if (claimed.count !== 1)
            throw new UnauthorizedException(
              'Cadastro já concluído ou expirado.',
            );
          const user = await this.auth.register(dto, tx);
          await tx.socialIdentity.create({
            data: {
              provider: attempt.provider,
              subject: attempt.subject!,
              userId: user.id,
              providerEmail: attempt.email,
            },
          });
          return this.auth.socialSession(user.id, tx);
        },
        { timeout: 15000 },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'Identidade ou cadastro já existente. Entre na conta original para vincular.',
        );
      throw error;
    }
  }
  async link(
    ticket: string,
    browserProof: string,
    user: { id: string; sessionId: string; role: string },
  ) {
    const attempt = await this.pending(ticket, browserProof);
    if (user.role === 'ADMIN')
      throw new BadRequestException(
        'Contas administrativas mantêm o acesso específico.',
      );
    const session = await this.prisma.authSession.findFirst({
      where: {
        id: user.sessionId,
        userId: user.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        createdAt: { gt: new Date(Date.now() - 600000) },
      },
    });
    if (!session)
      throw new UnauthorizedException(
        'Entre novamente antes de vincular a identidade.',
      );
    try {
      await this.prisma.$transaction(async (tx) => {
        const claim = await tx.socialAuthAttempt.updateMany({
          where: {
            id: attempt.id,
            completedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: {
            completedAt: new Date(),
            email: null,
            name: null,
            subject: null,
            ticketHash: null,
          },
        });
        if (claim.count !== 1)
          throw new UnauthorizedException('Vínculo expirado ou já utilizado.');
        await tx.socialIdentity.create({
          data: {
            provider: attempt.provider,
            subject: attempt.subject!,
            userId: user.id,
            providerEmail: attempt.email,
          },
        });
        await tx.auditLog.create({
          data: {
            entityType: 'User',
            entityId: user.id,
            action: 'SOCIAL_IDENTITY_LINKED',
            actorUserId: user.id,
            metadata: { provider: attempt.provider },
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'Esta identidade ou provedor já possui vínculo. Nenhuma conta foi unida.',
        );
      throw error;
    }
    return { linked: true };
  }
}
