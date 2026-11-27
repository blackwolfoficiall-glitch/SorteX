import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const origin = new URL(process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000");
assert.equal(origin.protocol, "http:");
assert.equal(origin.hostname, "127.0.0.1");
const password = process.env.TEST_SEED_PASSWORD;
assert.ok(password);
const output = process.env.SORTEX_RESULTS_SCREENSHOTS;
if (output) await mkdir(output, { recursive: true });
const path = "/comprador/resultados";
const api = "/api/buyer/results/my";
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
  assert.equal((await first.request.get("/api/public/campaigns/sortex-review-v1-c3")).status(), 404);
  await p.goto(path);
  await expect(p).toHaveURL(/\/login\?next=%2Fcomprador%2Fresultados$/);
  await login(first, "buyer1@sortex.example.invalid");
  const [response] = await Promise.all([
    p.waitForResponse((reply) => new URL(reply.url()).pathname === api),
    p.goto(path),
  ]);
  assert.equal(response.status(), 200);
  assert.equal(response.headers()["cache-control"], "private, no-store");
  const records = await response.json();
  assert.doesNotMatch(JSON.stringify(records), /synthetic\.example\.invalid|privateAudit|auditHash|confirmedAt|Dado privado não exibido/);
  const exactIds = records.map(({ id }) => id).filter((id) => id.startsWith("qa-") || id === "sortex-review-v1-c3");
  assert.deepEqual(exactIds.sort(), ["qa-confirmed-main", "qa-confirmed-private-winner", "sortex-review-v1-c3"].sort());
  const region = p.getByRole("region", { name: "Apurações disponíveis" });
  const result = (title) => region.getByRole("article").filter({ has: p.getByRole("heading", { name: title, exact: true }) });
  const confirmed = result("[TESTE] Apuração Aurora");
  const synthetic = result("[FICTÍCIO] Resultado de avaliação");
  const deniedWinner = result("[TESTE] Apuração com divulgação restrita");
  await expect(confirmed.getByText("Apuração confirmada", { exact: true })).toBeVisible();
  await expect(confirmed.getByText("00042", { exact: true })).toBeVisible();
  await expect(confirmed.getByText("Prêmio fictício Aurora", { exact: true })).toBeVisible();
  await expect(confirmed.getByText("Comprador QA", { exact: true })).toBeVisible();
  await expect(synthetic.getByText("Simulação de avaliação", { exact: true })).toBeVisible();
  await expect(synthetic.getByText("00007", { exact: true })).toBeVisible();
  await expect(synthetic).toContainText("Não houve sorteio nem premiação real.");
  await expect(synthetic.getByText("Apuração confirmada")).toHaveCount(0);
  await expect(synthetic.getByRole("region", { name: "Prêmios desta apuração na sua conta" })).toHaveCount(0);
  await expect(deniedWinner.getByText("000123456789", { exact: true })).toBeVisible();
  await expect(deniedWinner.getByRole("region", { name: "Prêmios desta apuração na sua conta" })).toHaveCount(0);
  for (const hidden of ["Resultado privado em rascunho", "Resultado sem compra paga", "Apuração sem confirmação", "Apuração da segunda conta", "Dado privado não exibido", "Prêmio fictício com nome restrito", "synthetic.example.invalid", "privateAudit"])
    await expect(region.getByText(hidden, { exact: false })).toHaveCount(0);
  const links = p.getByRole("navigation", { name: "Atalhos dos resultados" });
  const titles = links.getByRole("link", { name: "Meus títulos" });
  const prizes = links.getByRole("link", { name: "Meus prêmios" });
  await expect(titles).toHaveAttribute("href", "/comprador/meus-numeros");
  await expect(prizes).toHaveAttribute("href", "/comprador/meus-premios");
  await titles.focus();
  await p.keyboard.press("Tab");
  await expect(prizes).toBeFocused();
  assert.equal(await prizes.evaluate((node) => getComputedStyle(node).outlineWidth), "2px");
  const capture = async (name) => {
    if (!output) return;
    await p.evaluate(() => document.fonts.ready.then(() => scrollTo(0, 0)));
    await p.screenshot({ path: resolve(output, name), scale: "device", animations: "disabled", style: "nextjs-portal { display: none !important }" });
  };
  await capture("SorteX-Resultados-Premium-desktop.png");

  for (const colorScheme of ["light", "dark"]) {
    await p.setViewportSize({ width: 320, height: 850 });
    await p.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await expect(confirmed).toBeVisible();
    const [scrollWidth, viewport, actual] = await p.evaluate(() => [
      document.documentElement.scrollWidth, innerWidth, getComputedStyle(document.querySelector(".sx-premium")).colorScheme,
    ]);
    assert.ok(scrollWidth <= viewport);
    assert.equal(actual, colorScheme);
  }
  await capture("SorteX-Resultados-Premium-celular.png");

  for (const [status, message] of [
    [404, "Esta versão do ambiente ainda não oferece a consulta de resultados."],
    [503, "Não foi possível consultar os resultados dos seus pedidos."],
  ]) {
    const delayed = async (route) => {
      await new Promise((done) => setTimeout(done, 400));
      await route.fulfill({ status, contentType: "application/json", body: "{}" });
    };
    await p.route(`**${api}`, delayed);
    await p.goto(path);
    const spinner = region.getByRole("status");
    await expect(spinner).toBeVisible();
    assert.equal(await spinner.locator("svg").evaluate((node) => getComputedStyle(node).animationName), "none");
    await expect(region.getByRole("alert")).toContainText(message);
    await p.unroute(`**${api}`, delayed);
    await region.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(confirmed).toBeVisible();
  }

  const second = await context();
  await login(second, "buyer2@sortex.example.invalid");
  const otherPage = await second.newPage();
  await otherPage.goto(path);
  await expect(otherPage.getByRole("heading", { name: "[TESTE] Apuração da segunda conta" })).toBeVisible();
  await expect(otherPage.getByRole("heading", { name: "[TESTE] Apuração Aurora" })).toHaveCount(0);
  const secondRows = await (await second.request.get(api)).json();
  assert.deepEqual(secondRows.map(({ id }) => id), ["qa-foreign"]);
  const empty = await context();
  await login(empty, "buyer-empty-results@sortex.example.invalid");
  const emptyResponse = await empty.request.get(api);
  assert.equal(emptyResponse.status(), 200);
  assert.deepEqual(await emptyResponse.json(), []);
  const emptyPage = await empty.newPage();
  await emptyPage.goto(path);
  await expect(emptyPage.getByText("Nenhum resultado disponível para os seus títulos.")).toBeVisible();
  await empty.close();
  const third = await context();
  await login(third, "organizer1@sortex.example.invalid");
  assert.equal((await third.request.get(api)).status(), 403);
  const admin = await context();
  await login(admin, "admin@sortex.example.invalid", "/api/auth/admin-login");
  assert.equal((await admin.request.get(api)).status(), 403);
  assert.deepEqual(blocked, []);
  console.log(JSON.stringify({
    path, zeros: ["00042", "00007", "000123456789"], verified: "confirmed+simulation",
    privateCache: true, disclosures: "own authorized visible; restricted not exposed", foreign: "isolated",
    auth: "401 anonymous; 403 organizer and administrator", viewport: "1440 light; 320 light/dark", keyboard: true, recovery: "404 and 503",
  }));
} finally {
  await browser.close();
}
