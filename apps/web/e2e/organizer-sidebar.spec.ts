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

test("organizer sidebar preserves module links and keeps the mobile panel at its direct URL", async ({ page, request }) => {
  const compact = (page.viewportSize()?.width ?? 0) < 1024;
  await page.goto("/dashboard");
  const toggle = page.getByRole("button", { name: "Abrir menu do organizador" });
  const nav = page.getByRole("navigation", { name: "Menu do organizador" });
  if (compact) {
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(nav).toBeHidden();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("button", { name: "Fechar menu", exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(nav).toBeHidden();
    await expect(toggle).toBeFocused();
    await toggle.click();
  } else {
    await expect(toggle).toBeHidden();
  }
  await expect(nav).toBeVisible();
  const sidebar = page.locator("#organizer-sidebar");
  await expect(sidebar.getByText(/Menu fixo no desktop|recolhível no mobile/)).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Painel mobile", exact: true })).toHaveCount(0);
  await expect(nav.getByRole("link")).toHaveCount(organizerLinks.length);
  for (const [name, href] of organizerLinks) {
    await expect(nav.getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
  }

  const profile = nav.getByRole("link", { name: "Perfil", exact: true });
  await profile.scrollIntoViewIfNeeded();
  await expect(profile).toBeInViewport();
  expect(await sidebar.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);

  await nav.getByRole("link", { name: "Pedidos", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/pedidos$/);
  if (compact) {
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(nav).toBeHidden();
    await toggle.click();
  }
  await expect(nav.getByRole("link", { name: "Pedidos", exact: true })).toHaveAttribute("aria-current", "page");

  const internalPanel = await request.get("/painel-mobile.html");
  expect(internalPanel.status()).toBe(200);
  expect(await internalPanel.text()).toContain("<title>SorteX · Painel do organizador</title>");
});
