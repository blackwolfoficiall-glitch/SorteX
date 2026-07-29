import { AdminPermission, AdminTeamRole } from '@prisma/client';

const ALL_ADMIN_PERMISSIONS = Object.values(AdminPermission);

export const ADMIN_ROLE_PERMISSIONS: Readonly<
  Record<AdminTeamRole, readonly AdminPermission[]>
> = {
  [AdminTeamRole.SUPERADMIN]: ALL_ADMIN_PERMISSIONS,
  [AdminTeamRole.ADMIN]: [
    AdminPermission.USERS_READ,
    AdminPermission.USERS_WRITE,
    AdminPermission.ORGANIZERS_REVIEW,
    AdminPermission.CAMPAIGNS_REVIEW,
    AdminPermission.FINANCE_READ,
  ],
  [AdminTeamRole.REGISTRATION_ANALYST]: [
    AdminPermission.USERS_READ,
    AdminPermission.ORGANIZERS_REVIEW,
  ],
  [AdminTeamRole.FINANCE]: [
    AdminPermission.FINANCE_READ,
    AdminPermission.FINANCE_WRITE,
    AdminPermission.PAYOUTS_REVIEW,
  ],
  [AdminTeamRole.SUPPORT]: [
    AdminPermission.USERS_READ,
    AdminPermission.SUPPORT_WRITE,
  ],
  [AdminTeamRole.AUDIT]: [AdminPermission.AUDIT_READ],
};

export function permissionsForAdminRole(
  role: AdminTeamRole | null | undefined,
): AdminPermission[] {
  return role ? [...ADMIN_ROLE_PERMISSIONS[role]] : [];
}

export function effectiveAdminPermissions(
  role: AdminTeamRole | null | undefined,
  assigned: readonly AdminPermission[] = [],
): AdminPermission[] {
  if (!role) return [];
  if (role === AdminTeamRole.SUPERADMIN)
    return permissionsForAdminRole(AdminTeamRole.SUPERADMIN);
  const allowed = new Set(ADMIN_ROLE_PERMISSIONS[role]);
  return assigned.filter((permission) => allowed.has(permission));
}
