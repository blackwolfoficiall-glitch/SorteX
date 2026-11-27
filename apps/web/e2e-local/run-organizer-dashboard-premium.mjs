import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const target = new URL(process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000");
assert.equal(target.protocol, "http:");
assert.equal(target.hostname, "127.0.0.1", "Use só um deploy local com banco descartável");
const password = process.env.TEST_SEED_PASSWORD;
assert.ok(password, "O seed local precisa definir TEST_SEED_PASSWORD");
const destination = process.env.SORTEX_DASHBOARD_SCREENSHOTS;
if (destination) await mkdir(destination, { recursive: true });

const path = "/api/dashboard/period";
const fmtMoney = (value) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const isPeriod = (response) => new URL(response.url()).pathname === path;
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_BINARY || undefined,
  args: ["--disable-gpu", "--no-zygote", "--renderer-process-limit=1"],
});
const context = await browser.newContext({
  baseURL: target.origin, colorScheme: "light",
  viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce",
  deviceScaleFactor: 2,
});
try {
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === target.origin ? route.continue() : route.abort());
  // Warm the handler at the same protected entry point before the browser's
  // 15-second auth timeout; a cold Next dev compiler is not API latency.
  const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const anonymous = await context.request.get(`${path}?start=${day}&end=${day}`);
  assert.equal(anonymous.status(), 401);
  assert.equal(anonymous.headers()["cache-control"], "private, no-store");
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  if (process.env.PLAYWRIGHT_TRACE_REQUESTS === "1") {
    page.on("requestfailed", (request) => {
      if (new URL(request.url()).origin === target.origin) {
        console.error("Local request failed:", new URL(request.url()).pathname, request.failure()?.errorText);
      }
    });
  }
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
  const session = await context.request.post("/api/auth/login", {
    data: { email: "organizer1@sortex.example.invalid", password },
  });
  assert.equal(session.status(), 200);
  // Compile Next development route handlers one at a time on constrained QA
  // runners; real authenticated browser requests below still verify the UI.
  for (const href of [
    "/dashboard", "/api/auth/me", "/api/plans/me", "/api/organizer/profile",
    "/api/organizer/personalization", "/api/legal/pending", "/api/campaigns/my",
    "/api/dashboard", "/api/crm/dashboard",
  ]) assert.equal((await context.request.get(href)).status(), 200, href);
  const [initial] = await Promise.all([page.waitForResponse(isPeriod), page.goto("/dashboard")]);
  assert.equal(initial.status(), 200);
  const payload = await initial.json();
  const sales = page.getByRole("region", { name: "Desempenho de vendas" });
  await expect(sales.getByText(/Intervalo:.*Brasília/)).toBeVisible();
  const displayedRevenue = await sales.getByText(fmtMoney(payload.summary.grossRevenue), { exact: true }).first().innerText();
  assert.equal(displayedRevenue.replaceAll("\u00a0", " "), fmtMoney(payload.summary.grossRevenue).replaceAll("\u00a0", " "));
  for (const [label, value] of [
    ["Títulos vendidos", payload.summary.soldTickets],
    ["Participantes", payload.summary.participants],
    ["Pedidos pagos", payload.summary.paidOrders],
  ]) {
    await expect(sales.locator("dl > div").filter({ hasText: label })).toContainText(value.toLocaleString("pt-BR"));
  }
  assert.ok(payload.summary.paidOrders > 0, "Use um seed sintético com pedidos pagos e histórico");
  await expect(sales.getByRole("img", { name: /^Receita no intervalo/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Resumo da operação" })).toBeVisible();
  const shortcuts = page.getByRole("region", { name: "Ações rápidas" });
  await expect(shortcuts.getByText("Ads · somente leitura")).toBeVisible();
  for (const [title, href] of [
    ["Criar campanha", "/dashboard/campanhas/nova"],
    ["Criar promoção", "/dashboard/promocoes"],
    ["Enviar WhatsApp", "/dashboard/comunicacao"],
    ["Relatórios", "/dashboard/financeiro"],
  ]) {
    await expect(shortcuts.getByRole("link", { name: title, exact: true })).toHaveAttribute("href", href);
  }
  await expect(page.getByRole("link", { name: "Conferir integrações" })).toHaveAttribute("href", "/dashboard/integracoes");
  const initialFilter = sales.getByRole("button", { name: "7 dias" });
  if (await initialFilter.getAttribute("aria-pressed") === "false") {
    await initialFilter.click();
    await expect(sales.getByRole("img", { name: /^Receita no intervalo/ })).toBeVisible();
  }
  await expect(initialFilter).toHaveAttribute("aria-pressed", "true");
  const screenshot = async (name) => {
    if (!destination) return;
    await page.evaluate(() => document.fonts.ready.then(() => null));
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: resolve(destination, name), animations: "disabled", scale: "device",
      style: "nextjs-portal { display: none !important }",
    });
  };
  const ticketAmount = sales.getByText(fmtMoney(payload.summary.grossRevenue), { exact: true }).first();
  for (const copy of [ticketAmount, sales.getByText("Total bruto confirmado", { exact: true }), sales.getByText(/Intervalo:.*Brasília/)]) {
    assert.equal(await copy.evaluate((node) => getComputedStyle(node).color), "rgb(255, 255, 255)");
  }
  await screenshot("SorteX-Dashboard-Web-desktop.png");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
  assert.equal(await sales.evaluate((node) => getComputedStyle(node).colorScheme), "dark");
  const rgb = (css) => css.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  const contrast = (a, b) => {
    const luminance = (c) => c.map((x) => x / 255)
      .map((x) => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4)
      .reduce((sum, x, i) => sum + x * [0.2126, 0.7152, 0.0722][i], 0);
    const vals = [luminance(rgb(a)), luminance(rgb(b))].sort((x, y) => y - x);
    return (vals[0] + .05) / (vals[1] + .05);
  };
  const styles = await sales.evaluate((node) => ({
    surface: getComputedStyle(node).backgroundColor,
    copy: getComputedStyle(node.querySelector("header p:last-child")).color,
  }));
  assert.ok(contrast(styles.surface, styles.copy) >= 4.5);
  await screenshot("SorteX-Dashboard-Web-celular-escuro.png");

  const first = sales.getByRole("button", { name: "Hoje", exact: true });
  await first.focus();
  await page.keyboard.press("Tab");
  await expect(initialFilter).toBeFocused();
  const focus = await initialFilter.evaluate((el) => ({
    shown: el.matches(":focus-visible"),
    width: getComputedStyle(el).outlineWidth,
    transition: getComputedStyle(el).transitionDuration,
  }));
  assert.ok(focus.shown);
  assert.equal(focus.width, "2px");
  assert.equal(focus.transition, "0s");
  const [today] = await Promise.all([page.waitForResponse(isPeriod), first.click()]);
  assert.equal(today.status(), 200);
  await expect(first).toHaveAttribute("aria-pressed", "true");
  const todayPayload = await today.json();
  assert.deepEqual(todayPayload.period, { start: day, end: day, timeZone: "America/Sao_Paulo" });
  await expect(sales.getByText(fmtMoney(todayPayload.summary.grossRevenue), { exact: true }).first()).toBeVisible();

  const custom = sales.getByRole("button", { name: "Personalizado" });
  await custom.click();
  await expect(sales.getByText("Escolha as datas e toque em Aplicar.")).toBeVisible();
  const start = sales.getByLabel("Início");
  const end = sales.getByLabel("Fim");
  await start.fill(payload.period.end);
  await end.fill(payload.period.start);
  await sales.getByRole("button", { name: "Aplicar" }).click();
  await expect(sales.getByRole("alert")).toContainText("Informe as datas em ordem");
  await start.fill(payload.period.start);
  await end.fill(payload.period.end);
  const [customResult] = await Promise.all([
    page.waitForResponse(isPeriod),
    sales.getByRole("button", { name: "Aplicar" }).click(),
  ]);
  assert.equal(customResult.status(), 200);
  assert.deepEqual((await customResult.json()).summary, payload.summary);
  await start.fill("2000-01-01");
  await end.fill("2000-01-01");
  const [empty] = await Promise.all([
    page.waitForResponse(isPeriod),
    sales.getByRole("button", { name: "Aplicar" }).click(),
  ]);
  assert.equal(empty.status(), 200);
  assert.equal((await empty.json()).summary.paidOrders, 0);
  await expect(sales.getByText("Sem receita registrada nesse intervalo.")).toBeVisible();

  // Only the explicit unavailability states are force-injected. The fallback
  // values are from the real /api/dashboard snapshot and disposable PostgreSQL.
  const periodPattern = "**/api/dashboard/period?*";
  await page.route(periodPattern, (route) => route.fulfill({ status: 404, json: { message: "Rota indisponível no teste" } }));
  await initialFilter.click();
  await expect(sales.getByText(/Na versão anterior, os filtros de receita usam os dias UTC/)).toBeVisible();
  await expect(sales.getByText(/Intervalo:.*UTC/)).toBeVisible();
  await expect(sales.getByText("(histórico total)", { exact: true }).first()).toBeVisible();
  await page.unroute(periodPattern);
  await page.route(periodPattern, (route) => route.fulfill({ status: 503, json: { message: "Indisponibilidade temporária de teste" } }));
  await first.click();
  await expect(sales.getByRole("alert")).toContainText("Indisponibilidade temporária de teste");
  await page.unroute(periodPattern);
  const [recovered] = await Promise.all([
    page.waitForResponse(isPeriod),
    sales.getByRole("button", { name: "Tentar novamente" }).click(),
  ]);
  assert.equal(recovered.status(), 200);
  await expect(sales.getByText(/Intervalo:.*Brasília/)).toBeVisible();

  console.log(JSON.stringify({
    route: "/dashboard", anonymous: "login redirect", viewports: ["1440x1000 light", "390x844 dark"],
    summary: payload.summary, emptyPeriod: true, customDateValidation: true,
    legacyUtc: true, retry: true, keyboard: true, reducedMotion: true,
    darkMutedContrast: Number(contrast(styles.surface, styles.copy).toFixed(2)),
  }));
} catch (error) {
  // Playwright's transport log can include local test cookies. Do not retain them.
  const description = error instanceof Error ? error.message : String(error);
  console.error(description.split("\n").filter((line) => !/cookie|authorization/i.test(line)).join("\n"));
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
