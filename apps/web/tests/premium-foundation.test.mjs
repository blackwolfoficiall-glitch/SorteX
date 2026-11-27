import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  premiumGradientStops,
  premiumPalettes,
  premiumShapeTokens,
  premiumTextTokens,
} from "../../../packages/design-tokens/src/premium.ts";

const files = new URL("../public/fonts/sortex/", import.meta.url);
const css = readFileSync(new URL("../components/premium/premium.css", import.meta.url), "utf8");

test("Premium preserves the approved colors and avoids low-contrast text on brand gradients", () => {
  assert.equal(premiumPalettes.light.purple, "#7734F5");
  assert.equal(premiumPalettes.light.blue, "#285BEA");
  assert.equal(premiumPalettes.light.bg, "#F3F0FF");
  assert.equal(premiumPalettes.light.deep, "#191238");
  assert.equal(premiumPalettes.light.white, "#FFFFFF");
  const luminance = (hex) => {
    const [r, g, b] = hex.slice(1).match(/../g).map((part) => {
      const x = Number.parseInt(part, 16) / 255;
      return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  for (const bg of [
    premiumPalettes.light.purple, premiumPalettes.light.blue,
    premiumGradientStops.from, premiumGradientStops.to,
  ]) assert((1.05 / (luminance(bg) + 0.05)) >= 4.5, bg);
  assert.equal(premiumTextTokens.title.fontSize, 28);
  assert.equal(premiumShapeTokens.actionHeight, 48);
});

test("Premium CSS is opt-in and uses verified same-origin WOFF2 fonts and notices", () => {
  const fonts = {
    "manrope-v23-latin.woff2": "8c2def024c1bf31aacf3624ae3c4d701269b4ec3dc765c04830839f0d36b2d9e",
    "manrope-v23-latin-ext.woff2": "2f7335119075b2079f1d882530bbc18728461612bf90743203d73a74a48f4d9b",
    "sora-v17-latin.woff2": "fa26406eeda9a3c6ec3d9ea8813c3045d6dc755e30c716d5c094e8ef43be5a7f",
    "sora-v17-latin-ext.woff2": "c163c536f68befd99a83d4f17e8b88030e7f54229688a45c44f70c7149db7385",
  };
  assert.doesNotMatch(css, /(?:https?:)?\/\/fonts\./);
  assert.match(css, /prefers-color-scheme: dark/);
  assert.match(css, /prefers-reduced-motion: no-preference/);
  for (const [file, sha] of Object.entries(fonts)) {
    const bytes = readFileSync(new URL(file, files));
    assert.equal(bytes.subarray(0, 4).toString(), "wOF2");
    assert.equal(bytes.readUInt32BE(8), bytes.length);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), sha);
    assert(css.includes(`/fonts/sortex/${file}`));
  }
  for (const family of ["sora", "manrope"]) {
    const notice = readFileSync(new URL(`${family}-LICENSE.txt`, files), "utf8");
    assert.match(notice, /SIL OPEN FONT LICENSE Version 1\.1/);
  }
});
