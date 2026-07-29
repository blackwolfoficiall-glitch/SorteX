import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { authConfig } from '../auth.config';
import type { AccessTokenPayload } from '../types/token-payload.type';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: authConfig.accessSecret(),
    });
  }

  async validate(payload: AccessTokenPayload) {
    if (payload.type !== 'access' || !payload.sid) {
      throw new UnauthorizedException('Token de acesso inválido.');
    }

    const session = await this.prisma.authSession.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { isActive: true, status: 'ACTIVE' },
      },
      select: {
        id: true,
        user: {
          select: {
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
            status: true,
            adminPermissions: true,
            adminTeamRole: true,
            verified: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!session) {
      throw new UnauthorizedException('Sessão inválida ou revogada.');
    }

    return { ...session.user, sessionId: session.id };
  }
}
