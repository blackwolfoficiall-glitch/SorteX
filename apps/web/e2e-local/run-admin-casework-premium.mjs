import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect, webkit } from "@playwright/test";

const origin = new URL(process.env.PLAYWRIGHT_BASE_URL ?? "https://127.0.0.1:3432");
assert.equal(origin.hostname, "127.0.0.1", "Local synthetic QA only");
assert.ok(process.env.TEST_SEED_PASSWORD);
const out = process.env.SORTEX_CASEWORK_SCREENSHOTS;
if (out) await mkdir(out, { recursive: true });
const tasks = [
  { mode: "support", url: "/admin/suporte", title: "Suporte", item: "chamados", subject: "Chamado sintético edição visual", text: "Mensagem de QA sem dados reais", initial: "WAITING_USER", label: "Aguardando usuário", firstAction: "Iniciar atendimento", detailActions: ["Responder chamado", "Aguardar usuário", "Resolver", "Fechar"] },
  { mode: "reports", url: "/admin/denuncias", title: "Denúncias", item: "denúncias", subject: "Denúncia sintética edição visual", text: "Descrição de QA sem dados reais", initial: "UNDER_REVIEW", label: "Em análise", firstAction: "Resolver", detailActions: ["Resolver", "Descartar"] },
];

for (const [engine, type] of [["chromium", chromium], ["webkit", webkit]]) {
  if (process.env.SORTEX_TEST_ENGINE && process.env.SORTEX_TEST_ENGINE !== engine) continue;
  const browser = await type.launch(engine === "chromium" ? {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_BINARY || undefined,
    args: ["--disable-gpu", "--no-zygote", "--renderer-process-limit=1"],
  } : {});
  try {
    for (const role of ["support", "finance", "buyer", "guest"]) {
      const context = await browser.newContext({ baseURL: origin.origin, ignoreHTTPSErrors: true, viewport: { width: 1440, height: 960 }, reducedMotion: "reduce" });
      const attemptedWrites = [];
      try {
        await context.route("**/*", (route) => {
          const req = route.request();
          if (new URL(req.url()).origin === origin.origin && ["GET", "HEAD"].includes(req.method())) return route.continue();
          attemptedWrites.push(req.method());
          return route.abort();
        });
        if (role !== "guest") {
          const email = role === "buyer" ? "buyer1@sortex.example.invalid" : `${role}-visual@sortex.example.invalid`;
          const status = await context.request.post(`/api/auth/${role === "buyer" ? "login" : "admin-login"}`, { data: { email, password: process.env.TEST_SEED_PASSWORD } });
          assert.equal(status.status(), 200, role);
        }
        const page = await context.newPage();
        page.setDefaultTimeout(30_000);
        for (const task of tasks) {
          const endpoint = `/api/admin/platform/${task.mode}`;
          const direct = await context.request.get(endpoint);
          if (role !== "support") {
            assert.equal(direct.status(), role === "guest" ? 401 : 403, `${role}: ${task.mode}`);
            await page.goto(task.url);
            if (role === "guest") await expect(page).toHaveURL(/\/admin\/login/);
            else if (role === "finance") await expect(page.getByRole("heading", { name: "Acesso não autorizado" })).toBeVisible();
            else {
              await expect(page).toHaveURL(/\/comprador(?:\/|$)/);
              await expect(page.locator(".sx-admin-casework")).toHaveCount(0);
            }
            continue;
          }
          assert.equal(direct.status(), 200);
          const list = await direct.json();
          if (task.mode === "reports") {
            assert.equal((await context.request.get(`${endpoint}?status=INVALID`)).status(), 400);
            assert.equal((await context.request.get(`${endpoint}?status=OPEN&unexpected=unknown`)).status(), 400);
            if (process.env.SORTEX_LEGACY_REPORT_FILTER_400 !== "1") {
              for (const status of ["OPEN", "UNDER_REVIEW", "RESOLVED", "DISMISSED"]) {
                const response = await context.request.get(`${endpoint}?status=${status}&limit=20&page=1`);
                assert.equal(response.status(), 200);
                const body = await response.json();
                assert.ok(body.data.every((record) => record.status === status));
                assert.equal(body.pagination.page, 1);
              }
            }
          }
          assert.equal(list.data.filter(({ status }) => status === task.initial).length, 1);
          await page.goto(task.url);
          const view = page.locator(".sx-admin-casework");
          await expect(view.getByRole("heading", { name: task.title, exact: true })).toBeVisible();
          await expect(view.getByRole("status")).toHaveText(`${list.pagination.total} ${task.item} no cadastro`);
          const search = view.getByRole("searchbox", { name: `Pesquisar ${task.item}` });
          const selectedStatus = view.getByRole("combobox", { name: "Filtrar status" });
          const filterReply = page.waitForResponse((reply) => {
            const url = new URL(reply.url());
            return url.pathname === endpoint && url.searchParams.get("status") === task.initial;
          });
          await selectedStatus.selectOption(task.initial);
          const filterStatus = (await filterReply).status();
          if (task.mode === "reports" && process.env.SORTEX_LEGACY_REPORT_FILTER_400 === "1") {
            assert.equal(filterStatus, 400, "Known pre-existing reports status DTO block");
            await expect(view.getByRole("alert")).toBeVisible();
            await expect(view.getByText("Nenhum registro encontrado para os filtros informados.")).toBeHidden();
            await selectedStatus.selectOption("");
          } else {
            assert.equal(filterStatus, 200);
          }
          const row = view.getByRole("listitem").filter({ hasText: task.subject });
          await expect(row.getByText(task.label, { exact: true })).toBeVisible();
          await expect(row.getByRole("button", { name: task.firstAction, exact: true })).toBeVisible();
          if (task.mode === "support") await expect(row.getByRole("button", { name: "Responder", exact: true })).toBeVisible();
          const detailButton = row.getByRole("button", { name: "Detalhes", exact: true });
          for (const theme of ["light", "dark"]) {
            for (const [width, height] of [[1440, 960], [768, 1024], [320, 780]]) {
              await page.setViewportSize({ width, height });
              await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
              await expect(view).toHaveCSS("color-scheme", theme);
              assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
              const opening = page.waitForResponse((reply) => new URL(reply.url()).pathname.startsWith(`${endpoint}/`));
              await detailButton.click();
              assert.equal((await opening).status(), 200);
              const detail = page.getByRole("dialog", { name: task.subject });
              await expect(detail).toHaveCSS("color-scheme", theme);
              await expect(detail.getByText(task.text, { exact: true })).toBeVisible();
              assert.ok(await detail.evaluate((node) => node.scrollWidth <= node.clientWidth + 1));
              const close = detail.getByRole("button", { name: "Fechar detalhes" });
              await expect(close).toBeFocused();
              for (const label of task.detailActions) await expect(detail.getByRole("button", { name: label, exact: true })).toBeVisible();
              if (out && (width === 320 || width === 1440)) await page.screenshot({ path: resolve(out, `${engine}-${task.mode}-${width}-${theme}.png`), animations: "disabled" });
              await close.press("Escape");
              await expect(detail).toBeHidden();
              await expect(detailButton).toBeFocused();
            }
          }
          const empty = page.waitForResponse((reply) => new URL(reply.url()).searchParams.get("search") === "sxd-inexistente-vazio");
          await search.fill("sxd-inexistente-vazio");
          assert.equal((await empty).status(), 200);
          await expect(view.getByText("Nenhum registro encontrado para os filtros informados.")).toBeVisible();
          await page.route(`**${endpoint}?*`, (route) => route.fulfill({ status: 503, json: {} }), { times: 1 });
          await view.getByRole("button", { name: "Atualizar listagem" }).click();
          await expect(view.getByRole("alert")).toBeVisible();
          await expect(view.getByText("Nenhum registro encontrado para os filtros informados.")).toBeHidden();
          await view.getByRole("button", { name: "Tentar novamente" }).click();
          await expect(view.getByText("Nenhum registro encontrado para os filtros informados.")).toBeVisible();
        }
        assert.deepEqual(attemptedWrites, []);
        console.log(`${engine}: ${role} PASS, no browser writes/outbound requests`);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
}
