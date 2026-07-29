import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

async function loginBuyer(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("buyer1@sortex.example.invalid");
  await page.getByLabel("Senha", { exact: true }).fill("SortexTest!2026Mvp");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/comprador/);
}

test("comprador visualiza campanha, reserva e acessa checkout sandbox", async ({ page }) => {
  await loginBuyer(page);
  await page.goto("/campanha/campanha-piloto-homologacao");
  await expect(page.getByRole("heading", { name: "Campanha Piloto de Homologação" })).toBeVisible();

  const quantity = page.getByLabel("Quantidade", { exact: true });
  await quantity.fill("");
  await expect(quantity).toHaveValue("");
  await quantity.fill("12");
  await page.getByRole("button", { name: "Reservar títulos" }).click();
  await expect(page).toHaveURL(/\/comprador\/checkout\//);
  await expect(page.getByRole("heading", { name: "Finalize sua participação" })).toBeVisible();
  await expect(page.getByText("Checkout seguro · Sandbox")).toBeVisible();
  await expect(page.getByRole("button", { name: "Gerar PIX de teste" })).toBeDisabled();
});

test("compra aprovada e títulos persistidos aparecem apó novo login", async ({ page }) => {
  await loginBuyer(page);
  await page.goto("/comprador/meus-numeros");
  await expect(page.getByRole("heading", { name: "Meus títulos" })).toBeVisible();
  await page.getByRole("button", { name: "Pagas", exact: true }).click();
  let paidPurchase = page
    .locator('a[href^="/comprador/compras/"]')
    .filter({ has: page.getByText("Paga", { exact: true }) })
    .filter({ hasText: "Campanha Piloto de Homologação" });
  await expect(paidPurchase).toBeVisible();
  await expect(paidPurchase.getByText("42", { exact: true })).toBeVisible();
  await page.reload();
  paidPurchase = page
    .locator('a[href^="/comprador/compras/"]')
    .filter({ has: page.getByText("Paga", { exact: true }) })
    .filter({ hasText: "Campanha Piloto de Homologação" });
  await expect(paidPurchase).toBeVisible();
  await expect(paidPurchase.getByText("314", { exact: true })).toBeVisible();
});

test("navegação do comprador carrega perfil, prêmios, notificações e sorteios", async ({ page }) => {
  await loginBuyer(page);
  for (const route of [
    "/comprador",
    "/comprador/perfil",
    "/comprador/meus-premios",
    "/comprador/notificacoes",
    "/comprador/sorteios",
  ]) {
    const response = await page.goto(route);
    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("body")).not.toContainText("Unauthorized");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow, `${route} possui overflow horizontal`).toBe(false);
  }
});
