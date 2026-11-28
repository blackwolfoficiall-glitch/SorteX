import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const adminEndpoint = "/api/draws/admin/lottery-draws";
const url = "/dashboard/sorteios";
const panel = (page: Page) =>
  page.getByRole("region", { name: "Motor de sorteios", exact: true });

async function prepare(
  context: BrowserContext,
  baseURL: string,
  user: "organizer1" | "organizer2" | "buyer1" | "admin",
) {
  const password = process.env.TEST_SEED_PASSWORD;
  if (!password) throw new Error("Credenciais sintéticas indisponíveis.");
  expect(
    (
      await context.request.post(
        user === "admin" ? "/api/auth/admin-login" : "/api/auth/login",
        {
          data: { email: `${user}@sortex.example.invalid`, password },
        },
      )
    ).status(),
  ).toBe(200);
  const who = await context.request.get("/api/auth/me");
  expect(who.status()).toBe(200);
  expect((await who.json()).role).toBe(
    user === "admin"
      ? "ADMIN"
      : user.startsWith("organizer")
        ? "ORGANIZER"
        : "BUYER",
  );
  const prohibited: string[] = [];
  await context.route("**/*", (intercepted) => {
    const target = new URL(intercepted.request().url());
    const method = intercepted.request().method();
    if (
      target.origin !== new URL(baseURL).origin ||
      (target.pathname.startsWith("/api/") &&
        (!["GET", "HEAD"].includes(method) ||
          target.pathname.includes("/import/")))
    ) {
      prohibited.push(method);
      return intercepted.abort("blockedbyclient");
    }
    return intercepted.continue();
  });
  return prohibited;
}

async function qualifyingDraw(context: BrowserContext) {
  const list = await context.request.get("/api/campaigns/my");
  expect(list.status()).toBe(200);
  const campaign = ((await list.json()) as { id: string; slug: string }[]).find(
    ({ slug }) => slug === "campanha-piloto-homologacao",
  );
  if (!campaign)
    throw new Error("Campanha exclusivamente sintética indisponível.");
  const path = `/api/draws/campaigns/${campaign.id}/draw`;
  const result = await context.request.get(path);
  expect(result.status()).toBe(200);
  const draw = await result.json();
  expect(draw).toMatchObject({
    status: "CONFIRMED",
    normalizedWinningNumber: "00314",
    auditHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    lotteryDraw: {
      extractionNumber: "TEST-0001",
      status: "VERIFIED",
      firstPrize: "00314",
    },
  });
  return { path };
}

test.use({
  storageState: { cookies: [], origins: [] },
  trace: "off",
  screenshot: "off",
  video: "off",
});

test.describe("apuração Premium do organizador em modo de leitura", () => {
  test.beforeEach(async ({ baseURL }) => {
    test.skip(
      process.env.SORTEX_DISPOSABLE_APURACAO !== "yes",
      "Requer ambiente local e extração sintética.",
    );
    if (!baseURL || new URL(baseURL).hostname !== "127.0.0.1")
      throw new Error("Use exclusivamente em loopback.");
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`mostra etapas separadas e teclado no tema ${colorScheme}`, async ({
      page,
      context,
      baseURL,
    }, info) => {
      const prohibited = await prepare(context, baseURL!, "organizer1");
      await qualifyingDraw(context);
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      const refused = page.waitForResponse((response) =>
        response.url().endsWith(adminEndpoint),
      );
      await page.goto(url);
      expect((await refused).status()).toBe(403);
      const own = panel(page);
      await expect(own).toHaveCSS("color-scheme", colorScheme);
      await expect(
        own.getByRole("heading", { name: "Apuração da campanha" }),
      ).toBeVisible();
      const campaign = own.getByRole("textbox", { name: "ID da campanha" });
      const draw = own.getByRole("textbox", {
        name: "ID da extração verificada",
      });
      for (const name of [
        "Simular",
        "Executar prévia",
        "Confirmar resultado",
        "Executar simulação segura",
      ]) {
        await expect(
          own.getByRole("button", { name, exact: true }),
        ).toBeVisible();
      }
      await expect(
        own.getByText("Usa dados fictícios e nunca cria ganhador."),
      ).toBeVisible();
      await expect(
        own.getByRole("heading", { name: "Resultados da Loteria Federal" }),
      ).toHaveCount(0);
      await expect(own.getByText("TEST-0001", { exact: true })).toHaveCount(0);
      await expect(campaign).toHaveValue("");
      await expect(draw).toHaveValue("");
      await campaign.focus();
      for (const next of [
        draw,
        own.getByRole("button", { name: "Simular", exact: true }),
        own.getByRole("button", { name: "Executar prévia", exact: true }),
        own.getByRole("button", { name: "Confirmar resultado", exact: true }),
        own.getByRole("button", {
          name: "Executar simulação segura",
          exact: true,
        }),
      ]) {
        await page.keyboard.press("Tab");
        await expect(next).toBeFocused();
      }
      if ((page.viewportSize()?.width ?? 0) <= 320) {
        const nav = page.getByRole("navigation").filter({
          has: page.getByRole("button", { name: "Mais", exact: true }),
        });
        const last = own.getByRole("button", {
          name: "Executar simulação segura",
          exact: true,
        });
        await expect
          .poll(async () => {
            const bound = (await last.boundingBox())!;
            return (await nav.boundingBox())!.y - (bound.y + bound.height);
          })
          .toBeGreaterThanOrEqual(4);
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(await page.evaluate(() => document.documentElement.clientWidth));
      expect(prohibited).toEqual([]);
      if (process.env.SORTEX_NAV_CAPTURE_DIR) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: `${process.env.SORTEX_NAV_CAPTURE_DIR}/organizer-apuracao-${info.project.name}-${colorScheme}.png`,
          animations: "disabled",
        });
      }
    });
  }

  test("preserva escopo da campanha, autorização do comprador e aparência administrativa", async ({
    context,
    browser,
    baseURL,
    page: viewportSource,
  }) => {
    await prepare(context, baseURL!, "organizer1");
    const { path } = await qualifyingDraw(context);
    for (const user of ["organizer2", "buyer1", "admin"] as const) {
      const other = await browser.newContext({
        baseURL,
        ignoreHTTPSErrors: true,
        viewport: viewportSource.viewportSize(),
        storageState: { cookies: [], origins: [] },
      });
      try {
        const prohibited = await prepare(other, baseURL!, user);
        if (user !== "admin")
          expect((await other.request.get(path)).status()).toBe(403);
        const page = await other.newPage();
        if (user === "buyer1") {
          await page.goto(url);
          await expect.poll(() => new URL(page.url()).pathname).not.toBe(url);
          await expect(panel(page)).toHaveCount(0);
        } else if (user === "admin") {
          await page.emulateMedia({ colorScheme: "dark" });
          await page.goto("/admin/loteria");
          const header = page.getByRole("heading", {
            name: "Resultados da Loteria Federal",
          });
          await expect(header).toBeVisible();
          await expect(
            page.getByRole("region", { name: "Resultados da Loteria Federal" }),
          ).toHaveCSS("color-scheme", "dark");
          await expect(panel(page)).toHaveCount(0);
          await expect(
            page.getByRole("heading", { name: "Cadastrar extração" }),
          ).toBeVisible();
          await expect(
            page.getByRole("heading", { name: "Importar extração da CAIXA" }),
          ).toBeVisible();
        }
        expect(prohibited).toEqual([]);
      } finally {
        await other.close();
      }
    }
  });
});
