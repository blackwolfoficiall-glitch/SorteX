/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { AdminTeamRole, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { PasswordResetMailService } from './password-reset-mail.service';

const user = {
  id: 'user-1',
  name: 'Comprador Teste',
  email: 'buyer@sortex.test',
  password: '',
  phone: null,
  cpf: '52998224725',
  cnpj: null,
  role: UserRole.BUYER,
  adminTeamRole: null,
  status: UserStatus.ACTIVE,
  city: null,
  state: null,
  isActive: true,
  verified: false,
  createdAt: new Date('2026-07-10T00:00:00.000Z'),
  updatedAt: new Date('2026-07-10T00:00:00.000Z'),
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    authSession: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    passwordResetToken: {
      findUnique: jest.Mock;
      create: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let mail: { sendPasswordReset: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      authSession: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      passwordResetToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(async (operations: unknown[]) =>
        Promise.all(operations),
      ),
    };
    mail = { sendPasswordReset: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: PasswordResetMailService, useValue: mail },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    user.password = await bcrypt.hash('senha-segura', 4);
  });

  it('cadastra comprador com senha criptografada e sem expor o hash', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => {
        const { password: dataPassword, ...safeData } = data;
        const { password: userPassword, ...safeUser } = user;
        void dataPassword;
        void userPassword;
        return { ...safeUser, ...safeData };
      },
    );

    const result = await service.register({
      name: user.name,
      email: user.email.toUpperCase(),
      password: 'senha-segura',
      passwordConfirmation: 'senha-segura',
      termsAccepted: true,
      privacyAccepted: true,
      dataProcessingAccepted: true,
      phone: '5571999990000',
      cpf: user.cpf ?? undefined,
      role: UserRole.BUYER,
    });

    expect(result).not.toHaveProperty('password');
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: user.email,
        password: expect.any(String),
        role: UserRole.BUYER,
      }),
      select: expect.not.objectContaining({ password: true }),
    });
  });

  it('cadastra organizador com CPF obrigatório e CNPJ opcional', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => {
        const { password, ...safeData } = data;
        void password;
        return { ...user, ...safeData, password: undefined };
      },
    );

    await service.register({
      name: 'Organizador Teste',
      email: 'organizador@sortex.test',
      password: 'senha-segura',
      passwordConfirmation: 'senha-segura',
      termsAccepted: true,
      privacyAccepted: true,
      dataProcessingAccepted: true,
      phone: '5571999990001',
      cpf: '11144477735',
      role: UserRole.ORGANIZER,
    });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cpf: '11144477735',
        cnpj: undefined,
        role: UserRole.ORGANIZER,
      }),
      select: expect.not.objectContaining({ password: true }),
    });
  });

  it('impede cadastro público de administrador', async () => {
    await expect(
      service.register({
        name: 'Administrador',
        email: 'admin@sortex.test',
        password: 'senha-segura',
        passwordConfirmation: 'senha-segura',
        termsAccepted: true,
        privacyAccepted: true,
        dataProcessingAccepted: true,
        phone: '5571999990002',
        cpf: '52998224725',
        role: UserRole.ADMIN,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('bloqueia conta comum no login administrativo', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    await expect(
      service.adminLogin({ email: user.email, password: 'senha-segura' }),
    ).rejects.toThrow('Esta conta não possui acesso administrativo.');
    expect(prisma.authSession.create).not.toHaveBeenCalled();
  });

  it('aceita membro ativo da equipe no login administrativo', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...user,
      role: UserRole.ADMIN,
      adminTeamRole: AdminTeamRole.ADMIN,
    });
    prisma.authSession.create.mockResolvedValue({ id: 'admin-session' });
    prisma.authSession.update.mockResolvedValue({});
    const result = await service.adminLogin({
      email: user.email,
      password: 'senha-segura',
    });
    expect(result.user.role).toBe(UserRole.ADMIN);
  });

  it('informa e-mail duplicado sem mensagem genérica', async () => {
    prisma.user.findFirst.mockResolvedValue({
      email: user.email,
      cpf: '11144477735',
      cnpj: null,
    });
    await expect(
      service.register({
        name: user.name,
        email: user.email,
        password: 'senha-segura',
        passwordConfirmation: 'senha-segura',
        termsAccepted: true,
        privacyAccepted: true,
        dataProcessingAccepted: true,
        phone: '5571999990003',
        cpf: '52998224725',
        role: UserRole.BUYER,
      }),
    ).rejects.toThrow('Este e-mail já está cadastrado.');
  });

  it('informa CPF duplicado sem expor o documento', async () => {
    prisma.user.findFirst.mockResolvedValue({
      email: 'outra@sortex.test',
      cpf: '52998224725',
      cnpj: null,
    });
    await expect(
      service.register({
        name: user.name,
        email: 'novo@sortex.test',
        password: 'senha-segura',
        passwordConfirmation: 'senha-segura',
        termsAccepted: true,
        privacyAccepted: true,
        dataProcessingAccepted: true,
        phone: '5571999990004',
        cpf: '52998224725',
        role: UserRole.BUYER,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('faz login e cria uma sessão com refresh token armazenado como hash', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.authSession.create.mockResolvedValue({ id: 'session-1' });
    prisma.authSession.update.mockResolvedValue({});

    const result = await service.login({
      email: 'BUYER@SORTEX.TEST',
      password: 'senha-segura',
    });

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.user).not.toHaveProperty('password');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'buyer@sortex.test' },
    });
    expect(prisma.authSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: {
        refreshTokenHash: expect.not.stringMatching(result.refreshToken),
      },
    });
  });

  it('rejeita senha inválida sem revelar se o e-mail existe', async () => {
    prisma.user.findUnique.mockResolvedValue(user);

    await expect(
      service.login({
        email: user.email,
        password: 'senha-incorreta',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejeita login de conta desativada', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...user, isActive: false });

    await expect(
      service.login({ email: user.email, password: 'senha-segura' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rotaciona o refresh token válido', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.authSession.create.mockResolvedValue({ id: 'session-1' });
    prisma.authSession.update.mockResolvedValue({});

    const login = await service.login({
      email: user.email,
      password: 'senha-segura',
    });
    const refreshTokenHash = await bcrypt.hash(login.refreshToken, 4);

    prisma.authSession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: user.id,
      refreshTokenHash,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      user,
    });
    prisma.authSession.updateMany.mockResolvedValue({ count: 1 });

    const refreshed = await service.refresh(login.refreshToken);

    expect(refreshed.accessToken).toBeTruthy();
    expect(refreshed.refreshToken).toBeTruthy();
    expect(prisma.authSession.updateMany).toHaveBeenLastCalledWith({
      where: {
        id: 'session-1',
        refreshTokenHash,
        revokedAt: null,
      },
      data: {
        refreshTokenHash: expect.any(String),
        expiresAt: expect.any(Date),
      },
    });
  });

  it('revoga a sessão quando um refresh token antigo é reutilizado', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.authSession.create.mockResolvedValue({ id: 'session-1' });
    prisma.authSession.update.mockResolvedValue({});

    const login = await service.login({
      email: user.email,
      password: 'senha-segura',
    });

    prisma.authSession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: user.id,
      refreshTokenHash: await bcrypt.hash('outro-token', 4),
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      user,
    });

    await expect(service.refresh(login.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'session-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('revoga a sessão no logout', async () => {
    prisma.authSession.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.logout('session-1')).resolves.toEqual({
      message: 'Logout realizado com sucesso.',
    });
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'session-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('rejeita renovação concorrente do mesmo refresh token', async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.authSession.create.mockResolvedValue({ id: 'session-1' });
    prisma.authSession.update.mockResolvedValue({});

    const login = await service.login({
      email: user.email,
      password: 'senha-segura',
    });
    const refreshTokenHash = await bcrypt.hash(login.refreshToken, 4);

    prisma.authSession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: user.id,
      refreshTokenHash,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      user,
    });
    prisma.authSession.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });

    await expect(service.refresh(login.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('gera recuperação de senha sem revelar se a conta existe', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: user.id,
      email: user.email,
      name: user.name,
      isActive: true,
    });
    prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
    prisma.passwordResetToken.create.mockResolvedValue({ id: 'reset-1' });

    const result = await service.requestPasswordReset(user.email);

    expect(result.message).toContain('Se o e-mail estiver cadastrado');
    expect(mail.sendPasswordReset).toHaveBeenCalledWith(
      user.email,
      user.name,
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
    expect(prisma.passwordResetToken.create).toHaveBeenCalledWith({
      data: {
        userId: user.id,
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        expiresAt: expect.any(Date),
      },
    });
  });

  it('não revela que o e-mail não está cadastrado', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await service.requestPasswordReset('unknown@sortex.test');

    expect(result.message).toContain('Se o e-mail estiver cadastrado');
    expect(mail.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('redefine a senha, invalida tokens e encerra todas as sessões', async () => {
    const rawToken = 'a'.repeat(64);
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      id: 'reset-1',
      userId: user.id,
      tokenHash: 'hash',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      user,
    });
    prisma.user.update.mockResolvedValue({});
    prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.authSession.updateMany.mockResolvedValue({ count: 2 });

    await expect(
      service.resetPassword(rawToken, 'nova-senha-segura'),
    ).resolves.toEqual({ message: 'Senha redefinida com sucesso.' });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { password: expect.any(String) },
    });
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('rejeita token de recuperação expirado', async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      id: 'reset-1',
      userId: user.id,
      expiresAt: new Date(Date.now() - 1),
      usedAt: null,
      user,
    });

    await expect(
      service.resetPassword('a'.repeat(64), 'nova-senha-segura'),
    ).rejects.toThrow('Token inválido ou expirado.');
  });
});
