import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminTeamRole, UserRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() };
  const guard = new RolesGuard(reflector as unknown as Reflector);

  function context(role?: UserRole, adminTeamRole?: AdminTeamRole) {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user: role ? { role, adminTeamRole } : undefined,
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('permite rota sem restrição de perfil', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(context())).toBe(true);
  });

  it('permite usuário com perfil autorizado', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ORGANIZER]);
    expect(guard.canActivate(context(UserRole.ORGANIZER))).toBe(true);
  });

  it('bloqueia usuário com perfil não autorizado', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    expect(() => guard.canActivate(context(UserRole.BUYER))).toThrow(
      ForbiddenException,
    );
  });

  it('bloqueia ADMIN sem vínculo com a Equipe SorteX', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    expect(() => guard.canActivate(context(UserRole.ADMIN))).toThrow(
      'Esta conta não possui acesso administrativo.',
    );
  });

  it('permite ADMIN com papel administrativo válido', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    expect(
      guard.canActivate(context(UserRole.ADMIN, AdminTeamRole.ADMIN)),
    ).toBe(true);
  });
});
