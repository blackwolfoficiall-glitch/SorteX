import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { AuthState } from "../src/api/client";
import { filterOrganizerWinners, loadOrganizerWinners, organizerWinnersSession,
  parseOrganizerWinners, type WinnersClient } from "../src/organizer/winners";

const row = {
  id: "winner-a", campaign: { id: "campaign-a", title: "Campanha sintética", organizerId: "a" },
  winningNumber: "00091", prizeName: "Prêmio", prizeValue: "89.50", status: "DELIVERED",
  createdAt: "2026-11-26T19:00:00Z", deliveredAt: "2026-11-27T19:00:00Z",
  publicDisclosureAuthorized: false,
  buyer: { name: "Maria Sintética Teste", city: "Feira de Santana", email: "private@example.test", phone: "private-phone" },
  confirmationToken: "private-token", ticket: { id: "private-ticket" },
};
const auth = (id: string, role: "ORGANIZER" | "BUYER" = "ORGANIZER"): AuthState =>
  ({ status: "signedIn", user: { id, role, name: "Sintético", email: "user@example.test" } });

test("preserva zeros, valor decimal, privacidade e registros exclusivos da operação", () => {
  const result = parseOrganizerWinners([row], "a");
  assert.equal(result[0]?.winningNumber, "00091");
  assert.equal(result[0]?.prizeValue, "89.50");
  assert.equal(result[0]?.winnerName, "Maria T.");
  assert.equal(result[0]?.publicDisclosureAuthorized, false);
  assert.ok(!JSON.stringify(result).includes("private"));
  assert.throws(() => parseOrganizerWinners([row], "b"), /verificar/);
  assert.throws(() => parseOrganizerWinners([row, row], "a"), /verificar/);
  assert.throws(() => parseOrganizerWinners([{ ...row, winningNumber: 91 }], "a"), /verificar/);
  assert.throws(() => parseOrganizerWinners([{ ...row, prizeValue: Infinity }], "a"), /verificar/);
});

test("filtra pela campanha, zeros da cota e pelo período, como no site", () => {
  const older = { ...row, id: "winner-b", campaign: { ...row.campaign, id: "campaign-b" },
    winningNumber: "00019", createdAt: "2026-10-30T19:00:00Z" };
  const rows = parseOrganizerWinners([row, older], "a");
  const now = new Date("2026-11-28T19:00:00Z");
  assert.deepEqual(filterOrganizerWinners(rows, "", "000", 7, now).map((r) => r.id), ["winner-a"]);
  assert.deepEqual(filterOrganizerWinners(rows, "campaign-b", "019", 30, now).map((r) => r.id), ["winner-b"]);
  assert.deepEqual(filterOrganizerWinners(rows, "campaign-a", "00019", 0, now), []);
  assert.deepEqual(filterOrganizerWinners(rows, "", "", 0, now), rows);
});

test("abre a API autenticada só para o organizador e ignora leitura tardia", async () => {
  let snapshot = auth("a");
  let revision: number | null = 1;
  let release: (v: unknown) => void = () => undefined;
  const pending = new Promise<unknown>((resolve) => { release = resolve; });
  const calls: string[] = [];
  const client: WinnersClient = {
    snapshot: () => snapshot, activeSessionRevision: () => revision,
    request: async <T>(path: string) => { calls.push(path); return await pending as T; },
  };
  const current = organizerWinnersSession(client)!;
  const read = loadOrganizerWinners(client, current);
  revision = 2;
  snapshot = auth("b");
  release([row]);
  assert.equal(await read, null);
  snapshot = auth("b", "BUYER");
  assert.equal(organizerWinnersSession(client), null);
  assert.equal(await loadOrganizerWinners(client, current), null);
  assert.deepEqual(calls, ["/winners/organizer"]);
});

test("entry point Mais apresenta rota real, só registrada para organizador", () => {
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  const menu = readFileSync(new URL("../src/organizer/premium-navigation.ts", import.meta.url), "utf8");
  const view = readFileSync(new URL("../src/organizer/NativeOrganizerWinners.tsx", import.meta.url), "utf8");
  assert.match(menu, /title: "Ganhadores", icon: "🏆", route: "OrganizerWinners"/);
  assert.match(app, /role === "ORGANIZER" && \(\s*<>\s*<Stack.Screen name="OrganizerProfile"[^\n]*\n\s*<Stack.Screen name="OrganizerWinners" component=\{OrganizerWinnersScreen\}/);
  assert.match(app, /NativeOrganizerWinners key=\{[^\n]*session.organizerId[^\n]*session.revision/);
  assert.match(view, /loadOrganizerWinners\(client, \{ organizerId, revision \}\)/);
  assert.match(view, /title="Ver detalhes" onPress=\{\(\) => setDetailId\(winner.id\)\}/);
});
