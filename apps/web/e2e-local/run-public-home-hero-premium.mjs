import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect, webkit } from "@playwright/test";

const origin = new URL(process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000");
assert.equal(origin.protocol, "http:");
assert.equal(origin.hostname, "127.0.0.1");
const runner = process.env.SORTEX_HOME_BROWSER === "webkit" ? "webkit" : "chromium";
const output = process.env.SORTEX_PUBLIC_HOME_SCREENSHOTS;
if (output) await mkdir(output, { recursive: true });
const browser = runner === "webkit"
  ? await webkit.launch()
  : await chromium.launch({
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
    if (url.origin !== origin.origin || !url.pathname.startsWith("/__nextjs")) blocked.push(req.method());
    return route.abort();
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(45_000);
  assert.equal((await p.goto("/")).status(), 200);
  await expect(p).toHaveTitle(/SorteX.+Sua campanha, em outro nível/);
  assert.equal(new URL(await p.locator('link[rel="canonical"]').getAttribute("href")).href, origin.origin + "/");
  await expect(p.locator('meta[property="og:image"]')).toHaveAttribute("content", origin.origin + "/sortex-og.png");
  await expect(p.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  const hero = p.getByRole("region", { name: "Sua campanha, em outro nível." });
  await expect(hero.getByRole("heading", { level: 1 })).toHaveText(/Sua campanha,\s*em outro nível\./s);
  const organize = hero.getByRole("link", { name: "Quero organizar" });
  const participate = hero.getByRole("link", { name: "Quero participar" });
  const tour = hero.getByRole("link", { name: "Veja a SorteX por dentro" });
  await expect(organize).toHaveAttribute("href", "/cadastro/organizador");
  await expect(participate).toHaveAttribute("href", "/cadastro/comprador");
  await expect(tour).toHaveAttribute("href", "#por-dentro");
  await expect(hero.getByRole("figure", { name: "Ilustração do dashboard inteligente" })).toBeVisible();
  await expect(hero.getByText("Visão ilustrada", { exact: true })).toBeVisible();
  await expect(hero.getByText("Ilustração demonstrativa · dados fictícios")).toBeVisible();
  await expect(p.getByRole("navigation", { name: "Acesso à conta" }).getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
  await expect(p.locator("footer")).toBeVisible();
  const capture = async (name) => {
    if (!output || runner !== "chromium") return;
    await p.evaluate(() => document.fonts.ready.then(() => scrollTo(0, 0)));
    await p.screenshot({ path: resolve(output, name), scale: "device", animations: "disabled", style: "nextjs-portal { display: none !important }" });
  };
  await capture("SorteX-Inicio-Premium-desktop.png");
  await organize.focus();
  await p.keyboard.press("Tab");
  await expect(participate).toBeFocused();
  const keyboard = await participate.evaluate((node) => [getComputedStyle(node).outlineWidth, getComputedStyle(node).transitionDuration]);
  assert.deepEqual(keyboard, ["2px", "0s"]);

  for (const colorScheme of ["light", "dark"]) {
    await p.setViewportSize({ width: 320, height: 875 });
    await p.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await expect(organize).toBeVisible();
    await expect(participate).toBeVisible();
    const layout = await hero.evaluate((node) => {
      const b = node.getBoundingClientRect();
      const links = [...node.querySelectorAll("a")].map((element) => {
        const area = element.getBoundingClientRect();
        return { left: area.left, right: area.right, height: area.height };
      });
      return {
        width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
        left: b.left, right: b.right,
        scheme: getComputedStyle(node.closest(".sx-premium")).colorScheme,
        ctas: links, gradient: getComputedStyle(node.querySelector("h1").parentElement).backgroundImage,
        leadColor: getComputedStyle(node.querySelector("h1 + p")).color,
      };
    });
    assert.equal(layout.scheme, colorScheme);
    assert.ok(layout.scrollWidth <= layout.width, "page does not overflow horizontally");
    assert.ok(layout.left >= 0 && layout.right <= layout.width);
    assert.ok(layout.ctas.every(({ left, right, height }) => left >= 0 && right <= 320 && height >= 44));
    assert.match(layout.gradient, /rgb\(89, 37, 182\).+rgb\(36, 71, 185\)/);
    assert.equal(layout.leadColor, "rgb(255, 255, 255)");
    if (colorScheme === "dark") await capture("SorteX-Inicio-Premium-celular.png");
  }
  await tour.click();
  await expect(p).toHaveURL(/#por-dentro$/);
  await expect(p.locator("#por-dentro")).toBeVisible();
  for (const href of ["/cadastro/organizador", "/cadastro/comprador", "/login"])
    assert.equal((await ctx.request.get(href)).status(), 200, href);
  assert.deepEqual(blocked, []);
  console.log(JSON.stringify({
    path: "/", browser: runner, metadata: "title, canonical, og image, noindex QA",
    viewport: "1440 light + 320 light/dark", keyboard: true, ctaHeight: 44, links: "organizer, buyer, login and tour verified",
    illustration: "existing example explicitly marked fictitious", outboundOrApplicationWrites: 0,
  }));
} finally {
  await browser.close();
}
