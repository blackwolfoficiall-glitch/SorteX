// Loopback-only browser proof with an independently seeded disposable Nest/PostgreSQL fixture.
import assert from "node:assert/strict";
import { join } from "node:path";
import { webkit } from "playwright";
import { expect as playwrightExpect } from "@playwright/test";

const expect = playwrightExpect.configure({ timeout: 20_000 });

const base = new URL(process.env.QUICK_TEST_URL);
assert.equal(base.hostname, "127.0.0.1");
assert.equal(base.protocol, "http:");
assert.ok(process.env.QUICK_TEST_PASSWORD);

function luminance(rgb) {
  assert.equal(rgb.length, 3);
  return rgb.reduce((sum, channel, i) => {
    const v = channel / 255;
    return sum + [0.2126, 0.7152, 0.0722][i] *
      (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  }, 0);
}
function channels(value) {
  return Array.from(value.matchAll(/\d+/g), ([channel]) => Number(channel));
}
function contrast(first, second) {
  const light = [luminance(channels(first)), luminance(channels(second))];
  return (Math.max(...light) + 0.05) / (Math.min(...light) + 0.05);
}
const browser = await webkit.launch({ headless: true });
try {
  const browserContext = await browser.newContext({
    viewport: { width: 320, height: 780 },
    deviceScaleFactor: 1, hasTouch: true, isMobile: true, locale: "pt-BR",
  });
  const attemptedWrites = [];
  await browserContext.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== base.origin) return route.abort();
    if (request.method() !== "GET" && request.method() !== "HEAD") {
      attemptedWrites.push(url.pathname);
      return route.abort();
    }
    return route.continue();
  });
  const login = await browserContext.request.post(new URL("/api/auth/login", base).href, {
    data: { email: "quick-buyer@example.test", password: process.env.QUICK_TEST_PASSWORD },
  });
  assert.equal(login.status(), 200, "synthetic buyer login must succeed at the real BFF");

  for (const [variant, expectedFill] of [
    ["yellow", [202, 138, 4]], ["orange", [234, 88, 12]], ["custom", [118, 118, 118]],
  ]) {
    const slug = "quick-" + variant;
    const response = await browserContext.request.get(new URL("/api/public/campaigns/" + slug, base).href);
    assert.equal(response.status(), 200);
    const campaign = await response.json();
    assert.equal(campaign.popularQuickQuantity, 1000);
    assert.equal(Number(campaign.numberPrice), 0.02);
    const promotion = campaign.promotions.find((item) => item.isActive && item.numberQuantity === 250);
    assert.ok(promotion && Number(promotion.packagePrice) === 4);

    const page = await browserContext.newPage();
    page.setDefaultTimeout(25_000);
    await page.goto(new URL("/campanha/" + slug, base).href, { waitUntil: "domcontentloaded", timeout: 95_000 });
    const panel = page.locator("[data-purchase-panel]");
    const badge = panel.getByText("Mais popular", { exact: true });
    const tile = panel.getByRole("button", { name: /Mais popular\s*\+1\.000\s*R\$\s*20,00/ });
    const offer = panel.getByRole("button", { name: /Oferta catálogo/ });
    const quantity = panel.getByRole("textbox", { name: "Quantidade", exact: true });
    const total = panel.getByText("Total", { exact: true }).locator("..");
    await expect(tile).toBeVisible();
    await expect(offer).toBeVisible();
    await expect(badge).toHaveCount(1);
    await expect(tile.getByText("Mais popular", { exact: true })).toBeVisible();
    await expect(offer.getByText("Mais popular", { exact: true })).toHaveCount(0);
    const state = await tile.evaluate((element) => {
      const [badge, price] = element.querySelectorAll(":scope > span");
      const { left, right } = element.getBoundingClientRect();
      const { left: badgeLeft, right: badgeRight } = badge.getBoundingClientRect();
      const grid = element.parentElement.parentElement;
      const allTiles = Array.from(grid.querySelectorAll("button"), b => {
        const { left, right } = b.getBoundingClientRect();
        return [left, right];
      });
      const ancestors = [];
      let cursor = element;
      for (let i = 0; cursor && i < 9; i++, cursor = cursor.parentElement) {
        const { left, right } = cursor.getBoundingClientRect();
        ancestors.push([cursor.tagName, left, right]);
      }
      const css = (e) => {
        const { color, backgroundColor, opacity, fontSize } = getComputedStyle(e);
        return { color, backgroundColor, opacity, fontSize };
      };
      return { tile: css(element), badge: css(badge), price: css(price), left, right,
        badgeLeft, badgeRight, viewport: window.innerWidth, allTiles, ancestors };
    });
    assert.deepEqual(channels(state.tile.backgroundColor), expectedFill);
    const tileContrast = contrast(state.tile.color, state.tile.backgroundColor);
    const priceContrast = contrast(state.price.color, state.tile.backgroundColor);
    const badgeContrast = contrast(state.badge.color, state.badge.backgroundColor);
    assert.ok(tileContrast >= 4.5 && priceContrast >= 4.5 && badgeContrast >= 4.5, JSON.stringify(state));
    assert.equal(state.price.opacity, "1");
    assert.equal(state.badge.opacity, "1");
    assert.deepEqual(channels(state.badge.backgroundColor), [255, 255, 255]);
    assert.equal(state.viewport, 320);
    assert.ok(state.left >= 0 && state.right <= 320 && state.badgeLeft >= state.left && state.badgeRight <= state.right,
      "badge and tile must fit 320px without crossing adjacent controls: " + JSON.stringify(state));

    assert.equal(state.allTiles.length, 6);
    assert.ok(state.allTiles.every(([left, right]) => left >= 0 && right <= 320),
      "all six quick controls must fit 320px: " + JSON.stringify(state));
    if (variant === "yellow" && process.env.QUICK_TEST_SCREENSHOT_DIR) {
      await tile.scrollIntoViewIfNeeded();
      const box = await tile.boundingBox();
      const top = Math.max(0, Math.floor(box.y) - 16);
      await page.screenshot({ path: join(process.env.QUICK_TEST_SCREENSHOT_DIR, "webkit-320-yellow-tiles.png"),
        clip: { x: 0, y: top, width: 320, height: Math.ceil(box.height) + 25 } });
    }
    async function quote(expectedQuantity, expectedTotal, includePromotion = false) {
      const chosen = Number(await quantity.inputValue());
      assert.equal(chosen, expectedQuantity);
      // Playwright shares the real signed-in browser cookie jar with this BFF
      // context. No app or checkout POST is permitted from the page itself.
      const request = await browserContext.request.post(new URL("/api/platform/promotion-quote", base).href, {
        data: { campaignId: campaign.id, quantity: chosen,
          ...(includePromotion ? { promotionId: promotion.id } : {}) },
      });
      const data = await request.json();
      assert.equal(request.status(), 201);
      assert.equal(data.total, expectedTotal);
      assert.equal(data.promotionId, includePromotion ? promotion.id : null);
    }
    await offer.click();
    await expect(quantity).toHaveValue("250");
    await expect(total).toContainText(/R\$\s*4,00/);
    await quote(250, 4, true);
    if (variant === "yellow") {
      await panel.getByRole("button", { name: /\+50\s*R\$\s*1,00/ }).click();
      await expect(quantity).toHaveValue("300");
      await expect(total).toContainText(/R\$\s*6,00/);
      await offer.click();
      await expect(quantity).toHaveValue("250");
    }
    await tile.click();
    await expect(quantity).toHaveValue("1000");
    await expect(total).toContainText(/R\$\s*20,00/);
    await expect(tile).toBeDisabled();
    await quote(1000, 20);
    console.log(JSON.stringify({ variant, width: state.viewport,
      contrast: [tileContrast, priceContrast, badgeContrast].map((x) => Number(x.toFixed(2))),
      quantity: 1000, quote: 20, promotionQuote: 4, capApplied: true }));
    await page.close();
  }
  assert.deepEqual(attemptedWrites, []);
} finally {
  await browser.close();
}
