import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { ApiError, type AuthState } from "../src/api/client";
import {
  initialPrizeTicketFilters,
  loadPrizeTicketHistory,
  loadPrizeTicketPage,
  loadPrizeTicketSummary,
  parsePrizeTicketHistory,
  parsePrizeTicketPage,
  parsePrizeTicketSummary,
  prizeTicketsPath,
  prizeTicketsSession,
  type PrizeTicketsClient,
} from "../src/organizer/prize-tickets";

const time = "2026-11-28T15:20:00.000Z";
const fixture = {
  id: "prize-test",
  campaignId: "campaign-test",
  campaign: { id: "campaign-test", title: "Campanha fictícia" },
  exactNumber: "000042",
  description: "Produto fictício",
  value: 0,
  quantity: 1,
  foundCount: 0,
  type: "PRODUCT",
  status: "AVAILABLE",
  createdAt: time,
  reservation: null,
  results: [],
  winnerUserId: "omit",
  generationRule: { private: "omit" },
};
const envelope = (item: unknown = fixture) => ({
  items: [item],
  page: 1,
  pages: 1,
  total: 1,
});

test("Cotas Premiadas filters use the exact existing owner read, not a draw", () => {
  const path = prizeTicketsPath(
    {
      ...initialPrizeTicketFilters,
      campaignId: "campaign-test",
      search: "00..42",
      type: "PRODUCT",
      status: "found",
      sort: "number",
    },
    2,
  );
  const url = new URL(path, "https://sortex.invalid");
  assert.equal(url.pathname, "/organizer/prize-tickets");
  assert.equal(path.includes(".."), false);
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    page: "2",
    limit: "20",
    sort: "number",
    campaignId: "campaign-test",
    search: "00..42",
    status: "found",
    type: "PRODUCT",
  });
  assert.throws(() =>
    prizeTicketsPath(
      { ...initialPrizeTicketFilters, campaignId: "../other" },
      1,
    ),
  );
  assert.throws(() => prizeTicketsPath(initialPrizeTicketFilters, 0));
});

test("Cotas preserve zero, leading zeros and distinct availability/confirmed statuses with minimum data", () => {
  const results = [
    {
      status: "IDENTIFIED",
      identifiedAt: time,
      deliveredAt: null,
      buyer: { phone: "omit" },
      purchase: { id: "omit" },
    },
  ];
  const row = parsePrizeTicketPage(
    envelope({ ...fixture, status: "FOUND", foundCount: 1, results }),
    1,
    initialPrizeTicketFilters,
  ).items[0];
  assert.ok(row);
  assert.equal(row.number, "000042");
  assert.equal(row.value, 0);
  assert.equal(row.state, "found");
  assert.deepEqual(row.result, {
    status: "IDENTIFIED",
    identifiedAt: time,
    deliveredAt: null,
  });
  assert.equal("winnerUserId" in row, false);
  assert.equal("generationRule" in row, false);
  const reserved = parsePrizeTicketPage(
    envelope({
      ...fixture,
      reservation: { expiresAt: time, buyerName: "omit", purchaseId: "omit" },
    }),
    1,
    initialPrizeTicketFilters,
  ).items[0];
  assert.ok(reserved);
  assert.equal(reserved.state, "reserved");
  assert.deepEqual(reserved.reservation, { expiresAt: time });
  assert.equal(reserved.result, null);
  assert.equal(
    parsePrizeTicketPage(
      envelope({ ...fixture, exactNumber: null }),
      1,
      initialPrizeTicketFilters,
    ).items[0]?.number,
    null,
  );
});

test("Cotas preserve genuine empty lists and summary but reject malformed or mis-scoped rows", () => {
  assert.deepEqual(
    parsePrizeTicketPage(
      { items: [], page: 1, pages: 1, total: 0 },
      1,
      initialPrizeTicketFilters,
    ).items,
    [],
  );
  assert.throws(() =>
    parsePrizeTicketPage(envelope(), 1, {
      ...initialPrizeTicketFilters,
      campaignId: "another",
    }),
  );
  assert.throws(() =>
    parsePrizeTicketPage(
      envelope({ ...fixture, value: "0" }),
      1,
      initialPrizeTicketFilters,
    ),
  );
  assert.throws(() =>
    parsePrizeTicketPage(
      { items: [], page: 1, pages: 1, total: 21 },
      1,
      initialPrizeTicketFilters,
    ),
  );
  const summary = {
    all: 1,
    available: 0,
    reserved: 0,
    found: 1,
    paused: 0,
    expired: 2,
    delivered: 0,
  };
  assert.deepEqual(
    parsePrizeTicketSummary({ ...summary, privateAudit: "omit" }),
    summary,
  );
  assert.throws(() => parsePrizeTicketSummary({}));
});

test("Cotas history keeps action/date but strips actor and snapshots", () => {
  assert.deepEqual(
    parsePrizeTicketHistory([
      {
        id: "one",
        action: "INSTANT_PRIZE_REACTIVATE",
        createdAt: time,
        actorUserId: "private",
        newData: { private: "omit" },
      },
      { id: "two", action: "future-unknown-raw", createdAt: time },
    ]),
    [
      { id: "one", action: "Cota reativada", createdAt: time },
      { id: "two", action: "Evento de cota registrado", createdAt: time },
    ],
  );
  assert.throws(() =>
    parsePrizeTicketHistory([{ id: "x", action: "foo", createdAt: "bad" }]),
  );
});

test("Owner requests preserve 404, failure, and stale response dispositions", async () => {
  let revision = 1;
  let role = "ORGANIZER";
  let respond: (value: unknown) => void = () => {};
  const visited: string[] = [];
  const client: PrizeTicketsClient = {
    snapshot: () =>
      ({
        status: "signedIn",
        user: { role, id: "organizer-test" },
      }) as AuthState,
    activeSessionRevision: () => revision,
    request: <T>(path: string) => {
      visited.push(path);
      if (path.endsWith("/foreign/history"))
        return Promise.reject(new ApiError("Not found", 404));
      if (path.endsWith("/summary"))
        return Promise.reject(new ApiError("Indisponível", 503));
      return new Promise<T>((resolve) => {
        respond = (v) => resolve(v as T);
      });
    },
  };
  const session = prizeTicketsSession(client);
  assert.ok(session);
  assert.deepEqual(await loadPrizeTicketHistory(client, session, "foreign"), {
    kind: "missing",
  });
  await assert.rejects(
    loadPrizeTicketSummary(client, session, ""),
    /Indisponível/,
  );
  const read = loadPrizeTicketPage(
    client,
    session,
    initialPrizeTicketFilters,
    1,
  );
  revision++;
  respond(envelope());
  assert.deepEqual(await read, { kind: "stale" });
  role = "BUYER";
  assert.deepEqual(
    await loadPrizeTicketHistory(client, session, "prize-test"),
    { kind: "stale" },
  );
  assert.equal(visited.length, 3);
});

test("Mais has a separate organizer-only Cotas route and keeps the draft editor", () => {
  const menu = readFileSync(
    new URL("../src/organizer/premium-navigation.ts", import.meta.url),
    "utf8",
  );
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  assert.match(
    menu,
    /title: "Cotas premiadas", icon: "🎁", route: "OrganizerPrizeTickets"/,
  );
  const ownerScreens = app
    .split('{auth.user?.role === "ORGANIZER" && (')
    .find(
      (part) =>
        part.startsWith("\n                  <>") &&
        part.includes('name="OrganizerProfile"'),
    )
    ?.split("</>")[0];
  assert.ok(
    ownerScreens?.includes(
      'name="OrganizerPrizeTickets" component={OrganizerPrizeTicketsScreen}',
    ),
  );
  assert.ok(
    app.includes(
      'name="OrganizerDraftPrizes" component={OrganizerDraftPrizesScreen}',
    ),
  );
  assert.ok(
    app.includes('navigation.navigate("Main", { screen: "Campaigns" })'),
  );
});
