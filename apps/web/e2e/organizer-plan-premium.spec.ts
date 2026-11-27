import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const url = "/dashboard/configuracoes/plano";
const endpoint = "/api/plans/me";
const panel = (page: Page) =>
  page.getByRole("region", { name: "Meu plano", exact: true });
const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

async function prepare(
  context: BrowserContext,
  baseURL: string,
  user: "organizer1" | "organizer2" | "buyer1",
) {
  const password = process.env.TEST_SEED_PASSWORD;
  if (!password) throw new Error("Credenciais sintéticas indisponíveis.");
  expect(
    (
      await context.request.post("/api/auth/login", {
        data: { email: `${user}@sortex.example.invalid`, password },
      })
    ).status(),
  ).toBe(200);
  const who = await context.request.get("/api/auth/me");
  expect(who.status()).toBe(200);
  expect((await who.json()).role).toBe(
    user === "buyer1" ? "BUYER" : "ORGANIZER",
  );
  const prohibited: string[] = [];
  await context.route("**/*", (intercepted) => {
    const target = new URL(intercepted.request().url());
    const method = intercepted.request().method();
    if (
      target.origin !== new URL(baseURL).origin ||
      (target.pathname.startsWith("/api/") && !["GET", "HEAD"].includes(method))
    ) {
      prohibited.push(method);
      return intercepted.abort("blockedbyclient");
    }
    return intercepted.continue();
  });
  return prohibited;
}

test.use({
  storageState: { cookies: [], origins: [] },
  trace: "off",
  screenshot: "off",
  video: "off",
});

test.describe("Meu plano Premium em modo de leitura", () => {
  test.beforeEach(async ({ baseURL }) => {
    test.skip(
      process.env.SORTEX_DISPOSABLE_ORGANIZER_PLAN !== "yes",
      "Requer planos e assinaturas sintéticos em banco descartável.",
    );
    if (!baseURL || new URL(baseURL).hostname !== "127.0.0.1")
      throw new Error("Use exclusivamente em loopback.");
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`mostra opções e assinatura sem cobranças no tema ${colorScheme}`, async ({
      page,
      context,
      baseURL,
    }, info) => {
      const prohibited = await prepare(context, baseURL!, "organizer1");
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      const currentRead = page.waitForResponse((response) =>
        response.url().endsWith(endpoint),
      );
      const catalogRead = page.waitForResponse((response) =>
        response.url().endsWith("/api/plans"),
      );
      await page.goto(url);
      const currentResponse = await currentRead;
      const catalogResponse = await catalogRead;
      expect(currentResponse.status()).toBe(200);
      expect(catalogResponse.status()).toBe(200);
      const current = await currentResponse.json();
      const plans = await catalogResponse.json();
      expect(current).toMatchObject({
        sandbox: true,
        subscription: { status: "ACTIVE", autoRenew: false },
        plan: { code: "INITIAL" },
      });
      const own = panel(page);
      await expect(own).toHaveCSS("color-scheme", colorScheme);
      await expect(
        own.getByText("Ambiente de teste", { exact: true }),
      ).toBeVisible();
      await expect(own.getByText(/Status: Ativo/)).toBeVisible();
      await expect(
        own.getByText(`${current.consumption.campaigns} campanhas`, {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        own.getByText("Mais escolhido", { exact: true }),
      ).toHaveCount(0);
      const cards = own.getByRole("article");
      await expect(cards).toHaveCount(plans.length);
      const card = cards.filter({
        has: page.getByRole("heading", {
          name: current.plan.name,
          exact: true,
        }),
      });
      await expect(card).toContainText(
        money.format(Number(current.plan.monthlyPrice)).replace(/\s/g, " "),
      );
      await expect(
        card.getByText("Plano ativo", { exact: true }),
      ).toBeVisible();
      await expect(
        card.getByRole("button", { name: "Plano atual", exact: true }),
      ).toBeDisabled();
      const sourceFeature = current.plan.features.find(
        (feature: { key: string }) => feature.key === "campaignLimit",
      );
      expect(sourceFeature).toBeDefined();
      await expect(
        card.getByText(`${sourceFeature.name}: ${sourceFeature.value}`, {
          exact: true,
        }),
      ).toBeVisible();
      const cycle = own.getByRole("combobox", { name: "Periodicidade" });
      await expect(cycle).toHaveValue("MONTHLY");
      await expect(cycle.locator("option")).toHaveText([
        "Mensal",
        "Anual",
        "Teste",
      ]);
      await cycle.focus();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(await page.evaluate(() => document.documentElement.clientWidth));
      await page.keyboard.press("Tab");
      await expect(
        own.getByRole("button", { name: "Cancelar renovação", exact: true }),
      ).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(
        own
          .getByRole("button", { name: "Escolher plano", exact: true })
          .first(),
      ).toBeFocused();
      expect(prohibited).toEqual([]);
      if (process.env.SORTEX_NAV_CAPTURE_DIR) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: `${process.env.SORTEX_NAV_CAPTURE_DIR}/organizer-plan-${info.project.name}-${colorScheme}.png`,
          animations: "disabled",
        });
      }
    });
  }

  test("separa plano em teste de outro organizador e conserva permissão e fluxo inicial", async ({
    browser,
    page,
    baseURL,
  }) => {
    for (const user of ["organizer2", "buyer1"] as const) {
      const context = await browser.newContext({
        baseURL,
        ignoreHTTPSErrors: true,
        viewport: page.viewportSize(),
        storageState: { cookies: [], origins: [] },
      });
      try {
        const prohibited = await prepare(context, baseURL!, user);
        const snapshot = await context.request.get(endpoint);
        const target = await context.newPage();
        await target.goto(url);
        if (user === "buyer1") {
          expect(snapshot.status()).toBe(403);
          await expect.poll(() => new URL(target.url()).pathname).not.toBe(url);
          await expect(panel(target)).toHaveCount(0);
        } else {
          expect(snapshot.status()).toBe(200);
          const trial = await snapshot.json();
          expect(trial).toMatchObject({
            subscription: { status: "TRIAL" },
            plan: { code: "PROFESSIONAL" },
          });
          await expect(
            panel(target).getByText(/Status: Em teste/),
          ).toBeVisible();
          await expect(
            panel(target).getByText(/Status: Cancelado/),
          ).toHaveCount(0);
          await expect(
            panel(target).getByText("Plano ativo", { exact: true }),
          ).toHaveCount(0);
          await target.goto("/organizador/escolher-plano");
          const existing = target.getByRole("heading", {
            name: "Escolha seu plano",
          });
          await expect(existing).toBeVisible();
          expect(
            await existing
              .locator("xpath=ancestor::*[@data-sx-premium]")
              .count(),
          ).toBe(0);
          await expect(
            target
              .getByRole("button", { name: "Escolher plano", exact: true })
              .first(),
          ).toBeVisible();
        }
        expect(prohibited).toEqual([]);
      } finally {
        await context.close();
      }
    }
  });
});
