import { expect, test } from "@playwright/test";

test("automações críticas executam de ponta a ponta no sandbox", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/dashboard/crm/automacoes");
  const templates = [
    "Boas-vindas",
    "Recuperar reserva abandonada",
    "Lembrar pagamento pendente",
    "Agradecer compra aprovada",
  ];

  for (const template of templates) {
    const uniqueName = `${template} E2E ${Date.now()}`;
    await page.getByRole("button", { name: new RegExp(`^${template}`) }).click();
    const nameInput = page.getByPlaceholder("Nome da automação");
    await nameInput.fill(uniqueName);
    await page.getByRole("button", { name: "Salvar fluxo como rascunho" }).click();

    const card = page.locator("article").filter({ has: page.getByText(uniqueName, { exact: true }) });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Ativar" }).click();
    await expect(card.getByRole("button", { name: "Executar teste sandbox" })).toBeVisible();
    await card.getByRole("button", { name: "Executar teste sandbox" }).click();
    await expect(page.getByText("Teste executado no sandbox. Nenhuma mensagem externa foi enviada.")).toBeVisible();
    await expect(card.getByText("1 execuções")).toBeVisible();
    await card.getByRole("button", { name: "Pausar" }).click();
    await expect(card.getByRole("button", { name: "Ativar" })).toBeVisible();
    await card.getByRole("button", { name: "Ativar" }).click();
    await expect(card.getByRole("button", { name: "Executar teste sandbox" })).toBeVisible();
  }

  await page.reload();
  for (const template of templates) {
    await expect(page.getByText(new RegExp(`^${template} E2E`)).first()).toBeVisible();
  }
});
