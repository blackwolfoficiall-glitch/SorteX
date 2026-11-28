import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const url = new URL(process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000");
assert.equal(url.protocol, "http:");
assert.equal(url.hostname, "127.0.0.1", "A prova exige Next, Nest, arquivos e banco isolados e locais");
const password = process.env.TEST_SEED_PASSWORD;
assert.ok(password);
const output = process.env.SORTEX_BUYER_HOME_SCREENSHOTS;
if (output) await mkdir(output, { recursive: true });

const path = "/comprador";
const api = "/api/buyer/home";
const mainTitle = "Prêmio fictício · Kit de viagem";
const defaultPath = "/comprador/sorteios";
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_BINARY || undefined,
  args: ["--disable-gpu", "--no-zygote", "--renderer-process-limit=1"],
});
const ctx = await browser.newContext({
  baseURL: url.origin, viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 2, reducedMotion: "reduce", colorScheme: "light",
});

try {
  const blocked = [];
  await ctx.route("**/*", (route) => {
    const req = route.request();
    const dest = new URL(req.url());
    if (dest.origin === url.origin && ["GET", "HEAD"].includes(req.method())) return route.continue();
    if (!["GET", "HEAD"].includes(req.method()) && (dest.origin !== url.origin || !dest.pathname.startsWith("/__nextjs"))) blocked.push(req.method());
    return route.abort();
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(40_000);
  assert.equal((await ctx.request.get(api)).status(), 401);
  await p.goto(path);
  await expect(p).toHaveURL(/\/login\?next=%2Fcomprador$/);
  const login = async (email, endpoint = "/api/auth/login") =>
    assert.equal((await ctx.request.post(endpoint, { data: { email, password } })).status(), 200);
  await login("buyer1@sortex.example.invalid");
  for (const dest of [path, "/api/auth/me", "/api/legal/pending", api]) assert.equal((await ctx.request.get(dest)).status(), 200, dest);
  const [buyer] = await Promise.all([
    p.waitForResponse((res) => new URL(res.url()).pathname === api),
    p.goto(path),
  ]);
  assert.equal(buyer.status(), 200);
  const home = await buyer.json();
  assert.ok(home.featured.some((c) => c.title === mainTitle));
  assert.ok(home.live.some((c) => c.title === mainTitle));
  assert.ok(home.live.every((c) => c.title !== "Campanha QA privada"));
  assert.deepEqual(home.upcoming, []);
  assert.equal(home.unreadNotifications, 1);
  const heading = p.getByRole("heading", { name: "Olá, Carla", exact: true });
  await expect(heading).toBeVisible();
  const featured = p.getByRole("region", { name: "Em destaque", exact: true });
  const cover = featured.getByRole("img", { name: mainTitle, exact: true });
  await expect(cover).toBeVisible();
  await expect.poll(() => cover.evaluate((img) => [img.naturalWidth, img.naturalHeight])).toEqual([960, 600]);
  assert.equal(await cover.evaluate((img) => getComputedStyle(img).objectFit), "cover");
  const mediaSrc = new URL(await cover.getAttribute("src"), url);
  assert.equal(mediaSrc.origin, url.origin);
  assert.match(mediaSrc.pathname, /^\/api\/public\/campaign-media\/[^/]+\/cover$/);
  assert.match(mediaSrc.searchParams.get("v"), /^[a-f0-9]{16}$/);
  const file = await ctx.request.get(mediaSrc.href);
  assert.equal(file.status(), 200);
  assert.match(file.headers()["content-type"], /^image\/png/);
  assert.ok((await file.body()).length > 1024);
  await expect(featured.getByRole("link", { name: /Ver campanha/ }).first()).toHaveAttribute("href", "/campanha/qa-premium-kit-viagem");
  await expect(featured.getByRole("progressbar")).toHaveAttribute("value", "17");
  await expect(featured.getByText("R$ 2,50 por título", { exact: true })).toBeVisible();
  const broken = p.getByRole("region", { name: "Campanhas publicadas" }).getByRole("link", { name: /Campanha QA sem mídia/ });
  await expect(broken.getByText("Sem imagem disponível", { exact: true })).toBeVisible();
  await expect(broken.getByRole("img", { name: "Campanha QA sem mídia" })).toHaveCount(0);
  await expect(p.getByRole("heading", { name: "Campanha QA privada", exact: true })).toHaveCount(0);
  await expect(p.getByRole("region", { name: "Em breve" }).getByText("Nenhuma campanha disponível agora.", { exact: true })).toBeVisible();
  const notices = p.getByRole("region", { name: "Avisos" });
  await expect(notices.getByRole("link", { name: /Catálogo em teste/ })).toHaveAttribute("href", defaultPath);
  await expect(notices.getByRole("link", { name: /Aviso sem destino/ })).toHaveCount(0);
  await expect(notices.getByRole("heading", { name: "Aviso sem destino" })).toBeVisible();
  const notification = p.getByRole("link", { name: "Notificações", exact: true });
  await expect(notification).toHaveAttribute("href", "/comprador/notificacoes");
  await expect(notification).toHaveAccessibleDescription("1 notificação não lida");
  const search = p.getByRole("link", { name: "Buscar campanhas e prêmios", exact: true });
  await expect(search).toHaveAttribute("href", defaultPath);

  const capture = async (name, item) => {
    if (!output) return;
    await p.evaluate(() => document.fonts.ready.then(() => scrollTo(0, 0)));
    const options = { path: resolve(output, name), scale: "device", animations: "disabled", style: "nextjs-portal { display: none !important }" };
    if (item) await item.screenshot(options);
    else await p.screenshot(options);
  };
  await capture("SorteX-Comprador-Premium-desktop.png");
  await notification.focus();
  await p.keyboard.press("Tab");
  await expect(search).toBeFocused();
  assert.equal(await search.evaluate((node) => getComputedStyle(node).outlineWidth), "2px");
  await p.setViewportSize({ width: 320, height: 812 });
  await p.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), 320);
  assert.equal(await featured.evaluate((node) => getComputedStyle(node).colorScheme), "dark");
  assert.equal(await search.evaluate((node) => getComputedStyle(node).transitionDuration), "0s");
  await capture("SorteX-Comprador-Premium-celular.png");
  await capture("SorteX-Comprador-Premium-celular-capa.png", featured.getByRole("link", { name: /Ver campanha/ }).first());

  let release;
  const wait = new Promise((done) => { release = done; });
  await p.route(`**${api}`, async (route) => {
    await wait;
    await route.fulfill({ status: 503, json: { message: "Indisponibilidade simulada apenas para a prova de erro." } });
  });
  await p.goto(path);
  await expect(p.getByRole("status").filter({ hasText: "Carregando sua conta…" })).toBeVisible();
  release();
  await expect(p.getByRole("heading", { name: "Não foi possível carregar seus dados." })).toBeVisible();
  await expect(heading).toHaveCount(0);
  await p.unroute(`**${api}`);
  await p.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(heading).toBeVisible();

  await ctx.clearCookies();
  await login("buyer2@sortex.example.invalid");
  await p.goto(path);
  await expect(p.getByRole("heading", { name: "Olá, Bruno", exact: true })).toBeVisible();
  await expect(heading).toHaveCount(0);
  await expect(notification).not.toHaveAttribute("aria-describedby", "buyer-home-unread");
  for (const [email, endpoint] of [
    ["organizer1@sortex.example.invalid", "/api/auth/login"],
    ["admin@sortex.example.invalid", "/api/auth/admin-login"],
  ]) {
    await ctx.clearCookies();
    await login(email, endpoint);
    assert.equal((await ctx.request.get(api)).status(), 403);
  }
  assert.deepEqual(blocked, [], "A prova não gera escrita de aplicação");
  console.log(JSON.stringify({
    path, realWidth: 960, realHeight: 600, versionedMedia: true, missingCoverFallback: true, privateCampaignHidden: true,
    alternateBuyerPrivate: true, catalogAndNotificationLinks: true, emptyUpcoming: true, anonymous: 401, organizer: 403, admin: 403,
    desktopLight: true, dark320: true, keyboard: true, loadingErrorRetry: true, appMutations: 0,
  }));
} catch (error) {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message.split("\n").filter((line) => !/cookie|authorization/i.test(line)).join("\n"));
  process.exitCode = 1;
} finally {
  await ctx.close();
  await browser.close();
}
