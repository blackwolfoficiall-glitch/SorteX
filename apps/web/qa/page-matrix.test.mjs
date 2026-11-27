import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { pageEvidence } from "./inventory-web-evidence.mjs";
import { publication, simulator } from "./page-matrix-evidence.mjs";
import { inventoryPages, journeyTotals, render } from "./page-matrix.mjs";

const docs = new URL("../../../docs/homologacao-2026-11-25/", import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, docs), "utf8");
const input = {
  inventory: read("INVENTARIO_WEB_PREMIUM_GERADO.md"),
  scoreboard: read("PLACAR_EVIDENCIAS_WEB_IOS.md"),
};
const matrixRows = (output) => output.split("\n").filter((line) => line.startsWith("| [/"));
const lineFor = (output, route) => matrixRows(output).find((line) => line.startsWith(`| [${route}](`));
const expected = read("MATRIZ_109_PAGINAS_WEB.md");

test("keeps exactly 109 distinct page entries and excludes handlers and layouts", () => {
  const pages = inventoryPages(input.inventory);
  assert.equal(pages.length, 109);
  assert.equal(pages.filter((page) => page.route === "/").length, 1);
  assert(pages.some((page) => page.route === "/dashboard/campanhas/[id]/editar"));
  assert(!pages.some((page) => page.route.startsWith("/api/")));
  assert(!pages.some((page) => page.route === "/robots.txt"));
  assert.throws(() => inventoryPages(input.inventory.replace(/^\| \[\/\]\([^\n]+\n/m, "")), /109/);
  assert.throws(() => inventoryPages(input.inventory.replace(/^\| \[\/\]\([^\n]+\n/m, (line) => line.repeat(2))), /109/);
});

test("imports exactly the recorded local recortes without promoting them to integral pages", () => {
  const result = render(input);
  assert.match(result, new RegExp(`${pageEvidence.length}/109 páginas têm um recorte local registrado`));
  assert.equal(matrixRows(result).filter((row) => row.includes("| Parcial no recorte |")).length, pageEvidence.length);
  assert.equal(matrixRows(result).filter((row) => row.includes("| Recorte validado localmente |")).length, pageEvidence.length);
  assert.equal(matrixRows(result).length, 109);
  assert.match(lineFor(result, "/admin/convite/\\[token\\]"), /Fora do escopo do app comum/);
  assert.throws(() => render({ ...input, evidence: pageEvidence.slice(1) }), /divergentes/);
  assert.throws(() => render({
    ...input,
    evidence: [{ ...pageEvidence[0], revision: "1234567" }, ...pageEvidence.slice(1)],
  }), /divergentes/);
});

test("does not propagate the private release to links or extract native parity from Web proof", () => {
  const result = render(input);
  assert.deepEqual(Object.keys(publication.directScopes), ["/", "/contato", "/dashboard", "/dashboard/configuracoes", "/suporte"]);
  assert.equal(matrixRows(result).filter((line) => line.includes("| Prévia privada v6 ·")).length, 5);
  assert.match(lineFor(result, "/"), /Prévia privada v6.*abertura da página inicial/);
  assert.match(lineFor(result, "/dashboard"), /Prévia privada v6.*6bb28fe.*painel do organizador/);
  assert.match(lineFor(result, "/dashboard/configuracoes"), /Prévia privada v6.*visão geral de configurações/);
  assert.match(lineFor(result, "/dashboard/campanhas"), /Não atestada na prévia v6.*não foi percorrida no simulador/);
  assert.deepEqual(Object.keys(simulator.partialPaths).sort(), ["/comprador", "/login"]);
  assert.match(lineFor(result, "/comprador"), /Início do comprador parcial no simulador/);
  assert.doesNotMatch(lineFor(result, "/dashboard"), /parcial no simulador/);
  assert.equal(matrixRows(result).filter((line) => line.includes("parcial no simulador")).length, 2);
  assert.match(lineFor(result, "/login"), /Login parcial no simulador/);
  assert.match(result, /Base Web anterior/);
});

test("preserves separate journey and physical-acceptance denominators", () => {
  const totals = journeyTotals(input.scoreboard);
  const result = render(input);
  assert.match(result, new RegExp(`Web ${totals.web}/18 .*app ${totals.native}/18; paridade integral ${totals.parity}/18; aceite físico ${totals.physical}/9`));
  assert.throws(() => journeyTotals(input.scoreboard.replace(/^\|\s*18\s*\|[^\n]+\n/m, "")), /escopo fixo/);
});

test("generated document is reproducible with no filesystem writes during verify", () => {
  assert.equal(render(input), expected);
});
