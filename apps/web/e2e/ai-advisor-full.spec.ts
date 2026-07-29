import { expect, test } from "@playwright/test";

test("IA SorteX responde, simula, gera mensagem editável e preserva contexto", async ({ page }) => {
  await page.goto("/dashboard/ia");
  await expect(page.getByText("SorteX Advisor")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Olá,/ })).toBeVisible();

  await page.getByRole("button", { name: "Conversar" }).click();
  await page.getByRole("button", { name: "Quantas reservas abandonadas existem?" }).click();
  await expect(page.getByText("Resposta do motor local determinístico")).toBeVisible();

  await page.getByRole("button", { name: "Simulações" }).click();
  const quantity = page.getByLabel("Quantidade");
  await quantity.fill("");
  await expect(quantity).toHaveValue("");
  await quantity.fill("250");
  await page.getByRole("button", { name: "Calcular simulação" }).click();
  await expect(page.getByText("Faturamento bruto")).toBeVisible();
  await expect(page.getByText("Receita estimada")).toBeVisible();

  await page.getByRole("button", { name: "Mensagens IA" }).click();
  await page.getByLabel("Objetivo da mensagem").selectOption({ label: "Reserva abandonada" });
  await page.getByLabel("Tom da mensagem").selectOption({ label: "Profissional" });
  await page.getByRole("button", { name: "Gerar mensagem" }).click();
  const generated = page.locator("textarea");
  await expect(generated).not.toHaveValue("");
  const edited = `Mensagem IA revisada ${Date.now()}`;
  await generated.fill(edited);
  await expect(generated).toHaveValue(edited);
  await page.getByRole("link", { name: "Abrir Comunicação" }).click();
  await expect(page).toHaveURL(/dashboard\/comunicacao\?tab=new/);
  await expect(page.getByRole("heading", { name: "Nova comunicação" })).toBeVisible();
});
