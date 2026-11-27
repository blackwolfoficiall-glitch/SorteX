import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { webkit } from "@playwright/test";

// Test the real built Next app against a small loopback upstream contract
// fixture. This does not exercise Postgres (the API e2e separately does).
const hostname = "127.0.0.1";
const cwd = fileURLToPath(new URL("../", import.meta.url));
const organizer = "sortex-owner-test";
const buyer = "sortex-buyer-test";
const calls = [];
let next, upstream, upstreamMode, web;
let output = "";
const dates = "start=2026-01-15&end=2026-01-16";
const snapshot = {
  generatedAt: new Date().toISOString(),
  summary: {
    grossRevenue: 435,
    revenueToday: 0,
    revenueMonth: 435,
    activeCampaigns: 0,
    soldTickets: 192,
    participants: 20,
    averageTicket: 30,
  },
  campaigns: [],
  revenueHistory: [],
};

async function listen(server) {
  server.listen(0, hostname);
  await once(server, "listening");
  return server.address().port;
}
function json(response, status, body, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    ...headers,
  });
  response.end(JSON.stringify(body));
}

before(async () => {
  upstream = createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    const token = request.headers.authorization;
    const organizerToken = `Bearer ${organizer}`;
    if (url.pathname === "/dashboard/period") {
      if (token === `Bearer ${buyer}`)
        return json(response, 403, { message: "Sem permissão." });
      assert.equal(token, organizerToken);
      calls.push(url.search.slice(1));
      if (upstreamMode === "legacy")
        return json(response, 404, { message: "Endpoint antigo." });
      if (upstreamMode === "error")
        return json(
          response,
          503,
          { message: "Sem resposta temporariamente." },
          { "Retry-After": "10" },
        );
      const [start, end] = [
        url.searchParams.get("start"),
        url.searchParams.get("end"),
      ];
      return json(response, 200, {
        version: 1,
        period: { start, end, timeZone: "America/Sao_Paulo" },
        summary: {
          grossRevenue: 100.03,
          soldTickets: 10,
          participants: 2,
          paidOrders: 4,
          averageTicket: 25.01,
        },
        revenueHistory: [{ date: start, revenue: 100.03 }],
      });
    }
    if (token !== organizerToken)
      return json(response, 401, { message: "Não autenticado." });
    const fixtures = {
      "/auth/me": {
        id: "organizer-fixture",
        role: "ORGANIZER",
        name: "Organizador fictício",
      },
      "/organizer/profile": { verificationStatus: "VERIFIED" },
      "/plans/current": { profile: { onboardingStatus: "ACTIVE" } },
      "/personalization": { brand: {} },
      "/campaigns/my": [],
      "/dashboard": snapshot,
      "/crm/dashboard": {},
      "/legal/pending": [],
    };
    const fixture = fixtures[url.pathname];
    return fixture
      ? json(response, 200, fixture)
      : json(response, 404, { message: "Não encontrado." });
  });
  const api = `http://${hostname}:${await listen(upstream)}`;
  const portServer = createServer();
  const port = await listen(portServer);
  await new Promise((resolve) => portServer.close(resolve));
  web = `http://${hostname}:${port}`;
  next = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      hostname,
      "--port",
      String(port),
    ],
    {
      cwd,
      env: {
        ...process.env,
        NODE_ENV: "production",
        NEXT_TELEMETRY_DISABLED: "1",
        API_INTERNAL_URL: api,
        API_URL: api,
        PLAYWRIGHT_API_URL: api,
        SORTEX_HOMOLOGATION_API_URL: api,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  for (const stream of [next.stdout, next.stderr])
    stream.on("data", (data) => {
      output = (output + data.toString()).slice(-4000);
    });
  for (let tryCount = 0; tryCount < 70 && next.exitCode === null; tryCount++) {
    if (
      await fetch(web + "/api/dashboard/period?" + dates)
        .then((r) => r.status === 401)
        .catch(() => false)
    )
      return;
    await delay(100);
  }
  throw new Error(`Execute o build de Next antes deste teste.\n${output}`);
});
after(async () => {
  if (next && next.exitCode === null && next.signalCode === null) {
    next.kill();
    await once(next, "exit");
  }
  if (upstream?.listening)
    await new Promise((resolve) => upstream.close(resolve));
});

test("BFF autentica, impede filtro por outro organizador e nunca armazena em cache", async () => {
  const path = web + "/api/dashboard/period?" + dates;
  for (const [url, token, status] of [
    [path, "", 401],
    [path, buyer, 403],
    [path + "&start=2026-01-14", organizer, 400],
    [path + "&organizerId=outro", organizer, 400],
    [path, organizer, 200],
  ]) {
    const response = await fetch(url, {
      headers: token ? { Cookie: `sortex_access_token=${token}` } : {},
    });
    assert.equal(response.status, status);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    const result = await response.json();
    if (status === 200) {
      assert.equal(result.summary.grossRevenue, 100.03);
      assert.equal(result.period.timeZone, "America/Sao_Paulo");
    }
  }
  assert.deepEqual(calls, [dates]);
});

test("BFF preserva o 404 para versão anterior e não confunde falha temporária", async () => {
  const path = web + "/api/dashboard/period?" + dates;
  const request = () =>
    fetch(path, { headers: { Cookie: `sortex_access_token=${organizer}` } });
  upstreamMode = "legacy";
  const legacy = await request();
  assert.equal(legacy.status, 404);
  assert.equal(legacy.headers.get("cache-control"), "private, no-store");
  await legacy.body.cancel();
  upstreamMode = "error";
  const error = await request();
  assert.equal(error.status, 503);
  assert.equal(error.headers.get("cache-control"), "private, no-store");
  assert.equal(error.headers.get("Retry-After"), "10");
  await error.body.cancel();
  upstreamMode = undefined;
});

test(
  "WebKit rendering: interval totals, custom query and labeled legacy fallback",
  {
    skip: process.env.SORTEX_DASHBOARD_TEST_WEBKIT !== "1",
    timeout: 30_000,
  },
  async () => {
    const browser = await webkit.launch();
    try {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
      });
      await context.addCookies([
        { name: "sortex_access_token", value: organizer, url: web },
      ]);
      const page = await context.newPage();
      await page.goto(web + "/dashboard");
      await page
        .getByText("Vendas confirmadas por período (horário de Brasília).")
        .waitFor();
      await page.getByText("R$ 100,03", { exact: true }).waitFor();
      await page.getByRole("button", { name: "Personalizado" }).click();
      await page.getByLabel("Início").fill("2026-01-15");
      await page.getByLabel("Fim").fill("2026-01-16");
      await page.getByRole("button", { name: "Aplicar" }).click();
      await page.getByText("15/01/2026 a 16/01/2026 · Brasília").waitFor();
      assert.equal(calls.at(-1), dates);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        true,
      );
      upstreamMode = "legacy";
      await page.getByRole("button", { name: "7 dias" }).click();
      await page
        .getByText("Histórico de vendas confirmadas (UTC) da versão anterior.")
        .waitFor();
      assert.equal(await page.getByText("192", { exact: true }).count(), 2);
      await page
        .getByText("Os indicadores abaixo são do histórico total", {
          exact: false,
        })
        .waitFor();
    } finally {
      upstreamMode = undefined;
      await browser.close();
    }
  },
);
