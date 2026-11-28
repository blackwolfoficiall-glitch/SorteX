import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { AuthState } from "../src/api/client";
import { loadSettingsDocument, loadSettingsLegal, loadSettingsPlan, organizerSettingsSections,
  organizerSettingsSession, parseLegalDocument, parseLegalSettings, parseSettingsPlan, type SettingsClient } from "../src/organizer/settings";

const owner = "owner-a";
const existingDate = "2026-11-26T19:00:00Z";
const doc = { title: "Termos sintéticos", slug: "termos-sinteticos", category: "TERMOS", version: 2 };
const acceptance = { id: "a", userId: owner, document: doc, version: 1, acceptedAt: existingDate, ipHash: "private-ip" };
const request = { id: "r", userId: owner, type: "DELETION", status: "OPEN", requestedAt: existingDate, reason: "private-reason" };
const plan = { sandbox: true, plan: { name: "Gratuito", monthlyPrice: 0, description: null,
  features: [{ id: "f", name: "Campanhas permitidas", value: 3 }] },
  consumption: { campaigns: 2 }, subscription: { organizerId: owner, status: "ACTIVE", autoRenew: false, nextRenewalAt: null } };
const state = (id: string, role: "ORGANIZER" | "BUYER" = "ORGANIZER"): AuthState =>
  ({ status: "signedIn", user: { id, role, name: "Sintético", email: "user@example.test" } });

test("menu mantém o Perfil real separado e distingue funções que ainda não têm tela", () => {
  assert.deepEqual(organizerSettingsSections.map((item) => item.title),
    ["Perfil", "Meu plano", "Central Jurídica", "Personalização", "Domínio próprio", "Redes sociais e comunidades"]);
  const view = readFileSync(new URL("../src/organizer/NativeOrganizerSettings.tsx", import.meta.url), "utf8");
  assert.match(view, /item.id === "profile" \? onProfile/);
  assert.match(view, /item.id === "plan" \? \(\) => setSection\("plan"\)/);
  assert.match(view, /item.id === "legal" \? \(\) => setSection\("legal"\) : null/);
  assert.doesNotMatch(view, /WebView|Linking.openURL|api\\\./);
});
test("Plano usa os dados reais da API e não confunde assinatura de outra conta ou produção", () => {
  const read = parseSettingsPlan(plan, owner);
  assert.equal(read.plan?.name, "Gratuito");
  assert.equal(read.plan?.features[0]?.value, 3);
  assert.equal(read.campaigns, 2);
  assert.equal(read.subscription?.autoRenew, false);
  assert.throws(() => parseSettingsPlan(plan, "owner-b"), /verificar/);
  assert.throws(() => parseSettingsPlan({ ...plan, sandbox: false }, owner), /verificar/);
});
test("Central mostra versão sem revelar dados de auditoria ou razões da solicitação", () => {
  const legal = parseLegalSettings([doc], [acceptance], [request], owner);
  assert.equal(legal.documents[0]?.version, 2);
  assert.equal(legal.acceptances[0]?.version, 1);
  assert.equal(legal.requests[0]?.status, "OPEN");
  assert.doesNotMatch(JSON.stringify(legal), /private|userId/);
  assert.throws(() => parseLegalSettings([doc], [acceptance], [request], "owner-b"), /verificar/);
  assert.throws(() => parseLegalSettings([{ ...doc, slug: "../administracao" }], [], [], owner), /verificar/);
});
test("documento integral em blocos, sem executar ou truncar conteúdo rico e sem trocar versão", () => {
  assert.deepEqual(parseLegalDocument({ ...doc, content: { blocks: [{ text: "Artigo 1" }, { text: "Artigo 2" }] } }, doc),
    { kind: "text", document: doc, blocks: ["Artigo 1", "Artigo 2"] });
  const rich = parseLegalDocument({ ...doc, content: { html: "<img src='x'>", blocks: [{ text: "texto parcial" }] } }, doc);
  assert.deepEqual(rich, { kind: "rich-on-web", document: doc });
  assert.throws(() => parseLegalDocument({ ...doc, version: 3, content: {} }, doc), /verificar/);
  assert.throws(() => parseLegalDocument({ ...doc, content: { blocks: [{ text: "  " }] } }, doc), /verificar/);
});
test("somente GET autorizados, código do documento é público sem sessão e respostas tardias são descartadas", async () => {
  let auth = state(owner), epoch = 1;
  const operations: string[] = [];
  const values = new Map([
    ["/plans/me", plan], ["/legal/acceptances/me", [acceptance]], ["/legal/data-requests/me", [request]],
    ["/legal/public", [doc]], ["/legal/public/" + doc.slug, { ...doc, content: { blocks: [{ text: "Artigo" }] } }],
  ] as Array<[string, unknown]>);
  let pause: Promise<unknown> | null = null;
  const read = async <T>(scope: string, path: string, method = "GET") => {
    operations.push(scope + " " + method + " " + path);
    if (pause) await pause;
    return values.get(path) as T;
  };
  const client: SettingsClient = {
    snapshot: () => auth, activeSessionRevision: () => epoch,
    request: (path, method) => read("private", path, method),
    publicRequest: (path, method) => read("public", path, method),
  };
  const session = organizerSettingsSession(client)!;
  assert.equal((await loadSettingsPlan(client, session))?.campaigns, 2);
  assert.equal((await loadSettingsLegal(client, session))?.requests.length, 1);
  assert.equal((await loadSettingsDocument(client, session, doc))?.kind, "text");
  assert.deepEqual(operations, ["private GET /plans/me", "public GET /legal/public",
    "private GET /legal/acceptances/me", "private GET /legal/data-requests/me", "public GET /legal/public/" + doc.slug]);
  let release: () => void = () => undefined;
  pause = new Promise<void>((resolve) => { release = resolve; });
  const started = loadSettingsPlan(client, session);
  auth = state("owner-b");
  epoch = 2;
  release();
  assert.equal(await started, null);
  auth = state("owner-b", "BUYER");
  const attempts = operations.length;
  assert.equal(organizerSettingsSession(client), null);
  assert.equal(await loadSettingsLegal(client, session), null);
  assert.equal(operations.length, attempts);
});

test("o atalho Configurações toca uma rota do organizador, sem substituir Perfil ou Personalização", () => {
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  const nav = readFileSync(new URL("../src/organizer/premium-navigation.ts", import.meta.url), "utf8");
  const more = readFileSync(new URL("../src/organizer/NativeOrganizerNavigation.tsx", import.meta.url), "utf8");
  assert.match(nav, /title: "Configurações", icon: "⚙", route: "OrganizerSettings"/);
  assert.match(nav, /title: "Perfil", icon: "●", route: "OrganizerProfile"/);
  assert.match(nav, /title: "Personalização", icon: "✧", unavailable:/);
  assert.match(more, /navigation.navigate\(entry.route\)/);
  assert.match(app, /role === "ORGANIZER" && \(\s*<>[\s\S]{0,1800}<Stack.Screen name="OrganizerSettings" component=\{OrganizerSettingsScreen\}/);
  assert.match(app, /NativeOrganizerSettings key=\{[^\n]*session.organizerId[^\n]*session.revision/);
  assert.match(app, /client=\{client\} session=\{session\} onProfile=\{\(\) => navigation.navigate\("OrganizerProfile"\)\}/);
});
