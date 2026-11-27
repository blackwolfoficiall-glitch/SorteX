import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect, webkit } from "@playwright/test";

const local = new URL(process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000");
assert.equal(local.protocol, "http:");
assert.equal(local.hostname, "127.0.0.1");
const runner = process.env.SORTEX_PUBLIC_CONTACT_BROWSER === "webkit" ? "webkit" : "chromium";
const output = process.env.SORTEX_PUBLIC_CONTACT_SCREENSHOTS;
if (output) await mkdir(output, { recursive: true });
const browser = runner === "webkit" ? await webkit.launch() : await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_BINARY || undefined,
  args: ["--disable-gpu", "--no-zygote", "--renderer-process-limit=1"],
});
const context = await browser.newContext({
  baseURL: local.origin, viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2, colorScheme: "light", reducedMotion: "reduce",
});
try {
  const blocked = [];
  await context.route("**/*", (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.origin === local.origin && ["GET", "HEAD"].includes(req.method())) return route.continue();
    if (url.origin !== local.origin || !url.pathname.startsWith("/__nextjs")) blocked.push(req.method());
    return route.abort();
  });
  const page = await context.newPage();
  assert.equal((await page.goto("/contato")).status(), 200);
  await expect(page).toHaveTitle("SorteX");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", "Plataforma inteligente de campanhas premiadas.");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  const premium = page.locator(".sx-premium");
  await expect(page.getByRole("heading", { level: 1, name: "Vamos conversar." })).toBeVisible();
  await expect(page.getByText("Encontre o caminho para acompanhar sua conta e suas campanhas.")).toBeVisible();
  const login = premium.getByRole("link", { name: "Já faço parte da SorteX" });
  const faq = premium.getByRole("link", { name: "Consulte as perguntas frequentes." });
  const pending = premium.getByRole("region", { name: "Canal público em preparação" });
  await expect(login).toHaveAttribute("href", "/login");
  await expect(login).toHaveAccessibleDescription("Entre na sua conta para acessar o painel e os canais internos de suporte.");
  await expect(faq).toHaveAttribute("href", "/#duvidas");
  await expect(pending.getByText("Ainda não há telefone ou e-mail oficial publicado nesta página.", { exact: false })).toBeVisible();
  await expect(pending.getByRole("link")).toHaveCount(0);
  await expect(pending.getByRole("button")).toHaveCount(0);
  await expect(page.locator("main form, main a[href^='mailto:'], main a[href^='tel:'], main a[href*='wa.me']")).toHaveCount(0);
  assert.deepEqual(await premium.getByRole("link").evaluateAll((links) => links.map((link) => link.getAttribute("href"))), ["/login", "/#duvidas"]);
  for (const href of ["/", "/#por-dentro", "/termos", "/privacidade"]) assert.ok(await page.locator(`main a[href="${href}"]`).count());
  const capture = async (name) => {
    if (!output || runner !== "chromium") return;
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: resolve(output, name), scale: "device", animations: "disabled", style: "nextjs-portal { display: none !important }" });
  };
  await capture("SorteX-Contato-Premium-desktop.png");
  await login.focus();
  await page.keyboard.press("Tab");
  await expect(faq).toBeFocused();
  assert.equal(await faq.evaluate((link) => getComputedStyle(link).outlineWidth), "2px");
  assert.equal(await login.evaluate((link) => getComputedStyle(link).transitionDuration), "0s");
  for (const mode of ["light", "dark"]) {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.emulateMedia({ colorScheme: mode, reducedMotion: "reduce" });
    await expect(pending).toBeVisible();
    const range = await premium.evaluate((node) => ({
      mode: getComputedStyle(node).colorScheme, width: document.documentElement.scrollWidth, viewport: innerWidth,
      links: [...node.querySelectorAll("a")].map((link) => {
        const b = link.getBoundingClientRect();
        return { left: b.left, right: b.right, h: b.height };
      }),
    }));
    assert.equal(range.mode, mode);
    assert.ok(range.width <= range.viewport);
    assert.ok(range.links.every(({ left, right, h }) => left >= 0 && right <= 320 && h >= 44));
    if (mode === "dark") await capture("SorteX-Contato-Premium-celular.png");
  }
  const loginResult = await context.request.get("/login");
  assert.equal(loginResult.status(), 200);
  const home = await context.request.get("/");
  assert.equal(home.status(), 200);
  assert.match(await home.text(), /id="duvidas"/);
  assert.deepEqual(blocked, []);
  console.log(JSON.stringify({
    route: "/contato", runner, publicAnonymous: true, metadataPreserved: true, oldLinksPreserved: true,
    viewport: "1440 light; 320 light/dark", keyboard: true, publicChannel: "not available, no form", outboundRequests: 0,
  }));
} finally {
  await browser.close();
}
