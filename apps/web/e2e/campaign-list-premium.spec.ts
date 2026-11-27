import { expect, test, type Page } from "@playwright/test";
import type { Campaign } from "../lib/campaigns/types";

const pilotTitle = "Campanha Piloto de Homologação";
const otherTitle = "Rascunho Homologação";

function card(page: Page, title: string) {
  return page.getByRole("article").filter({
    has: page.getByRole("heading", { name: title, exact: true }),
  });
}

test.describe("lista Premium do organizador com PostgreSQL descartável", () => {
  test.beforeEach(async ({ baseURL, page }) => {
    test.skip(process.env.SORTEX_DISPOSABLE_CAMPAIGN_LIST !== "yes", "Requer banco e mídias sintéticos descartáveis.");
    if (!baseURL || new URL(baseURL).hostname !== "127.0.0.1")
      throw new Error("Use este teste exclusivamente com o servidor em loopback.");
    await page.route("**/api/campaigns/**", (route) =>
      ["GET", "HEAD"].includes(route.request().method())
        ? route.continue()
        : route.abort("blockedbyclient"),
    );
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`mostra campanhas do organizador e dados da API no tema ${colorScheme}`, async ({ page, baseURL }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      const [response] = await Promise.all([
        page.waitForResponse((res) => res.url().endsWith("/api/campaigns/my") && res.request().method() === "GET"),
        page.goto("/dashboard/campanhas?status=PUBLISHED"),
      ]);
      expect(response.status()).toBe(200);
      const records = (await response.json()) as Campaign[];
      const pilot = records.find(({ title }) => title === pilotTitle);
      expect(pilot).toBeDefined();
      if (!pilot) throw new Error("Campanha sintética indisponível.");
      await expect(page.getByRole("heading", { name: "Minhas Campanhas" })).toBeVisible();
      const filters = page.getByRole("group", { name: "Situação da campanha" });
      await expect(filters.getByRole("button", { name: "Publicadas" })).toHaveAttribute("aria-pressed", "true");

      const published = card(page, pilotTitle);
      await expect(published).toBeVisible();
      await expect(published).toHaveCSS("color-scheme", colorScheme);
      await expect(published.getByText("Publicada", { exact: true })).toBeVisible();
      const cover = published.getByRole("img", { name: pilotTitle, exact: true });
      await expect(cover).toHaveAttribute("src", new RegExp(`/api/campaigns/${pilot.id}/media/cover\\?v=`));
      await expect.poll(() => cover.evaluate((img: HTMLImageElement) => img.complete ? img.naturalWidth : 0)).toBeGreaterThan(0);
      const percentage = Number((pilot.totalNumbers ? Math.min(100, pilot.soldNumbers * 100 / pilot.totalNumbers) : 0).toFixed(1));
      await expect(published.getByRole("progressbar", { name: "Percentual vendido" })).toHaveAttribute("aria-valuenow", String(percentage));
      await expect(published.getByText(pilot.grossRevenue.toLocaleString("pt-BR", { currency: "BRL", style: "currency" }), { exact: true })).toBeVisible();
      await expect(published.getByRole("heading", { name: "Cotas premiadas" })).toBeVisible();
      await expect(published.getByRole("link", { name: "Editar", exact: true })).toHaveAttribute("href", `/dashboard/campanhas/${pilot.id}/editar`);
      await expect(published.getByRole("link", { name: "Abrir campanha" })).toHaveAttribute("href", `/campanha/${pilot.slug}`);
      await expect(published.getByRole("textbox", { name: "Link público da campanha" })).toHaveValue(`${baseURL}/campanha/${pilot.slug}`);
      // Inspect actions without executing mutations.
      for (const name of ["Duplicar", "Pausar", "Encerrar"]) {
        await expect(published.getByRole("button", { name, exact: true })).toBeEnabled();
      }
      const share = published.getByRole("button", { name: "Compartilhar", exact: true });
      await share.click();
      await expect(published.getByRole("link", { name: "WhatsApp" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => document.documentElement.clientWidth));
      await share.click();
      await expect(card(page, otherTitle)).toHaveCount(0);

      const query = page.getByRole("searchbox", { name: "Pesquisar campanha" });
      await query.fill("busca sem correspondência QA");
      await expect(page.getByRole("heading", { name: "Nenhuma campanha encontrada" })).toBeVisible();
      await expect(published).toHaveCount(0);
      await query.fill("PILOTO");
      await expect(published).toBeVisible();
      const sorting = page.getByRole("group", { name: "Ordenar campanhas" });
      await sorting.getByRole("button", { name: "Mais vendidos" }).click();
      await expect(sorting.getByRole("button", { name: "Mais vendidos" })).toHaveAttribute("aria-pressed", "true");
      await filters.getByRole("button", { name: "Rascunhos" }).click();
      await expect(published).toHaveCount(0);
      await filters.getByRole("button", { name: "Todas" }).click();
      await expect(published).toBeVisible();
      // Real keyboard focus progression to another action at the bottom of the card.
      const pause = published.getByRole("button", { name: "Pausar", exact: true });
      const end = published.getByRole("button", { name: "Encerrar", exact: true });
      await pause.focus();
      await page.keyboard.press("Tab");
      await expect(end).toBeFocused();
      const quickTabs = page.getByRole("navigation", { name: "Navegação rápida do organizador" });
      if (await quickTabs.isVisible()) {
        await expect.poll(async () => {
          const tabs = (await quickTabs.boundingBox())!;
          const action = (await end.boundingBox())!;
          return tabs.y - action.y - action.height;
        }).toBeGreaterThanOrEqual(4);
      }
      const capture = process.env.SORTEX_NAV_CAPTURE_DIR;
      if (capture) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: `${capture}/campaign-list-${test.info().project.name}-${colorScheme}.png`,
          fullPage: true,
          animations: "disabled",
        });
      }
    });
  }

  test("segunda conta vê apenas suas campanhas e não pode ler a capa privada da primeira", async ({ browser, baseURL, page }) => {
    const first = await page.request.get("/api/campaigns/my");
    expect(first.status()).toBe(200);
    const pilot = ((await first.json()) as Campaign[]).find(({ title }) => title === pilotTitle);
    if (!pilot) throw new Error("Campanha sintética indisponível.");
    const email = process.env.E2E_SECOND_ORGANIZER_EMAIL;
    const password = process.env.E2E_SECOND_ORGANIZER_PASSWORD;
    if (!email || !password) throw new Error("Segunda sessão sintética indisponível.");
    const context = await browser.newContext({ baseURL, ignoreHTTPSErrors: true, storageState: { cookies: [], origins: [] } });
    try {
      const auth = await context.request.post("/api/auth/login", { data: { email, password } });
      expect(auth.status()).toBe(200);
      const visitor = await context.newPage();
      await visitor.goto("/dashboard/campanhas?status=DRAFT");
      const draft = card(visitor, otherTitle);
      await expect(draft.getByText("Rascunho", { exact: true })).toBeVisible();
      await expect(draft.getByRole("link", { name: "Editar", exact: true })).toBeVisible();
      await expect(draft.getByRole("button", { name: "Excluir", exact: true })).toBeEnabled();
      await expect(card(visitor, pilotTitle)).toHaveCount(0);
      const second = await context.request.get("/api/campaigns/my");
      expect(second.status()).toBe(200);
      expect((await second.json()) as Campaign[]).not.toEqual(expect.arrayContaining([expect.objectContaining({id: pilot.id})]));
      expect((await context.request.get(`/api/campaigns/${pilot.id}/media/cover`)).status()).toBe(403);
    } finally {
      await context.close();
    }
  });

  test("não confunde falha de rede com lista vazia e recupera dados reais", async ({ page }) => {
    await page.route("**/api/campaigns/my", (route) => route.abort("failed"), { times: 1 });
    await page.goto("/dashboard/campanhas");
    const content = page.getByRole("region", { name: "Minhas Campanhas" });
    await expect(content.getByRole("alert")).toContainText("Não foi possível carregar suas campanhas.");
    await expect(page.getByRole("heading", { name: "Nenhuma campanha encontrada" })).toHaveCount(0);
    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(card(page, pilotTitle)).toBeVisible();
    await expect(content.getByRole("alert")).toHaveCount(0);

    await page.route(/\/api\/campaigns\/[^/]+\/media\/cover\?/, (route) => route.abort("failed"));
    await page.reload();
    const published = card(page, pilotTitle);
    await expect(published).toBeVisible();
    await expect(published.getByRole("img", { name: pilotTitle, exact: true })).toHaveCount(0);
    await expect(published.getByRole("link", { name: "Editar", exact: true })).toBeVisible();
  });
});
