import { expect, test } from "@playwright/test";

const path = "/dashboard/comunicacao";
const api = "/api/engagement/communications";

test("Comunicação reads its history and previews a message without submitting it", async ({ page }) => {
  const unexpectedWrites: string[] = [];
  await page.route("**/api/engagement/**", (route) => {
    const request = route.request();
    const url = new URL(request.url()).pathname;
    if (request.method() === "GET" || (url === api + "/preview" && request.method() === "POST"))
      return route.continue();
    unexpectedWrites.push(url);
    return route.abort();
  });

  const response = page.waitForResponse((reply) => new URL(reply.url()).pathname === api);
  await page.goto(path);
  const view = page.locator(".sx-communication");
  await expect(view.getByRole("heading", { name: "Comunicação inteligente" })).toBeVisible();
  const actual = await response;
  expect(actual.ok()).toBe(true);
  await expect(view.getByText("Registros consultados", { exact: true }).locator("..")).toContainText(String((await actual.json()).length));

  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await expect(view).toHaveCSS("color-scheme", "dark");
  const tabs = view.getByRole("tablist", { name: "Seções de Comunicação" });
  const overview = tabs.getByRole("tab", { name: "Visão geral" });
  const compose = tabs.getByRole("tab", { name: "Nova comunicação" });
  await overview.focus();
  await page.keyboard.press("ArrowRight");
  await expect(compose).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(compose).toHaveAttribute("aria-selected", "true");
  const editor = view.getByRole("region", { name: "Nova comunicação" });
  const next = editor.getByRole("button", { name: "Continuar" });
  await next.click();
  await editor.getByLabel(/^ContatoSelecione/).selectOption({ index: 1 });
  await next.click();
  const whatsapp = editor.getByRole("button", { name: /WhatsApp/ });
  await expect(editor.getByRole("button", { name: /^Push/ })).toBeDisabled();
  await whatsapp.click();
  await next.click();
  await expect(editor.getByRole("alert")).toHaveText("Selecione ao menos um canal disponível.");
  await whatsapp.click();
  await next.click();
  await editor.getByRole("button", { name: "Sugerir texto de um modelo local" }).click();
  const assistant = view.getByRole("dialog", { name: "Sugestões de texto por modelo" });
  await expect(assistant.getByText(/sem provedor de IA e sem envio/)).toBeVisible();
  await assistant.getByRole("button", { name: "Fechar assistente" }).click();
  await editor.getByRole("textbox", { name: /^Mensagem/ }).fill("Olá, {{nome}}. Prévia fictícia.");
  const previewResponse = page.waitForResponse((reply) => new URL(reply.url()).pathname === api + "/preview");
  await next.click();
  const preview = await previewResponse;
  expect(preview.ok()).toBe(true);
  await expect(editor.getByText(/Prévia para \d+ destinatário/)).toBeVisible();
  expect((await preview.json()).content).toContain("Prévia fictícia.");
  await next.click();
  await expect(editor.getByText("Sandbox — nenhum envio externo")).toBeVisible();
  const confirmation = page.waitForEvent("dialog");
  const clicked = editor.getByRole("button", { name: "Processar teste no sandbox" }).click();
  const dialog = await confirmation;
  expect(dialog.message()).toContain("Nenhuma mensagem externa será enviada.");
  await dialog.dismiss();
  await clicked;
  expect(unexpectedWrites).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("Comunicação reports an unavailable API without presenting fabricated zero counts", async ({ page }) => {
  await page.route("**/api/engagement/communications", (route) => route.fulfill({ status: 503, json: {} }), { times: 1 });
  await page.goto(path);
  const view = page.locator(".sx-communication");
  await expect(view.getByRole("alert")).toHaveText("Não foi possível carregar esta área.");
  await expect(view.getByText("Registros consultados", { exact: true })).toHaveCount(0);
  await view.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(view.getByText("Registros consultados", { exact: true })).toBeVisible();
});
