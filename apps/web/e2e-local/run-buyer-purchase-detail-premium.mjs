import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const origin = new URL(process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000");
assert.equal(origin.protocol, "http:");
assert.equal(origin.hostname, "127.0.0.1");
const password = process.env.TEST_SEED_PASSWORD;
assert.ok(password);
const output = process.env.SORTEX_PURCHASE_DETAIL_SCREENSHOTS;
if (output) await mkdir(output, { recursive: true });
const purchaseApi = (id) => `/api/purchases/${id}`;
const paymentApi = (id) => `/api/payments/purchase/${id}`;
const detailRoute = (id) => `/comprador/compras/${id}`;
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_BINARY || undefined,
  args: ["--disable-gpu", "--no-zygote", "--renderer-process-limit=1"],
});
const options = {
  baseURL: origin.origin, viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 2, colorScheme: "light", reducedMotion: "reduce",
};
const blocked = [];
async function context() {
  const ctx = await browser.newContext(options);
  await ctx.route("**/*", (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const forbiddenPath = /^\/(?:comprador\/checkout|api\/payments\/(?:pix|card)|api\/purchases\/reserve)/.test(url.pathname);
    if (url.origin === origin.origin && ["GET", "HEAD"].includes(req.method()) && !forbiddenPath) return route.continue();
    if (url.origin !== origin.origin || !url.pathname.startsWith("/__nextjs")) blocked.push(req.method());
    return route.abort();
  });
  return ctx;
}
async function login(ctx, email, endpoint = "/api/auth/login") {
  assert.equal((await ctx.request.post(endpoint, { data: { email, password } })).status(), 200);
}
const first = await context();
try {
  await login(first, "buyer1@sortex.example.invalid");
  const rows = await (await first.request.get("/api/purchases/my")).json();
  const paid = rows.find(({ campaign }) => campaign.title === "Paga QA · Bicicleta Aurora");
  const pending = rows.find(({ campaign }) => campaign.title === "Aguardando QA · Kit Beija-Flor");
  const reserved = rows.find(({ campaign }) => campaign.title === "Reservada QA · Mochila Azul");
  const expired = rows.find(({ campaign }) => campaign.title === "Expirada QA · Luz de leitura");
  assert.ok(paid.id && pending.id && reserved.id && expired.id);
  const p = await first.newPage();
  p.setDefaultTimeout(37_000);
  const capture = async (name) => {
    if (!output) return;
    await p.evaluate(() => document.fonts.ready.then(() => scrollTo(0, 0)));
    await p.screenshot({ path: resolve(output, name), scale: "device", animations: "disabled", style: "nextjs-portal { display: none !important }" });
  };
  const [record, payment] = await Promise.all([
    p.waitForResponse((response) => new URL(response.url()).pathname === purchaseApi(paid.id)),
    p.waitForResponse((response) => new URL(response.url()).pathname === paymentApi(paid.id)),
    p.goto(detailRoute(paid.id)),
  ]);
  assert.equal(record.status(), 200);
  assert.equal(payment.status(), 200);
  assert.equal((await payment.json()).status, "APPROVED");
  const article = p.getByRole("article", { name: paid.campaign.title });
  await expect(article.getByText("Paga", { exact: true })).toBeVisible();
  await expect(article.getByText("17,55", { exact: false })).toBeVisible();
  await expect(article.getByText("05/11/2026, 11:25", { exact: false })).toBeVisible();
  await expect(article.getByText("Aprovado", { exact: true })).toBeVisible();
  await expect(article.getByText("Pix", { exact: true })).toBeVisible();
  await expect(article.getByRole("list", { name: "Números emitidos" }).getByRole("listitem")).toHaveCount(13);
  await expect(article.getByRole("link", { name: "Continuar pagamento" })).toHaveCount(0);
  await expect(article.getByRole("link", { name: "Preciso de suporte" })).toHaveAttribute("href", "/comprador/suporte");
  const history = p.getByRole("link", { name: "Voltar ao histórico" });
  await expect(history).toHaveAttribute("href", "/comprador/meus-numeros");
  await capture("SorteX-Detalhe-Compra-Premium-desktop.png");
  await history.focus();
  await p.keyboard.press("Tab");
  await expect(article.getByRole("link", { name: "Preciso de suporte" })).toBeFocused();
  await p.keyboard.press("Shift+Tab");
  await expect(history).toBeFocused();
  assert.equal(await history.evaluate((node) => getComputedStyle(node).outlineWidth), "2px");
  await history.click();
  await expect(p).toHaveURL(/\/comprador\/meus-numeros$/);
  await p.getByRole("link", { name: `Ver compra: ${paid.campaign.title}`, exact: true }).click();
  await expect(article.getByText("Aprovado", { exact: true })).toBeVisible();

  for (const [width, colorScheme] of [[320, "light"], [320, "dark"]]) {
    await p.setViewportSize({ width, height: 850 });
    await p.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await expect(article).toBeVisible();
    const [scrollWidth, viewport, actualMode] = await p.evaluate(() => [
      document.documentElement.scrollWidth, window.innerWidth, getComputedStyle(document.querySelector(".sx-premium")).colorScheme,
    ]);
    assert.ok(scrollWidth <= viewport);
    assert.equal(actualMode, colorScheme);
  }
  await capture("SorteX-Detalhe-Compra-Premium-celular.png");

  await p.goto(detailRoute(pending.id));
  const awaiting = p.getByRole("article", { name: pending.campaign.title });
  await expect(awaiting.getByText("Aguardando pagamento", { exact: true })).toBeVisible();
  await expect(awaiting.getByText("Aguardando confirmação", { exact: true })).toBeVisible();
  await expect(awaiting.getByText("Prazo previsto:", { exact: false })).toBeVisible();
  await expect(awaiting.getByRole("list", { name: "Números emitidos" })).toHaveCount(0);
  await expect(awaiting.getByRole("link", { name: "Continuar pagamento" })).toHaveAttribute("href", `/comprador/checkout/${pending.id}`);
  assert.ok(!(await p.locator("body").innerText()).includes("SORTEX_SYNTHETIC_NOT_A_PAYMENT_CODE"));
  await capture("SorteX-Detalhe-Compra-Premium-aguardando.png");

  await p.goto(detailRoute(reserved.id));
  const reservation = p.getByRole("article", { name: reserved.campaign.title });
  await expect(reservation.getByText("Nenhum pagamento registrado")).toBeVisible();
  await expect(reservation.getByRole("link", { name: "Continuar pagamento" })).toHaveAttribute("href", `/comprador/checkout/${reserved.id}`);
  await p.goto(detailRoute(expired.id));
  const expiration = p.getByRole("article", { name: expired.campaign.title });
  await expect(expiration.getByText("Expirada", { exact: true })).toBeVisible();
  await expect(expiration.getByRole("link", { name: "Continuar pagamento" })).toHaveCount(0);

  const delayError = async (route) => {
    await new Promise((done) => setTimeout(done, 400));
    await route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
  };
  await p.route(`**${purchaseApi(paid.id)}`, delayError);
  await p.goto(detailRoute(paid.id));
  const spinner = p.getByRole("status").filter({ hasText: "Carregando compra" });
  await expect(spinner).toBeVisible();
  assert.equal(await spinner.locator("svg").evaluate((node) => getComputedStyle(node).animationName), "none");
  await expect(p.getByRole("region", { name: "Compra indisponível" }).getByRole("alert")).toContainText("Não foi possível abrir esta compra.");
  await p.unroute(`**${purchaseApi(paid.id)}`, delayError);
  await p.route(`**${paymentApi(paid.id)}`, delayError);
  await p.getByRole("button", { name: "Tentar novamente", exact: true }).click();
  await expect(article.getByText("Situação do pagamento indisponível.")).toBeVisible();
  await expect(article.getByRole("list", { name: "Números emitidos" })).toBeVisible();
  await p.unroute(`**${paymentApi(paid.id)}`, delayError);
  await p.getByRole("button", { name: "Tentar consultar novamente" }).click();
  await expect(article.getByText("Aprovado", { exact: true })).toBeVisible();

  const other = await context();
  await login(other, "buyer2@sortex.example.invalid");
  const ownRows = await (await other.request.get("/api/purchases/my")).json();
  const own = ownRows[0];
  assert.notEqual(own.id, paid.id);
  assert.equal((await other.request.get(purchaseApi(paid.id))).status(), 404);
  assert.equal((await other.request.get(paymentApi(paid.id))).status(), 404);
  const second = await other.newPage();
  const paymentReads = [];
  second.on("request", (req) => { if (new URL(req.url()).pathname === paymentApi(paid.id)) paymentReads.push(1); });
  await second.goto(detailRoute(paid.id));
  await expect(second.getByRole("region", { name: "Compra indisponível" }).getByRole("alert")).toContainText("Não foi possível abrir esta compra.");
  await expect(second.getByRole("heading", { name: paid.campaign.title })).toHaveCount(0);
  assert.deepEqual(paymentReads, []);
  await second.goto(detailRoute(own.id));
  await expect(second.getByRole("heading", { name: own.campaign.title })).toBeVisible();
  await other.close();

  const anon = await context();
  assert.equal((await anon.request.get(purchaseApi(paid.id))).status(), 401);
  assert.equal((await anon.request.get(paymentApi(paid.id))).status(), 401);
  const third = await anon.newPage();
  await third.goto(detailRoute(paid.id));
  await expect(third).toHaveURL(/\/login\?next=%2Fcomprador%2Fcompras%2F/);
  await anon.close();
  const organizer = await context();
  await login(organizer, "organizer1@sortex.example.invalid");
  assert.equal((await organizer.request.get(purchaseApi(paid.id))).status(), 403);
  assert.equal((await organizer.request.get(paymentApi(paid.id))).status(), 403);
  await organizer.close();
  assert.deepEqual(blocked, []);
  console.log(JSON.stringify({
    route: "/comprador/compras/[id]", rendered: ["paid/approved", "awaiting/pending", "reserved/no payment", "expired"],
    issued: 13, auth: "401 anonymous, 403 organizer, 404 foreign", private: "no payment GET after denied purchase, no Pix data rendered",
    viewport: "1440 light; 320 light/dark", browser: "Chromium", keyboard: true, recovery: "purchase and payment 503", transactionsAttempted: 0,
  }));
} finally {
  await browser.close();
}
