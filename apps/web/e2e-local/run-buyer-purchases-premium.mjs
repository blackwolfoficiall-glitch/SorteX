import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const origin = new URL(process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000");
assert.equal(origin.protocol, "http:");
assert.equal(origin.hostname, "127.0.0.1");
const password = process.env.TEST_SEED_PASSWORD;
assert.ok(password);
const output = process.env.SORTEX_PURCHASES_SCREENSHOTS;
if (output) await mkdir(output, { recursive: true });
const path = "/comprador/meus-numeros";
const api = "/api/purchases/my";
const paidName = "Paga QA · Bicicleta Aurora";
const foreignName = "Compra privada QA · Quadro da segunda conta";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_BINARY || undefined,
  args: ["--disable-gpu", "--no-zygote", "--renderer-process-limit=1"],
});
const contextOptions = {
  baseURL: origin.origin, viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 2, colorScheme: "light", reducedMotion: "reduce",
};
const ctx = await browser.newContext(contextOptions);
const blocked = [];
function guard(route) {
  const req = route.request();
  const url = new URL(req.url());
  if (url.origin === origin.origin && ["GET", "HEAD"].includes(req.method())) return route.continue();
  if (url.origin !== origin.origin || !url.pathname.startsWith("/__nextjs")) blocked.push(req.method());
  return route.abort();
}
async function login(context, email, endpoint = "/api/auth/login") {
  assert.equal((await context.request.post(endpoint, { data: { email, password } })).status(), 200);
}
try {
  await ctx.route("**/*", guard);
  const p = await ctx.newPage();
  p.setDefaultTimeout(40_000);
  assert.equal((await ctx.request.get(api)).status(), 401);
  await p.goto(path);
  await expect(p).toHaveURL(/\/login\?next=%2Fcomprador%2Fmeus-numeros$/);
  await login(ctx, "buyer1@sortex.example.invalid");
  const [initial] = await Promise.all([
    p.waitForResponse((response) => new URL(response.url()).pathname === api), p.goto(path),
  ]);
  assert.equal(initial.status(), 200);
  const rows = await initial.json();
  const paidPurchase = rows.find((purchase) => purchase.campaign.title === paidName);
  assert.equal(paidPurchase.status, "PAID");
  assert.equal(paidPurchase.tickets.length, 13);
  assert.equal(paidPurchase.total, 17.55);
  assert.ok(!rows.some((purchase) => purchase.campaign.title === foreignName));
  const history = p.getByRole("region", { name: "Histórico de compras" });
  const filters = p.getByRole("region", { name: "Filtrar compras por situação" });
  const card = (title) => history.getByRole("article").filter({ has: p.getByRole("heading", { name: title, exact: true }) });
  await expect(p.getByRole("heading", { name: "Meus títulos", exact: true })).toBeVisible();
  await expect(card(paidName)).toContainText("Valor confirmado");
  await expect(card(paidName)).toContainText("17,55");
  await expect(card(paidName)).toContainText("05/11/2026, 11:25");
  await expect(card(paidName).getByRole("list", { name: "Números emitidos" }).getByRole("listitem")).toHaveCount(12);
  await expect(card(paidName)).toContainText("Mais 1 no detalhe");
  await expect(card(paidName).getByRole("link")).toHaveAttribute("href", `/comprador/compras/${paidPurchase.id}`);
  await expect(p.getByRole("heading", { name: foreignName })).toHaveCount(0);
  const capture = async (name) => {
    if (!output) return;
    await p.evaluate(() => document.fonts.ready.then(() => scrollTo(0, 0)));
    await p.screenshot({ path: resolve(output, name), scale: "device", animations: "disabled", style: "nextjs-portal { display: none !important }" });
  };
  await capture("SorteX-Meus-Titulos-Premium-desktop.png");
  const all = filters.getByRole("button", { name: "Todas" });
  await all.focus();
  await p.keyboard.press("Tab");
  const reservedButton = filters.getByRole("button", { name: "Reservadas" });
  await expect(reservedButton).toBeFocused();
  assert.equal(await reservedButton.evaluate((node) => getComputedStyle(node).outlineWidth), "2px");
  for (const [button, state, title] of [
    ["Reservadas", "RESERVED", "Reservada QA · Mochila Azul"],
    ["Aguardando", "AWAITING_PAYMENT", "Aguardando QA · Kit Beija-Flor"],
    ["Expiradas", "EXPIRED", "Expirada QA · Luz de leitura"],
    ["Canceladas", "CANCELLED", "Cancelada QA · Café de teste"],
    ["Estornadas", "REFUNDED", "Estornada QA · Caneca Roxa"],
    ["Pagas", "PAID", paidName],
  ]) {
    const [response] = await Promise.all([
      p.waitForResponse((candidate) => new URL(candidate.url()).searchParams.get("status") === state),
      filters.getByRole("button", { name: button }).click(),
    ]);
    assert.equal(response.status(), 200);
    const data = await response.json();
    assert.ok(data.length > 0 && data.every((item) => item.status === state));
    await expect(card(title)).toBeVisible();
    if (state !== "PAID") {
      await expect(card(title)).toContainText("Valor do pedido");
      await expect(card(title).getByRole("list", { name: "Números emitidos" })).toHaveCount(0);
    }
    if (["RESERVED", "AWAITING_PAYMENT"].includes(state)) await expect(card(title)).toContainText("Prazo previsto");
    else await expect(card(title).getByText("Prazo previsto:", { exact: false })).toHaveCount(0);
  }
  await filters.getByRole("button", { name: "Pendentes" }).click();
  await expect(history.getByRole("heading", { name: "Nenhuma compra nesta categoria" })).toBeVisible();
  await history.getByRole("button", { name: "Ver todas" }).click();
  await expect(card(paidName)).toBeVisible();

  let failOnce = true;
  const delayedError = async (route) => {
    if (!failOnce) return route.fallback();
    failOnce = false;
    await new Promise((done) => setTimeout(done, 400));
    await route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
  };
  await p.route("**/api/purchases/my?status=PAID", delayedError);
  await filters.getByRole("button", { name: "Pagas" }).click();
  const spinner = p.getByRole("status").filter({ hasText: "Carregando compras" });
  await expect(spinner).toBeVisible();
  assert.equal(await spinner.locator("svg").evaluate((node) => getComputedStyle(node).animationName), "none");
  await expect(history.getByRole("alert")).toContainText("Não foi possível carregar suas compras.");
  await history.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(card(paidName)).toBeVisible();

  await p.setViewportSize({ width: 320, height: 850 });
  for (const colorScheme of ["light", "dark"]) {
    await p.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await expect(card(paidName)).toBeVisible();
    const measurements = await p.evaluate(() => {
      const scope = document.querySelector(".sx-premium");
      return [document.documentElement.scrollWidth, window.innerWidth, getComputedStyle(scope).colorScheme];
    });
    assert.ok(measurements[0] <= measurements[1], "no horizontal mobile overflow");
    assert.equal(measurements[2], colorScheme);
  }
  await capture("SorteX-Meus-Titulos-Premium-celular.png");

  const other = await browser.newContext(contextOptions);
  await other.route("**/*", guard);
  await login(other, "buyer2@sortex.example.invalid");
  const second = await other.newPage();
  await second.goto(path);
  await expect(second.getByRole("heading", { name: foreignName, exact: true })).toBeVisible();
  await expect(second.getByRole("heading", { name: paidName, exact: true })).toHaveCount(0);
  assert.equal((await other.request.get(`/api/purchases/${paidPurchase.id}`)).status(), 404);
  const privateRows = await (await other.request.get(api)).json();
  assert.deepEqual(privateRows.map((item) => item.campaign.title), [foreignName]);
  await other.close();

  const organizer = await browser.newContext(contextOptions);
  await login(organizer, "organizer1@sortex.example.invalid");
  assert.equal((await organizer.request.get(api)).status(), 403);
  await organizer.close();
  const administrator = await browser.newContext(contextOptions);
  await login(administrator, "admin@sortex.example.invalid", "/api/auth/admin-login");
  const adminList = await administrator.request.get(api);
  assert.equal(adminList.status(), 200);
  assert.deepEqual(await adminList.json(), []);
  assert.equal((await administrator.request.get(`/api/purchases/${paidPurchase.id}`)).status(), 404);
  await administrator.close();
  assert.deepEqual(blocked, []);
  console.log(JSON.stringify({
    path, paidValue: "R$ 17,55", issued: 13, displayed: 12, filters: 8, isolatedBuyers: 2,
    anonymous: 401, organizer: 403, administrator: "200 own empty list, 404 foreign detail", foreignDetail: 404,
    viewport: "1440 light; 320 light/dark", keyboard: true, loadingEmptyRecovery: true, noApplicationWrites: true,
  }));
} finally {
  await browser.close();
}
