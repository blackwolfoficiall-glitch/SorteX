import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const base = new URL(process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000");
assert.equal(base.protocol, "http:");
assert.equal(base.hostname, "127.0.0.1", "Use somente instância local e banco descartável");
const password = process.env.TEST_SEED_PASSWORD;
assert.ok(password);
const output = process.env.SORTEX_ADS_SCREENSHOTS;
if (output) await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_BINARY || undefined,
  args: ["--disable-gpu", "--no-zygote", "--renderer-process-limit=1"],
});
const ctx = await browser.newContext({
  baseURL: base.origin, viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 2, colorScheme: "light", reducedMotion: "reduce",
});
const path = "/dashboard/ads";
const api = "/api/platform/sortex-ads/confirmed-sales";
const fixture = "Campanha sintética · Demonstração Ads";
try {
  const blocked = [];
  await ctx.route("**/*", (route) => {
    const req = route.request();
    if (new URL(req.url()).origin === base.origin && ["GET", "HEAD"].includes(req.method())) return route.continue();
    const url = new URL(req.url());
    blocked.push({ method: req.method(), sameOrigin: url.origin === base.origin, ...(url.origin === base.origin && { path: url.pathname }) });
    return route.abort();
  });
  const anon = await ctx.request.get(`${api}?period=30D`);
  assert.equal(anon.status(), 401);
  assert.equal(anon.headers()["cache-control"], "private, no-store");
  assert.equal((await ctx.request.post("/api/auth/login", {
    data: { email: "organizer1@sortex.example.invalid", password },
  })).status(), 200);
  for (const url of [path, "/api/auth/me", "/api/plans/me", "/api/organizer/profile", "/api/legal/pending", "/api/organizer/personalization", "/api/campaigns/my"]) {
    assert.equal((await ctx.request.get(url)).status(), 200, url);
  }
  const page = await ctx.newPage();
  page.setDefaultTimeout(40_000);
  await page.goto(path);
  await expect(page.getByRole("heading", { name: "SorteX Ads", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Modo Teste", exact: true })).toBeVisible();
  const report = page.getByRole("region", { name: "Vendas confirmadas" });
  const filters = report.getByRole("form", { name: "Filtros de vendas confirmadas" });
  const campaigns = filters.getByRole("combobox", { name: "Campanha SorteX" });
  await expect(campaigns.getByRole("option", { name: fixture, exact: true })).toHaveCount(1);
  await campaigns.selectOption({ label: fixture });
  const campaignId = await campaigns.inputValue();
  const submit = () => filters.getByRole("button", { name: "Aplicar filtros" }).click();
  const track = (qs) => page.waitForResponse((res) => {
    const url = new URL(res.url());
    return url.pathname === api && url.searchParams.get("campaignId") === campaignId && qs(url.searchParams);
  });
  const [response] = await Promise.all([track(() => true), submit()]);
  assert.equal(response.status(), 200);
  assert.equal(response.headers()["cache-control"], "private, no-store");
  const data = await response.json();
  assert.equal(data.source, "SORTEX_CONFIRMED_PURCHASES");
  assert.deepEqual(data.totals, {
    confirmedOrders: 19, buyers: 5, titlesSold: 83, paidOrderValue: "207.50", averageOrderValue: "10.92",
  });
  assert.deepEqual(data.attribution.channels.map((row) => [row.origin, row.confirmedOrders]), [["AFFILIATE", 12], ["UNKNOWN", 7]]);
  assert.equal(data.paidMedia.status, "UNAVAILABLE");
  for (const key of ["spend", "roas", "roi", "cpa", "platformReportedConversions"]) assert.equal(data.paidMedia[key], null);
  assert.equal(data.paidMedia.reportingProviders.length, 3);
  assert.ok(data.paidMedia.reportingProviders.every((item) => !item.canReadProviderData && !item.canPublish && !item.canChangeBudget && item.status === "DISABLED"));
  await expect(report.getByText("R$ 207,50", { exact: true })).toBeVisible();
  await expect(report.getByRole("complementary", { name: "Resumo das origens internas" })).toContainText("Afiliados (12)");
  await expect(report.getByRole("figure", { name: "Gráfico diário de pedidos pagos" })).toBeVisible();
  await expect(report.getByRole("region", { name: "Tabela de evolução diária de pedidos pagos" })).toBeVisible();
  const providers = report.getByRole("list", { name: "Leitura de plataformas publicitárias" });
  for (const name of ["Meta Ads", "Google Ads", "TikTok Ads"]) {
    const item = providers.getByRole("listitem").filter({ hasText: name });
    await expect(item).toContainText("Leitura desativada");
    await expect(item.getByRole("button")).toHaveCount(0);
  }
  assert.equal(await report.getByText("Valor bruto dos pedidos pagos", { exact: true }).evaluate((node) => getComputedStyle(node).color), "rgb(255, 255, 255)");
  const capture = async (file, target) => {
    if (!output) return;
    await page.evaluate(() => document.fonts.ready.then(() => scrollTo(0, 0)));
    const options = { path: resolve(output, file), animations: "disabled", scale: "device", style: "nextjs-portal { display: none !important }" };
    if (target) await target.screenshot(options);
    else await page.screenshot(options);
  };
  await capture("SorteX-Ads-Premium-desktop.png");
  await capture("SorteX-Ads-Premium-relatorio.png", report);

  await page.setViewportSize({ width: 320, height: 812 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
  assert.equal(await report.evaluate((node) => getComputedStyle(node).colorScheme), "dark");
  const period = filters.getByRole("combobox", { name: "Período" });
  await period.focus();
  await page.keyboard.press("Tab");
  await expect(campaigns).toBeFocused();
  assert.equal(await campaigns.evaluate((node) => getComputedStyle(node).outlineWidth), "2px");
  assert.equal(await campaigns.evaluate((node) => getComputedStyle(node).transitionDuration), "0s");
  await capture("SorteX-Ads-Premium-celular.png");
  await capture("SorteX-Ads-Premium-celular-provedores.png", providers);

  const origin = filters.getByRole("combobox", { name: "Origem dos pedidos" });
  await origin.selectOption("AFFILIATE");
  const [affiliates] = await Promise.all([track((qs) => qs.get("origin") === "AFFILIATE"), submit()]);
  assert.equal((await affiliates.json()).totals.confirmedOrders, 12);
  await expect(report.getByRole("complementary", { name: "Resumo das origens internas" })).toContainText("Este recorte não compara origens.");
  await origin.selectOption("ALL");
  await period.selectOption("TODAY");
  const [empty] = await Promise.all([track((qs) => qs.get("period") === "TODAY"), submit()]);
  assert.equal((await empty.json()).totals.confirmedOrders, 0, "Campanha sintética não tem pedidos pagos hoje");
  await expect(report.getByText("Nenhum pedido pago no período selecionado.")).toBeVisible();

  const workspace = page.getByRole("region", { name: "Rascunhos e conexões" });
  await page.getByRole("link", { name: "Rascunhos e conexões" }).click();
  await expect(page).toHaveURL(/#area-de-gerenciamento-ads$/);
  await expect(workspace.getByRole("heading", { name: "Conexões", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Criar campanha", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Nova campanha de mídia" })).toBeVisible();
  await page.getByRole("button", { name: "Fechar editor de campanha" }).click();
  await expect(page.getByRole("heading", { name: "Nova campanha de mídia" })).toHaveCount(0);
  // Next dev may POST internal stack-frame requests. Those are still blocked
  // but are not application mutations or calls to advertising services.
  const applicationWrites = blocked.filter((item) =>
    !["GET", "HEAD"].includes(item.method) &&
    (!item.sameOrigin || !item.path?.startsWith("/__nextjs")),
  );
  assert.deepEqual(applicationWrites, [], "Interações da prova não devem iniciar mutações");
  console.log(JSON.stringify({
    path, desktop: true, mobileDark320: true, keyboard: true, confirmedOrders: 19, affiliate: 12, unknown: 7,
    filters: ["campanha", "origem", "hoje vazio"], verifiedMedia: "indisponível", externalWrites: 0, openCloseEditorOnly: true,
  }));
} catch (error) {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message.split("\n").filter((line) => !/cookie|authorization/i.test(line)).join("\n"));
  process.exitCode = 1;
} finally {
  await ctx.close();
  await browser.close();
}
