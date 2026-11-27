import { expect, test } from "@playwright/test";

const organizerLinks = [
  ["Dashboard", "/dashboard"],
  ["Campanhas", "/dashboard/campanhas"],
  ["Ganhadores", "/dashboard/campanhas/ganhadores"],
  ["Pedidos", "/dashboard/pedidos"],
  ["Mini Campanhas", "/dashboard/mini-campanhas"],
  ["Financeiro", "/dashboard/financeiro"],
  ["CRM Intelligence", "/dashboard/crm"],
  ["IA SorteX", "/dashboard/ia"],
  ["SorteX Ads", "/dashboard/ads"],
  ["Afiliados", "/dashboard/afiliados"],
  ["Promoções", "/dashboard/promocoes"],
  ["Cotas premiadas", "/dashboard/ganhadores"],
  ["Comunicação", "/dashboard/comunicacao"],
  ["Personalização", "/dashboard/personalizacao"],
  ["Integrações", "/dashboard/integracoes"],
  ["Configurações", "/dashboard/configuracoes"],
  ["Perfil", "/perfil"],
] as const;

const mobileLinks = [
  ["Início", "/dashboard"],
  ["Campanhas", "/dashboard/campanhas"],
  ["Criar campanha", "/dashboard/campanhas/nova"],
  ["Copilot", "/dashboard/ia"],
] as const;

test("organizer preserves all destinations, keyboard focus and the direct legacy panel", async ({
  page,
  request,
}) => {
  const mobile = (page.viewportSize()?.width ?? 0) < 1024;
  await page.goto("/dashboard");
  const rail = page.locator("#organizer-sidebar");
  const main = page.locator("#organizer-main");
  const tabs = page.getByRole("navigation", {
    name: "Navegação rápida do organizador",
  });
  const more = tabs.getByRole("button", { name: "Mais", exact: true });
  const dialog = page.getByRole("dialog", {
    name: "Mais opções do organizador",
  });
  const panel = mobile ? dialog : rail;
  const nav = panel.getByRole("navigation", { name: "Menu do organizador" });

  if (mobile) {
    await expect(rail).toBeHidden();
    await expect(tabs).toBeVisible();
    await expect(tabs.getByRole("link")).toHaveCount(4);
    for (const [name, href] of mobileLinks) {
      await expect(tabs.getByRole("link", { name, exact: true })).toHaveAttribute(
        "href",
        href,
      );
    }
    await expect(
      tabs.getByRole("link", { name: "Início", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await expect(nav).toBeHidden();
    await more.click();
    await expect(more).toHaveAttribute("aria-expanded", "true");
    const close = dialog.getByRole("button", {
      name: "Fechar menu",
      exact: true,
    });
    await expect(close).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(nav.getByRole("link", { name: "Perfil", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(nav).toBeHidden();
    await expect(more).toBeFocused();
    await more.click();
  } else {
    await expect(tabs).toBeHidden();
    const collapse = rail.getByRole("button", { name: "Recolher menu do organizador" });
    await expect(collapse).toHaveAttribute("aria-expanded", "true");
    const mainX = () => main.evaluate((node) => node.getBoundingClientRect().x);
    const uncollapsedX = await mainX();
    await collapse.click();
    await expect(rail).toHaveAttribute("data-collapsed", "true");
    const expand = rail.getByRole("button", { name: "Expandir menu do organizador" });
    await expect(expand).toHaveAttribute("aria-expanded", "false");
    await expect(expand).toBeFocused();
    await expect.poll(mainX).toBeLessThan(uncollapsedX - 100);
  }

  await expect(nav).toBeVisible();
  await expect(panel.getByText(/Menu fixo no desktop|recolhível no mobile/)).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Painel mobile", exact: true })).toHaveCount(0);
  await expect(nav.locator('a[href*="painel-mobile.html"]')).toHaveCount(0);
  await expect(nav.getByRole("link")).toHaveCount(organizerLinks.length);
  for (const [name, href] of organizerLinks) {
    await expect(nav.getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
  }

  const profile = nav.getByRole("link", { name: "Perfil", exact: true });
  await profile.scrollIntoViewIfNeeded();
  await expect(profile).toBeInViewport();
  expect(await panel.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);

  await nav.getByRole("link", { name: "Pedidos", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/pedidos$/);
  if (mobile) {
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await expect(nav).toBeHidden();
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
    await more.click();
  } else {
    await expect(rail).toHaveAttribute("data-collapsed", "true");
  }
  await expect(nav.getByRole("link", { name: "Pedidos", exact: true })).toHaveAttribute("aria-current", "page");

  await nav.getByRole("link", { name: "Ganhadores", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/campanhas\/ganhadores$/);
  if (mobile) await more.click();
  await expect(nav.getByRole("link", { name: "Ganhadores", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Campanhas", exact: true })).not.toHaveAttribute("aria-current", "page");

  if (mobile) {
    await dialog.getByRole("button", { name: "Fechar menu" }).click();
    await tabs.getByRole("link", { name: "Criar campanha", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard\/campanhas\/nova$/);
    await expect(tabs.getByRole("link", { name: "Criar campanha", exact: true })).toHaveAttribute("aria-current", "page");
    if (page.viewportSize()?.width === 320) {
      // The keyboard moves from the last media input to the real first-step
      // action. Start with the action under the fixed tabs, not already clear.
      const action = main.getByRole("button", { name: "Salvar e continuar", exact: true });
      await main.locator('input[type="file"][accept="video/mp4,video/webm"]').focus();
      const tabTop = async () => (await tabs.boundingBox())!.y;
      const actionBottom = async () => {
        const rect = (await action.boundingBox())!;
        return rect.y + rect.height;
      };
      await action.evaluate((element, navTop) => {
        window.scrollBy(0, element.getBoundingClientRect().bottom - navTop - 12);
      }, await tabTop());
      expect(await actionBottom()).toBeGreaterThan(await tabTop());
      await page.keyboard.press("Tab");
      await expect(action).toBeFocused();
      await expect.poll(async () => (await tabTop()) - (await actionBottom())).toBeGreaterThanOrEqual(4);
      expect(
        await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).scrollPaddingBottom)),
      ).toBeGreaterThan(80);
    }
    await tabs.getByRole("link", { name: "Copilot", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard\/ia$/);
  } else {
    await rail.getByRole("button", { name: "Expandir menu do organizador" }).click();
    await expect(rail).toHaveAttribute("data-collapsed", "false");
  }

  const internalPanel = await request.get("/painel-mobile.html");
  expect(internalPanel.status()).toBe(200);
  expect(await internalPanel.text()).toContain("<title>SorteX · Painel do organizador</title>");
});

test("organizer navigation stays unavailable in initial setup mode", async ({ page }) => {
  const compact = (page.viewportSize()?.width ?? 0) < 1024;
  await page.goto("/dashboard/personalizacao?onboarding=1");
  const setup = compact
    ? page.locator(".sxorg-mobile-setup")
    : page.locator("#organizer-sidebar");
  await expect(setup.getByText("Configuração inicial", { exact: true })).toBeVisible();
  await expect(setup.getByRole("button", { name: "Sair da conta", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Menu do organizador" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Navegação rápida do organizador" })).toHaveCount(0);
});

test("genuine buyer and team sessions cannot see organizer navigation", async ({
  browser,
  page,
  baseURL,
}) => {
  const buyer = { email: process.env.E2E_BUYER_EMAIL, password: process.env.E2E_BUYER_PASSWORD };
  const admin = { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD };
  test.skip(
    !buyer.email || !buyer.password || !admin.email || !admin.password,
    "Requer comprador e administrador sintéticos no banco descartável.",
  );
  if (!baseURL || new URL(baseURL).hostname !== "127.0.0.1")
    throw new Error("Este teste usa exclusivamente o site em loopback.");
  for (const [account, role, endpoint, destination] of [
    [buyer, "BUYER", "/api/auth/login", "/comprador"],
    [admin, "ADMIN", "/api/auth/admin-login", "/admin/login"],
  ] as const) {
    const context = await browser.newContext({
      baseURL,
      storageState: { cookies: [], origins: [] },
      viewport: page.viewportSize(),
      ignoreHTTPSErrors: new URL(baseURL).protocol === "https:",
    });
    try {
      const visitor = await context.newPage();
      await visitor.goto("/dashboard");
      await expect(visitor).toHaveURL(/\/login\?next=/);
      await expect(visitor.locator("#organizer-sidebar")).toHaveCount(0);
      const response = await context.request.post(endpoint, { data: account });
      expect(response.status()).toBe(200);
      const me = await context.request.get("/api/auth/me");
      expect(me.status()).toBe(200);
      expect(await me.json()).toMatchObject({ role });
      await visitor.goto("/dashboard");
      await expect(visitor).toHaveURL(`${baseURL}${destination}`);
      await expect(visitor.locator("#organizer-sidebar")).toHaveCount(0);
      await expect(visitor.getByRole("navigation", { name: "Menu do organizador" })).toHaveCount(0);
      await expect(visitor.getByRole("navigation", { name: "Navegação rápida do organizador" })).toHaveCount(0);
    } finally {
      await context.close();
    }
  }
});
