import { expect, test } from "@playwright/test";

test("módulos autenticados carregam sem erro técnico", async ({ page }) => {
  const routes = [
    ["/dashboard/crm/contatos?status=LEAD", "Contatos"],
    ["/dashboard/personalizacao", "Personalização"],
    ["/dashboard/mini-campanhas", "Mini Campanhas"],
    ["/dashboard/afiliados", "Afiliados"],
    ["/dashboard/crm/automacoes", "Construtor de automações"],
  ] as const;

  for (const [route, heading] of routes) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(route.split("?")[0]));
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await expect(page.getByText(/Unauthorized|Internal Server Error|stack trace/i)).toHaveCount(0);
  }
});

test("atalhos do dashboard preservam o contexto", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Recuperar clientes" }).click();
  await expect(page).toHaveURL(/\/dashboard\/crm\/contatos\?status=INACTIVE/);

  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Falar com VIPs" }).click();
  await expect(page).toHaveURL(/\/dashboard\/comunicacao\?tab=new&audience=VIP/);

  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Boas-vindas" }).click();
  await expect(page).toHaveURL(/\/dashboard\/crm\/automacoes\?template=welcome/);
  await expect(page.locator('input[value="Boas-vindas"]')).toBeVisible();

  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Impulsionar" }).click();
  await expect(page).toHaveURL(/\/dashboard\/ads\?action=create&campaignId=/);
});
