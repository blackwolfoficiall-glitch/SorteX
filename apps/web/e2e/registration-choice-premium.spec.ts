import { expect, test, type Page } from "@playwright/test";

const choiceHeading = "Seu próximo passo começa aqui.";
const buyer = (page: Page) => page.getByRole("link", { name: /Sou comprador/ });
const organizer = (page: Page) => page.getByRole("link", { name: /Sou organizador/ });
const continueButton = (page: Page) => page.getByRole("button", { name: "Continuar", exact: true });

test.use({ storageState: { cookies: [], origins: [] }, trace: "off", screenshot: "off", video: "off" });

test.describe("escolha Premium do perfil de cadastro", () => {
  test.beforeEach(async ({ baseURL }) => {
    test.skip(process.env.SORTEX_DISPOSABLE_REGISTRATION_CHOICE !== "yes", "Requer ambiente descartável e entradas em branco.");
    if (!baseURL || new URL(baseURL).hostname !== "127.0.0.1") throw new Error("Use exclusivamente em loopback.");
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`mantém os destinos e validação em branco nos dois endereços, tema ${colorScheme}`, async ({ page, context, baseURL }, info) => {
      const origin = new URL(baseURL!).origin;
      const attempts: string[] = [];
      await context.route("**/*", (route) => {
        const target = new URL(route.request().url());
        if (target.origin !== origin) return route.abort("blockedbyclient");
        if (target.pathname.startsWith("/api/") && !["GET", "HEAD"].includes(route.request().method())) {
          attempts.push(route.request().method());
          return route.abort("blockedbyclient");
        }
        return route.continue();
      });
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      for (const entry of ["/cadastro", "/escolha"]) {
        const providersResponse = page.waitForResponse((r) => r.url().endsWith("/api/auth/social/providers") && r.ok());
        await page.goto(entry);
        const providers = (await (await providersResponse).json()) as { google: { enabled: boolean }; apple: { enabled: boolean } };
        const main = page.locator("main.sx-auth");
        await expect(main).toHaveCSS("color-scheme", colorScheme);
        await expect(main.getByRole("heading", { name: choiceHeading, exact: true })).toBeVisible();
        const profile = main.getByRole("region", { name: "Escolha seu perfil" });
        await expect(profile.getByRole("link")).toHaveCount(2);
        await expect(buyer(page)).toHaveAttribute("href", "/cadastro/comprador");
        await expect(organizer(page)).toHaveAttribute("href", "/cadastro/organizador");
        await expect(organizer(page)).toContainText("Cadastro PF ou PJ.");
        await expect(main.getByRole("link", { name: "Entrar", exact: true })).toHaveAttribute("href", "/login");
        await expect(main.getByRole("link", { name: "Termos de uso" })).toHaveAttribute("href", "/termos");
        await expect(main.getByRole("link", { name: "Privacidade" })).toHaveAttribute("href", "/privacidade");

        for (const key of ["google", "apple"] as const) {
          const name = `Continuar com ${key === "google" ? "Google" : "Apple"}`;
          if (providers[key].enabled) {
            await expect(main.getByRole("link", { name })).toHaveAttribute("href", `/api/auth/social/${key}/start`);
          } else {
            await expect(main.getByRole("button", { name })).toBeDisabled();
          }
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => document.documentElement.clientWidth));
        await buyer(page).focus();
        await page.keyboard.press("Tab");
        await expect(organizer(page)).toBeFocused();
        const focus = await organizer(page).evaluate((node) => getComputedStyle(node).outlineWidth);
        expect(parseFloat(focus)).toBeGreaterThanOrEqual(2);
        if (process.env.SORTEX_NAV_CAPTURE_DIR && entry === "/cadastro") {
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.screenshot({
            path: `${process.env.SORTEX_NAV_CAPTURE_DIR}/registration-${info.project.name}-${colorScheme}.png`,
            fullPage: true,
            animations: "disabled",
          });
        }

        if (entry === "/cadastro") {
          await buyer(page).focus();
          await page.keyboard.press("Enter");
          await expect(page).toHaveURL(/\/cadastro\/comprador$/);
          await expect(page.getByRole("heading", { name: "Conta de comprador", exact: true })).toBeVisible();
          await expect(page.getByRole("radio", { name: "Pessoa Jurídica (PJ)" })).toHaveCount(0);
          await continueButton(page).click();
          await expect(page.locator('input[name="name"]:invalid')).toBeVisible();
          await expect(page.getByRole("navigation", { name: "Etapas do cadastro" }).getByText("Identificação"))
            .toHaveAttribute("aria-current", "step");
        } else {
          await page.keyboard.press("Enter");
          await expect(page).toHaveURL(/\/cadastro\/organizador$/);
          await expect(page.getByRole("heading", { name: "Conta de organizador", exact: true })).toBeVisible();
          const pf = page.getByRole("radio", { name: "Pessoa Física (PF)" });
          const pj = page.getByRole("radio", { name: "Pessoa Jurídica (PJ)" });
          await expect(pf).toBeChecked();
          await expect(page.getByLabel("CPF", { exact: true })).toBeVisible();
          await pj.check();
          await expect(pj).toBeChecked();
          await expect(page.getByLabel("CNPJ", { exact: true })).toBeVisible();
          await expect(page.getByLabel("CPF do representante legal", { exact: true })).toBeVisible();
          await continueButton(page).click();
          await expect(page.locator('input[name="cnpj"]:invalid')).toBeVisible();
          await expect(page.getByRole("navigation", { name: "Etapas do cadastro" }).getByText("Identificação"))
            .toHaveAttribute("aria-current", "step");
          await pf.check();
          await expect(page.getByLabel("CNPJ", { exact: true })).toHaveCount(0);
        }
      }
      expect(attempts).toEqual([]);
      expect((await page.request.get("/api/auth/me")).status()).toBe(401);
    });
  }
});
