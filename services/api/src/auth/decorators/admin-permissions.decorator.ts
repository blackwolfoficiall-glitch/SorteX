import { SetMetadata } from '@nestjs/common';
import { AdminPermission } from '@prisma/client';
export const ADMIN_PERMISSIONS_KEY = 'adminPermissions';
export const AdminPermissions = (...permissions: AdminPermission[]) =>
  SetMetadata(ADMIN_PERMISSIONS_KEY, permissions);
