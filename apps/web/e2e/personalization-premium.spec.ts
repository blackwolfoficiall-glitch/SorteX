import { expect, test, type Page } from "@playwright/test";

const path = "/dashboard/personalizacao";
const api = "/api/organizer/personalization";

async function openSection(page: Page, name: "Identidade" | "Aparência" | "Pré-visualização") {
  const view = page.locator(".sx-personalization");
  const mobile = view.getByLabel("Seção de personalização", { exact: true });
  if ((page.viewportSize()?.width ?? 1280) < 768) {
    await mobile.selectOption({ label: name });
  } else {
    const tab = view.getByRole("navigation", { name: "Seções de personalização" }).getByRole("button", { name, exact: true });
    await tab.focus();
    await page.keyboard.press("Enter");
    await expect(tab).toHaveAttribute("aria-pressed", "true");
  }
}

test("Personalização displays the saved brand, preserves the real iframe and discards local-only edits", async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? "http://127.0.0.1:3100").origin;
  const writes: string[] = [];
  await page.route("**/*", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname.startsWith("/api/") && !["GET", "HEAD"].includes(request.method())) {
      writes.push(url.pathname);
      return route.abort();
    }
    return route.continue();
  });
  await page.goto(path);
  const view = page.locator(".sx-personalization");
  const editor = view.getByRole("region", { name: "Editor de personalização" });
  const save = view.getByRole("button", { name: "Salvar alterações" });
  await expect(view.getByRole("heading", { name: "Personalização" })).toBeVisible();
  await expect(save).toBeDisabled();
  await expect(editor.getByLabel("Nome público", { exact: true })).not.toHaveValue("");

  await openSection(page, "Aparência");
  const field = editor.locator("label").filter({ hasText: /^Cor do fundo/ }).locator('input[type="color"]');
  const original = await field.inputValue();
  await openSection(page, "Pré-visualização");
  const iframe = view.locator('iframe[title^="Prévia da campanha"]').filter({ visible: true }).first();
  await expect(iframe).toBeVisible();
  const publicView = iframe.contentFrame().locator("main").first();
  await expect(publicView).toHaveCSS("background-color", hexRgb(original), { timeout: 15000 });
  await expect(iframe.contentFrame().locator(".sx-personalization")).toHaveCount(0);
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await expect(view).toHaveCSS("color-scheme", "dark");
  await expect(publicView).toHaveCSS("background-color", hexRgb(original));

  await openSection(page, "Aparência");
  const next = original.toLowerCase() === "#8d89b2" ? "#9785bb" : "#8d89b2";
  await field.fill(next);
  await expect(save).toBeEnabled();
  await openSection(page, "Pré-visualização");
  await expect(publicView).toHaveCSS("background-color", hexRgb(next), { timeout: 15000 });
  const accept = page.waitForEvent("dialog");
  const discard = view.getByRole("button", { name: "Descartar alterações" }).click();
  await (await accept).accept();
  await discard;
  await expect(save).toBeDisabled();
  await expect(publicView).toHaveCSS("background-color", hexRgb(original));
  await openSection(page, "Aparência");
  await expect(field).toHaveValue(original);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(writes).toEqual([]);
});

test("Personalização shows unavailable data until a successful retry", async ({ page }) => {
  await page.route("**" + api, (route) => route.fulfill({ status: 503, json: {} }));
  await page.goto(path);
  const view = page.locator(".sx-personalization");
  await expect(view.getByRole("alert")).toHaveText("Não foi possível carregar sua personalização.");
  await expect(view.getByRole("button", { name: "Salvar alterações" })).toHaveCount(0);
  await page.unroute("**" + api);
  await view.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(view.getByRole("region", { name: "Editor de personalização" })).toBeVisible();
  await expect(view.getByRole("button", { name: "Salvar alterações" })).toBeDisabled();
});

function hexRgb(value: string) {
  const channels = value.replace("#", "").match(/../g)?.map((channel) => Number.parseInt(channel, 16)) ?? [];
  return `rgb(${channels.join(", ")})`;
}
