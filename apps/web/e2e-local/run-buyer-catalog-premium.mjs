import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const origin = new URL(process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000");
assert.equal(origin.protocol, "http:");
assert.equal(origin.hostname, "127.0.0.1");
const password = process.env.TEST_SEED_PASSWORD;
assert.ok(password);
const output = process.env.SORTEX_CATALOG_SCREENSHOTS;
if (output) await mkdir(output, { recursive: true });

const path = "/comprador/sorteios";
const api = "/api/buyer/campaigns";
const main = "Prêmio fictício · Kit de viagem";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_BINARY || undefined,
  args: ["--disable-gpu", "--no-zygote", "--renderer-process-limit=1"],
});
const ctx = await browser.newContext({
  baseURL: origin.origin, viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 2, colorScheme: "light", reducedMotion: "reduce",
});
try {
  const blocked = [];
  await ctx.route("**/*", (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.origin === origin.origin && ["GET", "HEAD"].includes(req.method())) return route.continue();
    if (!["GET", "HEAD"].includes(req.method()) && (url.origin !== origin.origin || !url.pathname.startsWith("/__nextjs"))) blocked.push(req.method());
    return route.abort();
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(40_000);
  assert.equal((await ctx.request.get(api)).status(), 401);
  await p.goto(path);
  await expect(p).toHaveURL(/\/login\?next=%2Fcomprador%2Fsorteios$/);
  const login = async (email, endpoint = "/api/auth/login") =>
    assert.equal((await ctx.request.post(endpoint, { data: { email, password } })).status(), 200);
  await login("buyer1@sortex.example.invalid");
  for (const item of [path, "/api/auth/me", "/api/legal/pending", api, "/api/buyer/favorites/private"])
    assert.equal((await ctx.request.get(item)).status(), 200, item);

  const track = (predicate) => p.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === api && predicate(url.searchParams);
  });
  const [initial] = await Promise.all([track((q) => q.get("page") === "1"), p.goto(path)]);
  assert.equal(initial.status(), 200);
  const results = p.getByRole("region", { name: "Campanhas encontradas" });
  const initialCatalog = await initial.json();
  assert.equal(initialCatalog.items.length, 12);
  assert.equal(initialCatalog.total, 16);
  assert.equal(initialCatalog.pages, 2);
  assert.ok(initialCatalog.items.every((item) => !["Campanha QA privada", "Campanha QA bloqueada"].includes(item.title)));
  await expect(results.getByRole("listitem")).toHaveCount(12);
  const featured = results.getByRole("link", { name: new RegExp(main) });
  await expect(featured).toHaveAttribute("href", "/campanha/qa-premium-kit-viagem");
  const photo = featured.getByRole("img", { name: main, exact: true });
  await expect.poll(() => photo.evaluate((img) => [img.naturalWidth, img.naturalHeight])).toEqual([960, 600]);
  const coverUrl = new URL(await photo.getAttribute("src"), origin);
  assert.equal(coverUrl.origin, origin.origin);
  assert.match(coverUrl.pathname, /^\/api\/public\/campaign-media\/[^/]+\/cover$/);
  assert.match(coverUrl.searchParams.get("v"), /^[a-f0-9]{16}$/);
  await expect(featured.getByRole("progressbar")).toHaveAttribute("value", "17");
  await expect(featured.getByText("R$ 2,50 por título", { exact: true })).toBeVisible();
  await expect(p.getByRole("button", { name: `Remover dos favoritos: ${main}`, exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(p.getByRole("link", { name: "Meus favoritos" })).toHaveAttribute("href", "/comprador/favoritos");

  const search = p.getByRole("searchbox", { name: "Buscar campanha ou prêmio" });
  const filters = p.getByRole("region", { name: "Filtros de campanhas" });
  const select = filters.getByRole("combobox", { name: "Exibição" });
  const capture = async (name) => {
    if (!output) return;
    await p.evaluate(() => document.fonts.ready.then(() => scrollTo(0, 0)));
    await p.screenshot({ path: resolve(output, name), scale: "device", animations: "disabled", style: "nextjs-portal { display: none !important }" });
  };
  await capture("SorteX-Sorteios-Premium-desktop.png");
  await search.focus();
  await p.keyboard.press("Tab");
  await expect(select).toBeFocused();
  assert.equal(await select.evaluate((node) => getComputedStyle(node).outlineWidth), "2px");

  const pager = p.getByRole("navigation", { name: "Paginação de sorteios" });
  const [next] = await Promise.all([track((q) => q.get("page") === "2"), pager.getByRole("button", { name: "Próxima" }).click()]);
  const nextCatalog = await next.json();
  assert.equal(nextCatalog.page, 2);
  assert.equal(nextCatalog.items.length, 4);
  await expect(pager.getByText("Página 2 de 2")).toBeVisible();
  await expect(pager.getByRole("button", { name: "Próxima" })).toBeDisabled();

  const [searched] = await Promise.all([track((q) => q.get("search") === "Mala Aurora"), search.fill("Mala Aurora")]);
  const matching = await searched.json();
  assert.equal(matching.page, 1);
  assert.deepEqual(matching.items.map((item) => item.title), [main]);
  await expect(results.getByRole("listitem")).toHaveCount(1);
  await filters.getByRole("button", { name: "Limpar filtros" }).click();
  const [moto] = await Promise.all([
    track((q) => q.get("category") === "MOTORCYCLE"), filters.getByRole("button", { name: "Motos" }).click(),
  ]);
  assert.deepEqual((await moto.json()).items.map((item) => item.title), ["Moto QA fictícia"]);
  await expect(filters.getByRole("button", { name: "Motos" })).toHaveAttribute("aria-pressed", "true");
  const [travel] = await Promise.all([
    track((q) => q.get("category") === "TRAVEL"), filters.getByRole("button", { name: "Viagens" }).click(),
  ]);
  assert.deepEqual((await travel.json()).items.map((item) => item.title), [main]);
  await filters.getByRole("button", { name: "Limpar filtros" }).click();

  const [upcoming] = await Promise.all([track((q) => q.get("filter") === "UPCOMING"), select.selectOption("UPCOMING")]);
  assert.deepEqual((await upcoming.json()).items.map((item) => item.title), ["Campanha QA futura"]);
  await expect(results.getByText("Em breve", { exact: true })).toBeVisible();
  const [prices] = await Promise.all([track((q) => q.get("filter") === "LOWEST_PRICE"), select.selectOption("LOWEST_PRICE")]);
  const values = (await prices.json()).items.map((item) => item.numberPrice);
  assert.ok(values.every((amount, i) => i === 0 || amount >= values[i - 1]));
  const [live] = await Promise.all([track((q) => q.get("filter") === "LIVE"), p.goto("/comprador/participar")]);
  assert.equal(live.status(), 200);
  await expect(p).toHaveURL(/\/comprador\/sorteios\?filter=LIVE$/);
  await expect(select).toHaveValue("LIVE");
  await expect(filters.getByText(/Esta opção lista campanhas publicadas/)).toBeVisible();

  await p.setViewportSize({ width: 320, height: 812 });
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), 320);
  assert.equal(await results.evaluate((node) => getComputedStyle(node).colorScheme), "light");
  await p.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), 320);
  assert.equal(await results.evaluate((node) => getComputedStyle(node).colorScheme), "dark");
  assert.equal(await select.evaluate((node) => getComputedStyle(node).transitionDuration), "0s");
  await capture("SorteX-Sorteios-Premium-celular.png");

  await search.fill("nunca-existe-qa");
  await expect(p.getByRole("status").filter({ hasText: "Carregando campanhas…" })).toBeVisible();
  await expect(p.getByRole("heading", { name: "Nenhuma campanha encontrada." })).toBeVisible();
  await p.route("**/api/buyer/campaigns?*", (route) => route.fulfill({ status: 503, json: { message: "Falha controlada no teste." } }));
  await filters.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(p.getByRole("alert").filter({ hasText: "Não foi possível carregar as campanhas." })).toBeVisible();
  await expect(p.getByRole("heading", { name: "Nenhuma campanha encontrada." })).toHaveCount(0);
  await p.unroute("**/api/buyer/campaigns?*");
  await p.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(results.getByRole("listitem")).toHaveCount(12);

  await ctx.clearCookies();
  await login("buyer2@sortex.example.invalid");
  await p.goto(path);
  await expect(p.getByRole("button", { name: `Salvar nos favoritos: ${main}`, exact: true })).toHaveAttribute("aria-pressed", "false");
  for (const [account, endpoint] of [
    ["organizer1@sortex.example.invalid", "/api/auth/login"],
    ["admin@sortex.example.invalid", "/api/auth/admin-login"],
  ]) {
    await ctx.clearCookies();
    await login(account, endpoint);
    assert.equal((await ctx.request.get(api)).status(), 403);
  }
  assert.deepEqual(blocked, [], "A prova só consulta dados; nenhuma ação comercial ou de favoritos foi acionada");
  console.log(JSON.stringify({
    path, total: 16, pageOne: 12, pageTwo: 4, realCover: "960x600", anonymous: 401, organizer: 403, admin: 403,
    searchPrize: true, category: true, priceSort: true, upcoming: true, participarAlias: true, favoriteReadIsolation: true,
    widths: ["1440 light", "320 light", "320 dark"], keyboard: true, loadingEmptyErrorRetry: true, applicationWrites: 0,
  }));
} catch (error) {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message.split("\n").filter((line) => !/cookie|authorization/i.test(line)).join("\n"));
  process.exitCode = 1;
} finally {
  await ctx.close();
  await browser.close();
}
