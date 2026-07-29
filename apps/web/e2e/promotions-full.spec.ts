import { expect, test } from "@playwright/test";

async function selectSection(page: import("@playwright/test").Page, value: string, label: string) {
  const compact = page.locator('nav[aria-label="Seções de promoções"] select');
  await page.locator('nav[aria-label="Seções de promoções"]').waitFor();
  if (await compact.isVisible()) await compact.selectOption(value);
  else await page.getByRole("button", { name: label, exact: true }).click();
}

test("promoção cria, edita, ativa, pausa, reativa, duplica e persiste", async ({ page }) => {
  const name = `Promoção E2E ${Date.now()}`;
  const editedName = `${name} editada`;

  await page.goto("/dashboard/promocoes");
  await page.getByRole("button", { name: "Criar estratégia", exact: true }).click();
  const strategy = page.locator("article").filter({ hasText: "Bônus por quantidade" });
  await strategy.getByRole("button", { name: "Criar", exact: true }).click();

  await page.getByRole("button", { name: "Avançar" }).click();
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.getByLabel("Nome da estratégia").fill(name);
  await page.getByLabel("Quantidade comprada").fill("");
  await expect(page.getByLabel("Quantidade comprada")).toHaveValue("");
  await page.getByLabel("Quantidade comprada").fill("100");
  await page.getByLabel("Benefício / títulos extras").fill("20");
  for (let step = 3; step < 7; step += 1) {
    await page.getByRole("button", { name: "Avançar" }).click();
  }
  await page.getByRole("button", { name: "Salvar como rascunho" }).click();
  await expect(page.getByText("Estratégia salva como rascunho.")).toBeVisible();

  await selectSection(page, "drafts", "Rascunhos");
  let card = page.locator("article").filter({ hasText: name });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Editar" }).click();
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.getByLabel("Nome da estratégia").fill(editedName);
  for (let step = 3; step < 7; step += 1) {
    await page.getByRole("button", { name: "Avançar" }).click();
  }
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Ativar promoção" }).click();
  await expect(page.getByText("Estratégia ativada com sucesso.")).toBeVisible();

  card = page.locator("article").filter({ hasText: editedName });
  await expect(card).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await card.getByRole("button", { name: "Pausar" }).click();
  await expect(page.getByText("Estratégia pausada.")).toBeVisible();

  await selectSection(page, "paused", "Pausadas");
  card = page.locator("article").filter({ hasText: editedName });
  await card.getByRole("button", { name: "Reativar" }).click();
  await expect(page.getByText("Estratégia reativada.")).toBeVisible();

  card = page.locator("article").filter({ hasText: editedName });
  await card.getByRole("button", { name: "Duplicar" }).click();
  await expect(page.getByText("Estratégia duplicada e salva como rascunho.")).toBeVisible();
  await expect(page.getByRole("heading", { name: `${editedName} - cópia` })).toBeVisible();

  await page.reload();
  await selectSection(page, "drafts", "Rascunhos");
  await expect(page.getByRole("heading", { name: `${editedName} - cópia` })).toBeVisible();
});
