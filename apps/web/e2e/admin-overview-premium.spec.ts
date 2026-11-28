import { expect, test, type Page } from "@playwright/test";

const path = "/api/admin/platform/dashboard";
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

async function login(page: Page) {
  await page.context().clearCookies();
  const result = await page.request.post("/api/auth/admin-login", { data: { email, password } });
  expect(result.ok()).toBe(true);
}

test("Admin home displays BFF metrics and preserves read-only period navigation", async ({ page }) => {
  test.skip(!email || !password, "Requer administrador sintético por E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD.");
  const methods: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/admin/")) methods.push(request.method());
  });
  await login(page);
  const dashboard = page.waitForResponse((response) => new URL(response.url()).pathname === path);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  const view = page.locator(".sx-admin-overview");
  await expect(view.getByRole("heading", { name: "Painel administrativo" })).toBeVisible();
  const response = await dashboard;
  expect(response.ok()).toBe(true);
  const data = await response.json();
  const counts = view.getByRole("region", { name: "Operação da plataforma" });
  const metric = (scope: typeof view, label: string) => scope.getByText(label, { exact: true }).locator("..").locator("dd");
  await expect(metric(counts, "Compradores")).toHaveText(Number(data.totals.buyers).toLocaleString("pt-BR"));
  const finance = view.getByRole("region", { name: "Indicadores financeiros" });
  await expect(metric(finance, "GMV")).toContainText(money.format(Number(data.totals.gmv)));
  await expect(finance.getByText(/API pode retornar o acumulado/)).toBeVisible();
  const ranks = view.getByRole("region", { name: "Campanhas com maior faturamento" });
  await expect(ranks.getByText("Ranking acumulado, sem filtro de datas.")).toBeVisible();
  if (data.topCampaigns.length) {
    await expect(ranks.locator("li").first()).toContainText(data.topCampaigns[0].title);
    await expect(ranks.locator("li").first()).toContainText(money.format(Number(data.topCampaigns[0].grossRevenue)));
  }
  const series = view.getByRole("region", { name: "Novos usuários" });
  await expect(series.getByText(/dia UTC/)).toBeVisible();
  if (data.series.users.length) {
    await series.locator("summary").click();
    await expect(series.locator("time")).toHaveCount(data.series.users.length);
  }
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await expect(view).toHaveCSS("color-scheme", "dark");
  const period = view.getByLabel("Período", { exact: true });
  const switchRange = page.waitForResponse((reply) => {
    const url = new URL(reply.url());
    return url.pathname === path && url.searchParams.has("from");
  });
  await period.selectOption("1");
  const selectedRange = await switchRange;
  expect(selectedRange.ok()).toBe(true);
  const selectedAfter = await selectedRange.json();
  await expect(metric(counts, "Compradores")).toHaveText(Number(selectedAfter.totals.buyers).toLocaleString("pt-BR"));
  expect(methods).toEqual(["GET", "GET"]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("Admin home never substitutes zeros for an unavailable result", async ({ page }) => {
  test.skip(!email || !password, "Requer administrador sintético por E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD.");
  await login(page);
  await page.route("**/api/admin/platform/dashboard?*", (route) => route.fulfill({ status: 503, json: {} }), { times: 1 });
  await page.goto("/admin");
  const view = page.locator(".sx-admin-overview");
  await expect(view.getByRole("alert")).toHaveText("Não foi possível consultar os indicadores do painel.");
  await expect(view.getByRole("region", { name: "Operação da plataforma" })).toHaveCount(0);
  await view.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(view.getByRole("region", { name: "Operação da plataforma" })).toBeVisible();
});
