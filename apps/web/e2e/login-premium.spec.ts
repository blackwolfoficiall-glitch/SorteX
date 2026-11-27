import { expect, test, type Page } from "@playwright/test";

const byEmail = (page: Page) => page.getByLabel("E-mail", { exact: true });
const byPassword = (page: Page) => page.getByLabel("Senha", { exact: true });
const signIn = (page: Page) => page.getByRole("button", { name: "Entrar", exact: true });

function localAccount(role: "ORGANIZER" | "BUYER") {
  const email = process.env[`E2E_${role}_EMAIL`];
  const password = process.env[`E2E_${role}_PASSWORD`];
  if (!email || !password || !email.endsWith("@sortex.example.invalid")) {
    throw new Error("Credenciais sintéticas indisponíveis.");
  }
  return { email, password };
}

async function fillLogin(page: Page, email: string, password: string) {
  try {
    await byEmail(page).fill(email);
    await byPassword(page).fill(password);
  } catch {
    throw new Error("Não foi possível preencher o formulário sintético.");
  }
}

async function attemptLogin(page: Page) {
  const request = page.waitForResponse((res) => res.url().endsWith("/api/auth/login") && res.request().method() === "POST");
  await signIn(page).click();
  return (await request).status();
}

test.use({ storageState: { cookies: [], origins: [] }, trace: "off", screenshot: "off", video: "off" });

test.describe("login Premium padrão, com API local", () => {

  test.beforeEach(async ({ context, baseURL }) => {
    test.skip(process.env.SORTEX_DISPOSABLE_LOGIN !== "yes", "Requer serviço de autenticação local e contas sintéticas.");
    if (!baseURL || new URL(baseURL).hostname !== "127.0.0.1") throw new Error("Use exclusivamente em loopback.");
    const origin = new URL(baseURL).origin;
    await context.route("**/*", (route) => {
      if (new URL(route.request().url()).origin !== origin) return route.abort("blockedbyclient");
      return route.continue();
    });
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`mantém teclado, campos e opções reais no tema ${colorScheme}`, async ({ page }, info) => {
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      const status = page.waitForResponse((r) => r.url().endsWith("/api/auth/social/providers") && r.ok());
      await page.goto("/login");
      const providers = (await (await status).json()) as { google: { enabled: boolean }; apple: { enabled: boolean } };
      const form = page.locator("main.sx-auth");
      await expect(form).toHaveCSS("color-scheme", colorScheme);
      await expect(form.getByRole("heading", { name: "Entre na sua conta", exact: true })).toBeVisible();
      await expect(byEmail(page)).toHaveAttribute("autocomplete", "email");
      await expect(byPassword(page)).toHaveAttribute("autocomplete", "current-password");
      await expect(byPassword(page)).toHaveAttribute("type", "password");
      for (const provider of ["google", "apple"] as const) {
        const label = provider === "google" ? "Google" : "Apple";
        if (providers[provider].enabled) {
          await expect(form.getByRole("link", { name: `Continuar com ${label}` }))
            .toHaveAttribute("href", `/api/auth/social/${provider}/start`);
        } else {
          await expect(form.getByRole("button", { name: `Continuar com ${label}` })).toBeDisabled();
        }
      }
      await expect(form.getByRole("link", { name: "Cadastre-se", exact: true })).toHaveAttribute("href", "/escolha");
      await expect(form.getByRole("link", { name: "Termos de uso" })).toHaveAttribute("href", "/termos");
      await expect(form.getByRole("link", { name: "Privacidade" })).toHaveAttribute("href", "/privacidade");

      await byEmail(page).focus();
      await page.keyboard.press("Tab");
      await expect(byPassword(page)).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(form.getByRole("button", { name: "Mostrar senha" })).toBeFocused();
      await page.keyboard.press("Space");
      await expect(byPassword(page)).toHaveAttribute("type", "text");
      await expect(form.getByRole("button", { name: "Ocultar senha" })).toBeFocused();
      await page.keyboard.press("Space");
      await expect(byPassword(page)).toHaveAttribute("type", "password");
      await page.keyboard.press("Tab");
      const recovery = form.getByRole("link", { name: "Esqueci minha senha", exact: true });
      await expect(recovery).toHaveAttribute("href", "/esqueci-senha");
      await expect(recovery).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(signIn(page)).toBeFocused();
      await expect(signIn(page)).toBeInViewport();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => document.documentElement.clientWidth));
      await expect(byEmail(page)).toHaveValue("");
      await expect(byPassword(page)).toHaveValue("");
      if (process.env.SORTEX_NAV_CAPTURE_DIR) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: `${process.env.SORTEX_NAV_CAPTURE_DIR}/login-${info.project.name}-${colorScheme}.png`,
          fullPage: true,
          animations: "disabled",
        });
      }

      await page.goto("/login?social_error=unavailable");
      await expect(form.getByRole("alert")).toContainText("Este provedor aguarda configuração.");
    });
  }

  test("rejeita senha incorreta antes de abrir o destino local do organizador", async ({ page }) => {
    const account = localAccount("ORGANIZER");
    await page.goto("/login?next=%2Fdashboard%2Fpedidos");
    await fillLogin(page, account.email, "SenhaIncorretaDeTeste-000!");
    expect(await attemptLogin(page)).toBe(401);
    await expect(page.locator("main.sx-auth").getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/login\?next=/);
    expect((await page.request.get("/api/auth/me")).status()).toBe(401);
    await fillLogin(page, account.email, account.password);
    expect(await attemptLogin(page)).toBe(200);
    await expect(page).toHaveURL(/\/dashboard\/pedidos$/);
    const session = await page.request.get("/api/auth/me");
    expect(session.status()).toBe(200);
    expect((await session.json()).role).toBe("ORGANIZER");
  });

  test("comprador mantém destino seguro com parâmetro de redirecionamento não local", async ({ page }) => {
    const account = localAccount("BUYER");
    const outside = "/\\outside.example.invalid/";
    await page.goto(`/login?next=${encodeURIComponent(outside)}`);
    const outsideNavigation: string[] = [];
    page.on("request", (request) => {
      if (request.isNavigationRequest() && new URL(request.url()).hostname !== "127.0.0.1") outsideNavigation.push(request.url());
    });
    await fillLogin(page, account.email, account.password);
    expect(await attemptLogin(page)).toBe(200);
    await expect(page).toHaveURL(/\/comprador$/);
    expect(outsideNavigation).toEqual([]);
    const session = await page.request.get("/api/auth/me");
    expect(session.status()).toBe(200);
    expect((await session.json()).role).toBe("BUYER");
  });
});
