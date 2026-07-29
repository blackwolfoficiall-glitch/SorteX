import { expect, test, type Page } from "@playwright/test";

async function openComposer(page: Page, content: string, scheduledAt?: string) {
  await page.goto("/dashboard/comunicacao?tab=new");
  await expect(page.getByRole("heading", { name: "Nova comunicação" })).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel(/^ContatoSelecione/).selectOption({ index: 1 });
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("textbox", { name: /^Mensagem/ }).fill(content);
  if (scheduledAt) await page.getByLabel("Agendar (opcional)").fill(scheduledAt);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText(/Prévia para \d+ destinatário/)).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("Sandbox — nenhum envio externo")).toBeVisible();
}

test("comunicação mantém abas, modelos, rascunho, sandbox e agendamento", async ({ page }) => {
  const suffix = Date.now();
  const templateName = `Modelo E2E ${suffix}`;
  const templateEdited = `${templateName} atualizado`;

  await page.goto("/dashboard/comunicacao?tab=templates");
  await expect(page.getByRole("tab", { name: "Modelos" })).toHaveAttribute("aria-selected", "true");
  await page.getByPlaceholder("Nome").fill(templateName);
  await page.getByPlaceholder("Conteúdo").fill(`Olá {{nome}}, mensagem ${suffix}.`);
  await page.getByRole("button", { name: "Salvar template" }).click();
  await expect(page.getByText("Template criado.")).toBeVisible();

  let template = page.locator("article").filter({ hasText: templateName });
  await expect(template).toBeVisible();
  await template.getByRole("button", { name: "Editar" }).click();
  await page.getByPlaceholder("Nome").fill(templateEdited);
  await page.getByRole("button", { name: "Salvar template" }).click();
  await expect(page.getByText("Template atualizado.")).toBeVisible();
  template = page.locator("article").filter({ hasText: templateEdited });
  await template.getByRole("button", { name: "Duplicar" }).click();
  await expect(page.getByText("Template duplicado.")).toBeVisible();
  await page.reload();
  await expect(page.locator("article").filter({ hasText: templateEdited }).first()).toBeVisible();

  const draftContent = `Rascunho E2E ${suffix}`;
  await openComposer(page, draftContent);
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page.getByText("Comunicação salva como rascunho.")).toBeVisible();
  await expect(page).toHaveURL(/tab=history/);
  await page.reload();
  await page.getByLabel("Buscar comunicação").fill(draftContent);
  let result = page.locator("article").first();
  await expect(result).toBeVisible();
  await result.getByRole("button", { name: "Ver detalhes" }).click();
  await expect(result).toContainText(draftContent);

  const sandboxContent = `Sandbox E2E ${suffix}`;
  await openComposer(page, sandboxContent);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Processar teste no sandbox" }).click();
  await expect(page.getByText(/canal\(is\) registrado\(s\) em sandbox/)).toBeVisible();
  await page.getByLabel("Buscar comunicação").fill(sandboxContent);
  result = page.locator("article").first();
  await expect(result).toContainText("Processada em sandbox");
  await result.getByRole("button", { name: "Ver detalhes" }).click();
  await expect(result).toContainText(sandboxContent);

  const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const local = new Date(future.getTime() - future.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
  const scheduledContent = `Agendamento E2E ${suffix}`;
  await openComposer(page, scheduledContent, local);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Agendar no sandbox" }).click();
  await expect(page).toHaveURL(/tab=history/);
  await page.getByRole("tab", { name: "Agendamentos" }).click();
  await expect(page).toHaveURL(/tab=schedules/);
  await page.getByLabel("Buscar comunicação").fill(scheduledContent);
  const scheduled = page.locator("article").first();
  await expect(scheduled).toContainText("Agendada");
  await scheduled.getByRole("button", { name: "Executar agora em sandbox" }).click();
  await expect(
    page.getByText("Envio registrado em modo de teste. Nenhuma mensagem externa foi enviada."),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Histórico" }).click();
  await page.getByLabel("Buscar comunicação").fill(scheduledContent);
  await expect(page.locator("article").first()).toContainText("Processada em sandbox");

  await page.getByRole("tab", { name: "Métricas" }).click();
  await expect(page).toHaveURL(/tab=metrics/);
  await page.goBack();
  await expect(page).toHaveURL(/tab=history/);
});
