import { expect, test, type Page } from "@playwright/test";

const path = "/dashboard/crm/automacoes";

async function openCrm(page: Page) {
  await page.goto("/dashboard/crm");
  await expect(page.getByRole("heading", { name: "CRM SorteX" })).toBeVisible();
}

test("atalhos de reserva e pagamento abrem o modelo correto sem salvar", async ({ page }) => {
  let writes = 0;
  await page.route("**/api/engagement/automations", (route) => {
    if (route.request().method() === "GET") return route.continue();
    writes++;
    return route.fulfill({ status: 409, json: { message: "Escrita não esperada nesta navegação" } });
  });
  const form = page.getByRole("form", { name: "Configuração" });
  await openCrm(page);
  await page.getByRole("link", { name: /^Reserva abandonada\b/ }).click();
  await expect(page).toHaveURL(`${path}?template=abandoned`);
  await expect(form.getByLabel("Nome da automação")).toHaveValue("Recuperar reserva abandonada");
  await expect(form.getByLabel("Gatilho")).toHaveValue("RESERVATION_EXPIRED");
  await expect(form.getByLabel("Atraso em minutos")).toHaveValue("15");
  await expect(form.getByLabel("Ação", { exact: true })).toHaveValue("QUEUE_EXTERNAL_MESSAGE");
  await expect(form.getByLabel("Mensagem")).toHaveValue(/Sua reserva expirou/);
  await form.getByLabel("Nome da automação").fill("Alteração local sem salvar");

  await page.goBack();
  await expect(page.getByRole("heading", { name: "CRM SorteX" })).toBeVisible();
  const paymentLink = page.getByRole("link", { name: /^Automatizar pagamentos\b/ });
  await expect(paymentLink).toHaveAttribute("href", `${path}?template=payment`);
  await paymentLink.click();
  await expect(page).toHaveURL(`${path}?template=payment`);
  await expect(form.getByLabel("Nome da automação")).toHaveValue("Lembrar pagamento pendente");
  await expect(form.getByLabel("Gatilho")).toHaveValue("PURCHASE_PENDING");
  await expect(form.getByLabel("Atraso em minutos")).toHaveValue("30");
  await expect(form.getByLabel("Ação", { exact: true })).toHaveValue("QUEUE_EXTERNAL_MESSAGE");
  await expect(form.getByLabel("Mensagem")).toHaveValue(/Seu pagamento está pendente/);
  await expect(form.getByRole("button", { name: "Salvar fluxo como rascunho" })).toBeEnabled();
  expect(writes).toBe(0);
});

test("atalhos de status filtram e voltar restaura o estado da lista", async ({ page }) => {
  await page.route("**/api/engagement/automations", (route) =>
    route.fulfill({ json: [
      { id: "active-fixture", name: "Ativa sintética", status: "ACTIVE", totalRuns: 0 },
      { id: "paused-fixture", name: "Pausada sintética", status: "PAUSED", totalRuns: 0 },
      { id: "draft-fixture", name: "Rascunho sintético", status: "DRAFT", totalRuns: 0 },
    ] }),
  );
  await openCrm(page);
  await page.getByRole("link", { name: /^Fluxos ativos\b/ }).click();
  const list = page.getByRole("region", { name: "Fluxos ativos" });
  await expect(list.getByText("Ativa sintética")).toBeVisible();
  await expect(list.getByText("Pausada sintética")).toHaveCount(0);
  await expect(list.getByText("Rascunho sintético")).toHaveCount(0);
  await list.getByRole("link", { name: "Pausados" }).click();
  const paused = page.getByRole("region", { name: "Fluxos pausados" });
  await expect(paused.getByText("Pausada sintética")).toBeVisible();
  await expect(paused.getByText("Ativa sintética")).toHaveCount(0);
  await page.goBack();
  await expect(list.getByText("Ativa sintética")).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "CRM SorteX" })).toBeVisible();
  await page.getByRole("link", { name: /^Fluxos pausados\b/ }).click();
  await expect(paused.getByText("Pausada sintética")).toBeVisible();
  await paused.getByRole("link", { name: "Todos" }).click();
  await expect(page.getByText("Rascunho sintético")).toBeVisible();
});

test("novo, galeria, boas-vindas e modelo desconhecido têm destinos intencionais", async ({ page }) => {
  let writes = 0;
  page.on("request", (request) => {
    if (request.method() !== "GET" && new URL(request.url()).pathname.startsWith("/api/engagement/automations")) writes++;
  });
  const form = page.getByRole("form", { name: "Configuração" });
  await openCrm(page);
  await page.getByRole("link", { name: "Criar automação", exact: true })
    .and(page.locator(`a[href="${path}?action=new"]`)).click();
  await expect(form.getByLabel("Nome da automação")).toHaveValue("");
  await expect(form.getByLabel("Atraso em minutos")).toHaveValue("0");
  await page.goBack();
  await expect(page.getByRole("heading", { name: "CRM SorteX" })).toBeVisible();
  await page.getByRole("link", { name: "Usar modelo pronto" }).click();
  await expect(page).toHaveURL(`${path}?templates=1`);
  await expect(page.getByRole("heading", { name: "Modelos de automação" })).toBeFocused();
  await expect(form).toHaveCount(0);

  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Boas-vindas", exact: true }).click();
  await expect(form.getByLabel("Nome da automação")).toHaveValue("Boas-vindas");
  await expect(form.getByLabel("Gatilho")).toHaveValue("PURCHASE_APPROVED");
  await page.goto(`${path}?template=campaign-ending`);
  await expect(page.getByText("Este modelo não está disponível.", { exact: false })).toBeVisible();
  await expect(form).toHaveCount(0);
  expect(writes).toBe(0);
});
