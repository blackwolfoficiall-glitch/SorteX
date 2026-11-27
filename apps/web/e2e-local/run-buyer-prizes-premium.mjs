import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const origin = new URL(process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000");
assert.equal(origin.protocol, "http:");
assert.equal(origin.hostname, "127.0.0.1");
const password = process.env.TEST_SEED_PASSWORD;
assert.ok(password);
const output = process.env.SORTEX_PRIZES_SCREENSHOTS;
if (output) await mkdir(output, { recursive: true });
const path = "/comprador/meus-premios";
const api = "/api/buyer/prizes";
const drawFixture = "Prêmio fictício · Kit Aurora";
const instantFixture = "Cota fictícia · Caderno Azul";
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
    if (url.origin === origin.origin && ["GET", "HEAD"].includes(req.method())) return route.continue();
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
  const p = await first.newPage();
  p.setDefaultTimeout(37_000);
  assert.equal((await first.request.get(api)).status(), 401);
  await p.goto(path);
  await expect(p).toHaveURL(/\/login\?next=%2Fcomprador%2Fmeus-premios$/);
  await login(first, "buyer1@sortex.example.invalid");
  const [response] = await Promise.all([
    p.waitForResponse((reply) => new URL(reply.url()).pathname === api),
    p.goto(path),
  ]);
  assert.equal(response.status(), 200);
  assert.equal(response.headers()["cache-control"], "private, no-store");
  const payload = await response.json();
  const drawRow = payload.draw.find(({ prizeName }) => prizeName === drawFixture);
  assert.equal(drawRow.ticketNumber, "00042");
  const instantRow = payload.instant.find(({ prizeName }) => prizeName === instantFixture);
  assert.equal(instantRow.ticketNumber, "00107");
  for (const entry of [...payload.draw, ...payload.instant]) assert.deepEqual(Object.keys(entry).sort(), ["campaignTitle", "id", "prizeName", "status", "ticketNumber"].sort());
  assert.doesNotMatch(JSON.stringify(payload), /privateSynthetic|PRIVATE_SYNTHETIC|Segunda conta|segunda conta/);
  const draw = p.getByRole("region", { name: "Prêmios de sorteios" });
  const instant = p.getByRole("region", { name: "Cotas premiadas" });
  await expect(draw.getByRole("heading", { name: drawFixture })).toBeVisible();
  await expect(draw.getByText("00042", { exact: true })).toBeVisible();
  await expect(draw.getByText("Ganhador contatado", { exact: true })).toBeVisible();
  await expect(instant.getByRole("heading", { name: instantFixture })).toBeVisible();
  await expect(instant.getByText("00107", { exact: true })).toBeVisible();
  await expect(instant.getByText("Entrega registrada", { exact: true })).toBeVisible();
  for (const section of [draw, instant]) {
    assert.doesNotMatch(await section.innerText(), /privateSynthetic|PRIVATE_SYNTHETIC|Segunda conta|segunda conta/);
    await expect(section.getByRole("link")).toHaveCount(0);
    await expect(section.getByRole("button")).toHaveCount(0);
  }
  const nav = p.getByRole("navigation", { name: "Atalhos dos prêmios" });
  const results = nav.getByRole("link", { name: "Resultados" });
  const titles = nav.getByRole("link", { name: "Meus títulos" });
  await expect(results).toHaveAttribute("href", "/comprador/resultados");
  await expect(titles).toHaveAttribute("href", "/comprador/meus-numeros");
  const capture = async (name) => {
    if (!output) return;
    await p.evaluate(() => document.fonts.ready.then(() => scrollTo(0, 0)));
    await p.screenshot({ path: resolve(output, name), scale: "device", animations: "disabled", style: "nextjs-portal { display: none !important }" });
  };
  await capture("SorteX-Meus-Premios-Premium-desktop.png");
  await results.focus();
  await p.keyboard.press("Tab");
  await expect(titles).toBeFocused();
  assert.equal(await titles.evaluate((node) => getComputedStyle(node).outlineWidth), "2px");

  for (const colorScheme of ["light", "dark"]) {
    await p.setViewportSize({ width: 320, height: 850 });
    await p.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await expect(draw.getByRole("heading", { name: drawFixture })).toBeVisible();
    const [scrollWidth, viewport, actual] = await p.evaluate(() => [
      document.documentElement.scrollWidth, innerWidth, getComputedStyle(document.querySelector(".sx-premium")).colorScheme,
    ]);
    assert.ok(scrollWidth <= viewport);
    assert.equal(actual, colorScheme);
  }
  await capture("SorteX-Meus-Premios-Premium-celular.png");

  const partial = async (route) => {
    await new Promise((done) => setTimeout(done, 400));
    const real = await route.fetch();
    const data = await real.json();
    await route.fulfill({ response: real, json: { draw: data.draw, instant: null } });
  };
  await p.route(`**${api}`, partial);
  await p.goto(path);
  const spinner = draw.getByRole("status");
  await expect(spinner).toBeVisible();
  assert.equal(await spinner.locator("svg").evaluate((node) => getComputedStyle(node).animationName), "none");
  await expect(draw.getByRole("heading", { name: drawFixture })).toBeVisible();
  await expect(instant.getByRole("alert")).toContainText("Não foi possível carregar esta lista.");
  await p.unroute(`**${api}`, partial);
  await p.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(instant.getByRole("heading", { name: instantFixture })).toBeVisible();

  const second = await context();
  await login(second, "buyer2@sortex.example.invalid");
  const other = await second.newPage();
  await other.goto(path);
  await expect(other.getByRole("heading", { name: "Prêmio fictício · Segunda conta" })).toBeVisible();
  await expect(other.getByRole("heading", { name: "Cota fictícia · Mochila da segunda conta" })).toBeVisible();
  await expect(other.getByRole("heading", { name: drawFixture })).toHaveCount(0);
  await expect(other.getByRole("heading", { name: instantFixture })).toHaveCount(0);
  await second.close();
  const empty = await context();
  await login(empty, "buyer-empty-prizes@sortex.example.invalid");
  const emptyBody = await (await empty.request.get(api)).json();
  assert.deepEqual(emptyBody, { draw: [], instant: [] });
  const emptyPage = await empty.newPage();
  await emptyPage.goto(path);
  await expect(emptyPage.getByText("Você ainda não tem prêmios de sorteios.")).toBeVisible();
  await expect(emptyPage.getByText("Você ainda não tem cotas premiadas.")).toBeVisible();
  await empty.close();
  for (const [email, endpoint] of [
    ["organizer1@sortex.example.invalid", "/api/auth/login"],
    ["admin@sortex.example.invalid", "/api/auth/admin-login"],
  ]) {
    const denied = await context();
    await login(denied, email, endpoint);
    assert.equal((await denied.request.get(api)).status(), 403);
    await denied.close();
  }
  assert.deepEqual(blocked, []);
  console.log(JSON.stringify({
    path, zeros: ["00042", "00107"], channels: ["draw", "instant"],
    privateCache: true, projection: "only expected fields; no private winner/contact identifiers in DOM", otherBuyer: "isolated", empty: true,
    auth: "401 anonymous; 403 organizer and administrator", viewport: "1440 light; 320 light/dark", keyboard: true, partialRecovery: true,
  }));
} finally {
  await browser.close();
}
