import { expect, test, type Page } from "@playwright/test";

const main = (page: Page) => page.locator("main.sx-auth");
const back = (page: Page) => main(page).getByRole("link", { name: "Voltar ao login", exact: true });
const newPassword = (page: Page) => page.getByLabel("Nova senha", { exact: true });
const confirmation = (page: Page) => page.getByLabel("Confirmar nova senha", { exact: true });
const reset = (page: Page) => page.getByRole("button", { name: "Redefinir senha", exact: true });

async function fitsViewport(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => document.documentElement.clientWidth));
}

test.use({ storageState: { cookies: [], origins: [] }, trace: "off", screenshot: "off", video: "off" });

test.describe("recuperação de senha Premium sem envio ou redefinição", () => {
  test.beforeEach(async ({ baseURL }) => {
    test.skip(process.env.SORTEX_DISPOSABLE_RECOVERY !== "yes", "Requer ambiente local descartável.");
    if (!baseURL || new URL(baseURL).hostname !== "127.0.0.1") throw new Error("Use exclusivamente em loopback.");
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`mantém formulários e validações locais no tema ${colorScheme}`, async ({ page, context, baseURL }, info) => {
      const origin = new URL(baseURL!).origin;
      const blockedWrites: string[] = [];
      await context.route("**/*", (route) => {
        const target = new URL(route.request().url());
        const method = route.request().method();
        if (target.origin !== origin) return route.abort("blockedbyclient");
        if (target.pathname.startsWith("/api/") && !["GET", "HEAD"].includes(method)) {
          blockedWrites.push(method);
          return route.abort("blockedbyclient");
        }
        return route.continue();
      });
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto("/login");
      const forgot = main(page).getByRole("link", { name: "Esqueci minha senha" });
      await expect(forgot).toHaveAttribute("href", "/esqueci-senha");
      await forgot.focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/esqueci-senha$/);
      await expect(main(page)).toHaveCSS("color-scheme", colorScheme);
      await expect(main(page).getByRole("heading", { name: "Recupere sua senha", exact: true })).toBeVisible();
      await expect(back(page)).toHaveAttribute("href", "/login");
      const email = page.getByLabel("E-mail da conta", { exact: true });
      const send = page.getByRole("button", { name: "Enviar link de recuperação", exact: true });
      await expect(email).toHaveValue("");
      await expect(email).toHaveAttribute("autocomplete", "email");
      await email.focus();
      await page.keyboard.press("Tab");
      await expect(send).toBeFocused();
      await expect(send).toBeInViewport();
      await fitsViewport(page);
      const capture = process.env.SORTEX_NAV_CAPTURE_DIR;
      if (capture) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: `${capture}/esqueci-${info.project.name}-${colorScheme}.png`,
          fullPage: true,
          animations: "disabled",
        });
      }
      await page.keyboard.press("Enter");
      await expect(main(page).locator('input[type="email"]:invalid')).toBeVisible();
      await email.fill("endereco-em-formato-invalido");
      await send.click();
      await expect(main(page).locator('input[type="email"]:invalid')).toBeVisible();
      await expect(page).toHaveURL(/\/esqueci-senha$/);

      await page.goto("/recuperar-senha");
      await expect(main(page)).toHaveCSS("color-scheme", colorScheme);
      await expect(main(page).getByRole("heading", { name: "Crie uma nova senha", exact: true })).toBeVisible();
      await expect(back(page)).toHaveAttribute("href", "/login");
      for (const field of [newPassword(page), confirmation(page)]) {
        await expect(field).toHaveValue("");
        await expect(field).toHaveAttribute("type", "password");
        await expect(field).toHaveAttribute("autocomplete", "new-password");
        await expect(field).toHaveAttribute("minlength", "8");
      }
      await newPassword(page).focus();
      await page.keyboard.press("Tab");
      await expect(confirmation(page)).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(reset(page)).toBeFocused();
      await expect(reset(page)).toBeInViewport();
      await fitsViewport(page);
      if (capture) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: `${capture}/recuperar-${info.project.name}-${colorScheme}.png`,
          fullPage: true,
          animations: "disabled",
        });
      }
      await page.keyboard.press("Enter");
      await expect(main(page).locator("input:invalid")).toHaveCount(2);

      await newPassword(page).fill("valor-sintetico-sem-conta-1");
      await confirmation(page).fill("valor-sintetico-sem-conta-1");
      await reset(page).click();
      await expect(main(page).getByRole("alert")).toHaveText("O link de recuperação é inválido ou está incompleto.");

      // This is only a non-secret query placeholder. It must reach the local
      // mismatch guard, not any API call or real token verification.
      await page.goto("/recuperar-senha?token=apenas-marcador-sem-token");
      await newPassword(page).fill("valor-sintetico-sem-conta-1");
      await confirmation(page).fill("valor-sintetico-sem-conta-2");
      await reset(page).click();
      await expect(main(page).getByRole("alert")).toHaveText("As senhas não conferem.");
      await fitsViewport(page);
      await back(page).focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/login$/);
      expect(blockedWrites).toEqual([]);
      expect((await page.request.get("/api/auth/me")).status()).toBe(401);
    });
  }
});
