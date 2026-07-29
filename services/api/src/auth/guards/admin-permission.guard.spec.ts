import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminPermission, AdminTeamRole, UserRole } from '@prisma/client';
import { AdminPermissionGuard } from './admin-permission.guard';
describe('AdminPermissionGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
  const prisma: any = { user: { findUnique: jest.fn() } };
  const guard = new AdminPermissionGuard(reflector, prisma);
  const context = (role: UserRole, id = 'u') =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({ user: { id, role } }) }),
    }) as unknown as ExecutionContext;
  beforeEach(() => jest.clearAllMocks());
  it('libera rota sem permissão específica', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    await expect(guard.canActivate(context(UserRole.BUYER))).resolves.toBe(
      true,
    );
  });
  it('bloqueia BUYER em rota administrativa', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      AdminPermission.USERS_READ,
    ]);
    await expect(guard.canActivate(context(UserRole.BUYER))).rejects.toThrow(
      ForbiddenException,
    );
  });
  it('bloqueia ORGANIZER em rota administrativa', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      AdminPermission.USERS_READ,
    ]);
    await expect(
      guard.canActivate(context(UserRole.ORGANIZER)),
    ).rejects.toThrow(ForbiddenException);
  });
  it('libera Superadministrador sem lista granular de permissões', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      AdminPermission.USERS_READ,
    ]);
    prisma.user.findUnique.mockResolvedValue({
      adminPermissions: [],
      adminTeamRole: AdminTeamRole.SUPERADMIN,
    });
    await expect(guard.canActivate(context(UserRole.ADMIN))).resolves.toBe(
      true,
    );
  });
  it('bloqueia administrador comum sem permissões atribuídas', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      AdminPermission.USERS_READ,
    ]);
    prisma.user.findUnique.mockResolvedValue({
      adminPermissions: [],
      adminTeamRole: AdminTeamRole.ADMIN,
    });
    await expect(guard.canActivate(context(UserRole.ADMIN))).rejects.toThrow(
      'Nenhuma permissão administrativa atribuída',
    );
  });
  it('exige todas as permissões configuradas', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([
      AdminPermission.USERS_READ,
      AdminPermission.USERS_WRITE,
    ]);
    prisma.user.findUnique.mockResolvedValue({
      adminPermissions: [AdminPermission.USERS_READ],
      adminTeamRole: AdminTeamRole.ADMIN,
    });
    await expect(guard.canActivate(context(UserRole.ADMIN))).rejects.toThrow(
      'Permissão administrativa insuficiente',
    );
  });
});
