import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, webkit, expect } from "@playwright/test";

const origin = new URL(process.env.PLAYWRIGHT_BASE_URL || "");
assert.equal(origin.protocol, "http:");
assert.equal(origin.hostname, "127.0.0.1", "Disposable loopback only");
const password = process.env.TEST_SEED_PASSWORD;
assert.ok(password);
const output = process.env.SORTEX_CRM_SCREENSHOTS;
if (output) await mkdir(output, { recursive: true });
const isWebKit = process.env.SORTEX_CRM_BROWSER === "webkit";
const browser = isWebKit
  ? await webkit.launch()
  : await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_BINARY || undefined,
      args: ["--disable-gpu", "--no-zygote", "--renderer-process-limit=1"],
    });
const engine = isWebKit ? "WebKit" : "Chromium";
const contactsPage = "/dashboard/crm/contatos";
const contactsApi = "/api/crm/contacts";
const segmentsApi = "/api/crm/segments";
const tagName = `Etiqueta Teste ${engine}`;
const segmentName = `Segmento Teste ${engine}`;
const note = `Nota exclusivamente fictícia ${engine}`;

async function context(colorScheme = "light") {
  const c = await browser.newContext({
    baseURL: origin.origin,
    viewport: { width: 1440, height: 950 },
    colorScheme,
    reducedMotion: "reduce",
  });
  await c.route("**/*", (route) => {
    const req = route.request(),
      url = new URL(req.url());
    const isSending =
      req.method() !== "GET" &&
      /(?:execute|communications|sends)/i.test(url.pathname);
    return url.origin !== origin.origin || isSending
      ? route.abort()
      : route.continue();
  });
  return c;
}
async function auth(c, account) {
  assert.equal(
    (
      await c.request.post("/api/auth/login", {
        data: { email: `${account}@sortex.example.invalid`, password },
      })
    ).status(),
    200,
  );
}
async function capture(page, suffix) {
  if (!output) return;
  await page.evaluate(() => document.fonts.ready.then(() => scrollTo(0, 0)));
  await page.screenshot({
    path: resolve(output, `CRM-${engine}-${suffix}.png`),
    animations: "disabled",
    style: "nextjs-portal { display: none !important }",
  });
}
async function width(page, pixels, theme) {
  await page.setViewportSize({ width: pixels, height: 900 });
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(pixels);
  assert.equal(
    await page
      .locator(".sx-premium")
      .last()
      .evaluate((el) => getComputedStyle(el).colorScheme),
    theme,
  );
}
const wait = (page, method, path) =>
  page.waitForResponse(
    (res) =>
      res.request().method() === method && new URL(res.url()).pathname === path,
  );
async function click(page, action, method, path) {
  const [response] = await Promise.all([
    wait(page, method, path),
    action.click(),
  ]);
  assert.ok(response.ok(), `${method} ${path} returned ${response.status()}`);
  return response;
}

try {
  const owner = await context();
  await auth(owner, "organizer1");
  const result = await owner.request.get(contactsApi);
  assert.equal(result.status(), 200);
  const initial = (await result.json()).items.find((item) =>
    item.name.includes("Comprador Teste"),
  );
  assert.ok(initial?.id, "Use exclusively the synthetic local seed");
  const communicationsBefore = await owner.request.get(
    "/api/engagement/communications",
  );
  assert.equal(communicationsBefore.status(), 200);
  const initialCommunications = await communicationsBefore.json();
  const contactPath = `${contactsApi}/${initial.id}`;
  const profile = `${contactsPage}/${initial.id}`;
  const p = await owner.newPage();
  p.setDefaultTimeout(40_000);
  let release;
  const delayed = new Promise((resolve) => {
    release = resolve;
  });
  const delayedMatcher = (url) => url.pathname === contactsApi;
  const delayHandler = async (route) => {
    await delayed;
    await route.continue();
  };
  await p.route(delayedMatcher, delayHandler);
  await p.goto(contactsPage + "?search=" + encodeURIComponent(initial.name));
  await expect(
    p.getByRole("heading", { name: "Contatos", exact: true }),
  ).toBeVisible();
  await expect(p.getByText("Carregando contatos…")).toBeVisible();
  release();
  await expect(p.getByRole("table")).toBeVisible();
  await expect(p.getByLabel("Buscar contato")).toHaveValue(initial.name);
  const contactLink = () =>
    p
      .getByRole("link", { name: initial.name, exact: true })
      .filter({ visible: true });
  await expect(contactLink()).toHaveAttribute("href", profile);
  await capture(p, "contatos-desktop");
  await width(p, 768, "light");
  await expect(p.getByRole("table")).toBeHidden();
  await expect(contactLink()).toBeVisible();
  await p
    .getByRole("checkbox", { name: `Selecionar ${initial.name}` })
    .filter({ visible: true })
    .check();
  await expect(p.getByRole("heading", { name: /1 comprador/ })).toBeVisible();
  await p.getByRole("button", { name: "Remover seleção" }).click();
  await expect(p.getByRole("heading", { name: /1 comprador/ })).toHaveCount(0);

  await p.route(`**${contactsApi}?*`, (route) => route.abort(), { times: 1 });
  await p.getByLabel("Buscar contato").fill("Busca fictícia inexistente");
  await expect(
    p.getByText("Não foi possível carregar os contatos."),
  ).toBeVisible();
  await click(
    p,
    p.getByRole("button", { name: "Tentar novamente" }),
    "GET",
    contactsApi,
  );
  await expect(p.getByText("Nenhum contato encontrado.")).toBeVisible();
  await p.getByLabel("Buscar contato").fill(initial.name);
  await expect(contactLink()).toBeVisible();
  await Promise.all([wait(p, "GET", contactPath), contactLink().click()]);
  await expect(p.getByRole("heading", { name: initial.name })).toBeVisible();
  await expect(
    p.getByRole("heading", { name: "Compras, reservas e títulos" }),
  ).toBeVisible();
  await expect(
    p.getByRole("link", { name: "Abrir comunicação" }),
  ).toHaveAttribute("href", /\/dashboard\/comunicacao\?tab=new&contactId=/);
  await width(p, 390, "dark");
  await capture(p, "perfil-iphone-dark");
  await p.getByLabel("Nota interna").fill(note);
  await click(
    p,
    p.getByRole("button", { name: "Adicionar nota" }),
    "POST",
    contactPath + "/notes",
  );
  await expect(p.getByText(note, { exact: true })).toBeVisible();
  const taskTitle = `Tarefa exclusivamente fictícia ${engine}`;
  await p.getByLabel("Título da tarefa").fill(taskTitle);
  await click(
    p,
    p.getByRole("button", { name: "Criar tarefa" }),
    "POST",
    "/api/crm/tasks",
  );
  await expect(p.getByText("Tarefa criada.")).toBeVisible();
  const tasksResponse = await owner.request.get("/api/crm/tasks");
  assert.equal(tasksResponse.status(), 200);
  assert.ok(
    (await tasksResponse.json()).some(
      (task) => task.title === taskTitle && task.contactId === initial.id,
    ),
  );
  await click(
    p,
    p.getByRole("button", { name: "Marcar como VIP" }),
    "PATCH",
    contactPath + "/status",
  );
  await expect(p.getByText("Status VIP atualizado.")).toBeVisible();
  assert.equal(
    (await (await owner.request.get(contactPath)).json()).status,
    "VIP",
  );
  assert.ok(
    (
      await owner.request.patch(contactPath + "/status", {
        data: { status: initial.status },
      })
    ).ok(),
  );

  await p.getByRole("link", { name: "Segmentos", exact: true }).click();
  await expect(
    p.getByRole("heading", { name: "Segmentos", exact: true }),
  ).toBeVisible();

  await p.getByRole("button", { name: "Nova etiqueta", exact: true }).click();
  const tagModal = p.getByRole("dialog", { name: "Nova etiqueta" });
  await expect(tagModal).toBeVisible();
  await tagModal.getByLabel("Nome").fill(tagName);
  const tagResponse = await click(
    p,
    tagModal.getByRole("button", { name: "Criar etiqueta" }),
    "POST",
    "/api/crm/tags",
  );
  const tag = await tagResponse.json();
  await expect(p.getByText(tagName, { exact: true })).toBeVisible();
  await p.getByRole("button", { name: "Novo segmento", exact: true }).click();
  const wizard = p.getByRole("dialog", { name: "Novo segmento" });
  await wizard.getByLabel("Nome").fill(segmentName);
  await wizard.getByRole("button", { name: "Continuar" }).click();
  await wizard.getByLabel("Status").selectOption("CUSTOMER");
  await click(
    p,
    wizard.getByRole("button", { name: "Calcular prévia" }),
    "POST",
    segmentsApi + "/preview",
  );
  await expect(wizard.getByText("Prévia calculada no banco")).toBeVisible();
  await capture(p, "segmentos-iphone-dark");
  await wizard.getByRole("button", { name: "Continuar" }).click();
  const created = await click(
    p,
    wizard.getByRole("button", { name: "Criar segmento" }),
    "POST",
    segmentsApi,
  );
  const segment = await created.json();
  await expect(p.getByText(segmentName, { exact: true })).toBeVisible();
  await expect(
    p
      .getByRole("link", { name: "Preparar comunicação" })
      .filter({ visible: true })
      .last(),
  ).toHaveAttribute("href", /\?tab=new&segmentId=/);
  await width(p, 1024, "dark");
  await click(
    p,
    p.getByRole("button", { name: `Recalcular segmento ${segmentName}` }),
    "POST",
    `${segmentsApi}/${segment.id}/calculate`,
  );
  await expect(p.getByText("Segmento recalculado.")).toBeVisible();

  await p.goto(profile);
  await expect(p.getByRole("heading", { name: initial.name })).toBeVisible();
  await p.getByLabel("Etiqueta para adicionar").selectOption(tag.id);
  await click(
    p,
    p.getByRole("button", { name: "Aplicar etiqueta" }),
    "POST",
    `${contactPath}/tags/${tag.id}`,
  );
  await expect(
    p.getByRole("button", { name: `Remover etiqueta ${tagName}` }),
  ).toBeVisible();
  await click(
    p,
    p.getByRole("button", { name: `Remover etiqueta ${tagName}` }),
    "DELETE",
    `${contactPath}/tags/${tag.id}`,
  );
  await expect(
    p.getByRole("button", { name: `Remover etiqueta ${tagName}` }),
  ).toHaveCount(0);
  const communicationsAfter = await owner.request.get(
    "/api/engagement/communications",
  );
  assert.equal(communicationsAfter.status(), 200);
  assert.deepEqual(await communicationsAfter.json(), initialCommunications);

  const other = await context("dark");
  await auth(other, "organizer2");
  const crossStatus = (await other.request.get(contactPath)).status();
  assert.ok([403, 404].includes(crossStatus));
  const otherContacts = await (await other.request.get(contactsApi)).json();
  const otherSegments = await (await other.request.get(segmentsApi)).json();
  assert.equal(
    otherContacts.items.some((item) => item.id === initial.id),
    false,
  );
  assert.equal(
    otherSegments.some((item) => item.id === segment.id),
    false,
  );
  const foreign = await other.newPage();
  foreign.setDefaultTimeout(40_000);
  await foreign.goto(profile);
  await expect(
    foreign.getByText("Contato indisponível para esta conta."),
  ).toBeVisible();
  await expect(foreign.getByText(note, { exact: true })).toHaveCount(0);
  await expect(
    foreign.getByRole("link", { name: "Voltar aos contatos" }),
  ).toBeVisible();
  await other.close();

  const buyer = await context();
  await auth(buyer, "buyer1");
  assert.equal((await buyer.request.get(contactsApi)).status(), 403);
  await buyer.close();
  const guest = await context();
  assert.equal((await guest.request.get(contactsApi)).status(), 401);
  const signedOut = await guest.newPage();
  await signedOut.goto(contactsPage);
  await expect(signedOut).toHaveURL(/\/login(?:\?|$)/, { timeout: 40_000 });
  await guest.close();
  await owner.close();
  console.log(
    JSON.stringify({
      engine,
      list: "ok",
      profile: "ok",
      segments: "ok",
      realMutations: "local only",
      notifications: "outbound blocked",
      authAndTenant: "verified",
      widths: [390, 768, 1024, 1440],
    }),
  );
} finally {
  await browser.close();
}
