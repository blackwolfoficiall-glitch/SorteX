import { expect, test } from "@playwright/test";

const pages = [
  ["planos", "Planos"],
  ["taxas", "Taxas SorteX"],
  ["gateways", "Gateways"],
  ["conteudo", "Conteúdo"],
  ["configuracoes", "Configurações gerais"],
  ["saude", "Saúde do sistema"],
  ["auditoria", "Auditoria"],
  ["afiliados", "Afiliados"],
  ["crm", "CRM"],
  ["midia", "Mídia"],
  ["juridico", "Central Jurídica"],
] as const;

async function prepare(page: import("@playwright/test").Page) {
  await page
    .context()
    .addCookies([
      {
        name: "sortex_access_token",
        value: "admin-session",
        url: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000",
      },
    ]);
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        id: "admin-1",
        name: "Super Admin",
        email: "admin@sortex.test",
        phone: null,
        cpf: null,
        cnpj: null,
        role: "ADMIN",
        adminTeamRole: "SUPERADMIN",
        adminPermissions: [
          "FINANCE_READ",
          "FINANCE_WRITE",
          "PAYOUTS_REVIEW",
          "SETTINGS_WRITE",
          "CONTENT_WRITE",
          "AUDIT_READ",
        ],
        city: null,
        state: null,
        isActive: true,
        verified: true,
        createdAt: "2026-07-01T00:00:00Z",
        updatedAt: "2026-07-01T00:00:00Z",
      },
    }),
  );
  await page.route("**/api/legal/admin**", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route("**/api/admin/platform/**", (route) => {
    const path = new URL(route.request().url()).pathname.replace(
      "/api/admin/platform/",
      "",
    );
    if (route.request().method() !== "GET")
      return route.fulfill({ json: { id: "saved", status: "ACTIVE" } });
    if (path === "content")
      return route.fulfill({
        json: { banners: [], notices: [], pages: [], featured: [] },
      });
    if (path === "health") return route.fulfill({ json: [] });
    if (path.startsWith("audit-logs"))
      return route.fulfill({
        json: { data: [], pagination: { page: 1, pages: 1, total: 0 } },
      });
    if (path === "crm/overview")
      return route.fulfill({
        json: {
          contacts: 10,
          automations: 2,
          campaigns: 1,
          queued: 0,
          failed: 0,
        },
      });
    if (path === "media/overview")
      return route.fulfill({
        json: { templates: 2, generated: 5, failed: 0, jobs: 0, links: 1 },
      });
    if (path.endsWith("/failures")) return route.fulfill({ json: [] });
    return route.fulfill({
      json: path.startsWith("approvals")
        ? { data: [], pagination: { page: 1, pages: 1, total: 0 } }
        : [],
    });
  });
}

test.describe("Fase 6 administrativa", () => {
  for (const [path, heading] of pages) {
    test(`${heading} abre com sessão autorizada`, async ({ page }) => {
      await prepare(page);
      await page.goto(`/admin/${path}`);
      await expect(
        page.getByRole("heading", { name: heading, exact: true }),
      ).toBeVisible();
    });
  }
});
