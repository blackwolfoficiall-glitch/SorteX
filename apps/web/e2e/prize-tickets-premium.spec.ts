import { expect, test, type Locator, type Page } from "@playwright/test";

const url = "/dashboard/ganhadores";
const endpoint = "/api/draws/organizer/prize-tickets";
const expected = [
  "Cota sintética zero", "Cota sintética pausada", "Cota sintética encontrada",
  "Cota sintética entregue", "Cota sintética reservada",
];
const foreign = "Cota do outro organizador";
const pilot = "Campanha Piloto de Homologação";
const findCard = (scope: Page | Locator, name: string) =>
  scope.getByRole("article").filter({ hasText: name });

test.describe("Cotas Premiadas Premium somente leitura", () => {
  test.beforeEach(async ({ page, baseURL }) => {
    test.skip(process.env.SORTEX_DISPOSABLE_PRIZE_TICKETS !== "yes", "Requer fixtures em PostgreSQL descartável.");
    if (!baseURL || new URL(baseURL).hostname !== "127.0.0.1") throw new Error("Use exclusivamente em loopback.");
    await page.route("**/api/**", (route) =>
      ["GET", "HEAD"].includes(route.request().method()) ? route.continue() : route.abort("blockedbyclient"),
    );
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`preserva zero, escopo, ações elegíveis e dialog no tema ${colorScheme}`, async ({ page }, info) => {
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      const [res] = await Promise.all([
        page.waitForResponse((r) => /\/api\/draws\/organizer\/prize-tickets\?/.test(r.url()) && r.ok()),
        page.goto(url),
      ]);
      const actual = await res.json();
      expect(actual.items).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: "seed-premium-prize-zero", exactNumber: "0000", value: 0, status: "AVAILABLE", reservation: null }),
        expect.objectContaining({ id: "seed-premium-prize-reserved", status: "AVAILABLE", reservation: expect.objectContaining({ purchaseId: "seed-premium-prize-reservation" }) }),
      ]));
      const region = page.getByRole("region", { name: "Cotas premiadas", exact: true });
      await expect(region).toHaveCSS("color-scheme", colorScheme);
      const zero = findCard(region, expected[0]);
      await expect(zero.getByRole("heading", { name: "0000", exact: true })).toBeVisible();
      await expect(zero.getByText("R$ 0,00", { exact: true })).toBeVisible();
      await expect(zero.getByRole("button", { name: "Pausar", exact: true })).toBeEnabled();
      await expect(findCard(region, expected[1]).getByRole("button", { name: "Reativar", exact: true })).toBeEnabled();
      for (const name of expected.slice(2)) {
        const restricted = findCard(region, name);
        await expect(restricted).toBeVisible();
        await expect(restricted.getByRole("button", { name: /^(Editar|Pausar|Reativar)$/ })).toHaveCount(0);
      }
      await expect(findCard(region, expected[4]).getByText("Reservada", { exact: true }).first()).toBeVisible();
      await expect(findCard(region, foreign)).toHaveCount(0);
      await expect(region.getByRole("button", { name: "Filtrar por Todas" })).toHaveAttribute("aria-pressed", "true");

      const opener = zero.getByRole("button", { name: "Editar", exact: true });
      await opener.focus();
      await page.keyboard.press("Enter");
      const editor = page.getByRole("dialog", { name: "Editar cota premiada" });
      await expect(editor).toHaveCSS("color-scheme", colorScheme);
      await expect(editor.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "3");
      await expect(editor.getByRole("textbox", { name: "Nome do prêmio" })).toHaveValue(expected[0]);
      await expect(editor.getByRole("spinbutton", { name: "Valor estimado" })).toHaveValue("0");
      await expect(editor.getByRole("button", { name: "Fechar", exact: true })).toBeFocused();
      await page.keyboard.press("Tab");
      expect(await editor.evaluate((node) => node.contains(document.activeElement))).toBe(true);
      await page.keyboard.press("Escape");
      await expect(editor).toHaveCount(0);
      await expect(opener).toBeFocused();

      const status = region.getByRole("button", { name: "Filtrar por Entregues" });
      await status.click();
      await expect(page).toHaveURL(/status=delivered/);
      await expect(region.getByRole("heading", { name: "Prêmios entregues", exact: true })).toBeVisible();
      await expect(findCard(region, expected[3])).toBeVisible();
      await expect(zero).toHaveCount(0);
      await region.getByRole("button", { name: "Filtrar por Todas" }).click();
      await expect(zero).toBeVisible();

      const create = region.getByRole("button", { name: "Adicionar cota premiada", exact: true });
      await create.focus();
      await page.keyboard.press("Enter");
      const creator = page.getByRole("dialog", { name: "Adicionar cota premiada" });
      await expect(creator.getByRole("button", { name: new RegExp(pilot) })).toBeEnabled();
      await creator.getByRole("button", { name: "Avançar", exact: true }).click();
      await expect(creator.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
      await creator.getByRole("textbox", { name: "Número da cota" }).fill("0000");
      await expect(creator.getByRole("textbox", { name: "Número da cota" })).toHaveValue("0000");
      await creator.getByRole("button", { name: "Aleatório", exact: true }).click();
      const count = creator.getByRole("spinbutton", { name: "Quantidade de números" });
      await count.fill("0");
      await expect(creator.getByRole("button", { name: "Avançar", exact: true })).toBeDisabled();
      await count.fill("101");
      await expect(creator.getByRole("button", { name: "Avançar", exact: true })).toBeDisabled();
      await count.fill("1");
      await expect(creator.getByRole("button", { name: "Avançar", exact: true })).toBeEnabled();

      await page.keyboard.press("Escape");
      await expect(create).toBeFocused();
      if ((page.viewportSize()?.width ?? 0) < 768) {
        await region.getByRole("button", { name: "Abrir", exact: true }).click();
        await expect(region.getByRole("combobox", { name: "Campanha", exact: true })).toBeVisible();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => document.documentElement.clientWidth));
      const identical = await page.request.get(endpoint);
      expect((await identical.json()).items).toEqual(actual.items);
      if (process.env.SORTEX_NAV_CAPTURE_DIR) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: `${process.env.SORTEX_NAV_CAPTURE_DIR}/prizes-${info.project.name}-${colorScheme}.png`,
          fullPage: true,
          animations: "disabled",
        });
      }
    });
  }

  test("rede recupera status reais; organizador diferente não lê cota alheia", async ({ page, browser, baseURL }) => {
    await page.route("**/api/draws/organizer/prize-tickets?**", (route) => route.abort("failed"), { times: 1 });
    await page.goto(url);
    await expect(page.getByRole("heading", { name: "Não foi possível carregar as cotas premiadas." })).toBeVisible();
    await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
    await expect(findCard(page, expected[0])).toBeVisible();
    const history = `${endpoint}/seed-premium-prize-zero/history`;
    expect((await page.request.get(history)).status()).toBe(200);
    const email = process.env.E2E_SECOND_ORGANIZER_EMAIL;
    const password = process.env.E2E_SECOND_ORGANIZER_PASSWORD;
    if (!email || !password) throw new Error("Segunda conta sintética indisponível.");
    const other = await browser.newContext({ baseURL, ignoreHTTPSErrors: true, storageState: { cookies: [], origins: [] } });
    try {
      expect((await other.request.post("/api/auth/login", { data: { email, password } })).status()).toBe(200);
      expect((await other.request.get(history)).status()).toBe(404);
      const visitor = await other.newPage();
      await visitor.goto(url);
      await expect(findCard(visitor, foreign)).toBeVisible();
      await expect(findCard(visitor, expected[0])).toHaveCount(0);
    } finally {
      await other.close();
    }
  });
});
