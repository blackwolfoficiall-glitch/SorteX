import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect, webkit } from "@playwright/test";

const local = new URL(process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000");
assert.equal(local.protocol, "http:");
assert.equal(local.hostname, "127.0.0.1");
const runner = process.env.SORTEX_PUBLIC_SUPPORT_BROWSER === "webkit" ? "webkit" : "chromium";
const output = process.env.SORTEX_PUBLIC_SUPPORT_SCREENSHOTS;
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
  const p = await context.newPage();
  assert.equal((await p.goto("/suporte")).status(), 200);
  await expect(p).toHaveTitle("SorteX");
  await expect(p.locator('meta[name="description"]')).toHaveAttribute("content", "Plataforma inteligente de campanhas premiadas.");
  await expect(p.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  const surface = p.locator(".sx-premium");
  const main = p.getByRole("main");
  await expect(main.getByRole("heading", { level: 1, name: "Suporte" })).toBeVisible();
  await expect(main.getByText("Entre na sua conta para abrir e acompanhar um chamado com segurança.")).toBeVisible();
  const access = main.getByRole("region", { name: "Acesso à conta" });
  const back = main.getByRole("link", { name: "Voltar" });
  const login = access.getByRole("link", { name: "Entrar" });
  await expect(back).toHaveAttribute("href", "/");
  await expect(login).toHaveAttribute("href", "/login");
  assert.deepEqual(await main.getByRole("link").evaluateAll((links) => links.map((link) => link.getAttribute("href"))), ["/", "/login"]);
  await expect(p.locator("form")).toHaveCount(0);
  await expect(main.getByRole("button")).toHaveCount(0);
  const shot = async (name) => {
    if (!output || runner !== "chromium") return;
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: resolve(output, name), scale: "device", animations: "disabled", style: "nextjs-portal { display: none !important }" });
  };
  await shot("SorteX-Suporte-Publico-Premium-desktop.png");
  await back.focus();
  await p.keyboard.press("Tab");
  await expect(login).toBeFocused();
  assert.deepEqual(await login.evaluate((link) => [getComputedStyle(link).outlineWidth, getComputedStyle(link).transitionDuration]), ["2px", "0s"]);
  for (const mode of ["light", "dark"]) {
    await p.setViewportSize({ width: 320, height: 850 });
    await p.emulateMedia({ colorScheme: mode, reducedMotion: "reduce" });
    const boundaries = await surface.evaluate((node) => ({
      mode: getComputedStyle(node).colorScheme, width: document.documentElement.scrollWidth, viewport: innerWidth,
      links: [...node.querySelectorAll("a")].map((link) => {
        const b = link.getBoundingClientRect();
        return { x: b.left, right: b.right, h: b.height };
      }),
    }));
    assert.equal(boundaries.mode, mode);
    assert.ok(boundaries.width <= boundaries.viewport);
    assert.ok(boundaries.links.every(({ x, right, h }) => x >= 0 && right <= 320 && h >= 44));
    if (mode === "dark") await shot("SorteX-Suporte-Publico-Premium-celular.png");
  }
  for (const url of ["/", "/login"]) assert.equal((await context.request.get(url)).status(), 200);
  assert.deepEqual(blocked, []);
  console.log(JSON.stringify({
    route: "/suporte", runner, publicAnonymous: true, metadataPreserved: true,
    links: ["/", "/login"], viewport: "1440 light; 320 light/dark", keyboard: true,
    accountForm: false, attemptsToContact: 0, outboundRequests: 0,
  }));
} finally {
  await browser.close();
}
