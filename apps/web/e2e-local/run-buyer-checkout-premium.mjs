import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const origin = new URL(process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000");
assert.equal(origin.protocol, "http:");
assert.equal(origin.hostname, "127.0.0.1");
const password = process.env.TEST_SEED_PASSWORD;
assert.ok(password);
const output = process.env.SORTEX_CHECKOUT_SCREENSHOTS;
if (output) await mkdir(output, { recursive: true });
const purchaseApi = (id) => `/api/purchases/${id}`;
const paymentApi = (id) => `/api/payments/purchase/${id}`;
const checkoutRoute = (id) => `/comprador/checkout/${id}`;
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
    const forbiddenPath = /^\/api\/(payments\/(pix|card|config)|purchases\/reserve)/.test(url.pathname);
    if (url.origin === origin.origin && ["GET", "HEAD"].includes(req.method()) && !forbiddenPath) return route.continue();
    if (url.origin !== origin.origin || !url.pathname.startsWith("/__nextjs")) blocked.push({ method: req.method(), path: url.pathname });
    return route.abort();
  });
  return ctx;
}
async function login(ctx, email) {
  assert.equal((await ctx.request.post("/api/auth/login", { data: { email, password } })).status(), 200);
}
const first = await context();
try {
  await login(first, "buyer1@sortex.example.invalid");
  const rows = await (await first.request.get("/api/purchases/my")).json();
  const reserved = rows.find(({ campaign }) => campaign.title === "Reservada QA · Mochila Azul");
  const expired = rows.find(({ campaign }) => campaign.title === "Expirada QA · Luz de leitura");
  assert.equal(reserved.status, "RESERVED");
  assert.equal(expired.status, "EXPIRED");
  // A stored non-approved payment triggers existing auto-refresh. Open only
  // known no-payment orders, and block all browser writes and external URLs.
  assert.equal((await first.request.get(paymentApi(reserved.id))).status(), 404);
  assert.equal((await first.request.get(paymentApi(expired.id))).status(), 404);
  const p = await first.newPage();
  p.setDefaultTimeout(37_000);
  const capture = async (name) => {
    if (!output) return;
    await p.evaluate(() => document.fonts.ready.then(() => scrollTo(0, 0)));
    await p.screenshot({ path: resolve(output, name), scale: "device", animations: "disabled", style: "nextjs-portal { display: none !important }" });
  };
  const [record, payment] = await Promise.all([
    p.waitForResponse((response) => new URL(response.url()).pathname === purchaseApi(reserved.id)),
    p.waitForResponse((response) => new URL(response.url()).pathname === paymentApi(reserved.id)),
    p.goto(checkoutRoute(reserved.id)),
  ]);
  assert.equal(record.status(), 200);
  assert.equal(payment.status(), 404);
  const scope = p.locator(".sx-premium");
  const summary = p.getByRole("region", { name: reserved.campaign.title });
  const methods = p.getByRole("group", { name: "Forma de pagamento" });
  const pix = methods.getByRole("button", { name: "Pix" });
  const card = methods.getByRole("button", { name: "Cartão" });
  const terms = p.getByRole("checkbox", { name: /Li e aceito o regulamento/ });
  const generate = p.getByRole("button", { name: "Gerar Pix de teste" });
  await expect(p.getByRole("heading", { name: "Finalize sua participação" })).toBeVisible();
  await expect(p.getByText("Checkout · Ambiente de teste", { exact: true })).toBeVisible();
  await expect(summary.getByText("Reservada", { exact: true })).toBeVisible();
  await expect(summary.getByText("Tempo restante da reserva")).toBeVisible();
  await expect(summary.getByText("1 título no pedido", { exact: true })).toBeVisible();
  await expect(summary.getByText("5,10", { exact: false }).first()).toBeVisible();
  await expect(generate).toBeDisabled();
  await expect(terms).not.toBeChecked();
  await expect(pix).toHaveAttribute("aria-pressed", "true");
  await expect(card).toHaveAttribute("aria-pressed", "false");
  await expect(p.getByRole("button", { name: "Cancelar e voltar" })).toBeEnabled();
  await expect(p.getByRole("link", { name: "Ver meus títulos" })).toHaveAttribute("href", "/comprador/meus-numeros");
  await capture("SorteX-Checkout-Premium-desktop.png");

  await pix.focus();
  await p.keyboard.press("Tab");
  await expect(card).toBeFocused();
  assert.equal(await card.evaluate((node) => getComputedStyle(node).outlineWidth), "2px");
  // Card method preview only, without checking terms and therefore without SDK.
  await p.keyboard.press("Enter");
  await expect(card).toHaveAttribute("aria-pressed", "true");
  await expect(p.getByText("Aceite os termos para abrir o formulário seguro.")).toBeVisible();
  await expect(p.locator("#sortex-card-payment-brick")).toHaveCount(0);
  await pix.click();
  // Checking terms with Pix selected is a local UI change only. Do not click Generate.
  await terms.check();
  await expect(generate).toBeEnabled();
  await terms.uncheck();
  await expect(generate).toBeDisabled();

  for (const colorScheme of ["light", "dark"]) {
    await p.setViewportSize({ width: 320, height: 850 });
    await p.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await expect(summary).toBeVisible();
    const [scrollWidth, viewport] = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    assert.ok(scrollWidth <= viewport);
    assert.equal(await scope.evaluate((node) => getComputedStyle(node).colorScheme), colorScheme);
  }
  await capture("SorteX-Checkout-Premium-celular.png");
  await p.goto(checkoutRoute(expired.id));
  await expect(p.getByRole("heading", { name: "O tempo da sua reserva terminou." })).toBeVisible();
  await expect(p.getByText("Tempo restante da reserva")).toHaveCount(0);
  await expect(p.getByRole("link", { name: "Iniciar nova reserva" })).toHaveAttribute("href", `/campanha/${expired.campaign.slug}`);
  await expect(generate).toHaveCount(0);
  await expect(p.getByRole("button", { name: "Cancelar e voltar" })).toHaveCount(0);
  await capture("SorteX-Checkout-Premium-expirada.png");

  const other = await context();
  await login(other, "buyer2@sortex.example.invalid");
  assert.equal((await other.request.get(purchaseApi(reserved.id))).status(), 404);
  assert.equal((await other.request.get(paymentApi(reserved.id))).status(), 404);
  const second = await other.newPage();
  await second.goto(checkoutRoute(reserved.id));
  await expect(second.locator(".sx-premium").getByRole("alert")).toBeVisible();
  await expect(second.getByRole("heading", { name: reserved.campaign.title })).toHaveCount(0);
  await expect(second.getByRole("button", { name: "Gerar Pix de teste" })).toHaveCount(0);
  await other.close();

  const anon = await context();
  assert.equal((await anon.request.get(purchaseApi(reserved.id))).status(), 401);
  assert.equal((await anon.request.get(paymentApi(reserved.id))).status(), 401);
  const third = await anon.newPage();
  await third.goto(checkoutRoute(reserved.id));
  await expect(third).toHaveURL(/\/login\?next=%2Fcomprador%2Fcheckout%2F/);
  await anon.close();
  const organizer = await context();
  await login(organizer, "organizer1@sortex.example.invalid");
  assert.equal((await organizer.request.get(purchaseApi(reserved.id))).status(), 403);
  assert.equal((await organizer.request.get(paymentApi(reserved.id))).status(), 403);
  await organizer.close();
  assert.deepEqual(blocked, []);
  console.log(JSON.stringify({
    route: "/comprador/checkout/[id]", rendered: ["reserved/no payment", "expired/no payment"],
    amount: "R$ 5,10", terms: "Pix gate and Card preview without mounting SDK", auth: "401 anonymous, 403 organizer, 404 foreign",
    viewport: "1440 light; 320 light/dark", browser: "Chromium", keyboard: true, transactionsAttempted: 0,
  }));
} finally {
  await browser.close();
}
