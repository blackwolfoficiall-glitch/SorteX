import { expect, test } from "@playwright/test";

test("cota premiada cria, edita, pausa, reativa, filtra e persiste", async ({ page }) => {
  const number = String(1000 + (Date.now() % 8000));
  const prize = `Prêmio E2E ${number}`;
  const editedPrize = `${prize} atualizado`;

  await page.goto("/dashboard/ganhadores");
  await page.getByRole("button", { name: "Adicionar cota premiada", exact: true }).click();
  const wizard = page.getByRole("dialog");
  await page.getByRole("button", { name: "Avançar" }).click();
  await wizard.getByRole("textbox", { name: "Número da cota" }).fill(number);
  await page.getByRole("button", { name: "Avançar" }).click();
  await wizard.getByLabel("Nome do prêmio").fill(prize);
  await wizard.getByLabel("Valor estimado").fill("25");
  await wizard.getByLabel("Instruções de entrega").fill("Contato de homologação");
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.getByRole("button", { name: "Ativar agora" }).click();
  await page.getByRole("button", { name: "Avançar" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Ativar", exact: true }).click();
  await expect(page.getByText("Cota premiada ativada.")).toBeVisible();

  await page.locator('[data-status-card="available"]').click();
  let card = page.locator("article").filter({ hasText: prize });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Editar" }).click();
  await page.getByRole("dialog").getByLabel("Nome do prêmio").fill(editedPrize);
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.getByRole("button", { name: "Salvar pausada" }).click();
  await expect(page.getByText("Cota premiada atualizada.")).toBeVisible();

  card = page.locator("article").filter({ hasText: editedPrize });
  page.once("dialog", (dialog) => dialog.accept());
  await card.getByRole("button", { name: "Pausar" }).click();
  await expect(page.getByText("Cota pausada.")).toBeVisible();

  await page.locator('[data-status-card="paused"]').click();
  await expect(page).toHaveURL(/status=paused/);
  card = page.locator("article").filter({ hasText: editedPrize });
  await card.getByRole("button", { name: "Reativar" }).click();
  await expect(page.getByText("Cota reativada.")).toBeVisible();

  await page.locator('[data-status-card="available"]').click();
  card = page.locator("article").filter({ hasText: editedPrize });
  await card.locator('summary[aria-label="Mais ações"]').click();
  await card.getByRole("button", { name: "Ver histórico" }).click();
  await expect(page.getByText(`Histórico da cota ${number}`)).toBeVisible();
  await page.getByRole("button", { name: "Fechar", exact: true }).click();

  await page.reload();
  await expect(page).toHaveURL(/status=available/);
  await expect(page.locator("article").filter({ hasText: editedPrize })).toBeVisible();
});
