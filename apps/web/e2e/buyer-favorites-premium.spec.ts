import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const endpoint = "/api/buyer/favorites/private";
const url = "/comprador/favoritos";
const pilot = "Campanha Piloto de Homologação";
const rewards = "[HOMOLOGAÇÃO] Premiações públicas sintéticas";
const region = (page: Page) => page.getByRole("region", { name: "Favoritos", exact: true });

async function prepare(context: BrowserContext, baseURL: string, buyer: number) {
  const password = process.env.E2E_BUYER_PASSWORD;
  if (!password) throw new Error("Credenciais sintéticas indisponíveis.");
  const signed = await context.request.post("/api/auth/login", {
    data: { email: `buyer${buyer}@sortex.example.invalid`, password },
  });
  expect(signed.status()).toBe(200);
  const who = await context.request.get("/api/auth/me");
  expect(who.status()).toBe(200);
  expect((await who.json()).role).toBe("BUYER");
  const writes: string[] = [];
  await context.route("**/*", (intercepted) => {
    const target = new URL(intercepted.request().url());
    const method = intercepted.request().method();
    if (target.origin !== new URL(baseURL).origin) return intercepted.abort("blockedbyclient");
    if (target.pathname.startsWith("/api/") && !["GET", "HEAD"].includes(method)) {
      writes.push(method);
      return intercepted.abort("blockedbyclient");
    }
    return intercepted.continue();
  });
  return writes;
}

test.use({ storageState: { cookies: [], origins: [] }, trace: "off", screenshot: "off", video: "off" });

test.describe("favoritos Premium do comprador em modo de leitura", () => {
  test.beforeEach(async ({ baseURL }) => {
    test.skip(process.env.SORTEX_DISPOSABLE_FAVORITES !== "yes", "Requer banco local e favoritos sintéticos.");
    if (!baseURL || new URL(baseURL).hostname !== "127.0.0.1") throw new Error("Use exclusivamente em loopback.");
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`mantém campanha, filtros do servidor e teclado no tema ${colorScheme}`, async ({ page, context, baseURL }, info) => {
      const writes = await prepare(context, baseURL!, 1);
      const response = await context.request.get(endpoint);
      expect(response.status()).toBe(200);
      const before = await response.json();
      expect(before).toHaveLength(1);
      const campaign = before[0].campaign;
      expect(campaign.title).toBe(pilot);
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      let release = () => {};
      const wait = new Promise<void>((resolve) => { release = resolve; });
      await page.route(`**${endpoint}`, async (route) => { await wait; await route.continue(); }, { times: 1 });
      const panel = region(page);
      try {
        await page.goto(url);
        await expect(panel.getByRole("status")).toHaveText("Atualizando favoritos…");
      } finally {
        release();
      }
      await expect(panel).toHaveCSS("color-scheme", colorScheme);
      await expect(panel).toHaveAttribute("aria-busy", "false");
      await expect(panel.getByRole("link", { name: "Ver sorteios" })).toHaveAttribute("href", "/comprador/sorteios");
      const list = panel.getByRole("list", { name: "Campanhas favoritas" });
      const card = list.getByRole("link");
      await expect(list.getByRole("listitem")).toHaveCount(1);
      await expect(card.getByRole("heading", { name: pilot })).toBeVisible();
      await expect(card).toHaveAttribute("href", `/campanha/${campaign.slug}`);
      await expect(card.getByText(`R$ ${campaign.numberPrice.toFixed(2).replace(".", ",")}`, { exact: true })).toBeVisible();
      await expect(card.getByText(`${campaign.soldPercentage}% vendido`, { exact: true })).toBeVisible();
      await expect(panel.getByText("Rascunho Homologação", { exact: true })).toHaveCount(0);
      await expect(panel.getByText(rewards, { exact: true })).toHaveCount(0);
      const remove = panel.getByRole("button", { name: `Remover dos favoritos: ${pilot}` });
      const refresh = panel.getByRole("button", { name: "Atualizar favoritos" });
      await card.focus();
      await page.keyboard.press("Tab");
      await expect(remove).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(refresh).toBeFocused();
      if ((page.viewportSize()?.width ?? 0) <= 320) {
        const nav = page.getByRole("navigation").filter({ has: page.getByRole("link", { name: "Perfil", exact: true }) });
        const participate = nav.getByRole("link", { name: "Participar", exact: true });
        await expect.poll(async () => {
          const bound = (await refresh.boundingBox())!;
          return Math.min((await nav.boundingBox())!.y, (await participate.boundingBox())!.y) - (bound.y + bound.height);
        }).toBeGreaterThanOrEqual(4);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => document.documentElement.clientWidth));
      const retry = page.waitForResponse((r) => r.url().endsWith(endpoint) && r.request().method() === "GET");
      await refresh.click();
      expect(await (await retry).json()).toEqual(before);
      expect(writes).toEqual([]);
      if (process.env.SORTEX_NAV_CAPTURE_DIR) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: `${process.env.SORTEX_NAV_CAPTURE_DIR}/favorites-${info.project.name}-${colorScheme}.png`,
          fullPage: true,
          animations: "disabled",
        });
      }
    });
  }

  test("isola listas de compradores e diferencia falha de lista vazia", async ({ browser, baseURL, page: viewportSource }) => {
    for (const buyer of [2, 3]) {
      const context = await browser.newContext({ baseURL, ignoreHTTPSErrors: true, viewport: viewportSource.viewportSize(), storageState: { cookies: [], origins: [] } });
      try {
        const writes = await prepare(context, baseURL!, buyer);
        const page = await context.newPage();
        if (buyer === 2) await page.route(`**${endpoint}`, (route) => route.abort("failed"), { times: 1 });
        await page.goto(url);
        const panel = region(page);
        const empty = panel.getByText("Nenhuma campanha pública salva.", { exact: true });
        if (buyer === 2) {
          await expect(panel.getByRole("alert")).toContainText("Não foi possível carregar seus favoritos.");
          await expect(empty).toHaveCount(0);
          await panel.getByRole("button", { name: "Tentar novamente" }).click();
          await expect(panel.getByRole("heading", { name: rewards })).toBeVisible();
          await expect(panel.getByRole("alert")).toHaveCount(0);
        } else {
          await expect(empty).toBeVisible();
          await expect(panel.getByRole("list", { name: "Campanhas favoritas" })).toHaveCount(0);
        }
        await expect(panel.getByRole("heading", { name: pilot })).toHaveCount(0);
        expect(writes).toEqual([]);
      } finally {
        await context.close();
      }
    }
  });
});
