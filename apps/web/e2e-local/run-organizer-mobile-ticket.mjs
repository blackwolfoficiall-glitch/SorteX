import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect, webkit } from "@playwright/test";

const origin = new URL(process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000");
assert.equal(origin.protocol, "http:");
assert.equal(origin.hostname, "127.0.0.1");
assert.ok(process.env.TEST_SEED_PASSWORD);
const engine = process.env.SORTEX_TICKET_BROWSER === "webkit" ? "webkit" : "chromium";
const out = process.env.SORTEX_TICKET_SCREENSHOTS;
if (out) await mkdir(out, { recursive: true });
const browser = engine === "webkit" ? await webkit.launch() : await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_BINARY || undefined,
  args: ["--disable-gpu", "--no-zygote", "--renderer-process-limit=1"],
});
const context = await browser.newContext({
  baseURL: origin.origin, viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 2, colorScheme: "light", reducedMotion: "reduce",
});
const blocked = [];
const periodPath = "/api/dashboard/period";
const isPeriod = (reply) => new URL(reply.url()).pathname === periodPath;
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
try {
  await context.route("**/*", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin.origin && ["GET", "HEAD"].includes(request.method())) return route.continue();
    if (url.origin !== origin.origin || !url.pathname.startsWith("/__nextjs")) blocked.push(request.method());
    return route.abort();
  });
  const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
  assert.equal((await context.request.get(`${periodPath}?start=${day}&end=${day}`)).status(), 401);
  const p = await context.newPage();
  p.setDefaultTimeout(55_000);
  await p.goto("/dashboard");
  await expect(p).toHaveURL(/\/login\?next=%2Fdashboard$/);
  const login = await context.request.post("/api/auth/login", {
    data: { email: "organizer1@sortex.example.invalid", password: process.env.TEST_SEED_PASSWORD },
  });
  assert.equal(login.status(), 200);
  for (const path of [
    "/dashboard", "/api/auth/me", "/api/plans/me", "/api/organizer/profile",
    "/api/organizer/personalization", "/api/legal/pending", "/api/campaigns/my", "/api/dashboard", "/api/crm/dashboard",
  ]) assert.equal((await context.request.get(path)).status(), 200, path);
  const [response] = await Promise.all([p.waitForResponse(isPeriod), p.goto("/dashboard")]);
  assert.equal(response.status(), 200);
  const data = await response.json();
  assert.ok(data.summary.paidOrders > 1);
  const headings = p.getByRole("heading", { name: "Desempenho de vendas", exact: true });
  const sales = p.getByRole("region", { name: "Desempenho de vendas" });
  const chart = sales.getByRole("img", { name: /^Receita no intervalo:/ });
  const amount = sales.getByText(money.format(data.summary.grossRevenue), { exact: true }).first();
  const title = sales.getByText("Total bruto confirmado", { exact: true });
  const aliases = ["Hoje", "7 dias", "30 dias", "12 meses", "Personalizado"];
  const filters = sales.getByRole("group", { name: "Período de vendas" });
  assert.deepEqual(await filters.getByRole("button").allTextContents(), aliases);
  await expect(title).toBeVisible();
  await expect(amount).toBeVisible();
  await expect(chart).toBeVisible();
  await expect(sales.getByText(/Intervalo:.*Brasília/)).toBeVisible();
  for (const [label, value] of [
    ["Títulos vendidos", data.summary.soldTickets],
    ["Participantes", data.summary.participants],
    ["Ticket médio", money.format(data.summary.averageTicket)],
    ["Pedidos pagos", data.summary.paidOrders],
  ]) await expect(sales.locator("dl > div").filter({ hasText: label })).toContainText(String(value));

  const capture = async (name) => {
    if (!out) return;
    await p.evaluate(async () => { await document.fonts.ready; scrollTo(0, 0); });
    await p.screenshot({ path: resolve(out, `${engine}-${name}.png`), scale: "device", animations: "disabled", style: "nextjs-portal { display: none !important }" });
  };
  function geometry() {
    return chart.evaluate((graph) => {
      const ticket = graph.parentElement;
      const report = ticket.closest("section");
      const amount = graph.previousElementSibling;
      const nav = document.querySelector(".sxorg-mobile-tabs");
      const navFab = nav?.querySelector(".sxorg-tab-create .sxorg-tab-icon");
      const box = (node) => {
        const rect = node.getBoundingClientRect();
        return Object.fromEntries(["top", "bottom", "left", "right", "width", "height"].map((field) => [field, Math.round(rect[field] * 100) / 100]));
      };
      const ticketStyle = getComputedStyle(ticket);
      const dot = (pseudo) => {
        const style = getComputedStyle(ticket, pseudo);
        return [style.content, style.backgroundColor, style.width, style.height, style.borderTopLeftRadius];
      };
      const hit = (node) => {
        const b = node.getBoundingClientRect();
        const top = document.elementFromPoint(b.left + b.width * .5, b.top + b.height * .75);
        return Boolean(top && node.contains(top));
      };
      const positiveBars = [...graph.children].filter((bar) => bar.getBoundingClientRect().height >= 4);
      return {
        width: innerWidth, scrollWidth: document.documentElement.scrollWidth, scrollY, viewportHeight: innerHeight,
        report: box(report), ticket: box(ticket), chart: box(graph), amount: box(amount),
        navTop: nav && box(nav).height ? Math.min(box(nav).top, navFab ? box(navFab).top : innerHeight) : null,
        positiveBars: positiveBars.length, maxBar: Math.max(0, ...positiveBars.map((bar) => box(bar).height)),
        amountColor: getComputedStyle(amount).color, gradient: ticketStyle.backgroundImage,
        radius: ticketStyle.borderTopLeftRadius, leftNotch: dot("::before"), rightNotch: dot("::after"),
        scheme: getComputedStyle(report).colorScheme, ticketHit: hit(ticket), chartHit: hit(graph),
      };
    });
  }
  async function mode(width, height, colorScheme) {
    await p.setViewportSize({ width, height });
    await p.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await p.evaluate(async () => { await document.fonts.ready; scrollTo(0, 0); });
    await expect.poll(() => p.evaluate(() => innerWidth)).toBe(width);
    await expect.poll(() => sales.evaluate((node) => getComputedStyle(node).colorScheme)).toBe(colorScheme);
    return geometry();
  }

  const after = {};
  for (const theme of ["light", "dark"]) {
    const desktop = await mode(1440, 1000, theme);
    after[`desktop-${theme}`] = desktop;
    await capture(`after-desktop-${theme}`);
    for (const [width, height] of [[390, 844], [320, 680]]) {
      const m = await mode(width, height, theme);
      after[`${width}-${theme}`] = m;
      const contextError = JSON.stringify({ engine, width, theme, m });
      assert.equal(m.scrollY, 0, contextError);
      assert.ok(m.scrollWidth <= width && m.ticket.left > 0 && m.ticket.right < width, contextError);
      assert.equal(m.gradient, desktop.gradient, contextError);
      assert.equal(m.amountColor, desktop.amountColor);
      assert.deepEqual(m.leftNotch, desktop.leftNotch, contextError);
      assert.deepEqual(m.rightNotch, desktop.rightNotch, contextError);
      assert.ok(m.chart.height >= 80 && m.positiveBars >= 2 && m.maxBar >= 30, contextError);
      assert.ok(m.navTop && m.ticket.bottom + 8 <= m.navTop && m.chartHit && m.ticketHit, contextError);
      assert.ok(await filters.getByRole("button").evaluateAll((buttons) => buttons.every((button) => {
        const b = button.getBoundingClientRect();
        return b.height >= 44 && b.left >= 0 && b.right <= innerWidth;
      })));
      const filterRows = await filters.getByRole("button").evaluateAll((buttons) =>
        new Set(buttons.map((button) => Math.round(button.getBoundingClientRect().top))).size);
      assert.equal(filterRows, width === 390 ? 1 : 2, contextError);
      await capture(`after-${width}-${theme}`);
    }
  }

  await filters.getByRole("button", { name: "Hoje", exact: true }).focus();
  await p.keyboard.press("Tab");
  const week = filters.getByRole("button", { name: "7 dias", exact: true });
  await expect(week).toBeFocused();
  assert.deepEqual(await week.evaluate((button) => [getComputedStyle(button).outlineWidth, getComputedStyle(button).transitionDuration]), ["2px", "0s"]);
  const [weekly] = await Promise.all([p.waitForResponse(isPeriod), week.click()]);
  assert.equal(weekly.status(), 200);
  const weekPayload = await weekly.json();
  await expect(chart).toHaveAccessibleName(`Receita no intervalo: ${money.format(weekPayload.summary.grossRevenue)}`);
  const [back] = await Promise.all([p.waitForResponse(isPeriod), filters.getByRole("button", { name: "30 dias", exact: true }).click()]);
  assert.deepEqual((await back.json()).summary, data.summary);
  await expect(amount).toBeVisible();
  await expect(headings).toHaveCount(1);

  // Render a like-for-like baseline without the three *new*, mobile-only
  // rules. The actual page, authorized database data, session, chart and
  // complete remaining stylesheet are identical in both captures.
  const removed = await p.evaluate(() => {
    let count = 0;
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch { continue; }
      for (let i = rules.length - 1; i >= 0; i--) {
        const rule = rules[i];
        if (rule.type === CSSRule.MEDIA_RULE && /37\.49rem|22\.49rem/.test(rule.conditionText) &&
          /organizer-dashboard-premium/.test(rule.cssText)) {
          sheet.deleteRule(i);
          count++;
        }
      }
    }
    return count;
  });
  assert.equal(removed, 3, "remove only the new dashboard overrides from baseline captures");
  const before = {};
  for (const theme of ["light", "dark"]) {
    const desktop = await mode(1440, 1000, theme);
    before[`desktop-${theme}`] = desktop;
    assert.deepEqual(desktop, after[`desktop-${theme}`], `desktop geometry, chart, notches and colors unchanged: ${theme}`);
    await capture(`before-desktop-${theme}`);
    for (const [width, height] of [[390, 844], [320, 680]]) {
      const m = await mode(width, height, theme);
      before[`${width}-${theme}`] = m;
      assert.ok(m.ticket.top >= after[`${width}-${theme}`].ticket.top + 45, "mobile ticket progress must be materially visible earlier");
      await capture(`before-${width}-${theme}`);
    }
  }
  assert.deepEqual(blocked, []);
  console.log(JSON.stringify({
    engine, paidOrders: data.summary.paidOrders, gross: money.format(data.summary.grossRevenue),
    visual: Object.fromEntries(Object.keys(after).map((key) => [key, {
      before: Math.round(before[key].ticket.top), after: Math.round(after[key].ticket.top),
      ticketBottom: Math.round(after[key].ticket.bottom), navTop: after[key].navTop, chart: after[key].chart.height,
      visibleBars: after[key].positiveBars,
    }])),
    sameDesktop: true, tintAndNotches: true, keyboard: true, realPeriodSwitch: true, blocked,
  }));
} finally {
  await browser.close();
}
