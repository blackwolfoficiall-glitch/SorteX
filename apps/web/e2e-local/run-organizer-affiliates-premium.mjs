import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const target = new URL(process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000");
assert.equal(target.protocol, "http:");
assert.equal(target.hostname, "127.0.0.1", "Use somente um ambiente isolado, local e com banco descartável");
const password = process.env.TEST_SEED_PASSWORD;
assert.ok(password);
const output = process.env.SORTEX_AFFILIATE_SCREENSHOTS;
if (output) await mkdir(output, { recursive: true });

const path = "/dashboard/afiliados";
const affiliateRoot = "/api/affiliates";
const api = `${affiliateRoot}/affiliates/organizer`;
const campaign = "Campanha fictícia · Afiliados Premium";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_BINARY || undefined,
  args: ["--disable-gpu", "--no-zygote", "--renderer-process-limit=1"],
});
const ctx = await browser.newContext({
  baseURL: target.origin, viewport: { width: 1440, height: 1000 },
  colorScheme: "light", reducedMotion: "reduce", deviceScaleFactor: 2,
});

try {
  const blocked = [];
  await ctx.route("**/*", (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.origin === target.origin && ["GET", "HEAD"].includes(req.method())) return route.continue();
    if (!["GET", "HEAD"].includes(req.method()) && (url.origin !== target.origin || !url.pathname.startsWith("/__nextjs"))) blocked.push(req.method());
    return route.abort();
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(40_000);
  assert.equal((await ctx.request.get(`${api}/dashboard`)).status(), 401);
  await p.goto(path);
  await expect(p).toHaveURL(/\/login\?next=%2Fdashboard%2Fafiliados$/);
  const login = async (email, endpoint = "/api/auth/login") => {
    assert.equal((await ctx.request.post(endpoint, { data: { email, password } })).status(), 200);
  };
  await login("organizer1@sortex.example.invalid");
  for (const url of [
    path, "/api/auth/me", "/api/plans/me", "/api/organizer/profile", "/api/organizer/personalization",
    "/api/legal/pending", "/api/campaigns/my", `${affiliateRoot}/affiliate-programs/my`, `${affiliateRoot}/affiliates/my`,
    `${api}/dashboard`, `${api}/conversions`, `${api}/commissions`,
  ]) assert.equal((await ctx.request.get(url)).status(), 200, url);
  const [initial] = await Promise.all([
    p.waitForResponse((res) => new URL(res.url()).pathname === `${api}/dashboard`),
    p.goto(path),
  ]);
  assert.equal(initial.status(), 200);
  assert.deepEqual(await initial.json(), {
    activePrograms: 1, activeAffiliates: 1, pendingInvites: 0, clicks: 4, attributedReservations: 1,
    approvedSales: 3, generatedRevenue: 100, estimatedCommissions: 3, availableCommissions: 4, paidCommissions: 2,
  });
  const overview = p.getByRole("region", { name: "Visão geral", exact: true });
  await expect(overview.getByText("R$ 100,00", { exact: true })).toBeVisible();
  await expect(overview.getByText(/Inclui atribuições de todos os status/)).toBeVisible();
  await expect(p.getByText("Repasses automáticos indisponíveis.", { exact: true })).toBeVisible();
  const amountLabel = overview.getByText("Valor bruto das atribuições", { exact: true });
  assert.equal(await amountLabel.evaluate((node) => getComputedStyle(node).color), "rgb(255, 255, 255)");

  const capture = async (name) => {
    if (!output) return;
    await p.evaluate(() => document.fonts.ready.then(() => scrollTo(0, 0)));
    await p.screenshot({ path: resolve(output, name), scale: "device", animations: "disabled", style: "nextjs-portal { display: none !important }" });
  };
  await capture("SorteX-Afiliados-Premium-desktop.png");
  const nav = p.getByRole("navigation", { name: "Seções de afiliados" });
  await nav.getByRole("button", { name: "Visão geral", exact: true }).focus();
  await p.keyboard.press("Tab");
  const programTab = nav.getByRole("button", { name: "Programas", exact: true });
  await expect(programTab).toBeFocused();
  assert.equal(await programTab.evaluate((node) => getComputedStyle(node).outlineWidth), "2px");
  await p.keyboard.press("Enter");
  await expect(programTab).toHaveAttribute("aria-pressed", "true");
  await expect(p.getByRole("heading", { name: "Programa Teste", exact: true })).toBeVisible();
  await expect(p.getByRole("heading", { name: "Novo programa", exact: true })).toBeVisible();
  await nav.getByRole("button", { name: "Convites", exact: true }).click();
  await expect(p.getByText("Nenhum convite registrado.", { exact: true })).toBeVisible();
  await expect(p.getByText("Gerar o link não envia e-mail nem mensagem.", { exact: true })).toBeVisible();
  await nav.getByRole("button", { name: "Vendas atribuídas", exact: true }).click();
  await expect(p.getByRole("region", { name: "Afiliados: Vendas atribuídas" }).getByRole("article")).toHaveCount(4);
  await expect(p.getByText(campaign, { exact: false }).first()).toBeVisible();
  await nav.getByRole("button", { name: "Configurações", exact: true }).click();
  await expect(p.getByText(/Atribuição por último clique válido/)).toBeVisible();

  await p.setViewportSize({ width: 320, height: 812 });
  await p.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  const picker = p.getByRole("combobox", { name: "Seção de afiliados" });
  await picker.selectOption("Visão geral");
  assert.equal(await overview.evaluate((node) => getComputedStyle(node).colorScheme), "dark");
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), 320);
  await capture("SorteX-Afiliados-Premium-celular.png");
  await picker.selectOption("Comissões");
  const com = p.getByRole("region", { name: "Afiliados: Comissões" });
  await expect(com.getByRole("article")).toHaveCount(3);
  await expect(com.getByText("Pagamento manual registrado", { exact: true })).toBeVisible();
  await expect(com.getByRole("button", { name: "Registrar pagamento externo" })).toBeVisible();
  await expect(com.getByRole("button", { name: "Liberar", exact: true })).toBeVisible();
  assert.equal(await com.getByRole("button", { name: "Liberar", exact: true }).evaluate((node) => getComputedStyle(node).transitionDuration), "0s");
  await capture("SorteX-Afiliados-Premium-comissoes.png");

  let releaseError;
  const releaseErrorResponse = new Promise((done) => { releaseError = done; });
  const failEndpoint = `**${api}/dashboard`;
  await p.route(failEndpoint, async (route) => {
    await releaseErrorResponse;
    await route.fulfill({ status: 503, json: { message: "Indisponibilidade controlada" } });
  });
  await p.goto(path);
  await expect(p.getByRole("status").filter({ hasText: "Carregando dados de afiliados…" })).toBeVisible();
  releaseError();
  await expect(p.getByRole("alert").filter({ hasText: "Não foi possível carregar os dados de afiliados." })).toBeVisible();
  await p.unroute(failEndpoint);
  await p.getByRole("button", { name: "Tentar novamente", exact: true }).click();
  await expect(overview.getByText("R$ 100,00", { exact: true })).toBeVisible();

  await ctx.clearCookies();
  await login("organizer2@sortex.example.invalid");
  for (const section of ["conversions", "commissions"]) {
    const result = await ctx.request.get(`${api}/${section}`);
    assert.equal(result.status(), 200);
    assert.deepEqual(await result.json(), []);
  }
  await p.goto(path);
  await expect(overview.getByText("R$ 0,00", { exact: true }).first()).toBeVisible();
  await picker.selectOption("Comissões");
  await expect(com.getByText("Nenhuma comissão registrada.", { exact: true })).toBeVisible();
  await expect(p.getByText(campaign, { exact: false })).toHaveCount(0);
  for (const [account, endpoint] of [
    ["buyer1@sortex.example.invalid", "/api/auth/login"],
    ["admin@sortex.example.invalid", "/api/auth/admin-login"],
  ]) {
    await ctx.clearCookies();
    await login(account, endpoint);
    assert.equal((await ctx.request.get(`${api}/dashboard`)).status(), 403);
  }
  assert.deepEqual(blocked, [], "Nenhuma ação da prova gera mutação nem comunicação externa.");
  console.log(JSON.stringify({
    path, checked: { grossAttributed: 100, confirmedSales: 3, pendingReservations: 1, estimatedCommission: 3, releasedCommission: 4, externalManualRecord: 2 },
    narrowDark320: true, keyboard: true, loadingErrorRetry: true, emptyAlternateOrganizer: true, buyer: 403, admin: 403, attemptedMutations: 0,
  }));
} catch (error) {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message.split("\n").filter((line) => !/cookie|authorization/i.test(line)).join("\n"));
  process.exitCode = 1;
} finally {
  await ctx.close();
  await browser.close();
}
