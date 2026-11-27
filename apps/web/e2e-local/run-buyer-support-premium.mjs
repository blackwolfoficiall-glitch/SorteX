import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect, webkit } from "@playwright/test";

const origin = new URL(process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000");
assert.equal(origin.protocol, "http:");
assert.equal(origin.hostname, "127.0.0.1");
assert.ok(process.env.TEST_SEED_PASSWORD);
const output = process.env.SORTEX_SUPPORT_SCREENSHOTS;
const engine = process.env.SORTEX_SUPPORT_BROWSER === "webkit" ? "webkit" : "chromium";
if (output) await mkdir(output, { recursive: true });
const browser = engine === "webkit" ? await webkit.launch() : await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_BINARY || undefined,
  args: ["--disable-gpu", "--no-zygote", "--renderer-process-limit=1"],
});
const options = { baseURL: origin.origin, viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, colorScheme: "light", reducedMotion: "reduce" };
const path = "/comprador/suporte";
const api = "/api/buyer/support";
const ticket = "Chamado fictício · Acompanhar meu título";
const otherTicket = "Chamado fictício · Conta separada";
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
  assert.equal((await ctx.request.post(endpoint, { data: { email, password: process.env.TEST_SEED_PASSWORD } })).status(), 200);
}
const owner = await context();
try {
  const p = await owner.newPage();
  assert.equal((await owner.request.get(api)).status(), 401);
  await p.goto(path);
  await expect(p).toHaveURL(/\/login\?next=%2Fcomprador%2Fsuporte$/);
  await login(owner, "buyer1@sortex.example.invalid");
  const [response] = await Promise.all([p.waitForResponse((reply) => new URL(reply.url()).pathname === api), p.goto(path)]);
  assert.equal(response.status(), 200);
  const records = await response.json();
  const own = records.find(({ subject }) => subject === ticket);
  assert.ok(own && !records.some(({ subject }) => subject === otherTicket));
  const form = p.getByRole("region", { name: "Novo chamado" });
  const history = p.getByRole("region", { name: "Meus chamados" });
  await expect(history.getByRole("heading", { name: ticket })).toBeVisible();
  await expect(history.getByText("Aberto", { exact: true })).toBeVisible();
  await expect(history.getByText("Resolvido", { exact: true })).toBeVisible();
  await expect(history.getByText("25/11/2026, 10:00", { exact: true }).first()).toBeVisible();
  await expect(history.getByRole("heading", { name: otherTicket })).toHaveCount(0);
  await expect(form.getByRole("button", { name: "Abrir chamado" })).toBeEnabled();
  const category = form.getByRole("combobox", { name: "Categoria" });
  const subject = form.getByRole("textbox", { name: "Assunto" });
  const description = form.getByRole("textbox", { name: "Descrição" });
  await expect(subject).toHaveAttribute("minlength", "3");
  await expect(subject).toHaveAttribute("maxlength", "160");
  await expect(description).toHaveAttribute("minlength", "10");
  await expect(description).toHaveAttribute("maxlength", "5000");
  assert.deepEqual(await category.locator("option").evaluateAll((options) => options.map((item) => item.value)), ["ACCOUNT", "CAMPAIGN", "PAYMENT", "PRIZE", "TECHNICAL", "OTHER"]);
  await category.focus();
  await p.keyboard.press("Tab");
  await expect(subject).toBeFocused();
  const keyboard = await subject.evaluate((node) => getComputedStyle(node).outlineWidth);
  assert.equal(keyboard, "2px");
  await category.selectOption("PRIZE");
  await subject.fill("Rascunho fictício não enviado");
  await description.fill("Apenas teste local de edição do formulário.");
  await expect(category).toHaveValue("PRIZE");
  await expect(subject).toHaveValue("Rascunho fictício não enviado");
  await expect(description).toHaveValue("Apenas teste local de edição do formulário.");
  // Deliberately do not click the submit button, send support or press Enter.
  await category.selectOption("ACCOUNT");
  await subject.clear();
  await description.clear();

  const capture = async (name) => {
    if (!output || engine !== "chromium") return;
    await p.evaluate(() => document.fonts.ready.then(() => scrollTo(0, 0)));
    await p.screenshot({ path: resolve(output, name), scale: "device", animations: "disabled", style: "nextjs-portal { display: none !important }" });
  };
  await capture("SorteX-Suporte-Premium-desktop.png");
  for (const colorScheme of ["light", "dark"]) {
    await p.setViewportSize({ width: 320, height: 950 });
    await p.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await expect(form).toBeVisible();
    const [width, viewport, mode] = await p.evaluate(() => [
      document.documentElement.scrollWidth, innerWidth, getComputedStyle(document.querySelector(".sx-premium")).colorScheme,
    ]);
    assert.ok(width <= viewport);
    assert.equal(mode, colorScheme);
  }
  await capture("SorteX-Suporte-Premium-celular.png");

  const delayError = async (route) => {
    await new Promise((done) => setTimeout(done, 400));
    await route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
  };
  await p.route(`**${api}`, delayError);
  await p.goto(path);
  const spinner = history.getByRole("status");
  await expect(spinner).toBeVisible();
  assert.equal(await spinner.locator("svg").evaluate((node) => getComputedStyle(node).animationName), "none");
  await expect(history.getByRole("alert")).toContainText("Não foi possível carregar seus chamados.");
  await p.unroute(`**${api}`, delayError);
  await history.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(history.getByRole("heading", { name: ticket })).toBeVisible();

  await owner.close();
  const second = await context();
  await login(second, "buyer2@sortex.example.invalid");
  assert.equal((await second.request.get("/api/auth/me")).status(), 200);
  assert.deepEqual((await (await second.request.get(api)).json()).map(({ subject }) => subject), [otherTicket]);
  const other = await second.newPage();
  await other.goto(path);
  await expect(other.getByRole("heading", { name: otherTicket })).toBeVisible();
  await expect(other.getByRole("heading", { name: ticket })).toHaveCount(0);
  assert.equal((await second.request.get(`${api}/${own.id}`)).status(), 404);
  await second.close();
  const empty = await context();
  await login(empty, "buyer-empty-support@sortex.example.invalid");
  assert.deepEqual(await (await empty.request.get(api)).json(), []);
  const emptyPage = await empty.newPage();
  await emptyPage.goto(path);
  await expect(emptyPage.getByText("Você ainda não tem chamados.")).toBeVisible();
  await empty.close();

  for (const [email, endpoint] of [["organizer1@sortex.example.invalid", "/api/auth/login"], ["admin@sortex.example.invalid", "/api/auth/admin-login"]]) {
    const denied = await context();
    await login(denied, email, endpoint);
    assert.equal((await denied.request.get(api)).status(), 403);
    await denied.close();
  }
  assert.deepEqual(blocked, []);
  console.log(JSON.stringify({
    path, engine, history: "owner & foreign isolated, empty fixture, 503/retry",
    form: "original six categories and native bounds; edited local draft only, no submit",
    auth: "401 anon, 403 roles, 404 foreign detail", viewport: "1440 light; 320 light/dark",
    keyboard: true, supportPosts: 0, outboundRequests: 0,
  }));
} finally {
  await browser.close();
}
