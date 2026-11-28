import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import { generate, httpExports, routePattern } from "./inventory-web.mjs";

const root = new URL("../../../", import.meta.url);
const read = (file) => fs.readFileSync(new URL(file, root), "utf8");
const filePath = (file) => file.split("/").map(encodeURIComponent).join("/");
const staticMatrix = "docs/homologacao-2026-11-25/INVENTARIO_WEB_PREMIUM_GERADO.md";

test("normaliza raiz, grupo, rota dinâmica e catch-alls, sem transformar pasta privada em rota", () => {
  assert.equal(routePattern("app/page.tsx"), "/");
  assert.equal(routePattern("app/(store)/o/[organizerId]/page.tsx"), "/o/[organizerId]");
  assert.equal(routePattern("app/(trade)/api/ref/[...path]/route.ts"), "/api/ref/[...path]");
  assert.equal(routePattern("app/(trade)/api/ref/[[...path]]/route.ts"), "/api/ref/[[...path]]");
  assert.equal(routePattern("app/_support/private/page.tsx"), null);
  assert.throws(() => routePattern("app/@modal/profile/page.tsx"), /explicitamente/);
  assert.throws(() => routePattern("app/cart/(..)login/page.tsx"), /explicitamente/);
});

test("distingue exports HTTP reais de nomes locais, types e comentários", () => {
  const src = ts.createSourceFile(
    "route.ts",
    "async function handle() {} const GET = handle; export const GETTING = 7; export async function POST() {};\n" +
      "export const PUT = handle; export { handle as GET }; export type { HEAD }; /* export const DELETE = handle */",
    ts.ScriptTarget.Latest,
    true,
  );
  assert.deepEqual(httpExports(src), ["GET", "POST", "PUT"]);
});

test("o inventário versionado é determinístico e cobre toda rota, layout e estado rastreado", () => {
  const actual = generate();
  assert.equal(actual, generate());
  assert.equal(actual, read(staticMatrix));

  const trackedApp = execFileSync("git", ["ls-files", "-z", "--", "apps/web/app"], { cwd: root, encoding: "utf8" })
    .split("\0").filter(Boolean);
  let countPages = 0;
  let countHandlers = 0;
  for (const file of trackedApp) {
    if (!/\/(?:page|route|layout|loading|not-found|error|global-error|forbidden|unauthorized|default|template|sitemap|robots)\.(?:[cm]?js|jsx|tsx?|mdx)$/.test(file)) continue;
    const rel = file.slice("apps/web/".length);
    if (routePattern(rel) === null) continue;
    assert.ok(actual.includes(`(../../${filePath(file)})`), `fonte não mapeada: ${file}`);
    if (/\/page\./.test(file)) countPages++;
    if (/\/route\./.test(file)) countHandlers++;
  }
  assert.ok(actual.includes(`**${countPages} páginas, ${countHandlers} handlers`));
  for (const target of actual.matchAll(/\]\(\.\.\/\.\.\/([^\s)]+)\)/g)) {
    assert.ok(fs.existsSync(new URL(decodeURIComponent(target[1]), root)), `link sem fonte: ${target[1]}`);
  }
});

test("aliases, limites de sessão e UI compartilhada ficam explícitos", () => {
  const matrix = read(staticMatrix);
  const row = (prefix) => matrix.split("\n").find((line) => line.startsWith(`| [${prefix}](`));
  assert.match(row("/escolha"), /re-exporta ..\/cadastro\/page/);
  assert.match(row("/criar"), /redireciona → \/dashboard\/campanhas\/nova/);
  for (const verified of ["/dashboard", "/dashboard/campanhas", "/dashboard/pedidos", "/dashboard/financeiro"]) {
    assert.match(row(verified), /verificado no recorte local \/ parcial \/ passou local/);
  }

  assert.match(row("/comprador/participar"), /redireciona → \/comprador\/sorteios\?filter=LIVE/);
  assert.match(row("/dashboard/crm/notificacoes"), /redireciona → \/dashboard\/crm/);
  assert.match(row("/admin/login"), /Exceção do proxy e layout/);
  assert.match(row("/admin/taxas"), /FINANCE_WRITE/);
  assert.match(row("/comprador/checkout/\\[id\\]"), /BUYER ou ADMIN/);
  assert.match(row("/comprador/checkout/\\[id\\]"), /verificado no recorte local \/ parcial \/ passou local/);
  assert.match(row("/dashboard/campanhas/\\[id\\]/publicada"), /ORGANIZER.*CampaignPublishedSuccess.*verificado no recorte local \/ parcial \/ passou local/);
  assert.match(row("/dashboard/crm/contatos"), /ORGANIZER.*verificado no recorte local \/ parcial \/ passou local/);
  assert.match(row("/dashboard/crm/tarefas"), /\? \/ \? \/ não rodado/);
  assert.match(row("/dashboard/campanhas/\\[id\\]/editar"), /ORGANIZER.*CampaignWizard/);
  assert.match(row("/api/platform/sortex-ads/confirmed-sales"), /GET.*authenticatedApiFetch.*não rodado/);
});
