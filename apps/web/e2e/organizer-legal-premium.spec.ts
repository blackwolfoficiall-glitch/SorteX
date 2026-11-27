import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const url = "/dashboard/configuracoes/juridico";
const panel = (page: Page) =>
  page.getByRole("region", { name: "Central Jurídica", exact: true });
const existing = "Documento sintético de histórico";
const pending = "Documento sintético pendente";
const device = "Dispositivo fictício QA";

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
      (target.pathname.startsWith("/api/") &&
        (!["GET", "HEAD"].includes(method) ||
          /^\/api\/legal\/public\/|^\/api\/legal\/assets\//.test(
            target.pathname,
          )))
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

test.describe("central jurídica Premium do organizador em modo de leitura", () => {
  test.beforeEach(async ({ baseURL }) => {
    test.skip(
      process.env.SORTEX_DISPOSABLE_ORGANIZER_LEGAL !== "yes",
      "Requer dados jurídicos sintéticos isolados.",
    );
    if (!baseURL || new URL(baseURL).hostname !== "127.0.0.1")
      throw new Error("Use exclusivamente em loopback.");
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`exibe documentos, histórico e busca local no tema ${colorScheme}`, async ({
      context,
      page,
      baseURL,
    }, info) => {
      const prohibited = await prepare(context, baseURL!, "organizer1");
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      const endpoints = [
        "/api/legal/public",
        "/api/legal/acceptances/me",
        "/api/legal/data-requests/me",
      ];
      const calls = endpoints.map((endpoint) =>
        page.waitForResponse((response) => response.url().endsWith(endpoint)),
      );
      await page.goto(url);
      const responses = await Promise.all(calls);
      for (const response of responses) expect(response.status()).toBe(200);
      const own = panel(page);
      await expect(own).toHaveCSS("color-scheme", colorScheme);
      const card = (title: string) =>
        own
          .getByRole("article")
          .filter({
            has: page.getByRole("heading", { name: title, exact: true }),
          });
      await expect(
        card(existing).getByText("Aceito", { exact: true }),
      ).toBeVisible();
      await expect(
        card(pending).getByText("Aceite pendente", { exact: true }),
      ).toBeVisible();
      await expect(
        card(pending).getByText("Versão 3 · HOMOLOGAÇÃO-B", { exact: true }),
      ).toBeVisible();
      await expect(
        own.getByRole("heading", { name: "Direitos do titular — LGPD" }),
      ).toBeVisible();
      await expect(
        own.getByText("1 solicitação(ões) registrada(s).", { exact: true }),
      ).toBeVisible();
      await expect(own.getByText(device, { exact: false })).toBeVisible();
      for (const label of [
        "Exclusão da conta",
        "Portabilidade",
        "Correção de dados",
        "Revogar consentimento",
        "Relatório dos dados",
      ]) {
        await expect(
          own.getByRole("button", { name: label, exact: true }),
        ).toBeVisible();
      }
      const search = own.getByRole("textbox");
      await search.fill("pendente");
      await expect(card(existing)).toHaveCount(0);
      await expect(card(pending)).toBeVisible();
      await search.focus();
      await page.keyboard.press("Tab");
      await expect(
        card(pending).getByRole("button", { name: "Ler documento" }),
      ).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(
        card(pending).getByRole("button", { name: `Baixar ${pending} em PDF` }),
      ).toBeFocused();
      await search.fill("");
      await expect(card(existing)).toBeVisible();
      await expect(own.getByRole("dialog")).toHaveCount(0);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(await page.evaluate(() => document.documentElement.clientWidth));
      expect(prohibited).toEqual([]);
      if (process.env.SORTEX_NAV_CAPTURE_DIR) {
        // Capture only one allowlisted synthetic metadata card, never account history, document body or identifiers.
        await card(pending).screenshot({
          path: `${process.env.SORTEX_NAV_CAPTURE_DIR}/organizer-legal-${info.project.name}-${colorScheme}.png`,
          animations: "disabled",
        });
      }
    });
  }

  test("separa histórico de outra conta e conserva Central Jurídica global", async ({
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
        for (const endpoint of [
          "/api/legal/acceptances/me",
          "/api/legal/data-requests/me",
        ]) {
          const privateHistory = await context.request.get(endpoint);
          expect(privateHistory.status()).toBe(200);
          expect(await privateHistory.json()).toEqual([]);
        }
        const target = await context.newPage();
        await target.goto(url);
        if (user === "organizer2") {
          await expect(
            panel(target).getByText("Nenhum aceite registrado.", {
              exact: true,
            }),
          ).toBeVisible();
          await expect(
            panel(target).getByText(device, { exact: false }),
          ).toHaveCount(0);
          await expect(
            panel(target).getByText("1 solicitação(ões) registrada(s).", {
              exact: true,
            }),
          ).toHaveCount(0);
        } else {
          await expect.poll(() => new URL(target.url()).pathname).not.toBe(url);
          await expect(panel(target)).toHaveCount(0);
          await target.goto("/juridico");
          const heading = target.getByRole("heading", {
            name: "Central Jurídica",
            exact: true,
          });
          await expect(heading).toBeVisible();
          expect(
            await heading
              .locator("xpath=ancestor::*[@data-sx-premium]")
              .count(),
          ).toBe(0);
        }
        expect(prohibited).toEqual([]);
      } finally {
        await context.close();
      }
    }
  });
});
