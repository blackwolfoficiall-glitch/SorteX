import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, webkit, expect } from "@playwright/test";

const origin = new URL(process.env.PLAYWRIGHT_BASE_URL || "");
assert.equal(origin.protocol, "http:");
assert.equal(
  origin.hostname,
  "127.0.0.1",
  "Somente ambiente local com banco descartável",
);
const password = process.env.TEST_SEED_PASSWORD;
assert.ok(password, "Senha da fixture descartável obrigatória");
const output = process.env.SORTEX_ADVISOR_SCREENSHOTS;
if (output) await mkdir(output, { recursive: true });
const useWebkit = process.env.SORTEX_ADVISOR_BROWSER === "webkit";
const browser = useWebkit
  ? await webkit.launch()
  : await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_BINARY || undefined,
      args: ["--disable-gpu", "--no-zygote", "--renderer-process-limit=1"],
    });
const engine = useWebkit ? "WebKit" : "Chromium";
const api = "/api/platform/ai-sortex/advisor";
const route = "/dashboard/ia";
const original = "Pergunta de teste desta visita: Como estão minhas vendas?";

async function context(options = {}) {
  const c = await browser.newContext({
    baseURL: origin.origin,
    viewport: { width: 1440, height: 1050 },
    colorScheme: "light",
    reducedMotion: "reduce",
    ...options,
  });
  await c.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin.origin
      ? route.continue()
      : route.abort(),
  );
  return c;
}
async function login(c, identity) {
  assert.equal(
    (
      await c.request.post("/api/auth/login", {
        data: { email: `${identity}@sortex.example.invalid`, password },
      })
    ).status(),
    200,
  );
}
async function capture(page, label) {
  if (!output) return;
  await page.evaluate(() => document.fonts.ready.then(() => scrollTo(0, 0)));
  await page.screenshot({
    path: resolve(output, `Advisor-${engine}-${label}.png`),
    animations: "disabled",
    style: "nextjs-portal { display: none !important }",
  });
}
async function activeTabContrast(page) {
  return page
    .getByRole("navigation", { name: "Seções do SorteX Advisor" })
    .locator("a[aria-current='page']")
    .evaluate((active) => {
      const { color, backgroundColor } = getComputedStyle(active);
      const luminance = (s) => {
        const rgb = s.match(/[0-9.]+/g).map((n) => Number(n) / 255);
        return rgb
          .slice(0, 3)
          .reduce(
            (total, c, i) =>
              total +
              (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4) *
                [0.2126, 0.7152, 0.0722][i],
            0,
          );
      };
      const a = luminance(color);
      const b = luminance(backgroundColor);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
}
const captureAdvisor = (p, path) =>
  Promise.all([
    p.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === api &&
        response.request().method() === "GET",
    ),
    p.goto(path),
  ]);

try {
  const owner = await context();
  await login(owner, "organizer1");
  const page = await owner.newPage();
  page.setDefaultTimeout(40_000);
  const [summary] = await captureAdvisor(page, route);
  assert.equal(summary.status(), 200);
  const ownerSummary = await summary.json();
  assert.equal(
    ownerSummary.aiPilotAvailable,
    false,
    "Provedor deve ficar desligado",
  );
  await expect(
    page.getByRole("heading", { name: `Olá, ${ownerSummary.organizerName}.` }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Indicadores da conta" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Resumo" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  assert.ok(
    (await activeTabContrast(page)) >= 4.5,
    "active tab contrast in light",
  );
  await capture(page, "desktop");

  await page.getByRole("link", { name: "Conversar" }).click();
  await expect(
    page.getByText(
      "Provedor de IA indisponível nesta conta. As respostas usam regras locais.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /IA externa/ })).toHaveCount(
    0,
  );
  const q = page.getByRole("textbox", { name: "Sua pergunta" });
  await expect(
    page.getByRole("button", { name: "Enviar pergunta" }),
  ).toBeDisabled();
  await q.fill(original);
  const [chat] = await Promise.all([
    page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === api + "/chat" &&
        response.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Enviar pergunta" }).click(),
  ]);
  assert.ok(chat.ok());
  assert.deepEqual(chat.request().postDataJSON(), {
    question: original,
    allowAi: false,
  });
  const answer = await chat.json();
  assert.equal(answer.mode, "DETERMINISTIC");
  const log = page.getByRole("log", { name: "Histórico desta conversa" });
  await expect(log.getByText(original)).toBeVisible();
  await expect(
    log.getByText("Resposta de regras locais, sem IA externa"),
  ).toBeVisible();
  await expect(log.getByText(answer.answer)).toBeVisible();
  await expect(
    log.getByText(
      /Resposta gerada pelo Google Gemini|Resposta gerada pela OpenAI/,
    ),
  ).toHaveCount(0);

  await page.getByRole("link", { name: "Simulações" }).click();
  const quantity = page.getByLabel("Quantidade");
  await quantity.fill("");
  await expect(quantity).toHaveValue("");
  await quantity.fill("10");
  await page.getByLabel("Preço alternativo (opcional)").fill("1,50");
  const [calc] = await Promise.all([
    page.waitForResponse(
      (response) => new URL(response.url()).pathname === api + "/simulate",
    ),
    page.getByRole("button", { name: "Calcular simulação" }).click(),
  ]);
  assert.ok(calc.ok());
  const quote = await calc.json();
  assert.equal(quote.grossRevenue, 15);
  await expect(page.getByText("Faturamento bruto")).toBeVisible();
  await expect(page.getByText(/Não é garantia de vendas/)).toBeVisible();
  await page.getByRole("link", { name: "Conversar" }).click();
  await expect(log.getByText(original)).toBeVisible();

  await page.getByRole("link", { name: "Rascunhos" }).click();
  await expect(
    page.getByText(
      "Rascunho baseado em regras locais. Esta tela não envia mensagens.",
    ),
  ).toBeVisible();
  await page
    .getByLabel("Objetivo da mensagem")
    .selectOption({ label: "Reserva abandonada" });
  const [draft] = await Promise.all([
    page.waitForResponse(
      (response) => new URL(response.url()).pathname === api + "/message",
    ),
    page.getByRole("button", { name: "Gerar mensagem" }).click(),
  ]);
  assert.ok(draft.ok());
  const draftText = page.getByLabel("Rascunho da mensagem");
  await expect(draftText).not.toHaveValue("");
  await draftText.fill("Rascunho fictício editado. Não enviar.");
  await expect(draftText).toHaveValue("Rascunho fictício editado. Não enviar.");
  await expect(
    page.getByRole("link", { name: "Abrir Comunicação" }),
  ).toHaveAttribute("href", /^\/dashboard\/comunicacao\?tab=new/);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.getByRole("link", { name: "Conversar" }).click();
  await expect(log.getByText(original)).toBeVisible();
  assert.equal(
    await page
      .getByRole("heading", { name: "Converse com seu consultor" })
      .evaluate((element) => getComputedStyle(element).colorScheme),
    "dark",
  );
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth),
    390,
  );
  assert.ok(
    (await activeTabContrast(page)) >= 4.5,
    "active tab contrast in dark",
  );
  await capture(page, "mobile-dark");
  await page.setViewportSize({ width: 320, height: 760 });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth),
    320,
  );

  // One intentionally aborted request exercises local error/recovery UI; the
  // next request still goes through real Next BFF, Nest and PostgreSQL.
  await page.route(`**${api}/chat`, (route) => route.abort(), { times: 1 });
  const quick = page.getByRole("button", {
    name: "Quantas reservas abandonadas existem?",
  });
  await quick.click();
  await expect(page.getByText("Não foi possível responder.")).toBeVisible();
  await page.getByRole("button", { name: "Editar a pergunta" }).click();
  await expect(q).toHaveValue("Quantas reservas abandonadas existem?");
  const [recovered] = await Promise.all([
    page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === api + "/chat" &&
        response.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Enviar pergunta" }).click(),
  ]);
  assert.ok(recovered.ok());
  assert.equal((await recovered.json()).mode, "DETERMINISTIC");
  await expect(page.getByText("Não foi possível responder.")).toBeHidden();

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Pergunte sobre a sua operação" }),
  ).toBeVisible();
  await expect(page.getByText(original)).toHaveCount(0);
  await owner.close();

  const second = await context();
  await login(second, "organizer2");
  const p2 = await second.newPage();
  p2.setDefaultTimeout(40_000);
  const [secondResponse] = await captureAdvisor(p2, route + "?tab=chat");
  const secondSummary = await secondResponse.json();
  assert.equal(secondResponse.status(), 200);
  assert.notDeepEqual(
    secondSummary.campaigns.map((row) => row.id),
    ownerSummary.campaigns.map((row) => row.id),
  );
  assert.equal(
    secondSummary.campaigns.some((row) =>
      ownerSummary.campaigns.some((first) => first.id === row.id),
    ),
    false,
  );
  await expect(
    p2.getByRole("heading", { name: "Pergunte sobre a sua operação" }),
  ).toBeVisible();
  await expect(p2.getByText(original)).toHaveCount(0);
  await second.close();

  const guest = await context();
  assert.equal((await guest.request.get(api)).status(), 401);
  const p3 = await guest.newPage();
  p3.setDefaultTimeout(40_000);
  await p3.goto(route + "?tab=chat");
  await expect(p3).toHaveURL(/\/login(?:\?|$)/, { timeout: 40_000 });
  await expect(
    p3.getByRole("heading", { name: "Converse com seu consultor" }),
  ).toHaveCount(0);
  await guest.close();

  const buyer = await context();
  await login(buyer, "buyer1");
  assert.equal((await buyer.request.get(api)).status(), 403);
  const p4 = await buyer.newPage();
  p4.setDefaultTimeout(40_000);
  await p4.goto(route + "?tab=chat");
  await expect(p4).toHaveURL(/\/comprador(?:\?|$)/, { timeout: 40_000 });
  await buyer.close();

  console.log(
    JSON.stringify({
      engine,
      advisor: "ok",
      provider: "disabled",
      tenantBoundary: "verified",
      responsive390and320: "ok",
      chatHistory: "visit only",
    }),
  );
} finally {
  await browser.close();
}
