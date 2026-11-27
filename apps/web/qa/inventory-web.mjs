import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { pageEvidence } from "./inventory-web-evidence.mjs";

const web = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const repo = path.resolve(web, "../..");
const output = "docs/homologacao-2026-11-25/INVENTARIO_WEB_PREMIUM_GERADO.md";
const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const extensions = [".tsx", ".ts", ".jsx", ".js"];
const accessSources = [
  "apps/web/proxy.ts",
  "apps/web/next.config.ts",
  "apps/web/app/admin/layout.tsx",
  "apps/web/app/comprador/layout.tsx",
  "apps/web/app/dashboard/layout.tsx",
  "apps/web/app/organizador/layout.tsx",
  "apps/web/components/auth/RoleGate.tsx",
  "apps/web/components/organizador/OrganizerApprovalGate.tsx",
  "apps/web/components/organizer-platform/OrganizerOnboardingGate.tsx",
  "apps/web/components/legal/LegalAcceptanceGate.tsx",
  "apps/web/lib/admin/authorization.ts",
  "apps/web/lib/auth/server.ts",
];
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const sorted = (items) => [...new Set(items)].sort(cmp);
const quoted = (value) => `\`${value.replaceAll("|", "&#124;")}\``;
const links = (file, name = path.basename(file)) =>
  `[${name.replaceAll("[", "\\[").replaceAll("]", "\\]")}](../../${file.split("/").map(encodeURIComponent).join("/")})`;
const listed = (items) => [...items].join(", ") || "—";

function walk(dir) {
  return fs.readdirSync(path.join(repo, dir), { withFileTypes: true }).sort((a, b) => cmp(a.name, b.name)).flatMap((item) => {
    const file = `${dir}/${item.name}`;
    if (item.isDirectory()) return walk(file);
    return item.isFile() ? [file] : [];
  });
}

export function routePattern(file) {
  const [, ...segments] = file.split("/");
  segments.pop();
  if (segments.some((segment) => segment.startsWith("_"))) return null;
  if (segments.some((segment) => segment.startsWith("@") || /^\(\.{1,3}\)/.test(segment))) {
    throw new Error(`Slot/rota interceptada deve ser mapeada explicitamente: ${file}`);
  }
  return "/" + segments.filter((segment) => !/^\([^)]+\)$/.test(segment)).join("/");
}

function exported(node) {
  return Boolean(node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
}
const isLiteral = (node) => node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node));

function parse(file, text) {
  const src = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  if (src.parseDiagnostics.length) throw new Error(`Erro de sintaxe em ${file}`);
  return src;
}

export function httpExports(src) {
  const names = [];
  for (const stmt of src.statements) {
    if (ts.isExportDeclaration(stmt) && !stmt.isTypeOnly && stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
      names.push(...stmt.exportClause.elements.filter((el) => !el.isTypeOnly).map((el) => el.name.text));
    } else if (ts.isFunctionDeclaration(stmt) && exported(stmt) && stmt.name && stmt.body) {
      names.push(stmt.name.text);
    } else if (ts.isVariableStatement(stmt) && exported(stmt)) {
      names.push(...stmt.declarationList.declarations.filter((decl) => ts.isIdentifier(decl.name)).map((decl) => decl.name.text));
    }
  }
  return methods.filter((name) => names.includes(name));
}

function code(file) {
  return parse(file, fs.readFileSync(path.join(repo, file), "utf8"));
}

function importedFiles(src, files) {
  const deps = [];
  for (const stmt of src.statements) {
    if (!(ts.isImportDeclaration(stmt) || ts.isExportDeclaration(stmt)) || !isLiteral(stmt.moduleSpecifier)) continue;
    if (stmt.isTypeOnly || stmt.importClause?.isTypeOnly) continue;
    if (stmt.importClause && !stmt.importClause.name && ts.isNamedImports(stmt.importClause.namedBindings ?? stmt) &&
        stmt.importClause.namedBindings.elements.length && stmt.importClause.namedBindings.elements.every((el) => el.isTypeOnly)) continue;
    const specifier = stmt.moduleSpecifier.text;
    const dest = specifier.startsWith("@/") ? `apps/web/${specifier.slice(2)}` :
      specifier.startsWith(".") ? path.posix.normalize(`${path.posix.dirname(src.fileName)}/${specifier}`) : null;
    if (!dest) continue;
    const opts = [dest, ...extensions.flatMap((ext) => [dest + ext, dest + "/index" + ext])];
    const dep = opts.find((key) => files.has(key));
    if (dep) deps.push(dep);
    else if ((dest.startsWith("apps/web/components/") || dest.startsWith("apps/web/app/")) && !dest.endsWith(".css")) {
      throw new Error(`Dependência de visual não resolvida: ${src.fileName} -> ${dest}`);
    }
  }
  return sorted(deps);
}

function surface(src) {
  const groups = { forms: [], tables: [], overlays: [], controls: [] };
  const visit = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(src);
      const attrs = node.attributes.properties;
      const role = attrs.find((attr) => ts.isJsxAttribute(attr) && attr.name.getText(src) === "role");
      const roleValue = role && isLiteral(role.initializer) ? role.initializer.text : "";
      if (/^(form|Form|[A-Z]\w*Form)$/.test(tag)) groups.forms.push(tag);
      if (/^(table|Table|[A-Z]\w*Table)$/.test(tag) || roleValue === "table" || roleValue === "grid") groups.tables.push(tag);
      if (/^(dialog|[A-Z]\w*(Dialog|Modal|Drawer|Sheet)|Dialog|Modal|Drawer|Sheet)$/.test(tag) || ["dialog", "alertdialog"].includes(roleValue)) groups.overlays.push(tag);
      if (/^(button|input|select|textarea|a|Button|Link|Input|Select|Textarea|Checkbox|RadioGroup|Switch|DropdownMenu)$/.test(tag)) groups.controls.push(tag);
    }
    ts.forEachChild(node, visit);
  };
  visit(src);
  return Object.fromEntries(Object.entries(groups).map(([key, value]) => [key, sorted(value)]));
}

function primaryRedirect(src) {
  const direct = [];
  for (const stmt of src.statements) {
    if (ts.isExportDeclaration(stmt) && isLiteral(stmt.moduleSpecifier) && stmt.exportClause && ts.isNamedExports(stmt.exportClause) &&
        stmt.exportClause.elements.some((el) => el.name.text === "default")) direct.push(`re-exporta ${stmt.moduleSpecifier.text}`);
    if (!ts.isFunctionDeclaration(stmt) || !exported(stmt)) continue;
    for (const child of stmt.body?.statements ?? []) {
      const call = ts.isExpressionStatement(child) ? child.expression : ts.isReturnStatement(child) ? child.expression : null;
      if (call && ts.isCallExpression(call) && ["redirect", "permanentRedirect"].includes(call.expression.getText(src)) &&
          isLiteral(call.arguments[0])) direct.push(`redireciona → ${call.arguments[0].text}`);
    }
  }
  return direct;
}

function handlerSignals(src) {
  const calls = new Set();
  const helpers = new Set(["authenticatedApiFetch", "apiFetch", "renewAuthSession", "setAuthCookies", "clearAuthCookies", "cookies", "fetch", "NextResponse.redirect"]);
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const fn = node.expression.getText(src);
      if (helpers.has(fn)) calls.add(fn);
    }
    ts.forEachChild(node, visit);
  };
  visit(src);
  return sorted(calls);
}

function resolveAdminPermissions() {
  const src = code("apps/web/lib/admin/authorization.ts");
  const decl = src.statements.flatMap((stmt) => ts.isVariableStatement(stmt) ? [...stmt.declarationList.declarations] : [])
    .find((candidate) => candidate.name.getText(src) === "ADMIN_ROUTE_PERMISSIONS");
  let array = decl?.initializer;
  if (array && (ts.isAsExpression(array) || ts.isSatisfiesExpression(array))) array = array.expression;
  if (!array || !ts.isArrayLiteralExpression(array)) throw new Error("Revisar ADMIN_ROUTE_PERMISSIONS antes de gerar inventário");
  return array.elements.map((item) => {
    if (!ts.isObjectLiteralExpression(item)) throw new Error("Regra administrativa não literal");
    const entry = Object.fromEntries(item.properties.map((p) => {
      if (!ts.isPropertyAssignment(p) || !isLiteral(p.initializer)) throw new Error("Regra administrativa não literal");
      return [p.name.getText(src), p.initializer.text];
    }));
    if (!entry.path) throw new Error("Regra administrativa sem rota");
    return entry;
  }).sort((a, b) => b.path.length - a.path.length);
}

function pageScope(route, admin) {
  if (route === "/admin/login" || route.startsWith("/admin/convite/")) return ["Equipe · entrada", "Exceção do proxy e layout; convite validado no fluxo"];
  if (/^\/admin(?:\/|$)/.test(route)) {
    const entry = admin.find((p) => route === p.path || route.startsWith(p.path + "/"));
    if (!entry && route !== "/admin") throw new Error(`Nova página admin sem regra de revisão explícita: ${route}`);
    return ["Admin", `ADMIN da equipe${entry?.permission ? ` + ${entry.permission}` : ""}`];
  }
  if (/^\/comprador(?:\/|$)/.test(route)) return ["Comprador", "Proxy; BUYER ou ADMIN da equipe; aviso legal"];
  if (/^\/dashboard(?:\/|$)/.test(route)) return ["Organizador", "Proxy; ORGANIZER; onboarding, aprovação e aviso legal"];
  if (route === "/organizador/escolher-plano") return ["Organizador", "Proxy; ORGANIZER (gate adicional na página)"];
  if (/^\/organizador(?:\/|$)/.test(route)) return ["Organizador", "Proxy; ORGANIZER ou ADMIN da equipe"];
  if (route === "/criar") return ["Organizador", "Proxy; redireciona para layout de ORGANIZER"];
  if (route === "/perfil") return ["Conta", "Proxy; página carrega a própria conta; sem RoleGate de layout"];
  if (route === "/juridico") return ["Conta", "RoleGate local BUYER/ORGANIZER/ADMIN da equipe; fora do proxy"];
  if (route === "/afiliado") return ["Afiliado", "Sem gate no layout; consulta de sessão/dados na API"];
  if (route.startsWith("/afiliado/")) return ["Afiliado", "Sem proxy de página; continuação por convite/conta"];
  if (/^\/(?:cadastro|login|escolha|esqueci-senha|recuperar-senha)(?:\/|$)/.test(route)) return ["Acesso", "Sem proxy de página; validações próprias do fluxo"];
  if (route.startsWith("/preview/")) return ["Prévia", "Sem proxy de página; payload local do editor/iframe"];
  if (route === "/teste") return ["Diagnóstico", "Página interativa sem gate; revisar destino/intenção"];
  if (/^\/(?:campanha|mini-campanhas|o|verificar)\//.test(route)) return ["Campanha e prova pública", "Sem proxy de página; regras e visibilidade dependem da API"];
  return ["Institucional/público a revisar", "Sem gate por rota identificado; reavaliar regras em novos destinos"];
}

export function generate() {
  const app = walk("apps/web/app");
  const codeFiles = new Set([...app, ...walk("apps/web/components")].filter((f) => extensions.includes(path.extname(f))));
  const suffix = /\/(page|route|layout|not-found|loading|error|global-error|default|template|robots|sitemap|forbidden|unauthorized)\.(tsx?|jsx?|mdx)$/;
  const entries = app.flatMap((file) => {
    const match = file.match(suffix);
    if (!match) return [];
    const pattern = routePattern(file.slice("apps/web/".length));
    return pattern === null ? [] : [{ file, type: match[1], pattern }];
  });
  const pages = entries.filter(({ type }) => type === "page");
  const handlers = entries.filter(({ type }) => type === "route");
  const special = entries.filter(({ type }) => !["page", "route"].includes(type));
  const routes = new Map();
  for (const entry of [...pages, ...handlers]) {
    const sig = entry.pattern.replace(/\[\[\.\.\.[^\]]+\]\]/g, "[[...]]").replace(/\[\.\.\.[^\]]+\]/g, "[...]").replace(/\[[^\]]+\]/g, "[]");
    if (routes.has(sig)) throw new Error(`Rota repetida em ${entry.file} e ${routes.get(sig)}`);
    routes.set(sig, entry.file);
  }
  const cache = new Map();
  const scan = (file) => {
    if (!cache.has(file)) {
      const src = code(file);
      cache.set(file, { src, imports: importedFiles(src, codeFiles), surface: surface(src) });
    }
    return cache.get(file);
  };
  const reachable = (entry) => {
    const seen = new Set([entry]);
    const visit = (file) => {
      for (const dep of scan(file).imports) {
        if (seen.has(dep)) continue;
        seen.add(dep);
        visit(dep);
      }
    };
    visit(entry);
    return sorted(seen);
  };
  const admin = resolveAdminPermissions();
  const pageTotals = new Map();
  const componentsUsed = new Set();
  const pagePatterns = new Set(pages.map(({ pattern }) => pattern));
  const checkedEvidence = new Map();
  for (const evidence of pageEvidence) {
    if (
      !pagePatterns.has(evidence.path) ||
      checkedEvidence.has(evidence.path) ||
      !/^apps\/web\/(?:e2e|e2e-local)\/[A-Za-z0-9._-]+$/.test(evidence.source) ||
      !fs.existsSync(path.join(repo, evidence.source)) ||
      !/^[a-f0-9]{7,40}$/.test(evidence.revision) ||
      !evidence.detail ||
      /[|\r\n]/.test(evidence.detail)
    ) throw new Error(`Evidência de página inválida: ${evidence.path}`);
    checkedEvidence.set(evidence.path, evidence);
  }
  const pageRows = pages.map(({ file, pattern }) => {
    const scope = pageScope(pattern, admin);
    pageTotals.set(scope[0], (pageTotals.get(scope[0]) ?? 0) + 1);
    const root = scan(file);
    const local = root.imports.map((f) => links(f, path.basename(f, path.extname(f))));
    const graph = reachable(file);
    const touched = graph.flatMap((source) => {
      const { forms, tables, overlays } = scan(source).surface;
      if (source.startsWith("apps/web/components/")) componentsUsed.add(source);
      return forms.length || tables.length || overlays.length ? [links(source, path.basename(source, path.extname(source)))] : [];
    });
    const proof = checkedEvidence.get(pattern);
    const status = proof
      ? `verificado no recorte local / parcial / passou local · ${links(proof.source, proof.revision)}: ${proof.detail}`
      : "? / ? / não rodado";
    return `| ${links(file, pattern)} | ${scope.join(" · ")} | ${listed(primaryRedirect(root.src))} | ${listed(local)} | ${listed(touched)} | ${status} |`;
  });
  const handlerRows = handlers.map(({ file, pattern }) => {
    const { src } = scan(file);
    const http = httpExports(src);
    if (!http.length) throw new Error(`Métodos HTTP não identificados em ${file}`);
    return `| ${links(file, pattern)} | ${http.join(", ")} | ${listed(handlerSignals(src).map(quoted))} | não rodado |`;
  });
  const specialRows = special.map(({ file, type, pattern }) => {
    const target = type === "robots" ? "/robots.txt" : type === "sitemap" ? "/sitemap.xml" : pattern;
    const deps = ["layout", "not-found", "loading", "error", "global-error", "default", "template", "forbidden", "unauthorized"].includes(type) ? reachable(file) : [];
    for (const dep of deps) if (dep.startsWith("apps/web/components/")) componentsUsed.add(dep);
    return `| ${links(file, `${type} · ${target}`)} | ${listed(scan(file).imports.map((f) => links(f, path.basename(f, path.extname(f)))))} | não rodado |`;
  });
  const compon = [...codeFiles].filter((file) => file.startsWith("apps/web/components/"));
  const surfaces = sorted([...compon, ...pages.map((entry) => entry.file), ...special.filter((entry) => !["robots", "sitemap"].includes(entry.type)).map((entry) => entry.file),
    ...codeFiles].filter((file) => !handlers.some((entry) => entry.file === file))).flatMap((file) => {
    const { forms, tables, overlays, controls } = scan(file).surface;
    if (!forms.length && !tables.length && !overlays.length && !controls.length && !file.startsWith("apps/web/components/")) return [];
    const reachableFromEntry = file.startsWith("apps/web/components/") ? componentsUsed.has(file) ? "sim" : "não encontrado estaticamente" : "fonte App Router";
    return [`| ${links(file, file.replace("apps/web/", ""))} | ${reachableFromEntry} | ${listed(forms.map(quoted))} | ${listed(tables.map(quoted))} | ${listed(overlays.map(quoted))} | ${listed(controls.map(quoted))} |`];
  });
  const candidateTests = ["tests", "e2e", "e2e-local"].flatMap((dir) => walk(`apps/web/${dir}`))
    .filter((file) => /\.(?:[cm]?js|tsx?)$/.test(file)).map((file) => `- ${links(file, file.replace("apps/web/", ""))}`);
  return [
    "# Inventário Web Premium — mapa de código gerado",
    "",
    "Gerado por `node apps/web/qa/inventory-web.mjs`. Verificação com `--check`. O relatório orienta a rodada visual, não comprova execução.",
    "",
    `**${pages.length} páginas, ${handlers.length} handlers (${handlers.filter((entry) => entry.pattern.startsWith("/api/")).length} em /api), ${special.filter((entry) => entry.type === "layout").length} layouts, ${compon.length} arquivos de componentes.**`,
    `Padrões parametrizados: ${pages.filter((entry) => entry.pattern.includes("[")).length} páginas, ${handlers.filter((entry) => entry.pattern.includes("[")).length} handlers; destes, ${handlers.filter((entry) => entry.pattern.includes("...")).length} catch-all. Grupos reais no inventário: ${sorted(entries.flatMap((entry) => entry.file.split("/").filter((s) => /^\([^)]+\)$/.test(s)))).length}.`,
    `Páginas por área: ${[...pageTotals].sort((a, b) => cmp(a[0], b[0])).map(([area, n]) => `${area} ${n}`).join("; ")}.`,
    "",
    "Controle de revisão dos gates: alterações nestas fontes exigem rever a interpretação manual, ainda que os nomes das rotas não mudem:",
    "",
    ...accessSources.map((file) => {
      const fingerprint = createHash("sha256").update(fs.readFileSync(path.join(repo, file))).digest("hex").slice(0, 12);
      return `- ${links(file)} · ${quoted(fingerprint)}`;
    }),
    "",
    "## Páginas",
    "",
    "**V/F/T** = visual da nova revisão / jornada funcional completa / execução nesta auditoria. `? / ? / não rodado` não significa defeito nem reprovação: verifique no navegador antes de mudar o status no registro manual. A evidência de um recorte local é parcial: não aprova a jornada integral, a publicação ou o iPhone. O código traz gates aparentes, não substitui os testes de autorização do backend.",
    "",
    "| Rota e fonte | Área e gate de origem | Alias puro | Imports locais diretos | Fontes que referenciam formulário, tabela ou sobreposição | V/F/T |",
    "|---|---|---|---|---|---|",
    ...pageRows,
    "",
    "## Manipuladores HTTP",
    "",
    "Métodos explicitamente exportados; o OPTIONS automático do Next não é listado. Chamadas estruturais indicam pistas de sessão/upstream, **não** garantem proteção, permissão ou ausência dela. O fallback e subcaminhos Nest estão fora da contagem; consultar auditoria manual. Os redirects GET /r e /s não são páginas de interface.",
    "",
    "| Padrão e fonte | Exporta | Sinais de sessão/upstream na fonte | Teste nesta auditoria |",
    "|---|---|---|---|",
    ...handlerRows,
    "",
    "## Layouts, estados e endpoints de metadados",
    "",
    "| Tipo e escopo | Imports locais diretos | Teste nesta auditoria |",
    "|---|---|---|",
    ...specialRows,
    ...app.filter((file) => file.endsWith("/favicon.ico")).map((file) => `| ${links(file, "/favicon.ico · arquivo especial")} | — | não rodado |`),
    "",
    "## Catálogo de superfície em fontes da Web",
    "",
    "O grafo segue imports estáticos de valor e reexports locais de App Router e components, inclusive de componentes transitivos e layouts. Marcadores são tags JSX únicas por fonte (inclusive roles literais de tabela/diálogo); não significam que o controle aparece para todo usuário, recebe dados reais ou executa a ação. Alguns modais inline, imports dinâmicos, wrappers genéricos, conteúdo condicional/imperativo, elementos de libs e validação de campo exigem leitura da fonte e inspeção em navegador. As dependências comuns dos layouts são registradas separadamente; os componentes não alcançados por este grafo também permanecem no catálogo.",
    "",
    "| Fonte | Alcançável no grafo | Formulários | Tabelas | Diálogos/sobreposições | Controles JSX |",
    "|---|---|---|---|---|---|",
    ...surfaces,
    "",
    "## Fontes de testes e fixtures a consultar",
    "",
    "Listado por arquivo, sem executar testes e sem inferir cobertura de uma rota pelo nome. Use os testes como candidatos para a nova rodada por revisão, papel, viewport e estado.",
    "",
    ...candidateTests,
    "",
  ].join("\n");
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const result = generate();
  const target = path.join(repo, output);
  if (process.argv.includes("--check")) {
    if (!fs.existsSync(target) || fs.readFileSync(target, "utf8") !== result) {
      console.error(`Inventário desatualizado: gere novamente com node apps/web/qa/inventory-web.mjs (${output})`);
      process.exitCode = 1;
    } else console.log("Inventário Web Premium confere com a árvore App Router.");
  } else {
    fs.writeFileSync(target, result);
    console.log(`Atualizado: ${output}`);
  }
}
