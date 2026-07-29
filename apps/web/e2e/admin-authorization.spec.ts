import { expect, test } from "@playwright/test";
import type { AdminPermission } from "@/lib/auth/types";

type AdminRole =
  | "SUPERADMIN"
  | "ADMIN"
  | "REGISTRATION_ANALYST"
  | "FINANCE"
  | "SUPPORT"
  | "AUDIT";

const permissions: Record<AdminRole, AdminPermission[]> = {
  SUPERADMIN: [
    "USERS_READ",
    "USERS_WRITE",
    "ORGANIZERS_REVIEW",
    "CAMPAIGNS_REVIEW",
    "FINANCE_READ",
    "FINANCE_WRITE",
    "PAYOUTS_REVIEW",
    "LOTTERY_RESULTS_WRITE",
    "DRAWS_REVIEW",
    "SETTINGS_WRITE",
    "AUDIT_READ",
    "SUPPORT_WRITE",
    "CONTENT_WRITE",
  ],
  ADMIN: [
    "USERS_READ",
    "USERS_WRITE",
    "ORGANIZERS_REVIEW",
    "CAMPAIGNS_REVIEW",
    "FINANCE_READ",
  ],
  REGISTRATION_ANALYST: ["USERS_READ", "ORGANIZERS_REVIEW"],
  FINANCE: ["FINANCE_READ", "FINANCE_WRITE", "PAYOUTS_REVIEW"],
  SUPPORT: ["USERS_READ", "SUPPORT_WRITE"],
  AUDIT: ["AUDIT_READ"],
};

async function mockAdminSession(
  page: import("@playwright/test").Page,
  role: AdminRole,
) {
  await page.context().addCookies([
    {
      name: "sortex_access_token",
      value: "e2e-admin-session",
      url: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000",
    },
  ]);
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: `admin-${role}`,
        name: role,
        email: `${role.toLowerCase()}@sortex.test`,
        phone: null,
        cpf: null,
        cnpj: null,
        role: "ADMIN",
        adminTeamRole: role,
        adminPermissions: permissions[role],
        city: null,
        state: null,
        isActive: true,
        verified: true,
        createdAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-01T00:00:00.000Z",
      }),
    }),
  );
  await page.route("**/api/admin/platform/dashboard**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        totals: {},
        series: { users: [], campaigns: [] },
        topCampaigns: [],
        alerts: [],
        balances: {},
      }),
    }),
  );
}

test.describe("matriz administrativa", () => {
  for (const role of Object.keys(permissions) as AdminRole[]) {
    test(`${role} visualiza somente menus permitidos`, async ({ page }) => {
      await mockAdminSession(page, role);
      await page.goto("/admin/dashboard");
      await expect(
        page.getByRole("heading", { name: "Painel administrativo" }),
      ).toBeVisible();

      const canSeeApprovals =
        role === "SUPERADMIN" ||
        permissions[role].includes("ORGANIZERS_REVIEW");
      const canSeeFinance =
        role === "SUPERADMIN" || permissions[role].includes("FINANCE_READ");
      const canSeeAudit =
        role === "SUPERADMIN" || permissions[role].includes("AUDIT_READ");

      await expect(page.getByRole("link", { name: "Aprovações" })).toHaveCount(
        canSeeApprovals ? 1 : 0,
      );
      await expect(page.getByRole("link", { name: "Financeiro" })).toHaveCount(
        canSeeFinance ? 1 : 0,
      );
      await expect(page.getByRole("link", { name: "Auditoria" })).toHaveCount(
        canSeeAudit ? 1 : 0,
      );
    });
  }

  test("bloqueia acesso direto quando a permissão da página não existe", async ({
    page,
  }) => {
    await mockAdminSession(page, "SUPPORT");
    await page.goto("/admin/financeiro");
    await expect(
      page.getByRole("heading", { name: "Acesso não autorizado" }),
    ).toBeVisible();
    await expect(page.getByText("Controle financeiro")).toHaveCount(0);
  });
});
