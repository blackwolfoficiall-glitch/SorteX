import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const endpoint = "/api/draws/admin/lottery-draws";
const url = "/admin/loteria";
const panel = (page: Page) =>
  page.getByRole("region", {
    name: "Resultados da Loteria Federal",
    exact: true,
  });

async function prepare(
  context: BrowserContext,
  baseURL: string,
  role: "admin" | "organizer1" | "buyer1",
) {
  const password = process.env.TEST_SEED_PASSWORD;
  if (!password) throw new Error("Credenciais sintéticas indisponíveis.");
  const login = role === "admin" ? "/api/auth/admin-login" : "/api/auth/login";
  expect(
    (
      await context.request.post(login, {
        data: { email: `${role}@sortex.example.invalid`, password },
      })
    ).status(),
  ).toBe(200);
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

test.use({
  storageState: { cookies: [], origins: [] },
  trace: "off",
  screenshot: "off",
  video: "off",
});

test.describe("histórico Federal Premium somente para administração", () => {
  test.beforeEach(async ({ baseURL }) => {
    test.skip(
      process.env.SORTEX_DISPOSABLE_ADMIN_LOTERIA !== "yes",
      "Requer extrações sintéticas em banco local.",
    );
    if (!baseURL || new URL(baseURL).hostname !== "127.0.0.1")
      throw new Error("Use exclusivamente em loopback.");
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`lê origem, zeros e decisões existentes no tema ${colorScheme}`, async ({
      context,
      page,
      baseURL,
    }, info) => {
      const prohibited = await prepare(context, baseURL!, "admin");
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      const listRead = page.waitForResponse((response) =>
        response.url().endsWith(endpoint),
      );
      await page.goto(url);
      const response = await listRead;
      expect(response.status()).toBe(200);
      const rows = await response.json();
      expect(rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            extractionNumber: "QA-ARCHIVED",
            status: "VERIFIED",
            firstPrize: "00171",
            sourceType: "MANUAL",
          }),
          expect.objectContaining({
            extractionNumber: "QA-DOCUMENT",
            status: "PENDING_REVIEW",
            firstPrize: "00091",
            sourceType: "OFFICIAL_DOCUMENT",
            sourcePrizes: ["000091", "012345", "000042", "090807", "011111"],
          }),
        ]),
      );
      const own = panel(page);
      await expect(own).toHaveCSS("color-scheme", colorScheme);
      await expect(
        own.getByRole("heading", { name: "Cadastrar extração" }),
      ).toBeVisible();
      await expect(
        own.getByRole("heading", { name: "Importar extração da CAIXA" }),
      ).toBeVisible();
      await expect(
        own.getByRole("textbox", { name: "Número da extração da CAIXA" }),
      ).toHaveAttribute("pattern", "[1-9][0-9]{0,8}");
      const history = own.getByRole("list", { name: "Histórico de extrações" });
      await expect(history.locator(":scope > li")).toHaveCount(rows.length);
      const card = (name: string) =>
        history
          .locator(":scope > li")
          .filter({ has: page.getByRole("heading", { name, exact: true }) });
      const pending = card("Extração QA-DOCUMENT");
      const archived = card("Extração QA-ARCHIVED");
      await expect(
        pending.getByText("Pendente de revisão", { exact: true }),
      ).toBeVisible();
      await expect(
        pending.getByText("Documento oficial", { exact: true }),
      ).toBeVisible();
      await expect(pending.getByText("00091", { exact: true })).toBeVisible();
      await expect(pending.getByText("000091", { exact: true })).toBeVisible();
      await expect(pending.locator("time")).toHaveAttribute(
        "datetime",
        "2025-01-11",
      );
      await expect(
        archived.getByText("Verificada", { exact: true }),
      ).toBeVisible();
      await expect(
        archived.getByText("Cadastro manual", { exact: true }),
      ).toBeVisible();
      await expect(archived.getByText("00171", { exact: true })).toBeVisible();
      await expect(archived.locator("time")).toHaveText("04/01/2025");
      await expect(
        pending.getByRole("button", { name: "Verificar", exact: true }),
      ).toBeDisabled();
      await expect(
        archived.getByRole("button", {
          name: "Bloquear alterações",
          exact: true,
        }),
      ).toBeDisabled();
      await expect(
        pending.getByRole("button", { name: "Rejeitar", exact: true }),
      ).toBeDisabled();
      const disclosure = pending.locator("summary");
      await disclosure.focus();
      await page.keyboard.press("Enter");
      await expect(pending.locator("details")).toHaveAttribute("open", "");
      await expect(pending.locator("pre")).toContainText(
        '"firstPrize": "00091"',
      );
      await expect(pending.locator("pre")).toContainText('"000091"');
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(await page.evaluate(() => document.documentElement.clientWidth));
      await page.keyboard.press("Enter");
      await expect(pending.locator("details")).not.toHaveAttribute("open", "");
      await page.keyboard.press("Tab");
      await expect(
        pending.getByRole("textbox", {
          name: "Justificativa da revisão QA-DOCUMENT",
        }),
      ).toBeFocused();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(await page.evaluate(() => document.documentElement.clientWidth));
      expect(prohibited).toEqual([]);
      if (process.env.SORTEX_NAV_CAPTURE_DIR) {
        // This capture is an allowlisted archived fixture only; never include real records, raw audit details or form data.
        await pending.screenshot({
          path: `${process.env.SORTEX_NAV_CAPTURE_DIR}/admin-loteria-${info.project.name}-${colorScheme}.png`,
          animations: "disabled",
        });
      }
    });
  }

  test("mantém a rota administrativa e a API restritas", async ({
    browser,
    page: source,
    baseURL,
  }) => {
    for (const role of ["organizer1", "buyer1"] as const) {
      const context = await browser.newContext({
        baseURL,
        ignoreHTTPSErrors: true,
        viewport: source.viewportSize(),
        storageState: { cookies: [], origins: [] },
      });
      try {
        const prohibited = await prepare(context, baseURL!, role);
        expect((await context.request.get(endpoint)).status()).toBe(403);
        const page = await context.newPage();
        await page.goto(url);
        await expect.poll(() => new URL(page.url()).pathname).not.toBe(url);
        await expect(panel(page)).toHaveCount(0);
        expect(prohibited).toEqual([]);
      } finally {
        await context.close();
      }
    }
  });
});
