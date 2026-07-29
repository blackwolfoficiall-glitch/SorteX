import type { AdminPermission, AuthUser } from "@/lib/auth/types";

type AdminRouteRule = {
  path: string;
  permission?: AdminPermission;
};

export const ADMIN_ROUTE_PERMISSIONS: readonly AdminRouteRule[] = [
  { path: "/admin/dashboard" },
  { path: "/admin/aprovacoes", permission: "ORGANIZERS_REVIEW" },
  { path: "/admin/organizadores", permission: "ORGANIZERS_REVIEW" },
  { path: "/admin/campanhas", permission: "CAMPAIGNS_REVIEW" },
  { path: "/admin/usuarios", permission: "USERS_READ" },
  { path: "/admin/pagamentos", permission: "FINANCE_READ" },
  { path: "/admin/denuncias", permission: "SUPPORT_WRITE" },
  { path: "/admin/ganhadores", permission: "DRAWS_REVIEW" },
  { path: "/admin/financeiro", permission: "FINANCE_READ" },
  { path: "/admin/planos", permission: "SETTINGS_WRITE" },
  { path: "/admin/taxas", permission: "FINANCE_WRITE" },
  { path: "/admin/gateways", permission: "FINANCE_READ" },
  { path: "/admin/equipe", permission: "USERS_READ" },
  { path: "/admin/auditoria", permission: "AUDIT_READ" },
  { path: "/admin/configuracoes", permission: "SETTINGS_WRITE" },
  { path: "/admin/conteudo", permission: "CONTENT_WRITE" },
  { path: "/admin/suporte", permission: "SUPPORT_WRITE" },
  { path: "/admin/saude", permission: "AUDIT_READ" },
  { path: "/admin/juridico", permission: "SETTINGS_WRITE" },
  { path: "/admin/afiliados", permission: "FINANCE_READ" },
  { path: "/admin/crm", permission: "AUDIT_READ" },
  { path: "/admin/midia", permission: "CONTENT_WRITE" },
  { path: "/admin/loteria", permission: "LOTTERY_RESULTS_WRITE" },
] as const;

export function requiredPermissionForAdminPath(pathname: string) {
  return ADMIN_ROUTE_PERMISSIONS.filter(
    (rule) => pathname === rule.path || pathname.startsWith(`${rule.path}/`),
  ).sort((first, second) => second.path.length - first.path.length)[0]
    ?.permission;
}

export function hasAdminPermission(
  user: Pick<AuthUser, "adminTeamRole" | "adminPermissions">,
  permission?: AdminPermission,
) {
  if (!permission) return true;
  if (user.adminTeamRole === "SUPERADMIN") return true;
  return user.adminPermissions?.includes(permission) ?? false;
}
