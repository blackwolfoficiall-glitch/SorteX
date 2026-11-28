import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const origin = new URL(process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000");
assert.equal(origin.protocol, "http:");
assert.equal(origin.hostname, "127.0.0.1", "Use somente ambiente local com banco descartável");
const password = process.env.TEST_SEED_PASSWORD;
assert.ok(password);
const output = process.env.SORTEX_ORDER_DETAIL_SCREENSHOTS;
if (output) await mkdir(output, { recursive: true });
const api = "/api/organizer/orders";
const dashboard = "/dashboard/pedidos";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_BINARY || undefined,
  args: ["--disable-gpu", "--no-zygote", "--renderer-process-limit=1"],
});
const context = await browser.newContext({
  baseURL: origin.origin, viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2,
  colorScheme: "light", reducedMotion: "reduce",
});
try {
  await context.route("**/*", (route) => {
    const request = route.request();
    return request.method() === "GET" && new URL(request.url()).origin === origin.origin ? route.continue() : route.abort();
  });
  const p = await context.newPage();
  p.setDefaultTimeout(40_000);
  assert.equal((await context.request.get(api)).status(), 401);
  assert.equal((await context.request.post("/api/auth/login", {
    data: { email: "organizer1@sortex.example.invalid", password },
  })).status(), 200);
  const list = await context.request.get(api);
  assert.equal(list.status(), 200);
  const { items } = await list.json();
  const paid = items.find((order) => order.status === "PAID" && order._count.tickets === 2);
  const pending = items.find((order) => order.status === "AWAITING_PAYMENT" && !order._count.tickets);
  assert.ok(paid?.id);
  assert.ok(pending?.id);

  for (const url of [
    dashboard + "/" + paid.id, "/api/auth/me", "/api/plans/me", "/api/organizer/profile",
    "/api/organizer/personalization", "/api/legal/pending",
  ]) assert.equal((await context.request.get(url)).status(), 200, url);
  const checkDetails = async (orderId) => {
    const [response] = await Promise.all([
      p.waitForResponse((res) => new URL(res.url()).pathname === `${api}/${orderId}`),
      p.goto(`${dashboard}/${orderId}`),
    ]);
    assert.equal(response.status(), 200);
    const body = await response.json();
    assert.equal(body.id, orderId);
    assert.ok(body.payments.every((payment) => !("pixCopyPaste" in payment) && !("pixQrCode" in payment) && !("pixQrCodeBase64" in payment)));
    return body;
  };
  const capture = async (file) => {
    if (!output) return;
    await p.evaluate(() => document.fonts.ready.then(() => scrollTo(0, 0)));
    await p.screenshot({ path: resolve(output, file), animations: "disabled", scale: "device", style: "nextjs-portal { display: none !important }" });
  };

  const actualPaid = await checkDetails(paid.id);
  assert.equal(actualPaid.status, "PAID");
  assert.equal(actualPaid._count.tickets, 2);
  assert.ok(!actualPaid.tickets, "O contrato atual fornece contagem e não números");
  assert.ok(actualPaid.payments.some((payment) => payment.status === "APPROVED"));
  await expect(p.getByRole("heading", { name: paid.campaign.title, exact: true })).toBeVisible();
  await expect(p.getByText("2 títulos registrados no pedido. A lista de números não está disponível nesta consulta.")).toBeVisible();
  await expect(p.getByText("Aprovado", { exact: true })).toBeVisible();
  await expect(p.getByRole("heading", { name: "Eventos registrados" })).toBeVisible();
  await expect(p.getByText("pix qa confirmado", { exact: true })).toBeVisible();
  await expect(p.getByText("O código Pix fica protegido no checkout do comprador.")).toBeVisible();
  await expect(p.getByRole("link", { name: "Abrir no CRM" })).toHaveAttribute("href", `/dashboard/crm/contatos?search=${encodeURIComponent(paid.buyer.email)}`);
  await expect(p.getByRole("link", { name: "Voltar aos pedidos" })).toHaveAttribute("href", dashboard);
  await capture("SorteX-Detalhe-Pedido-pago-desktop.png");

  await p.setViewportSize({ width: 390, height: 844 });
  await p.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  const actualPending = await checkDetails(pending.id);
  assert.equal(actualPending.status, "AWAITING_PAYMENT");
  assert.equal(actualPending._count.tickets, 0);
  assert.ok(actualPending.payments.some((payment) => payment.status === "PENDING"));
  await expect(p.getByRole("heading", { name: pending.campaign.title, exact: true })).toBeVisible();
  await expect(p.getByText("Aguardando pagamento", { exact: true })).toBeVisible();
  await expect(p.getByText("Pendente", { exact: true })).toBeVisible();
  await expect(p.getByText("Nenhum título registrado para este pedido.")).toBeVisible();
  await expect(p.getByText("Aprovado em", { exact: true })).toHaveCount(0);
  await expect(p.getByText("Pagamento ainda não confirmado. Este valor não é um recebimento.")).toBeVisible();
  await expect(p.getByText("PIX-INTERNO-QA-NAO-EXIBIR")).toHaveCount(0);
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), 390);
  const badgeTheme = await p.getByText("Aguardando pagamento", { exact: true }).evaluate((node) => getComputedStyle(node).colorScheme);
  assert.equal(badgeTheme, "dark");
  await capture("SorteX-Detalhe-Pedido-pendente-celular.png");
  if (output) {
    await p.getByRole("heading", { name: "Pagamento e histórico" }).locator("..").screenshot({
      path: resolve(output, "SorteX-Detalhe-Pedido-celular-pagamento.png"),
      animations: "disabled", scale: "device", style: "nextjs-portal { display: none !important }",
    });
  }

  const failRoute = `**${api}/${pending.id}`;
  let sendError;
  const release = new Promise((done) => { sendError = done; });
  await p.route(failRoute, async (route) => {
    await release;
    await route.fulfill({ status: 503, json: { message: "Indisponibilidade deliberada no teste." } });
  });
  await p.goto(`${dashboard}/${pending.id}`);
  const wait = p.getByRole("status").filter({ hasText: "Carregando pedido…" });
  await expect(wait).toBeVisible();
  assert.equal(await wait.locator("svg").evaluate((node) => getComputedStyle(node).animationName), "none");
  sendError();
  await expect(p.getByRole("alert").filter({ hasText: "Não foi possível carregar o pedido." })).toBeVisible();
  await p.unroute(failRoute);
  await p.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(p.getByText("Aguardando pagamento", { exact: true })).toBeVisible();

  const assertUnavailable = async () => {
    await expect(p.getByRole("alert").filter({ hasText: "Pedido indisponível para esta conta." })).toBeVisible();
    await expect(p.getByText(paid.buyer.email, { exact: true })).toHaveCount(0);
    await expect(p.getByRole("link", { name: "Abrir no CRM" })).toHaveCount(0);
  };
  await p.goto(`${dashboard}/qa-sintetico-nao-existe`);
  await assertUnavailable();
  await context.clearCookies();
  await p.goto(`${dashboard}/${paid.id}`);
  await expect(p).toHaveURL(/\/login\?next=/);
  assert.equal((await context.request.post("/api/auth/login", {
    data: { email: "organizer2@sortex.example.invalid", password },
  })).status(), 200);
  assert.equal((await context.request.get(`${api}/${paid.id}`)).status(), 404);
  await p.goto(`${dashboard}/${paid.id}`);
  await assertUnavailable();
  for (const [endpoint, account] of [
    ["/api/auth/login", "buyer1@sortex.example.invalid"],
    ["/api/auth/admin-login", "admin@sortex.example.invalid"],
  ]) {
    await context.clearCookies();
    assert.equal((await context.request.post(endpoint, { data: { email: account, password } })).status(), 200);
    assert.equal((await context.request.get(`${api}/${paid.id}`)).status(), 403);
  }

  console.log(JSON.stringify({
    route: `${dashboard}/[id]`, paidTicketCount: actualPaid._count.tickets, pendingTicketCount: actualPending._count.tickets,
    anonymous: 401, otherOrganizer: 404, buyer: 403, admin: 403, paidHistory: true, nonexistentSameState: true, protectedPix: true,
    darkMobile: true, loadingReducedMotion: true, errorRetry: true,
  }));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message.split("\n").filter((line) => !/cookie|authorization/i.test(line)).join("\n"));
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
