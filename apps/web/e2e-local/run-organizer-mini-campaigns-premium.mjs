import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const origin = new URL(process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000");
assert.equal(origin.protocol, "http:");
assert.equal(origin.hostname, "127.0.0.1", "Use somente Next e banco descartável locais");
const password = process.env.TEST_SEED_PASSWORD;
assert.ok(password);
const output = process.env.SORTEX_MINI_SCREENSHOTS;
if (output) await mkdir(output, { recursive: true });

const path = "/dashboard/mini-campanhas";
const api = "/api/platform/mini-campaigns";
const draft = "Mini Campanha fictícia · Rascunho";
const published = "Mini Campanha fictícia · Publicada";
const paused = "Mini Campanha fictícia · Pausada";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_BINARY || undefined,
  args: ["--disable-gpu", "--no-zygote", "--renderer-process-limit=1"],
});
const ctx = await browser.newContext({
  baseURL: origin.origin, viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 2, reducedMotion: "reduce", colorScheme: "light",
});

try {
  const blocked = [];
  await ctx.route("**/*", (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.origin === origin.origin && ["GET", "HEAD"].includes(req.method())) return route.continue();
    if (!["GET", "HEAD"].includes(req.method()) && !url.pathname.startsWith("/__nextjs")) blocked.push(req.method());
    return route.abort();
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(40_000);
  assert.equal((await ctx.request.get(api)).status(), 401);
  await p.goto(path);
  await expect(p).toHaveURL(/\/login\?next=%2Fdashboard%2Fmini-campanhas$/);
  const login = async (email, endpoint = "/api/auth/login") =>
    assert.equal((await ctx.request.post(endpoint, { data: { email, password } })).status(), 200);
  await login("organizer1@sortex.example.invalid");
  for (const dest of [
    path, "/api/auth/me", "/api/plans/me", "/api/organizer/profile", "/api/organizer/personalization",
    "/api/legal/pending", "/api/campaigns/my", api,
  ]) assert.equal((await ctx.request.get(dest)).status(), 200, dest);
  const [read] = await Promise.all([
    p.waitForResponse((response) => new URL(response.url()).pathname === api),
    p.goto(path),
  ]);
  assert.equal(read.status(), 200);
  const rows = await read.json();
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((item) => item.status).sort(), ["DRAFT", "PAUSED", "PUBLISHED"]);
  const item = rows.find((row) => row.status === "PUBLISHED");
  assert.ok(item.id);
  assert.equal(item.soldTickets, 2);
  assert.equal(item.maxTickets, 100);
  assert.equal(item._count.orders, 1);

  const group = p.getByRole("region", { name: "Mini Campanhas da conta" });
  await expect(group.getByRole("article")).toHaveCount(3);
  const content = (name) => group.getByRole("article", { name });
  await expect(content(published).getByText("Publicada", { exact: true })).toBeVisible();
  await expect(content(published).getByText("2 de 100", { exact: true })).toBeVisible();
  await expect(content(published).getByRole("link", { name: "Link público" })).toHaveAttribute("href", "/mini-campanhas/mini-premium-publicada");
  await expect(content(published).getByRole("button", { name: "Editar", exact: true })).toBeDisabled();
  await expect(content(published).getByRole("button", { name: "Excluir", exact: true })).toBeDisabled();
  await expect(content(published).getByRole("button", { name: "Pausar", exact: true })).toBeEnabled();
  for (const name of [draft, paused]) {
    await expect(content(name).getByText("Link público indisponível neste status.", { exact: true })).toBeVisible();
    await expect(content(name).getByRole("link", { name: "Link público" })).toHaveCount(0);
    await expect(content(name).getByRole("button", { name: "Publicar", exact: true })).toBeEnabled();
  }
  const capture = async (name, locator) => {
    if (!output) return;
    await p.evaluate(() => document.fonts.ready.then(() => scrollTo(0, 0)));
    const options = { path: resolve(output, name), animations: "disabled", scale: "device", style: "nextjs-portal { display: none !important }" };
    if (locator) await locator.screenshot(options);
    else await p.screenshot(options);
  };
  await capture("SorteX-Mini-Campanhas-Premium-desktop.png");
  const edit = content(draft).getByRole("button", { name: "Editar", exact: true });
  await edit.focus();
  await p.keyboard.press("Enter");
  const editing = p.getByRole("dialog", { name: "Editar Mini Campanha" });
  await expect(editing.getByRole("textbox", { name: "Nome", exact: true })).toHaveValue(draft);
  await expect(editing.getByRole("button", { name: "Fechar editor", exact: true })).toBeFocused();
  await p.keyboard.press("Escape");
  await expect(editing).toHaveCount(0);
  await expect(edit).toBeFocused();

  await p.setViewportSize({ width: 320, height: 812 });
  await p.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), 320);
  assert.equal(await group.evaluate((node) => getComputedStyle(node).colorScheme), "dark");
  assert.equal(await edit.evaluate((node) => getComputedStyle(node).transitionDuration), "0s");
  await capture("SorteX-Mini-Campanhas-Premium-celular.png", content(published));
  await p.getByRole("button", { name: "Criar Mini Campanha", exact: true }).click();
  const creating = p.getByRole("dialog", { name: "Criar Mini Campanha" });
  await expect(creating.getByRole("textbox", { name: "Nome", exact: true })).toHaveValue("");
  await expect(creating.getByRole("button", { name: "Salvar Mini Campanha" })).toBeVisible();
  await creating.getByRole("button", { name: "Fechar editor", exact: true }).click();
  await expect(creating).toHaveCount(0);

  let release;
  const wait = new Promise((complete) => { release = complete; });
  const fail = `**${api}`;
  await p.route(fail, async (route) => {
    await wait;
    await route.fulfill({ status: 503, json: { message: "Falha controlada no teste" } });
  });
  await p.goto(path);
  await expect(p.getByRole("status").filter({ hasText: "Carregando Mini Campanhas…" })).toBeVisible();
  release();
  await expect(p.getByRole("alert").filter({ hasText: "Não foi possível carregar as Mini Campanhas." })).toBeVisible();
  await expect(p.getByRole("heading", { name: "Nenhuma Mini Campanha criada" })).toHaveCount(0);
  await p.unroute(fail);
  await p.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(group.getByRole("article")).toHaveCount(3);

  await ctx.clearCookies();
  await login("organizer2@sortex.example.invalid");
  assert.deepEqual(await (await ctx.request.get(api)).json(), []);
  assert.equal((await ctx.request.get(`${api}/${item.id}`)).status(), 404);
  await p.goto(path);
  await expect(p.getByRole("heading", { name: "Nenhuma Mini Campanha criada" })).toBeVisible();
  assert.equal(await group.getByRole("article").count(), 0);
  for (const [name, endpoint] of [
    ["buyer1@sortex.example.invalid", "/api/auth/login"],
    ["admin@sortex.example.invalid", "/api/auth/admin-login"],
  ]) {
    await ctx.clearCookies();
    await login(name, endpoint);
    assert.equal((await ctx.request.get(api)).status(), 403);
  }
  assert.deepEqual(blocked, [], "Não deve haver mutação ou reserva pela interface do teste.");
  console.log(JSON.stringify({ path, states: ["DRAFT", "PAUSED", "PUBLISHED"], ownedRows: 3, actualPurchasedTitles: 2, actualOrders: 1,
    contrastThemeDark320: true, keyboardDialog: true, loadingErrorRetry: true, buyer: 403, admin: 403, foreignDetail: 404, browserWrites: 0,
  }));
} catch (error) {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message.split("\n").filter((line) => !/cookie|authorization/i.test(line)).join("\n"));
  process.exitCode = 1;
} finally {
  await ctx.close();
  await browser.close();
}
