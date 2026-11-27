import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect, webkit } from "@playwright/test";

const origin = new URL(process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000");
assert.equal(origin.protocol, "http:");
assert.equal(origin.hostname, "127.0.0.1");
const engine = process.env.SORTEX_CAMPAIGN_BROWSER === "webkit" ? "webkit" : "chromium";
const output = process.env.SORTEX_PUBLIC_CAMPAIGN_SCREENSHOTS;
if (output) await mkdir(output, { recursive: true });
const browser = engine === "webkit" ? await webkit.launch() : await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_BINARY || undefined,
  args: ["--disable-gpu", "--no-zygote", "--renderer-process-limit=1"],
});
const options = {
  baseURL: origin.origin, viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 2, colorScheme: "light", reducedMotion: "reduce",
};
const context = await browser.newContext(options);
const blocked = [];
const api = (slug) => `/api/public/campaigns/${slug}`;
const route = (slug) => `/campanha/${slug}`;
try {
  await context.route("**/*", (r) => {
    const req = r.request();
    const url = new URL(req.url());
    if (url.origin === origin.origin && ["GET", "HEAD"].includes(req.method())) return r.continue();
    if (url.origin !== origin.origin || !url.pathname.startsWith("/__nextjs")) blocked.push(req.method());
    return r.abort();
  });
  const p = await context.newPage();
  p.setDefaultTimeout(37_000);
  const capture = async (name) => {
    if (!output || engine !== "chromium") return;
    await p.evaluate(() => document.fonts.ready.then(() => scrollTo(0, 0)));
    await p.screenshot({ path: resolve(output, name), scale: "device", animations: "disabled", style: "nextjs-portal { display: none !important }" });
  };
  const live = "qa-campaign-premium";
  const title = "Campanha fictícia · Aurora Premium";
  const [published] = await Promise.all([
    p.waitForResponse((reply) => new URL(reply.url()).pathname === api(live)), p.goto(route(live)),
  ]);
  assert.equal(published.status(), 200);
  const payload = await published.json();
  assert.equal(payload.salesWindow.status, "OPEN");
  assert.equal(payload.soldNumbers, 17);
  assert.equal(payload.galleryImages.length, 1);
  const scope = p.locator("[data-public-campaign-hero=\x22premium\x22]");
  const media = scope.getByTestId("campaign-hero");
  const image = media.getByRole("img", { name: title, exact: true });
  await expect(media.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(media.getByText("Resultado baseado na Loteria Federal")).toBeVisible();
  await expect(scope.getByRole("progressbar", { name: "Percentual vendido" })).toHaveAttribute("aria-valuenow", "17");
  await expect(scope.getByText("Valor da cota", { exact: true })).toBeVisible();
  await expect(scope.getByText("2,50", { exact: false })).toBeVisible();
  await expect(scope.getByText("Participantes", { exact: true })).toBeVisible();
  await expect.poll(() => image.evaluate((node) => [node.naturalWidth, node.naturalHeight])).toEqual([960, 600]);
  const cover = new URL(await image.getAttribute("src"), origin);
  assert.match(cover.pathname, /^\/api\/public\/campaign-media\/.+\/cover$/);
  assert.match(cover.searchParams.get("v"), /^[0-9a-f]{16}$/);
  assert.equal(cover.origin, origin.origin);
  const panel = p.locator("[data-purchase-panel]");
  await expect(panel).toBeVisible();
  assert.equal(await panel.evaluate((element) => element.closest(".sx-premium") === null), true);
  await capture("SorteX-Campanha-Premium-desktop.png");

  const gallery = scope.getByRole("group", { name: "Galeria da campanha" });
  const first = gallery.getByRole("button", { name: "Mostrar imagem 1" });
  const next = gallery.getByRole("button", { name: "Mostrar imagem 2" });
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await first.focus();
  await p.keyboard.press("Tab");
  await expect(next).toBeFocused();
  const box = await next.boundingBox();
  assert.ok(box.height >= 44 && box.width >= 44);
  const styles = await next.evaluate((button) => [getComputedStyle(button).outlineWidth, getComputedStyle(button).transitionDuration]);
  assert.deepEqual(styles, ["2px", "0s"]);
  await p.keyboard.press("Enter");
  await expect(next).toHaveAttribute("aria-pressed", "true");
  await expect(first).toHaveAttribute("aria-pressed", "false");
  await expect(image).toHaveAttribute("src", /\/gallery\//);
  await expect.poll(() => image.evaluate((node) => [node.naturalWidth, node.naturalHeight])).toEqual([960, 600]);
  await first.click();
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await expect(image).toHaveAttribute("src", /\/cover\?v=/);

  for (const colorScheme of ["light", "dark"]) {
    await p.setViewportSize({ width: 320, height: 875 });
    await p.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await expect(media).toBeVisible();
    const range = await scope.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      const buttons = [...node.querySelectorAll("button")].map((item) => {
        const b = item.getBoundingClientRect();
        return [b.left, b.right, b.width, b.height];
      });
      return { left: rect.left, right: rect.right, scroll: document.documentElement.scrollWidth, viewport: innerWidth,
        theme: getComputedStyle(node.closest(".sx-premium")).colorScheme, buttons };
    });
    assert.equal(range.theme, colorScheme);
    assert.ok(range.left >= 0 && range.right <= 320 && range.scroll <= range.viewport);
    assert.ok(range.buttons.every(([left, right, width, height]) => left >= 0 && right <= 320 && width >= 44 && height >= 44));
    const timerText = await media.getByText("Faltam para o sorteio", { exact: true }).boundingBox();
    const seal = await media.getByText("Organizador verificado", { exact: true }).boundingBox();
    assert.ok(timerText && seal && timerText.y + timerText.height <= seal.y, "countdown copy and verification seal do not overlap");
    if (colorScheme === "dark") await capture("SorteX-Campanha-Premium-celular.png");
  }

  const customSlug = "qa-campaign-personalizada";
  await p.goto(route(customSlug));
  const customTitle = scope.getByRole("heading", { name: "Campanha fictícia · Galeria personalizada" });
  const customImage = media.getByRole("img", { name: "Campanha fictícia · Galeria personalizada" });
  await expect(customTitle).toBeVisible();
  await expect(scope.getByText("Participantes", { exact: true })).toHaveCount(0);
  const mobile = await customImage.evaluate((img) => [getComputedStyle(img).objectPosition, getComputedStyle(img).transform]);
  assert.equal(mobile[0], "67% 31%");
  assert.match(mobile[1], /^matrix\(1\.25,/);
  assert.deepEqual(await customTitle.evaluate((h) => [getComputedStyle(h).color, getComputedStyle(h).fontFamily]), ["rgb(255, 209, 102)", "Georgia, serif"]);
  assert.match(await scope.getByText("Valor da cota", { exact: true }).evaluate((p) => p.parentElement.style.backgroundColor), /202, 138, 4/);
  await p.setViewportSize({ width: 1440, height: 1000 });
  const desktop = await customImage.evaluate((img) => [getComputedStyle(img).objectPosition, getComputedStyle(img).transform]);
  assert.equal(desktop[0], "22% 76%");
  assert.match(desktop[1], /^matrix\(1\.18,/);

  const futureSlug = "qa-campaign-futura";
  const future = await context.request.get(api(futureSlug));
  assert.equal((await future.json()).salesWindow.status, "NOT_STARTED");
  await p.goto(route(futureSlug));
  await expect(p.locator("[data-purchase-panel]")).toContainText("As vendas ainda não começaram.");
  await expect(p.locator("[data-purchase-panel]").getByRole("button")).toHaveCount(0);
  const draft = "qa-campaign-privada";
  assert.equal((await context.request.get(api(draft))).status(), 404);
  await p.goto(route(draft));
  await expect(p.locator("main")).toContainText("Campanha não encontrada.");
  await expect(scope).toHaveCount(0);
  await expect(p.getByText("Campanha QA não publicada", { exact: true })).toHaveCount(0);
  assert.deepEqual(blocked, []);
  console.log(JSON.stringify({
    scope: "/campanha/[slug]", engine, active: "OPEN", future: "NOT_STARTED", draft: 404,
    images: "2 actual file-storage PNGs, versioned cover and keyboard gallery",
    custom: "title color, exact typography, accent, crop desktop and mobile, participant disclosure preserved",
    viewport: "1440 light; 320 light/dark", keyboard: true, noCheckoutMutation: true,
  }));
} finally {
  await browser.close();
}
