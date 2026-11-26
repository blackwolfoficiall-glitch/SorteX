import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError, SortexClient, type AuthState } from "../src/api/client";
import {
  loadOrganizerDashboard,
  organizerDashboardSession,
  parseOrganizerDashboard,
} from "../src/organizer/dashboard";

const organizer = {
  id: "synthetic-organizer",
  role: "ORGANIZER" as const,
  name: "Organizer",
  email: "organizer@example.test",
};
const generatedAt = "2026-11-26T19:03:04.000Z";
const campaigns = [
  {
    id: "public-1",
    title: "Publicada",
    status: "PUBLISHED",
    publicationBlocked: false,
    totalNumbers: 10,
    soldNumbers: 1,
  },
  {
    id: "sold-out-2",
    title: "Esgotada",
    status: "SOLD_OUT",
    publicationBlocked: false,
    totalNumbers: 10,
    soldNumbers: 10,
  },
  {
    id: "blocked-3",
    title: "Bloqueada",
    status: "PUBLISHED",
    publicationBlocked: true,
    totalNumbers: 10,
    soldNumbers: 0,
  },
];
const summary = {
  grossRevenue: 17.42,
  activeCampaigns: 2,
  participants: 1,
  soldTickets: 11,
};
const data = { generatedAt, summary, campaigns };

test("dashboard uses only known persisted fields and keeps sold out active but blocked inactive", () => {
  assert.deepEqual(
    parseOrganizerDashboard({
      ...data,
      summary: { ...summary, accountBalance: 444 },
      campaigns: campaigns.map((c) => ({
        ...c,
        grossRevenue: 999,
        memo: "not surfaced",
      })),
    }),
    data,
  );
  assert.deepEqual(
    parseOrganizerDashboard({
      generatedAt,
      campaigns: [],
      summary: {
        grossRevenue: 0,
        activeCampaigns: 0,
        participants: 0,
        soldTickets: 0,
      },
    }).campaigns,
    [],
  );
});

test("malformed, contradictory and missing fields never become valid zeroes", () => {
  for (const invalid of [
    null,
    {},
    { ...data, generatedAt: "wrong" },
    { ...data, summary: { ...summary, grossRevenue: "17.42" } },
    { ...data, summary: { ...summary, participants: NaN } },
    { ...data, summary: { ...summary, activeCampaigns: 3 } },
    { ...data, campaigns: [...campaigns, campaigns[0]] },
    { ...data, campaigns: campaigns.map(({ publicationBlocked, ...c }) => c) },
    { ...data, summary: { ...summary, activeCampaigns: 0 }, campaigns: [] },
  ])
    assert.throws(
      () => parseOrganizerDashboard(invalid),
      /indicadores válidos/,
    );
});

test("buyer and expired sessions do not request organizer metrics; server errors remain errors", async () => {
  const auth: AuthState = { status: "signedIn", user: organizer };
  let called = 0;
  const fixture = {
    snapshot: () => auth,
    activeSessionRevision: () => 1,
    request: async <T>(path: string): Promise<T> => {
      assert.equal(path, "/dashboard");
      ++called;
      throw new ApiError("Service unavailable", 503);
    },
  };
  const expected = organizerDashboardSession(fixture)!;
  await assert.rejects(
    loadOrganizerDashboard(fixture, expected),
    /Service unavailable/,
  );
  auth.user = { ...organizer, role: "BUYER" };
  assert.equal(organizerDashboardSession(fixture), null);
  assert.equal(await loadOrganizerDashboard(fixture, expected), null);
  auth.status = "signedOut";
  assert.equal(await loadOrganizerDashboard(fixture, expected), null);
  assert.equal(called, 1);
});

test("old organizer response is discarded after logout even after signing in as that organizer again", async () => {
  let complete: ((response: Response) => void) | undefined;
  const client = new SortexClient(
    "https://isolation.example.test",
    {
      read: async () => null,
      write: async () => {},
      clear: async () => {},
    },
    async (input) => {
      switch (new URL(String(input)).pathname) {
        case "/auth/login":
          return Response.json({
            user: organizer,
            accessToken: "access",
            refreshToken: "refresh",
          });
        case "/auth/me":
          return Response.json(organizer);
        case "/auth/logout":
          return Response.json({});
        case "/dashboard":
          return new Promise((resolve) => {
            complete = resolve;
          });
        default:
          throw new Error("Unexpected fixture request");
      }
    },
  );
  await client.login(organizer.email, "synthetic");
  const first = organizerDashboardSession(client)!;
  const run = loadOrganizerDashboard(client, first);
  assert.ok(complete);
  await client.logout();
  await client.login(organizer.email, "synthetic");
  assert.notEqual(organizerDashboardSession(client)?.revision, first.revision);
  complete(Response.json(data));
  assert.equal(await run, null);
});
