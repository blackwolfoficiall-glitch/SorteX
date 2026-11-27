import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { pageEvidence } from "./inventory-web-evidence.mjs";
import { notes, publication, simulator } from "./page-matrix-evidence.mjs";

const web = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const repo = path.resolve(web, "../..");
const directory = "docs/homologacao-2026-11-25";
const output = "MATRIZ_109_PAGINAS_WEB.md";
// Do not change these when a new route, fixture, or UI proof appears.
const PAGE_SCOPE = 109;
const JOURNEY_SCOPE = 18;
const PHYSICAL_SCOPE = 9;
const byRoute = (a, b) => a.route < b.route ? -1 : a.route > b.route ? 1 : 0;
const docData = (name) => fs.readFileSync(path.join(repo, directory, name), "utf8");

export function inventoryPages(input) {
  const section = /^## Páginas\s*\r?\n([\s\S]+?)^## Manipuladores HTTP/m.exec(input)?.[1];
  if (!section) throw new Error("Seção de páginas do inventário ausente.");
  const rows = [];
  for (const line of section.split(/\r?\n/)) {
    if (!line.startsWith("| [/")) continue;
    const match = /^\| \[(\/[^ ]*?)\]\((\.\.\/\.\.\/apps\/web\/app\/(?:[^() ]+\/)?page\.(?:tsx?|jsx?|mdx))\) \|/.exec(line);
    if (!match) throw new Error("Linha de página ilegível; confira o formato do inventário.");
    rows.push({
      route: match[1].replace(/\\([\[\]])/g, "$1"),
      source: match[2],
      inventoryProof: /verificado no recorte local \/ parcial \/ passou local · \[([^\]]+)\]\(\.\.\/\.\.\/([^)]+)\): ([^|]+) \|$/.exec(line)?.slice(1),
    });
  }
  if (rows.length !== PAGE_SCOPE || new Set(rows.map(({ route }) => route)).size !== PAGE_SCOPE) {
    throw new Error(`Cobertura incompleta ou rotas repetidas. Revise o escopo fixo de ${PAGE_SCOPE} páginas sem alterar o denominador automaticamente.`);
  }
  return rows.sort(byRoute);
}

export function journeyTotals(input) {
  const rows = [...input.matchAll(/^\|\s*(\d+)\s*\|[^|]*\|\s*(I|P|NE)\s*\|\s*(I|P|NE)\s*\|/gm)];
  if (rows.length !== JOURNEY_SCOPE || rows.some((row, index) => Number(row[1]) !== index + 1)) {
    throw new Error("Placar de jornadas não corresponde ao escopo fixo.");
  }
  const physical = /^\| Aceite físico formal da candidata[^\r\n]*\*\*(\d+)\/(\d+)/m.exec(input);
  if (!physical || Number(physical[2]) !== PHYSICAL_SCOPE || Number(physical[1]) > PHYSICAL_SCOPE) {
    throw new Error("Placar de aceite físico inválido.");
  }
  return {
    web: rows.filter((row) => row[2] === "I").length,
    native: rows.filter((row) => row[3] === "I").length,
    parity: rows.filter((row) => row[2] === "I" && row[3] === "I").length,
    physical: Number(physical[1]),
  };
}

function publicationStatus(route) {
  return Object.hasOwn(publication.directScopes, route)
    ? `Prévia privada v${publication.version} · \`${publication.revision.slice(0, 7)}\` · ${publication.directScopes[route]}`
    : `Não atestada na prévia v${publication.version}`;
}

function nativeStatus(route) {
  const partial = simulator.partialPaths[route];
  if (partial) return partial;
  if (/^\/admin(?:\/|$)/.test(route)) return "Fora do escopo do app comum";
  return "Paridade por rota não atestada";
}

export function render({ inventory, scoreboard, evidence = pageEvidence }) {
  const pages = inventoryPages(inventory);
  const scores = journeyTotals(scoreboard);
  const paths = new Set(pages.map(({ route }) => route));
  const proof = new Map(evidence.map((item) => [item.path, item]));
  if (proof.size !== evidence.length || pages.some(({ route, inventoryProof }) => {
    const found = proof.get(route);
    return Boolean(found) !== Boolean(inventoryProof) ||
      (found && (inventoryProof[0] !== found.revision || inventoryProof[1] !== found.source || inventoryProof[2] !== found.detail));
  })) {
    throw new Error("Evidências e inventário divergentes. Atualize o inventário antes da matriz.");
  }
  for (const entry of [...proof.keys(), ...Object.keys(publication.directScopes), ...Object.keys(simulator.partialPaths), ...Object.keys(notes)]) {
    if (!paths.has(entry)) throw new Error(`Rota declarada não encontrada: ${entry}`);
  }
  const pageLines = pages.map(({ route, source }) => {
    const found = proof.get(route);
    const visual = found ? "Recorte validado localmente" : "Conclusão não atestada";
    const functional = found ? "Parcial no recorte" : "Conclusão não atestada";
    const tests = found ? `[Passou no recorte · ${found.revision}](../../${found.source})` : "Sem evidência registrada";
    const limits = [found?.detail, notes[route]].filter(Boolean).join(" · ")
      || "Falta evidência específica desta rota. Isso não prova falha.";
    const label = route.replace(/[[\]]/g, "\\$&");
    return `| [${label}](${source}) | ${visual} | ${functional} | ${tests} | ${publicationStatus(route)} | ${nativeStatus(route)} | ${limits} |`;
  });
  return [
    "# SorteX · matriz de evidências das 109 páginas Web",
    "",
    "Escopo: candidata Web Premium do [PR #1](https://github.com/blackwolfoficiall-glitch/SorteX/pull/1). Fonte das rotas: [inventário gerado](INVENTARIO_WEB_PREMIUM_GERADO.md). Handlers, layouts e APIs não são páginas. Aliases e rotas parametrizadas permanecem no denominador; uma prova não se transfere automaticamente entre URLs.",
    "",
    `**${proof.size}/${PAGE_SCOPE} páginas têm um recorte local registrado**; as outras ${PAGE_SCOPE - proof.size} não têm evidência específica nesta revisão do inventário. O recorte pode ser visual ou uma parte do fluxo. Não é percentual de design, funcionalidade, paridade ou homologação integral.`,
    "",
    "## Como ler",
    "",
    "- **Design da página:** validação local de recorte não equivale à conclusão de todas as variantes, dispositivos e estados da rota.",
    "- **Funcionalidade da página:** recorte parcial não é jornada integral. Os números das jornadas ficam abaixo e não promovem páginas automaticamente.",
    "- **Testes:** cada link identifica apenas a prova registrada para a rota e sua revisão. Não combina resultados de revisões ou ambientes, nem comprova provedor externo.",
    `- **Publicação:** a prévia v${publication.version} comprova apenas os recortes explicitados. «Não atestada» não significa que a rota não exista em alguma versão anterior ou esteja quebrada.`,
    "- **Paridade iOS:** a interface nativa não se mede por simplesmente abrir URLs Web. Um trecho no simulador não é paridade integral, build distribuído ou aceite físico. A administração fica fora do app comum.",
    "",
    "## Ambientes e revisões",
    "",
    `- **Prévia privada v${publication.version}**: [abrir SorteX QA](${publication.url}) · fonte \`${publication.revision}\` · publicação verificada em ${publication.verifiedUtc}. Evidência de conteúdo publicado: ${Object.entries(publication.directScopes).map(([route, scope]) => `\`${route}\` (${scope})`).join(", ")}. ${publication.sharedShell}`,
    "- **Base Web anterior**: a presença de telas em versões anteriores não prova que seu redesign Premium esteja na prévia atual. O histórico de API QA, Netlify e ensaios anteriores continua documentado em [Progresso da homologação](PROGRESSO_HOMOLOGACAO.md); outras revisões não são reclassificadas como a versão atual. Produção não foi atestada por esta matriz.",
    `- **Simulador iOS**: [execução nativa registrada](${simulator.run}) · fonte \`${simulator.revision}\`. Login e abertura do Início com HTTP 2xx; não comprovou o percurso em Campanhas, as demais telas, a publicação hospedada ou o iPhone físico.`,
    `- **Placar separado (18 jornadas, 9 cenários)**: Web ${scores.web}/${JOURNEY_SCOPE} integrais no escopo do placar local; app ${scores.native}/${JOURNEY_SCOPE}; paridade integral ${scores.parity}/${JOURNEY_SCOPE}; aceite físico ${scores.physical}/${PHYSICAL_SCOPE}. Fonte: [placar e critérios](PLACAR_EVIDENCIAS_WEB_IOS.md). Esses indicadores não são percentuais das ${PAGE_SCOPE} páginas.`,
    "",
    "Pendências transversais: Mercado Pago Teste com webhook e fluxo completo no iPhone; provedores reais de IA/Ads/comunicação quando autorizados; distribuição e aceite físico de desenvolvimento; prova de homologação e autorizações de lançamento específicas. Ver [bloqueios documentados](BLOQUEIOS_CRITICOS.md).",
    "",
    "| Página Web | Design da página | Funcionalidade da página | Teste e revisão | Publicação verificada | Paridade iOS | Recorte e pendências |",
    "|---|---|---|---|---|---|---|",
    ...pageLines,
    "",
    "## Atualização",
    "",
    "1. Registre uma prova local por rota em `apps/web/qa/inventory-web-evidence.mjs`. Gere o inventário com `node apps/web/qa/inventory-web.mjs`.",
    "2. Só altere `page-matrix-evidence.mjs` para publicação ou simulador se tiver revisão, escopo e prova do ambiente, sem dados privados. Uma tela nova não aumenta automaticamente o denominador; reveja o escopo antes de proceder.",
    "3. Rode `node apps/web/qa/page-matrix.mjs` para atualizar a matriz e `node apps/web/qa/page-matrix.mjs --check` para conferir se está atualizada. Testes: `node --test apps/web/qa/page-matrix.test.mjs`.",
    "",
  ].join("\n");
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const result = render({
    inventory: docData("INVENTARIO_WEB_PREMIUM_GERADO.md"),
    scoreboard: docData("PLACAR_EVIDENCIAS_WEB_IOS.md"),
  });
  const target = path.join(repo, directory, output);
  if (process.argv.includes("--check")) {
    if (!fs.existsSync(target) || fs.readFileSync(target, "utf8") !== result) {
      console.error("Matriz desatualizada. Rode node apps/web/qa/page-matrix.mjs");
      process.exitCode = 1;
    } else console.log("Matriz de 109 páginas atualizada.");
  } else {
    fs.writeFileSync(target, result);
    console.log(`Atualizado: ${target}`);
  }
}
