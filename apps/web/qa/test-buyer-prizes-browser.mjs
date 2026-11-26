import assert from "node:assert/strict";
import { chromium, devices, expect, webkit } from "@playwright/test";

// Run only on the disposable local stack seeded by seed-buyer-prizes-local.cjs.
function loopback(name, protocol) {
  const uri = new URL(process.env[name] ?? "");
  assert.ok(uri.protocol === protocol && uri.hostname === "127.0.0.1" && uri.port &&
    uri.pathname === "/" && !uri.username && !uri.password && !uri.hash && !uri.search);
  return uri.origin;
}

function actor(label) {
  const email = process.env[`SORTEX_PRIZE_TEST_${label}_EMAIL`] ?? "";
  const password = process.env[`SORTEX_PRIZE_TEST_${label}_PASSWORD`] ?? "";
  assert.ok(/^sortex-prize-[a-f0-9]+@example\.test$/.test(email) && password.length >= 12);
  return { email, password };
}

const api = loopback("SORTEX_PRIZE_TEST_API", "http:");
const baseURL = loopback("SORTEX_PRIZE_BROWSER_WEB", "https:");
const engine = process.env.SORTEX_PRIZE_BROWSER ?? "chromium";
assert.ok(engine === "chromium" || engine === "webkit");
const health = await fetch(api + "/health", { redirect: "error" }).then((r) => r.json());
assert.equal(health.environment, "development");
assert.equal(health.version, process.env.SORTEX_PRIZE_TEST_SHA);
const browser = await (engine === "webkit" ? webkit : chromium).launch(
  engine === "chromium" && process.env.SORTEX_PRIZE_CHROMIUM_PATH
    ? { executablePath: process.env.SORTEX_PRIZE_CHROMIUM_PATH }
    : {},
);

try {
  async function context() {
    const { defaultBrowserType, ...device } = devices[engine === "webkit" ? "iPhone 13" : "Desktop Chrome"];
    void defaultBrowserType;
    const ctx = await browser.newContext({ ...device, baseURL, ignoreHTTPSErrors: true, serviceWorkers: "block" });
    await ctx.route("**/*", (route) => new URL(route.request().url()).origin === baseURL
      ? route.continue()
      : route.abort("blockedbyclient"));
    return ctx;
  }

  const owner = await context(), other = await context(), guest = await context(), organizer = await context();
  const webHealth = await guest.request.get("/api/health");
  assert.equal(webHealth.status(), 200);
  assert.equal((await webHealth.json()).version, health.version);
  assert.equal((await guest.request.get("/api/buyer/prizes")).status(), 401);
  assert.equal((await organizer.request.post("/api/auth/login", { data: actor("ORGANIZER") })).status(), 200);
  assert.equal((await organizer.request.get("/api/buyer/prizes")).status(), 403);

  async function login(ctx, label) {
    const page = await ctx.newPage();
    const credentials = actor(label);
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(credentials.email);
    await page.getByLabel("Senha", { exact: true }).fill(credentials.password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL(/\/comprador\/?$/);
    await page.getByRole("link", { name: "Perfil", exact: true }).click();
    await expect(page.getByRole("link", { name: "Meus prêmios", exact: true })).toBeVisible();
    return page;
  }

  const page = await login(owner, "OWNER");
  const prizeRoute = "**/api/buyer/prizes";
  let release;
  const hold = new Promise((go) => { release = go; });
  const waitForDisplay = async (route) => { await hold; await route.continue(); };
  await page.route(prizeRoute, waitForDisplay);
  await page.getByRole("link", { name: "Meus prêmios", exact: true }).click();
  await expect(page).toHaveURL(/\/comprador\/meus-premios$/);
  const draw = page.getByRole("region", { name: "Prêmios de sorteios" });
  const instant = page.getByRole("region", { name: "Cotas premiadas" });
  try {
    await expect(draw.getByText("Carregando prêmios...", { exact: true })).toBeVisible();
    await expect(instant.getByText("Carregando prêmios...", { exact: true })).toBeVisible();
  } finally { release(); }
  await expect(draw.getByText("00091", { exact: true })).toBeVisible();
  await expect(draw.getByText("Sorteio sintético", { exact: true })).toBeVisible();
  await expect(draw.getByText("Contato pendente", { exact: true })).toBeVisible();
  await expect(instant.getByText("00032", { exact: true })).toBeVisible();
  await expect(instant.getByText("Cota sintética", { exact: true })).toBeVisible();
  await expect(instant.getByText("Prêmio identificado", { exact: true })).toBeVisible();
  await expect(draw.getByText("Cota sintética", { exact: true })).toHaveCount(0);
  await expect(instant.getByText("Sorteio sintético", { exact: true })).toHaveCount(0);

  const response = await owner.request.get("/api/buyer/prizes");
  assert.equal(response.status(), 200);
  assert.match(response.headers()["cache-control"], /no-store/);
  const groups = await response.json();
  for (const [kind, endpoint] of [["draw", "/winners/my"], ["instant", "/winners/my-instant-prizes"]]) {
    const original = await owner.request.get("/api/draws" + endpoint);
    assert.equal(original.status(), 200);
    const rows = await original.json();
    assert.deepEqual(groups[kind].map(({ id, ticketNumber }) => [id, ticketNumber]),
      rows.map(({ id, winningNumber }) => [id, winningNumber]));
    assert.equal(groups[kind].length, 1);
    assert.deepEqual(Object.keys(groups[kind][0]).sort(), ["campaignTitle", "id", "prizeName", "status", "ticketNumber"]);
  }
  const me = await (await owner.request.get("/api/auth/me")).json();
  const another = await login(other, "OTHER");
  await another.getByRole("link", { name: "Meus prêmios", exact: true }).click();
  await expect(another.getByText("Você ainda não tem prêmios de sorteios.", { exact: true })).toBeVisible();
  await expect(another.getByText("Você ainda não tem cotas premiadas.", { exact: true })).toBeVisible();
  await expect(another.getByText(/Sorteio sintético|Cota sintética/)).toHaveCount(0);
  const attempt = await other.request.get("/api/buyer/prizes?buyerId=" + encodeURIComponent(me.id));
  assert.equal(attempt.status(), 200);
  assert.deepEqual(await attempt.json(), { draw: [], instant: [] });

  // A client-side connection failure is deliberately induced only here to
  // verify error/retry. The successful retry goes through the real backend.
  await page.unroute(prizeRoute, waitForDisplay);
  await page.route(prizeRoute, (route) => route.abort("failed"), { times: 1 });
  await page.reload();
  await expect(draw.getByRole("alert")).toHaveText("Não foi possível carregar esta lista.");
  await expect(instant.getByRole("alert")).toHaveText("Não foi possível carregar esta lista.");
  await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
  await expect(draw.getByText("00091", { exact: true })).toBeVisible();
  await expect(instant.getByText("00032", { exact: true })).toBeVisible();
  console.log(JSON.stringify({ evidence: "local-real-https-web-browser-not-ios", revision: health.version,
    engine, separatedPrizes: true, exactOwnedIds: true, leadingZeros: true, projectedOnly: true,
    loadingEmptyErrorRetry: true, unrelatedBuyerEmpty: true, anonymous: 401, organizer: 403,
    payoutOrClaimCalls: 0 }));
} finally {
  await browser.close();
}
