import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect, webkit } from "@playwright/test";
import {
  legacyUtcRange,
  parseDashboardPeriod,
  parseRevenueHistory,
  salesChart,
} from "../lib/api/dashboard-period.ts";

const origin = new URL(process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000");
assert.equal(origin.hostname, "127.0.0.1", "Local synthetic QA only");
assert.ok(["http:", "https:"].includes(origin.protocol));
assert.ok(process.env.TEST_SEED_PASSWORD);
const legacy = process.env.SORTEX_DASHBOARD_LEGACY === "1";
const out = process.env.SORTEX_TICKET_SCREENSHOTS;
if (out) await mkdir(out, { recursive: true });
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const isPeriod = (reply) => new URL(reply.url()).pathname === "/api/dashboard/period";

for (const [name, type] of [["chromium", chromium], ["webkit", webkit]]) {
  if (process.env.SORTEX_TICKET_BROWSER && process.env.SORTEX_TICKET_BROWSER !== name) continue;
  const browser = await type.launch(name === "chromium" ? {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_BINARY || undefined,
    args: ["--disable-gpu", "--no-zygote", "--renderer-process-limit=1"],
  } : {});
  const context = await browser.newContext({
    baseURL: origin.origin,
    viewport: { width: 1440, height: 1000 },
    ignoreHTTPSErrors: origin.protocol === "https:",
    reducedMotion: "reduce",
    colorScheme: "light",
    deviceScaleFactor: 2,
  });
  const traffic = [];
  try {
    await context.route("**/*", (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === origin.origin && ["GET", "HEAD"].includes(request.method())) return route.continue();
      traffic.push(url.pathname);
      return route.abort();
    });
    const guest = await context.request.get("/dashboard", { maxRedirects: 0 });
    assert.equal(guest.status(), 307);
    assert.match(guest.headers().location, /\/login\?next=%2Fdashboard$/);
    const login = await context.request.post("/api/auth/login", {
      data: {
        email: "organizer1@sortex.example.invalid",
        password: process.env.TEST_SEED_PASSWORD,
      },
    });
    assert.equal(login.status(), 200);
    const snapshotResponse = await context.request.get("/api/dashboard");
    assert.equal(snapshotResponse.status(), 200);
    const snapshot = await snapshotResponse.json();
    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    const [reply] = await Promise.all([page.waitForResponse(isPeriod), page.goto("/dashboard")]);
    assert.equal(reply.status(), legacy ? 404 : 200);
    const query = new URL(reply.url()).searchParams;
    const data = legacy ? null : parseDashboardPeriod(await reply.json(), {
      start: query.get("start"),
      end: query.get("end"),
    });
    const interval = data?.period ?? legacyUtcRange(snapshot.generatedAt, "month", null);
    assert.ok(interval);
    const series = salesChart(data?.revenueHistory ?? parseRevenueHistory(snapshot.revenueHistory), interval);
    const gross = data?.summary.grossRevenue ?? series.reduce((sum, row) => sum + Math.round(row.revenue * 100), 0) / 100;
    assert.ok(gross > 0, "Seed confirmed sales before smoke");
    const sales = page.getByRole("region", { name: "Desempenho de vendas" });
    const chart = sales.getByRole("figure", { name: "Evolução das vendas confirmadas" });
    const nav = page.getByRole("navigation", { name: "Navegação rápida do organizador" });
    const filters = sales.getByRole("group", { name: "Período de vendas" });
    await expect(sales.getByText(money.format(gross), { exact: true }).first()).toBeVisible();
    await expect(sales.getByText(legacy ? /Intervalo:.*UTC/ : /Intervalo:.*Brasília/)).toBeVisible();
    assert.deepEqual(await filters.getByRole("button").allTextContents(), ["Hoje", "7 dias", "30 dias", "12 meses", "Personalizado"]);
    const exact = [[
      "Títulos vendidos",
      (data?.summary.soldTickets ?? snapshot.summary.soldTickets).toLocaleString("pt-BR"),
    ], ["Participantes", (data?.summary.participants ?? snapshot.summary.participants).toLocaleString("pt-BR")],
      ["Ticket médio", typeof (data?.summary.averageTicket ?? snapshot.summary.averageTicket) === "number"
        ? money.format(data?.summary.averageTicket ?? snapshot.summary.averageTicket) : "—"],
      ["Pedidos pagos", data?.summary.paidOrders.toLocaleString("pt-BR") ?? "—"],
    ];
    for (const [label, value] of exact)
      await expect(sales.locator("dl > div").filter({ hasText: label }).locator("dd")).toHaveText(value);
    for (const theme of ["light", "dark"]) {
      for (const [width, height] of [[1440, 1000], [768, 1024], [390, 844], [320, 780]]) {
        const mobile = width < 1024;
        await page.setViewportSize({ width, height });
        await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
        await expect(mobile ? chart : sales.getByRole("img", { name: /^Receita no intervalo:/ })).toBeVisible();
        const header = expect(page.locator(".sxorg-mobile-header"));
        if (mobile) await header.toBeVisible();
        else await header.toBeHidden();
        if (mobile) {
          await expect(page.getByRole("button", { name: "Notificações do organizador indisponíveis" })).toBeDisabled();
          await expect(page.locator(".sxorg-mobile-header a[href='/perfil']")).toBeVisible();
          await expect(nav).toBeVisible();
          await expect(nav.getByRole("link", { name: "Início", exact: true })).toHaveAttribute("aria-current", "page");
          await expect(nav.getByRole("link", { name: "Campanhas", exact: true })).toHaveAttribute("href", "/dashboard/campanhas");
          await expect(nav.getByRole("link", { name: "Criar campanha", exact: true })).toHaveAttribute("href", "/dashboard/campanhas/nova");
          await expect(nav.getByRole("link", { name: "Copilot", exact: true })).toHaveAttribute("href", "/dashboard/ia");
          if (width === 390) {
            const more = nav.getByRole("button", { name: "Mais" });
            await more.click();
            const panel = page.getByRole("dialog", { name: "Mais opções do organizador" });
            await expect(panel.getByRole("link", { name: "Financeiro", exact: true })).toHaveAttribute("href", "/dashboard/financeiro");
            await panel.getByRole("button", { name: "Fechar menu" }).press("Escape");
            await expect(panel).toBeHidden();
            await expect(more).toBeFocused();
          }
          const keyboard = chart.locator("summary");
          await keyboard.focus();
          await page.keyboard.press("Enter");
          assert.deepEqual(await chart.locator("li strong").allTextContents(), series.map(({ revenue }) => money.format(revenue)));
          await page.keyboard.press("Enter");
          await expect(chart.locator("details")).not.toHaveAttribute("open", "");
          await keyboard.blur();
        } else {
          const rail = page.getByRole("complementary", { name: "Painel do organizador" });
          await expect(rail).toBeVisible();
          assert.equal(await rail.getByRole("navigation").getByRole("link").count(), 17);
          await expect(nav).toBeHidden();
        }
        await expect(page.getByRole("link", { name: "Abrir Copilot" })).toHaveAttribute("href", "/dashboard/ia");
        await expect(page.getByRole("link", { name: "Relatórios" })).toHaveAttribute("href", "/dashboard/financeiro");
        await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0); });
        const geometry = await page.evaluate(() => {
          const ribbon = document.querySelector(".sxorg-mobile-tabs");
          const chart = document.querySelector("figure[aria-label='Evolução das vendas confirmadas'] svg");
          const width = document.documentElement.scrollWidth;
          const top = Math.min(
            ribbon.getBoundingClientRect().top,
            ribbon.querySelector(".sxorg-tab-create .sxorg-tab-icon").getBoundingClientRect().top,
          );
          return { width, chartBottom: chart.getBoundingClientRect().bottom, nav: top };
        });
        assert.ok(geometry.width <= width, JSON.stringify({ name, theme, geometry, width }));
        if (mobile) assert.ok(geometry.chartBottom < geometry.nav, JSON.stringify({ name, theme, geometry, width }));
        if (out) await page.screenshot({ path: resolve(out, `${legacy ? "d13" : "current"}-${name}-${width}-${theme}.png`), animations: "disabled" });
        console.log(name, legacy ? "d13" : "current", width, theme, geometry);
      }
    }

    const [one] = await Promise.all([page.waitForResponse(isPeriod), filters.getByRole("button", { name: "Hoje", exact: true }).click()]);
    assert.equal(one.status(), legacy ? 404 : 200);
    await expect(chart.locator("path")).toHaveCount(1);
    await expect(chart.locator("polyline")).toHaveCount(0);
    await filters.getByRole("button", { name: "Personalizado" }).click();
    await sales.getByLabel("Início").fill("2000-01-01");
    await sales.getByLabel("Fim").fill("2000-01-01");
    const [empty] = await Promise.all([page.waitForResponse(isPeriod), sales.getByRole("button", { name: "Aplicar" }).click()]);
    assert.equal(empty.status(), legacy ? 404 : 200);
    if (legacy) {
      await expect(sales.getByText("Histórico de receita indisponível para esse intervalo.")).toBeVisible();
      await expect(chart).toHaveCount(0);
    } else {
      await expect(sales.getByText("Sem receita registrada nesse intervalo.")).toBeVisible();
      await expect(chart.locator("path")).toHaveCount(1);
      await expect(chart.locator("title")).toContainText(money.format(0));
    }
    assert.deepEqual(traffic, []);
  } finally {
    await browser.close();
  }
}
