import { expect, test } from "@playwright/test";

const path = "/dashboard/promocoes";

test("Promoções reports API indicators, opens its editor by keyboard and prevents an invalid write", async ({ page }) => {
  const methods: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/platform/promotions")) methods.push(request.method());
  });
  const state = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/platform/promotions/dashboard");
  await page.goto(path);
  const root = page.locator(".sx-promo");
  await expect(root.getByRole("heading", { name: "Promoções", exact: true })).toBeVisible();
  const response = await state;
  expect(response.ok()).toBe(true);
  const metrics = root.getByRole("region", { name: "Indicadores de promoções" });
  await expect(metrics.getByText("Utilizações", { exact: true }).locator("..")).toContainText(String((await response.json()).usages));
  await expect(metrics.getByText("Sem dados de visualizações")).toBeVisible();
  await expect(root.getByText("Sugestão baseada em regras")).toBeVisible();

  await page.emulateMedia({ colorScheme: "dark" });
  await expect(root).toHaveCSS("color-scheme", "dark");
  const button = root.getByRole("button", { name: "Criar estratégia", exact: true });
  await button.focus();
  await page.keyboard.press("Enter");
  const catalog = root.getByRole("dialog", { name: "Criar estratégia" });
  await expect(catalog.getByRole("button", { name: "Fechar", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(catalog.getByRole("button", { name: "Criar", exact: true }).last()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(catalog).toBeHidden();
  await expect(button).toBeFocused();
  await page.keyboard.press("Enter");
  const bonus = catalog.locator("article").filter({ has: page.getByRole("heading", { name: "Bônus por quantidade" }) });
  await expect(bonus.getByText("Sem benefício automático no checkout.")).toBeVisible();
  await bonus.getByRole("button", { name: "Criar", exact: true }).click();

  const wizard = root.getByRole("dialog", { name: "Nova estratégia" });
  await expect(wizard.getByRole("button", { name: "Fechar", exact: true })).toBeFocused();
  const next = wizard.getByRole("button", { name: "Avançar", exact: true });
  await next.click();
  await next.click();
  await wizard.getByLabel("Nome da estratégia").fill("");
  for (let step = 3; step < 7; step++) await next.click();
  await expect(wizard.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "7");
  await expect(wizard.getByRole("button", { name: "Agendar", exact: true })).toBeDisabled();
  await wizard.getByRole("button", { name: "Salvar como rascunho", exact: true }).click();
  await expect(wizard.getByRole("alert")).toHaveText("Informe o nome e a campanha da estratégia.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(await wizard.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(wizard).toBeHidden();
  expect(methods.length).toBeGreaterThan(0);
  expect(methods.every((method) => method === "GET")).toBe(true);
});

test("Promoções does not show fallback zero or a false empty result when the API fails", async ({ page }) => {
  await page.route("**/api/platform/promotions/dashboard", (route) => route.fulfill({ status: 503, json: {} }), { times: 1 });
  await page.goto(path);
  const root = page.locator(".sx-promo");
  await expect(root.getByRole("alert")).toHaveText("Não foi possível carregar as estratégias.");
  await expect(root.getByText("Você ainda não criou nenhuma estratégia.")).toHaveCount(0);
  await expect(root.getByRole("region", { name: "Indicadores de promoções" }).getByText("Indisponível").first()).toBeVisible();
  await root.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(root.getByText("Sugestão baseada em regras")).toBeVisible();
  await expect(root.getByRole("alert")).toHaveCount(0);
});
