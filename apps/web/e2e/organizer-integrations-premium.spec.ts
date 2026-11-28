import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const endpoint = "/api/organizer/integrations";
const url = "/dashboard/integracoes";
const panel = (page: Page) =>
  page.getByRole("region", { name: "Integrações", exact: true });
const secretNodes = "input, textarea, [contenteditable]";

async function prepare(
  context: BrowserContext,
  baseURL: string,
  user: "organizer1" | "organizer2" | "buyer1",
) {
  const password = process.env.TEST_SEED_PASSWORD;
  if (!password) throw new Error("Credenciais sintéticas indisponíveis.");
  const signed = await context.request.post("/api/auth/login", {
    data: { email: `${user}@sortex.example.invalid`, password },
  });
  expect(signed.status()).toBe(200);
  const who = await context.request.get("/api/auth/me");
  expect(who.status()).toBe(200);
  expect((await who.json()).role).toBe(
    user.startsWith("organizer") ? "ORGANIZER" : "BUYER",
  );
  const prohibited: string[] = [];
  await context.route("**/*", (intercepted) => {
    const target = new URL(intercepted.request().url());
    const method = intercepted.request().method();
    if (
      target.origin !== new URL(baseURL).origin ||
      (target.pathname.startsWith("/api/") &&
        (!["GET", "HEAD"].includes(method) ||
          target.pathname.includes("/oauth/")))
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

test.describe("integrações Premium do organizador em modo de leitura", () => {
  test.beforeEach(async ({ baseURL }) => {
    test.skip(
      process.env.SORTEX_DISPOSABLE_INTEGRATIONS !== "yes",
      "Requer ambiente local e integração sintética.",
    );
    if (!baseURL || new URL(baseURL).hostname !== "127.0.0.1")
      throw new Error("Use exclusivamente em loopback.");
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`distingue disponíveis, demonstração e futuros no tema ${colorScheme}`, async ({
      page,
      context,
      baseURL,
    }, info) => {
      const prohibited = await prepare(context, baseURL!, "organizer1");
      const response = await context.request.get(endpoint);
      expect(response.status()).toBe(200);
      // Retain only known non-sensitive status fields from the genuine response.
      const status = (
        (await response.json()) as { type: string; status: string }[]
      ).map(({ type, status }) => ({ type, status }));
      expect(status).toEqual([
        { type: "META_ADS", status: "SANDBOX_CONNECTED" },
      ]);
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      let release = () => {};
      const wait = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route(
        `**${endpoint}`,
        async (route) => {
          await wait;
          await route.continue();
        },
        { times: 1 },
      );
      try {
        await page.goto(url);
        await expect(
          panel(page).getByRole("status", { name: "Carregando integrações" }),
        ).toBeVisible();
      } finally {
        release();
      }
      const own = panel(page);
      await expect(own).toHaveCSS("color-scheme", colorScheme);
      const tabs = own.getByRole("navigation", {
        name: "Seções das integrações",
      });
      const available = tabs.getByRole("button", {
        name: "Disponíveis",
        exact: true,
      });
      const connected = tabs.getByRole("button", {
        name: "Conectadas (1)",
        exact: true,
      });
      const soon = tabs.getByRole("button", { name: "Em breve", exact: true });
      await expect(
        own.getByRole("heading", { name: "Meta Business", exact: true }),
      ).toBeVisible();
      await expect(
        own.getByRole("heading", { name: "WhatsApp Business", exact: true }),
      ).toBeVisible();
      await expect(own.getByText(/Dados demonstrativos/)).toBeVisible();
      await expect(
        own.getByText("Modo demonstração ativado.", { exact: true }),
      ).toBeVisible();
      await expect(
        own.getByText("Modo demonstração, sem conta externa.", { exact: true }),
      ).toBeVisible();
      await expect(
        own.getByText("Conexão operacional.", { exact: true }),
      ).toHaveCount(0);
      await available.focus();
      await page.keyboard.press("Tab");
      await expect(connected).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(connected).toHaveAttribute("aria-pressed", "true");
      await expect(
        own.getByRole("heading", { name: "WhatsApp Business", exact: true }),
      ).toHaveCount(0);
      await expect(
        own.getByRole("button", { name: "Sincronizar", exact: true }),
      ).toBeVisible();
      await soon.click();
      await expect(soon).toHaveAttribute("aria-pressed", "true");
      await expect(
        own.getByRole("button", {
          name: "Conectar WhatsApp Business",
          exact: true,
        }),
      ).toHaveCount(0);
      for (const name of [
        "Google Ads",
        "TikTok Ads",
        "Telegram",
        "X Ads",
        "Zapier",
        "Make",
      ]) {
        await expect(
          own.getByRole("heading", { name, exact: true }),
        ).toBeVisible();
      }
      await expect(
        own.getByRole("button", { name: "Avise-me", exact: true }),
      ).toHaveCount(6);
      await available.click();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(await page.evaluate(() => document.documentElement.clientWidth));
      await expect(own.locator(secretNodes)).toHaveCount(0);
      expect(prohibited).toEqual([]);
      if (process.env.SORTEX_NAV_CAPTURE_DIR) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: `${process.env.SORTEX_NAV_CAPTURE_DIR}/organizer-integrations-${info.project.name}-${colorScheme}.png`,
          fullPage: true,
          animations: "disabled",
        });
      }
    });
  }

  test("organizador sem conexões pode repetir leitura e comprador não acessa o módulo", async ({
    browser,
    baseURL,
    page: viewportSource,
  }) => {
    for (const user of ["organizer2", "buyer1"] as const) {
      const context = await browser.newContext({
        baseURL,
        ignoreHTTPSErrors: true,
        viewport: viewportSource.viewportSize(),
        storageState: { cookies: [], origins: [] },
      });
      try {
        const prohibited = await prepare(context, baseURL!, user);
        const page = await context.newPage();
        if (user === "organizer2") {
          const response = await context.request.get(endpoint);
          expect(response.status()).toBe(200);
          expect(await response.json()).toEqual([]);
          await page.route(`**${endpoint}`, (route) => route.abort("failed"), {
            times: 1,
          });
          await page.goto(url);
          const own = panel(page);
          await expect(
            own.getByText("Não foi possível carregar as integrações."),
          ).toBeVisible();
          const read = page.waitForResponse(
            (r) => r.url().endsWith(endpoint) && r.request().method() === "GET",
          );
          await own.getByRole("button", { name: "Tentar novamente" }).click();
          expect((await read).status()).toBe(200);
          await own.getByRole("button", { name: "Fechar mensagem" }).click();
          await own.getByRole("button", { name: "Conectadas (0)" }).click();
          await expect(
            own.getByRole("heading", { name: "Nenhuma conexão ativa" }),
          ).toBeVisible();
          await expect(
            own.getByText("Modo demonstração ativado.", { exact: true }),
          ).toHaveCount(0);
          await page.goto(`${url}?integration=WHATSAPP`);
          const drawer = page.getByRole("dialog", {
            name: "Conectar WhatsApp Business",
          });
          await expect(
            drawer.getByRole("heading", {
              name: "Login seguro no ambiente oficial",
            }),
          ).toBeVisible();
          await expect(drawer.locator(secretNodes)).toHaveCount(0);
          await drawer
            .getByRole("button", { name: "Fechar", exact: true })
            .click();
          await expect(drawer).toHaveCount(0);
        } else {
          expect((await context.request.get(endpoint)).status()).toBe(403);
          await page.goto(url);
          await expect(panel(page)).toHaveCount(0);
          await expect.poll(() => new URL(page.url()).pathname).not.toBe(url);
        }
        expect(prohibited).toEqual([]);
      } finally {
        await context.close();
      }
    }
  });
});
