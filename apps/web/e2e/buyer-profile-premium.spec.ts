import { expect, test, type Page } from "@playwright/test";

const route = "/comprador/perfil";
const api = "/api/buyer/profile";
const email = process.env.E2E_BUYER_EMAIL;
const password = process.env.E2E_BUYER_PASSWORD;

async function login(page: Page) {
  await page.context().clearCookies();
  const login = await page.request.post("/api/auth/login", { data: { email, password } });
  expect(login.ok()).toBe(true);
}

test("buyer profile retains its account links and accessible controls without writes", async ({ page }) => {
  test.skip(!email || !password, "Requer comprador sintético por E2E_BUYER_EMAIL/E2E_BUYER_PASSWORD.");
  await login(page);
  const methods: string[] = [];
  await page.route("**/api/buyer/profile", (request) => {
    methods.push(request.request().method());
    return request.request().method() === "GET" ? request.continue() : request.abort();
  });
  const response = page.waitForResponse((reply) => new URL(reply.url()).pathname === api);
  await page.goto(route);
  expect((await response).ok()).toBe(true);
  const view = page.locator(".sx-buyer-profile");
  const form = view.getByRole("region", { name: "Dados pessoais" });
  await expect(form).toBeVisible();
  await expect(form.getByRole("button", { name: "Salvar dados" })).toBeEnabled();
  const name = form.getByLabel("Nome", { exact: true });
  await expect(name).not.toHaveValue("");
  await expect(form.getByLabel("Telefone", { exact: true })).toHaveAttribute("type", "tel");
  await expect(form.getByLabel("Cidade", { exact: true })).toBeEditable();
  await expect(form.getByLabel("Estado (UF)", { exact: true })).toBeEditable();
  const nav = view.getByRole("navigation", { name: "Acessos da conta" });
  for (const [label, href] of [
    ["Meus prêmios", "/comprador/meus-premios"], ["Resultados", "/comprador/resultados"],
    ["Favoritos", "/comprador/favoritos"], ["Notificações", "/comprador/notificacoes"],
    ["Suporte", "/comprador/suporte"], ["Segurança e senha", "/esqueci-senha"],
  ]) await expect(nav.getByRole("link", { name: label, exact: true })).toHaveAttribute("href", href);
  await expect(view.getByRole("button", { name: "Sair da conta" })).toBeEnabled();
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await expect(view).toHaveCSS("color-scheme", "dark");
  await name.focus();
  await page.keyboard.press("Tab");
  await expect(form.getByLabel("Telefone", { exact: true })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(methods).toEqual(["GET"]);
});

test("buyer profile failure does not show account data and can be retried", async ({ page }) => {
  test.skip(!email || !password, "Requer comprador sintético por E2E_BUYER_EMAIL/E2E_BUYER_PASSWORD.");
  await login(page);
  await page.route("**/api/buyer/profile", (request) => request.fulfill({ status: 503, json: {} }), { times: 1 });
  await page.goto(route);
  const view = page.locator(".sx-buyer-profile");
  await expect(view.getByRole("alert")).toHaveText("Não foi possível carregar seu perfil.");
  await expect(view.getByRole("region", { name: "Dados pessoais" })).toHaveCount(0);
  await view.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(view.getByRole("region", { name: "Dados pessoais" })).toBeVisible();
});
