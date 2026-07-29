export type UserRole = "BUYER" | "ORGANIZER" | "ADMIN";
export type AdminPermission =
  | "USERS_READ"
  | "USERS_WRITE"
  | "ORGANIZERS_REVIEW"
  | "CAMPAIGNS_REVIEW"
  | "FINANCE_READ"
  | "FINANCE_WRITE"
  | "PAYOUTS_REVIEW"
  | "LOTTERY_RESULTS_WRITE"
  | "DRAWS_REVIEW"
  | "SETTINGS_WRITE"
  | "AUDIT_READ"
  | "SUPPORT_WRITE"
  | "CONTENT_WRITE";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  cnpj: string | null;
  role: UserRole;
  adminTeamRole?: "SUPERADMIN" | "ADMIN" | "REGISTRATION_ANALYST" | "FINANCE" | "SUPPORT" | "AUDIT" | null;
  adminPermissions?: AdminPermission[];
  city: string | null;
  state: string | null;
  isActive: boolean;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
};

export type LoginResponse = AuthTokens & { user: AuthUser };
