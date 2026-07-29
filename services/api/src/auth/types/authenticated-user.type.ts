import {
  AdminPermission,
  AdminTeamRole,
  UserRole,
  UserStatus,
} from '@prisma/client';

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  cnpj: string | null;
  role: UserRole;
  city: string | null;
  state: string | null;
  isActive: boolean;
  status: UserStatus;
  adminPermissions: AdminPermission[];
  adminTeamRole: AdminTeamRole | null;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
  sessionId: string;
};
