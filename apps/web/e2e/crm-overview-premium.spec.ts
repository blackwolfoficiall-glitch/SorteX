import { expect, test } from "@playwright/test";

const path = "/dashboard/crm";
const navLinks = [
  ["Visão geral", "/dashboard/crm?tab=overview"],
  ["Contatos", "/dashboard/crm/contatos"],
  ["Segmentos", "/dashboard/crm/segmentos"],
  ["Automações", "/dashboard/crm/automacoes"],
  ["Reservas abandonadas", "/dashboard/crm/reservas-abandonadas"],
  ["Tarefas", "/dashboard/crm/tarefas"],
] as const;

test("CRM overview reads organizer indicators and retains the existing destinations", async ({ page }) => {
  const methods: string[] = [];
  page.on("request", (request) => {
    if (/^\/api\/(crm|engagement|platform)\//.test(new URL(request.url()).pathname)) methods.push(request.method());
  });
  const dashboard = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/crm/dashboard");
  await page.goto(path);
  const overview = page.locator(".sx-crm-overview");
  await expect(overview.getByRole("heading", { name: "CRM SorteX" })).toBeVisible();
  const response = await dashboard;
  expect(response.ok()).toBe(true);
  const data = await response.json();
  const metrics = overview.getByRole("region", { name: "Indicadores principais" });
  await expect(metrics.locator(".sx-crm-metric").filter({ has: page.getByText("Contatos", { exact: true }) }).locator(".sx-crm-metric-value")).toHaveText(String(data.total));
  await expect(metrics.locator(".sx-crm-metric").filter({ has: page.getByText("Leads", { exact: true }) }).locator(".sx-crm-metric-value")).toHaveText(String(data.leads));
  const nav = overview.getByRole("navigation", { name: "Navegação principal do CRM" });
  if ((page.viewportSize()?.width ?? 0) === 320) {
    await expect(nav).toHaveCSS("display", "grid");
    expect((await nav.evaluate((element) => getComputedStyle(element).gridTemplateColumns)).trim().split(/\s+/)).toHaveLength(2);
  }
  for (const [name, href] of navLinks)
    await expect(nav.getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
  const selected = nav.getByRole("link", { name: "Visão geral" });
  await expect(selected).toHaveAttribute("aria-current", "page");
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await expect.poll(() => selected.evaluate((element) => {
      const { color, backgroundColor } = getComputedStyle(element);
      const luminance = (rgba: string) => {
        const channels = (rgba.match(/\d+(?:\.\d+)?/g) ?? []).slice(0, 3)
          .map((value) => Number(value) / 255)
          .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
      };
      const values = [luminance(color), luminance(backgroundColor)].sort((a, b) => b - a);
      return (values[0] + 0.05) / (values[1] + 0.05);
    })).toBeGreaterThanOrEqual(4.5);
  }
  await expect(overview.getByRole("link", { name: "Criar comunicação", exact: true }).first())
    .toHaveAttribute("href", /\/dashboard\/comunicacao\?tab=new/);
  await expect(overview.getByText("Sugestão baseada em regras do CRM, não gerada por IA. Estes atalhos não enviam mensagens.")).toBeVisible();
  const missing = (data.cities as Array<{city: string | null}>).some(({city}) => !city);
  if (missing)
    await expect(overview.getByRole("link", { name: /Cidade não informada/ }))
      .toHaveAttribute("href", "/dashboard/crm/contatos?cityMissing=1");
  await overview.getByRole("link", { name: "Ver oportunidades" }).click();
  await expect(page).toHaveURL(/\/dashboard\/crm#oportunidades$/);
  expect(methods).toContain("GET");
  expect(methods.every((method) => method === "GET")).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("CRM overview keeps faults separate from empty results and allows retry", async ({ page }) => {
  await page.route("**/api/crm/dashboard", (route) => route.fulfill({ status: 503, json: {} }), { times: 1 });
  await page.goto(path);
  const overview = page.locator(".sx-crm-overview");
  await expect(overview.getByRole("alert")).toHaveText("Não foi possível carregar esta área.");
  await expect(overview.getByRole("heading", { name: "Indicadores principais" })).toHaveCount(0);
  await overview.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(overview.getByRole("heading", { name: "Indicadores principais" })).toBeVisible();
});
