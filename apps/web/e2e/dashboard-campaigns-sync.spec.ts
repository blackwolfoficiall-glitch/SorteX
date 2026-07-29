import { expect, test } from "@playwright/test";

test("Dashboard navega para Campanhas publicadas e para as análises da IA", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Painel IA SorteX" })).toBeVisible();

  const analyses = [
    ["Melhor horário para vender: abrir análise na IA SorteX", "sales-time"],
    ["Campanhas abaixo da média: abrir análise na IA SorteX", "underperforming-campaigns"],
    ["Sugestões automáticas: abrir análise na IA SorteX", "recommendations"],
    ["Previsão de faturamento: abrir análise na IA SorteX", "revenue-forecast"],
  ] as const;
  for (const [label, analysis] of analyses) {
    await page.getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`analysis=${analysis}`));
    await expect(page.getByRole("heading", { name: label.split(":")[0] })).toBeVisible();
    await page.goto("/dashboard");
  }

  await page.getByRole("link", { name: "Ver todas" }).click();
  await expect(page).toHaveURL(/\/dashboard\/campanhas\?status=PUBLISHED/);
  await expect(page.getByRole("heading", { name: "Minhas Campanhas" })).toBeVisible({ timeout: 15_000 });
});

test("Filtros de Pedidos têm identificação e não geram overflow", async ({ page }) => {
  await page.goto("/dashboard/pedidos");
  for (const label of ["Busca", "Data inicial", "Data final", "Valor mínimo", "Valor máximo"]) {
    await expect(page.getByLabel(label, { exact: true })).toBeVisible({ timeout: 15_000 });
  }
  for (const name of ["Campanha", "Status", "Método de pagamento"]) {
    await expect(page.getByRole("combobox", { name, exact: true })).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("Minhas Campanhas recupera a lista após uma falha de rede", async ({ page }) => {
  await page.route("**/api/campaigns/my**", (route) => route.abort("failed"));
  await page.goto("/dashboard/campanhas");
  await expect(page.getByText("Não foi possível carregar suas campanhas.")).toBeVisible();

  await page.unroute("**/api/campaigns/my**");
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByText("Não foi possível carregar suas campanhas.")).toBeHidden();
  await expect(page.getByRole("heading", { name: "Minhas Campanhas" })).toBeVisible();
});
