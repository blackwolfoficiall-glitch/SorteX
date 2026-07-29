import { AdminPermission, AdminTeamRole } from '@prisma/client';
import {
  ADMIN_ROLE_PERMISSIONS,
  effectiveAdminPermissions,
  permissionsForAdminRole,
} from './admin-authorization.policy';

describe('admin authorization policy', () => {
  it('mantém uma matriz explícita para todos os papéis administrativos', () => {
    expect(Object.keys(ADMIN_ROLE_PERMISSIONS).sort()).toEqual(
      Object.values(AdminTeamRole).sort(),
    );
  });

  it.each([
    [
      AdminTeamRole.REGISTRATION_ANALYST,
      [AdminPermission.USERS_READ, AdminPermission.ORGANIZERS_REVIEW],
    ],
    [
      AdminTeamRole.FINANCE,
      [
        AdminPermission.FINANCE_READ,
        AdminPermission.FINANCE_WRITE,
        AdminPermission.PAYOUTS_REVIEW,
      ],
    ],
    [
      AdminTeamRole.SUPPORT,
      [AdminPermission.USERS_READ, AdminPermission.SUPPORT_WRITE],
    ],
    [AdminTeamRole.AUDIT, [AdminPermission.AUDIT_READ]],
  ])('atribui somente as permissões do papel %s', (role, expected) => {
    expect(permissionsForAdminRole(role)).toEqual(expected);
  });

  it('concede todas as permissões somente ao SUPERADMIN', () => {
    expect(permissionsForAdminRole(AdminTeamRole.SUPERADMIN).sort()).toEqual(
      Object.values(AdminPermission).sort(),
    );
  });

  it('remove permissões atribuídas fora da matriz do papel', () => {
    expect(
      effectiveAdminPermissions(AdminTeamRole.SUPPORT, [
        AdminPermission.SUPPORT_WRITE,
        AdminPermission.FINANCE_WRITE,
      ]),
    ).toEqual([AdminPermission.SUPPORT_WRITE]);
  });

  it('não concede permissão sem papel administrativo', () => {
    expect(
      effectiveAdminPermissions(null, [AdminPermission.USERS_READ]),
    ).toEqual([]);
  });
});
