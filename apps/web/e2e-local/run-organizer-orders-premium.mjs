import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const origin = new URL(process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000");
assert.equal(origin.protocol, "http:");
assert.equal(origin.hostname, "127.0.0.1", "Execute apenas em ambiente local descartável");
const password = process.env.TEST_SEED_PASSWORD;
assert.ok(password);
const output = process.env.SORTEX_ORDERS_SCREENSHOTS;
if (output) await mkdir(output, { recursive: true });
const campaign = "Campanha fictícia · Pedidos Premium";
const otherCampaign = "Campanha fictícia · Outro Organizador";
const api = "/api/organizer/orders";
const path = "/dashboard/pedidos";
const isOrders = (res) => new URL(res.url()).pathname === api;
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_BINARY || undefined,
  args: ["--disable-gpu", "--no-zygote", "--renderer-process-limit=1"],
});
const ctx = await browser.newContext({
  baseURL: origin.origin, colorScheme: "light", reducedMotion: "reduce",
  viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2,
  acceptDownloads: true,
});

try {
  await ctx.route("**/*", (route) => {
    const request = route.request();
    return new URL(request.url()).origin === origin.origin && ["GET", "HEAD"].includes(request.method())
      ? route.continue() : route.abort();
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(45_000);
  assert.equal((await ctx.request.get(api)).status(), 401);
  await p.goto(path);
  await expect(p).toHaveURL(/\/login\?next=%2Fdashboard%2Fpedidos$/);
  assert.equal((await ctx.request.post("/api/auth/login", { data: { email: "organizer1@sortex.example.invalid", password } })).status(), 200);
  for (const url of [
    path, "/api/auth/me", "/api/plans/me", "/api/organizer/profile",
    "/api/organizer/personalization", "/api/legal/pending", "/api/campaigns/my", api,
  ]) assert.equal((await ctx.request.get(url)).status(), 200, url);

  const [initial] = await Promise.all([p.waitForResponse(isOrders), p.goto(path)]);
  assert.equal(initial.status(), 200);
  const initialBody = await initial.json();
  assert.ok(initialBody.total > 25);
  const table = p.getByRole("table", { name: "Pedidos encontrados" });
  await expect(table).toBeVisible();
  await expect(table.getByRole("row")).toHaveCount(26);
  await expect(table.getByText(campaign, { exact: true }).first()).toBeVisible();
  assert.ok(initialBody.items.some((row) => row.campaign.title === campaign));
  await expect(table.getByText(otherCampaign, { exact: true })).toHaveCount(0);
  const capture = async (file) => {
    if (!output) return;
    await p.evaluate(() => document.fonts.ready.then(() => scrollTo(0, 0)));
    await p.screenshot({
      path: resolve(output, file), scale: "device", animations: "disabled",
      style: "nextjs-portal { display: none !important }",
    });
  };

  const ownerOrder = initialBody.items.find((row) => row.campaign.title === campaign && row.status === "PAID");
  assert.ok(ownerOrder);
  const pagination = p.getByRole("navigation", { name: "Paginação" });
  const [second] = await Promise.all([p.waitForResponse(isOrders), pagination.getByRole("button", { name: "Próxima" }).click()]);
  assert.equal((await second.json()).page, 2);
  await expect(pagination.getByText("Página 2 de 2")).toBeVisible();
  await pagination.getByRole("button", { name: "Anterior" }).click();
  await expect(table.getByText(campaign, { exact: true }).first()).toBeVisible();
  await capture("SorteX-Pedidos-Web-desktop.png");
  if (output) {
    await table.getByRole("row").nth(1).screenshot({
      path: resolve(output, "SorteX-Pedidos-Web-desktop-linha.png"), scale: "device", animations: "disabled",
      style: "nextjs-portal { display: none !important }",
    });
  }

  const orderRow = table.getByRole("row").filter({ hasText: `Pedido #${ownerOrder.id.slice(-8).toUpperCase()}` });
  const show = orderRow.getByRole("button", { name: "Abrir detalhes" });
  await show.focus();
  const [detail] = await Promise.all([
    p.waitForResponse((res) => new URL(res.url()).pathname === `${api}/${ownerOrder.id}`),
    p.keyboard.press("Enter"),
  ]);
  assert.equal(detail.status(), 200);
  const opened = await detail.json();
  assert.equal(opened.id, ownerOrder.id);
  assert.ok(opened.payments.every((pay) => !("pixCopyPaste" in pay) && !("pixQrCode" in pay)));
  const dialog = p.getByRole("dialog", { name: "Detalhes do pedido" });
  await expect(dialog.getByRole("heading", { name: "Linha do tempo" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Fechar detalhes" })).toBeFocused();
  await p.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(show).toBeFocused();

  const search = p.getByRole("searchbox", { name: "Busca" });
  const [searched] = await Promise.all([
    p.waitForResponse((res) => isOrders(res) && new URL(res.url()).searchParams.get("search") === "buyer1@sortex.example.invalid"),
    search.fill("buyer1@sortex.example.invalid"),
  ]);
  const matches = await searched.json();
  assert.ok(matches.total > 0);
  assert.ok(matches.items.every((row) => row.buyer.email === "buyer1@sortex.example.invalid"));
  const filters = p.getByRole("region", { name: "Filtros" });
  const campaignPicker = filters.getByRole("combobox", { name: "Campanha", exact: true });
  const campaignId = ownerOrder.campaign.id;
  await campaignPicker.selectOption(campaignId);
  const status = filters.getByRole("combobox", { name: "Status", exact: true });
  await status.selectOption("PAID");
  const method = filters.getByRole("combobox", { name: "Método de pagamento", exact: true });
  const [filtered] = await Promise.all([
    p.waitForResponse((res) => isOrders(res) && new URL(res.url()).searchParams.get("method") === "PIX"),
    method.selectOption("PIX"),
  ]);
  const filtersBody = await filtered.json();
  assert.ok(filtersBody.items.length > 0);
  assert.ok(filtersBody.items.every((row) => row.campaign.id === campaignId && row.status === "PAID" && row.payments[0]?.method === "PIX"));
  await expect(table.getByRole("row")).toHaveCount(filtersBody.items.length + 1);
  const sort = p.getByLabel("Ordenação");
  const [sorted] = await Promise.all([
    p.waitForResponse((res) => isOrders(res) && new URL(res.url()).searchParams.get("sort") === "value_desc"),
    sort.selectOption("value_desc"),
  ]);
  const sortedItems = (await sorted.json()).items;
  assert.ok(sortedItems.every((row, i) => !i || sortedItems[i - 1].total >= row.total));

  await p.getByRole("button", { name: "Exportar" }).click();
  await expect(p.getByText("Exportar a página atual")).toBeVisible();
  const [download] = await Promise.all([p.waitForEvent("download"), p.getByRole("button", { name: "CSV", exact: true }).click()]);
  assert.equal(download.suggestedFilename(), "pedidos-sortex.csv");
  const csv = await readFile(await download.path(), "utf8");
  assert.equal(csv.trim().split("\n").length, sortedItems.length + 1);
  assert.ok(csv.includes(sortedItems[0].id));
  assert.ok(!csv.includes(otherCampaign));
  await download.delete();

  await search.fill("nenhum-comprador-sintetico@sortex.example.invalid");
  await expect(p.getByRole("status").filter({ hasText: "Carregando pedidos…" })).toBeVisible();
  await expect(p.getByRole("button", { name: "Exportar" })).toBeDisabled();
  await expect(p.getByRole("heading", { name: "Nenhum pedido encontrado." })).toBeVisible();
  await p.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(table.getByRole("row")).toHaveCount(26);

  await p.route("**/api/organizer/orders?*", (route) => route.fulfill({ status: 503, json: { message: "Indisponibilidade forçada no teste." } }));
  await p.getByRole("button", { name: "Atualizar" }).click();
  await expect(p.getByRole("alert").filter({ hasText: "Indisponibilidade forçada no teste." })).toBeVisible();
  await expect(p.getByRole("button", { name: "Exportar" })).toBeDisabled();
  await p.unroute("**/api/organizer/orders?*");
  await p.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(table.getByRole("row")).toHaveCount(26);
  await p.setViewportSize({ width: 390, height: 844 });
  await p.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  const cards = p.getByRole("region", { name: "Lista de pedidos" });
  await expect(table).toHaveCount(0);
  await expect(cards.getByRole("article")).toHaveCount(25);
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), 390);
  assert.equal(await cards.evaluate((node) => getComputedStyle(node).colorScheme), "dark");
  assert.equal(await cards.getByRole("button", { name: "Abrir detalhes" }).first().evaluate((node) => getComputedStyle(node).transitionDuration), "0s");
  await capture("SorteX-Pedidos-Web-celular-filtros.png");
  if (output) {
    await cards.getByRole("article").first().screenshot({
      path: resolve(output, "SorteX-Pedidos-Web-celular-card.png"), scale: "device", animations: "disabled",
      style: "nextjs-portal { display: none !important }",
    });
  }

  const roleChecks = {};
  for (const [role, account] of [
    ["anotherOrganizer", "organizer2@sortex.example.invalid"],
    ["buyer", "buyer1@sortex.example.invalid"],
    ["admin", "admin@sortex.example.invalid"],
  ]) {
    const accountCtx = await browser.newContext({ baseURL: origin.origin });
    try {
      const endpoint = role === "admin" ? "/api/auth/admin-login" : "/api/auth/login";
      assert.equal((await accountCtx.request.post(endpoint, { data: { email: account, password } })).status(), 200);
      const list = await accountCtx.request.get(api);
      const access = await accountCtx.request.get(`${api}/${ownerOrder.id}`);
      if (role === "anotherOrganizer") {
        assert.equal(list.status(), 200);
        const body = await list.json();
        assert.ok(body.items.some((row) => row.campaign.title === otherCampaign));
        assert.ok(body.items.every((row) => row.campaign.title !== campaign));
        assert.equal(access.status(), 404);
      } else {
        assert.equal(list.status(), 403);
        assert.equal(access.status(), 403);
      }
      roleChecks[role] = [list.status(), access.status()];
    } finally {
      await accountCtx.close();
    }
  }
  console.log(JSON.stringify({
    route: path, desktopRows: 25, narrowCards: 25, total: initialBody.total, search: matches.total,
    filtered: filtersBody.total, csvRows: sortedItems.length, protected: roleChecks,
    loading: true, empty: true, errorRetry: true, keyboardDialog: true, reducedMotion: true,
  }));
} catch (error) {
  const description = error instanceof Error ? error.message : String(error);
  console.error(description.split("\n").filter((line) => !/cookie|authorization/i.test(line)).join("\n"));
  process.exitCode = 1;
} finally {
  await ctx.close();
  await browser.close();
}
