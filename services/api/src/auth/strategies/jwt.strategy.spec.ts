import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const prisma = {
    authSession: { findFirst: jest.fn() },
  };
  const strategy = new JwtStrategy(prisma as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it('valida access token e devolve usuário seguro da sessão ativa', async () => {
    const user = {
      id: 'user-1',
      name: 'Organizador',
      email: 'organizer@sortex.test',
      phone: null,
      cpf: null,
      cnpj: '12345678000100',
      role: UserRole.ORGANIZER,
      city: null,
      state: null,
      isActive: true,
      verified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    prisma.authSession.findFirst.mockResolvedValue({ id: 'session-1', user });

    await expect(
      strategy.validate({
        sub: user.id,
        sid: 'session-1',
        role: user.role,
        type: 'access',
      }),
    ).resolves.toEqual({ ...user, sessionId: 'session-1' });
  });

  it('rejeita token de refresh usado como access token', async () => {
    await expect(
      strategy.validate({
        sub: 'user-1',
        sid: 'session-1',
        role: UserRole.BUYER,
        type: 'refresh' as 'access',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejeita sessão revogada, expirada ou inexistente', async () => {
    prisma.authSession.findFirst.mockResolvedValue(null);

    await expect(
      strategy.validate({
        sub: 'user-1',
        sid: 'session-1',
        role: UserRole.BUYER,
        type: 'access',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
