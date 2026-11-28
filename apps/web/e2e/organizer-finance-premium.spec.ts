import { expect, test } from "@playwright/test";

const financePath = "/dashboard/financeiro";
const currency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

test("organizer reads actual balances and fees, filters and exports the statement", async ({ page }) => {
  const methods: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/finance/"))
      methods.push(request.method());
  });
  const overviewResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/api/finance/overview");
  const statementResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/api/finance/statement");
  await page.goto(financePath);
  await expect(page.getByRole("heading", { name: "Financeiro SorteX" })).toBeVisible();
  const [overview, statement] = await Promise.all([overviewResponse, statementResponse]);
  expect(overview.ok()).toBe(true);
  expect(statement.ok()).toBe(true);
  const { balance } = await overview.json();
  const statementData = await statement.json();
  const account = page.getByRole("region", { name: "Posição contábil interna" });
  await expect(account).toContainText("Confira recebimentos e prazos de liquidação diretamente no seu gateway.");
  await expect(account.getByRole("heading", { name: "Disponibilidade no controle interno" })).toBeVisible();
  await expect(page.getByRole("button", { name: /sacar|solicitar saque/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /sacar|solicitar saque/i })).toHaveCount(0);
  await expect(account.locator(".sx-finance-ticket-amount")).toHaveText(currency(balance.available));
  await expect(account.getByText("Pendente no controle", { exact: true }).locator("..")).toContainText(currency(balance.pending));
  await expect(account.getByText("Bloqueado no controle", { exact: true }).locator("..")).toContainText(currency(balance.blocked));
  const fees = page.getByRole("region", { name: "Taxas acumuladas" });
  await expect(fees).toContainText("A taxa do gateway pode incluir estimativas");
  await expect(fees.getByText("Taxa SorteX", { exact: true }).locator("..")).toContainText(currency(balance.platformFees));
  await expect(fees.getByText("Taxa do gateway registrada", { exact: true }).locator("..")).toContainText(currency(balance.gatewayFees));

  const chooser = page.getByLabel("Período", { exact: true });
  await chooser.selectOption("custom");
  const downloadButton = page.getByRole("button", { name: "Exportar Excel" });
  await page.getByLabel("De", { exact: true }).fill("2025-12-31");
  await page.getByLabel("Até", { exact: true }).fill("2025-12-01");
  await expect(page.locator(".sx-finance").getByRole("alert")).toContainText("A data inicial deve ser anterior ou igual à data final.");
  await expect(downloadButton).toBeDisabled();
  await page.getByLabel("De", { exact: true }).fill("");
  await page.getByLabel("Até", { exact: true }).fill("");
  await expect(downloadButton).toBeEnabled();
  const entries = page.getByRole("region", { name: "Extrato", exact: true }).locator("li");
  await expect(entries).toHaveCount(statementData.data.length);
  if (statementData.data.length) {
    const first = statementData.data[0];
    await expect(entries.first()).toContainText(first.description);
    await expect(entries.first()).toContainText(currency(Number(first.amount)));
  }
  const movements = page.getByRole("region", { name: "Movimentos no recorte" });
  const cents = (direction: string, type: string) => statementData.data
    .filter((entry: { type: string; direction: string }) => entry.direction === direction && entry.type === type)
    .reduce((sum: number, entry: { amount: string | number }) => sum + Math.round(Number(entry.amount) * 100), 0);
  const gross = cents("CREDIT", "GROSS_SALE");
  const net = cents("CREDIT", "ORGANIZER_NET_REVENUE");
  await expect(movements.getByText("Vendas brutas registradas").locator("..")).toContainText(currency(gross / 100));
  await expect(movements.getByText("Receita líquida registrada").locator("..")).toContainText(currency(net / 100));
  const downloaded = page.waitForEvent("download");
  await downloadButton.click();
  expect((await downloaded).suggestedFilename()).toMatch(/^sortex-extrato-.*\.xls$/);

  await page.evaluate(() => {
    window.print = () => document.body.setAttribute("data-print-invoked", "yes");
  });
  await page.getByRole("button", { name: "Exportar PDF" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-print-invoked", "yes");
  expect(methods).toEqual(["GET", "GET", "GET"]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
});

test("finance labels an unavailable contract without fictitious zeros and retries", async ({ page }) => {
  await page.route("**/api/finance/overview", (route) =>
    route.fulfill({ status: 404, json: {} }), { times: 1 });
  await page.goto(financePath);
  await expect(page.locator(".sx-finance").getByRole("alert")).toContainText("O financeiro não está disponível nesta versão da API");
  await expect(page.getByRole("region", { name: "Posição contábil interna" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Exportar Excel" })).toHaveCount(0);
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByRole("region", { name: "Posição contábil interna" })).toBeVisible();
});
