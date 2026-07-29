import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { authConfig } from './auth.config';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  CompleteCheckoutBuyerDto,
  MiniBuyerDto,
} from './dto/checkout-buyer.dto';
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
} from './types/token-payload.type';
import { PasswordResetMailService } from './password-reset-mail.service';

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  cpf: true,
  cnpj: true,
  role: true,
  city: true,
  state: true,
  isActive: true,
  verified: true,
  createdAt: true,
  updatedAt: true,
} as const;

type SessionMetadata = {
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly passwordResetMail: PasswordResetMailService,
  ) {}

  async users() {
    return this.prisma.user.findMany({ select: publicUserSelect });
  }

  async register(data: RegisterDto) {
    const role = data.role ?? UserRole.BUYER;
    const cpf = data.cpf.replace(/\D/g, '');
    const phone = data.phone.replace(/\D/g, '');
    const cnpj = data.cnpj?.replace(/\D/g, '');

    if (data.password !== data.passwordConfirmation) {
      throw new BadRequestException('As senhas não conferem.');
    }

    if (!data.termsAccepted) {
      throw new BadRequestException('Aceite os Termos de Uso para continuar.');
    }
    if (!data.privacyAccepted || !data.dataProcessingAccepted) {
      throw new BadRequestException(
        'Aceite a Política de Privacidade e o tratamento de dados para continuar.',
      );
    }

    if (!this.isValidCpf(cpf)) {
      throw new BadRequestException('CPF inválido.');
    }

    if (role === UserRole.ADMIN) {
      throw new ForbiddenException(
        'Administradores não podem ser criados pelo cadastro público.',
      );
    }

    if ((role === UserRole.BUYER || role === UserRole.ORGANIZER) && !cpf) {
      throw new BadRequestException(
        'CPF é obrigatório para compradores e organizadores.',
      );
    }

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: data.email.toLowerCase() },
          { cpf },
          ...(cnpj ? [{ cnpj }] : []),
        ],
      },
      select: { email: true, cpf: true, cnpj: true },
    });

    if (existingUser) {
      if (existingUser.email === data.email.toLowerCase()) {
        throw new ConflictException('Este e-mail já está cadastrado.');
      }
      if (existingUser.cpf === cpf) {
        throw new ConflictException('Este CPF já está cadastrado.');
      }
      throw new ConflictException('Este CNPJ já está cadastrado.');
    }

    const password = await bcrypt.hash(data.password, 12);

    return this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        password,
        phone,
        cpf,
        cnpj,
        role,
        city: data.city,
        state: data.state,
        consentRecords: {
          create: [
            { type: 'TERMS', version: 'cadastro', granted: true },
            { type: 'PRIVACY', version: 'cadastro', granted: true },
            { type: 'DATA_PROCESSING', version: 'cadastro', granted: true },
          ],
        },
      },
      select: publicUserSelect,
    });
  }

  async lookupBuyerByPhone(value: string) {
    const phone = this.normalizeBrazilPhone(value);
    const user = await this.prisma.user.findFirst({
      where: { phone: { in: [phone, phone.slice(2)] } },
      select: { email: true, role: true, isActive: true },
    });
    if (!user) return { exists: false };
    return {
      exists: true,
      canContinue: user.role === UserRole.BUYER && user.isActive,
      maskedEmail: this.maskEmail(user.email),
    };
  }

  async registerMiniBuyer(data: MiniBuyerDto) {
    if (data.password !== data.passwordConfirmation) {
      throw new BadRequestException('As senhas não conferem.');
    }
    if (!data.termsAccepted) {
      throw new BadRequestException('Aceite os termos para continuar.');
    }
    const phone = this.normalizeBrazilPhone(data.phone);
    const email = data.email.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { phone: { in: [phone, phone.slice(2)] } }] },
      select: { email: true, phone: true },
    });
    if (existing?.email === email) {
      throw new ConflictException(
        'Este e-mail já está cadastrado. Entre na sua conta para continuar.',
      );
    }
    if (existing) {
      throw new ConflictException(
        'Este WhatsApp já está cadastrado. Entre na sua conta para continuar.',
      );
    }
    return this.prisma.user.create({
      data: {
        name: data.name.trim(),
        email,
        phone,
        password: await bcrypt.hash(data.password, 12),
        role: UserRole.BUYER,
      },
      select: publicUserSelect,
    });
  }

  async startCheckout(value: string, metadata: SessionMetadata = {}) {
    const phone = this.normalizeBrazilPhone(value);
    const existing = await this.prisma.user.findFirst({
      where: { phone: { in: [phone, phone.slice(2)] } },
      select: { email: true, role: true, isActive: true },
    });
    if (existing)
      return {
        existing: true,
        canContinue: existing.role === UserRole.BUYER && existing.isActive,
        maskedEmail: this.maskEmail(existing.email),
      };
    const secret = randomBytes(32).toString('hex');
    const email = `checkout-${createHash('sha256').update(phone).digest('hex').slice(0, 24)}@temporary.sortex.local`;
    await this.prisma.user.create({
      data: {
        name: 'Comprador',
        email,
        phone,
        password: await bcrypt.hash(secret, 12),
        role: UserRole.BUYER,
      },
    });
    const session = await this.login({ email, password: secret }, metadata);
    return { ...session, existing: false, temporary: true };
  }

  async completeCheckoutBuyer(userId: string, data: CompleteCheckoutBuyerDto) {
    if (data.password !== data.passwordConfirmation)
      throw new BadRequestException('As senhas não conferem.');
    const payment = await this.prisma.payment.findFirst({
      where: { id: data.paymentId, buyerId: userId, status: 'APPROVED' },
      select: { id: true },
    });
    if (!payment)
      throw new ForbiddenException('O pagamento ainda não foi confirmado.');
    const current = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!current.email.endsWith('@temporary.sortex.local'))
      return this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: publicUserSelect,
      });
    const email = data.email.trim().toLowerCase();
    const owner = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (owner && owner.id !== userId)
      throw new ConflictException('Este e-mail já está cadastrado.');
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name.trim(),
        city: data.city.trim(),
        state: data.state,
        email,
        password: await bcrypt.hash(data.password, 12),
      },
      select: publicUserSelect,
    });
  }

  private normalizeBrazilPhone(value: string) {
    const digits = value.replace(/\D/g, '');
    const normalized = digits.startsWith('55') ? digits : `55${digits}`;
    if (!/^55\d{10,11}$/.test(normalized)) {
      throw new BadRequestException('Telefone brasileiro inválido.');
    }
    return normalized;
  }

  private maskEmail(value: string) {
    const [name, domain] = value.split('@');
    return `${name.slice(0, 2)}${'*'.repeat(Math.max(2, name.length - 2))}@${domain}`;
  }

  private isValidCpf(value: string) {
    if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;
    const digit = (length: number) => {
      let total = 0;
      for (let index = 0; index < length; index += 1) {
        total += Number(value[index]) * (length + 1 - index);
      }
      const remainder = (total * 10) % 11;
      return remainder === 10 ? 0 : remainder;
    };
    return digit(9) === Number(value[9]) && digit(10) === Number(value[10]);
  }

  async login(
    data: LoginDto,
    metadata: SessionMetadata = {},
    adminOnly = false,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    if (!user || !(await bcrypt.compare(data.password, user.password))) {
      if (user) {
        const attempts = user.failedLoginAttempts + 1;
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: attempts,
            lockedUntil:
              attempts >= Number(process.env.AUTH_MAX_LOGIN_ATTEMPTS || 5)
                ? new Date(
                    Date.now() +
                      Number(process.env.AUTH_LOCKOUT_MINUTES || 15) * 60000,
                  )
                : undefined,
          },
        });
        await this.securityAudit(
          user.id,
          adminOnly ? 'ADMIN_LOGIN_FAILED' : 'LOGIN_FAILED',
          metadata,
        );
      } else if (adminOnly) {
        await this.prisma.auditLog.create({
          data: {
            entityType: 'SECURITY',
            entityId: createHash('sha256')
              .update(data.email.toLowerCase())
              .digest('hex')
              .slice(0, 20),
            action: 'ADMIN_LOGIN_FAILED',
            metadata: {
              ipHash: metadata.ipAddress
                ? createHash('sha256')
                    .update(metadata.ipAddress)
                    .digest('hex')
                    .slice(0, 20)
                : undefined,
              userAgent: metadata.userAgent?.slice(0, 180),
            },
          },
        });
      }
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    if (adminOnly && (user.role !== UserRole.ADMIN || !user.adminTeamRole)) {
      await this.securityAudit(user.id, 'ADMIN_LOGIN_DENIED', metadata);
      throw new ForbiddenException(
        'Esta conta não possui acesso administrativo.',
      );
    }

    if (!user.isActive || user.status !== 'ACTIVE') {
      throw new ForbiddenException(
        adminOnly
          ? 'Seu acesso administrativo está desativado.'
          : 'Esta conta está desativada.',
      );
    }

    const expiresAt = this.refreshTokenExpirationDate();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastAccessAt: new Date(),
      },
    });
    const session = await this.prisma.authSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: 'pending',
        expiresAt,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
      select: { id: true },
    });

    const tokens = await this.issueTokens(user.id, user.role, session.id);

    await this.prisma.authSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: await bcrypt.hash(tokens.refreshToken, 12),
      },
    });
    await this.securityAudit(
      user.id,
      adminOnly ? 'ADMIN_LOGIN_SUCCEEDED' : 'LOGIN_SUCCEEDED',
      metadata,
      session.id,
    );

    const { password, ...safeUser } = user;
    void password;
    return { user: safeUser, ...tokens };
  }

  adminLogin(data: LoginDto, metadata: SessionMetadata = {}) {
    return this.login(data, metadata, true);
  }

  async refresh(refreshToken: string) {
    const payload = await this.verifyRefreshToken(refreshToken);
    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sid },
      include: { user: true },
    });

    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !session.user.isActive
    ) {
      throw new UnauthorizedException('Sessão inválida ou expirada.');
    }

    const matches = await bcrypt.compare(
      refreshToken,
      session.refreshTokenHash,
    );

    if (!matches) {
      await this.revokeSession(session.id);
      throw new UnauthorizedException('Refresh token inválido ou reutilizado.');
    }

    const tokens = await this.issueTokens(
      session.user.id,
      session.user.role,
      session.id,
    );

    const rotated = await this.prisma.authSession.updateMany({
      where: {
        id: session.id,
        refreshTokenHash: session.refreshTokenHash,
        revokedAt: null,
      },
      data: {
        refreshTokenHash: await bcrypt.hash(tokens.refreshToken, 12),
        expiresAt: this.refreshTokenExpirationDate(),
      },
    });

    if (rotated.count !== 1) {
      await this.revokeSession(session.id);
      throw new UnauthorizedException('Refresh token já utilizado.');
    }

    return tokens;
  }

  async logout(sessionId: string) {
    const session = await this.prisma.authSession.findUnique({
      where: { id: sessionId },
      select: { user: { select: { id: true, role: true } } },
    });
    await this.revokeSession(sessionId);
    if (session?.user)
      await this.securityAudit(
        session.user.id,
        session.user.role === UserRole.ADMIN ? 'ADMIN_LOGOUT' : 'LOGOUT',
        {},
        sessionId,
      );
    return { message: 'Logout realizado com sucesso.' };
  }

  async logoutAll(userId: string) {
    await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.securityAudit(userId, 'LOGOUT_ALL', {});
    return { message: 'Todas as sessões foram encerradas.' };
  }

  sessions(userId: string) {
    return this.prisma.authSession.findMany({
      where: { userId },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        expiresAt: true,
        revokedAt: true,
        ipAddress: true,
        userAgent: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeOwnedSession(userId: string, sessionId: string) {
    const result = await this.prisma.authSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (!result.count) throw new BadRequestException('Sessão não encontrada.');
    await this.securityAudit(userId, 'SESSION_REVOKED', {}, sessionId);
    return { message: 'Sessão encerrada.' };
  }

  async requestPasswordReset(email: string) {
    const normalizedEmail = email.toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, name: true, isActive: true },
    });

    const response = {
      message:
        'Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação.',
    };

    if (!user?.isActive) {
      return response;
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashResetToken(token);
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + authConfig.passwordResetTtlSeconds() * 1000,
    );

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: now },
      }),
      this.prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      }),
    ]);

    await this.passwordResetMail.sendPasswordReset(
      user.email,
      user.name,
      token,
    );

    return response;
  }

  async resetPassword(token: string, password: string) {
    const now = new Date();
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.hashResetToken(token) },
      include: { user: true },
    });

    if (
      !resetToken ||
      resetToken.usedAt ||
      resetToken.expiresAt <= now ||
      !resetToken.user.isActive
    ) {
      throw new BadRequestException('Token inválido ou expirado.');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: passwordHash },
      }),
      this.prisma.passwordResetToken.updateMany({
        where: { userId: resetToken.userId, usedAt: null },
        data: { usedAt: now },
      }),
      this.prisma.authSession.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: now },
      }),
    ]);

    return { message: 'Senha redefinida com sucesso.' };
  }

  private async issueTokens(userId: string, role: UserRole, sessionId: string) {
    const accessPayload: AccessTokenPayload = {
      sub: userId,
      sid: sessionId,
      role,
      type: 'access',
    };
    const refreshPayload: RefreshTokenPayload = {
      sub: userId,
      sid: sessionId,
      role,
      type: 'refresh',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: authConfig.accessSecret(),
        expiresIn: authConfig.accessTokenTtlSeconds(),
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: authConfig.refreshSecret(),
        expiresIn: authConfig.refreshTokenTtlSeconds(),
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer' as const,
      expiresIn: authConfig.accessTokenTtlSeconds(),
    };
  }

  private async verifyRefreshToken(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        token,
        { secret: authConfig.refreshSecret() },
      );

      if (payload.type !== 'refresh' || !payload.sid) {
        throw new UnauthorizedException('Refresh token inválido.');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Refresh token inválido ou expirado.');
    }
  }

  private refreshTokenExpirationDate() {
    return new Date(Date.now() + authConfig.refreshTokenTtlSeconds() * 1000);
  }

  private async revokeSession(sessionId: string) {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private hashResetToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private securityAudit(
    userId: string,
    action: string,
    metadata: SessionMetadata,
    sessionId?: string,
  ) {
    if (!(this.prisma as any).auditLog?.create) return Promise.resolve();
    return this.prisma.auditLog.create({
      data: {
        entityType: 'SECURITY',
        entityId: userId,
        action,
        actorUserId: userId,
        metadata: {
          sessionId,
          ipHash: metadata.ipAddress
            ? createHash('sha256')
                .update(metadata.ipAddress)
                .digest('hex')
                .slice(0, 20)
            : undefined,
          userAgent: metadata.userAgent?.slice(0, 180),
        },
      },
    });
  }
}
