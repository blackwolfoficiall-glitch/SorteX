import { expect, test } from "@playwright/test";

test("cadastro não apresenta conexões ou cobranças que não existem", async ({
  page,
}) => {
  await page.goto("/cadastro/organizador/financeiro");
  await expect(
    page.getByRole("heading", { name: "Configuração Financeira" }),
  ).toBeVisible();

  for (const name of ["Stone", "PagBank", "Pagar.me", "Asaas"]) {
    const card = page.getByRole("article", { name });
    await expect(card).toBeVisible();
    await expect(
      card.getByRole("button", { name: "Integração indisponível" }),
    ).toBeDisabled();
  }
  await expect(page.getByText("Recebimentos reais")).toBeVisible();
  await expect(page.getByText("Desabilitados", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Ir para o painel" }),
  ).toHaveAttribute("href", "/dashboard");
  await expect(page.getByText("● Conectado")).toHaveCount(0);

  await page.getByRole("link", { name: "Ver ambiente de teste" }).click();
  await expect(page).toHaveURL(/\/organizador\/gateways\/mercado-pago$/);
  await expect(page.getByText("Pix de teste", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Sem recebimento, split ou saque real"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Conectar com Mercado Pago" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Abrir painel financeiro" }),
  ).toHaveAttribute("href", "/dashboard/financeiro");
});
