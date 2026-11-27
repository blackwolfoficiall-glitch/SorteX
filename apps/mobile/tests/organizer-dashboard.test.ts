import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError, SortexClient, type AuthState } from "../src/api/client";
import {
  loadOrganizerDashboard,
  organizerDashboardSession,
  parseOrganizerDashboard,
} from "../src/organizer/dashboard";

import { organizerRevenueGeometry } from "../src/organizer/premium-chart";

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

import {
  DEFAULT_DASHBOARD_PERIOD,
  chartFor,
  dayInSaoPaulo,
  legacyHistoryCovers,
  legacyUtcRange,
  loadDashboardPeriod,
  parseCustomPeriod,
  parsePeriodDashboard,
  periodFor,
} from "../src/organizer/dashboard-period";
import { organizerCampaignShareUrl } from "../src/organizer/campaign-share";
import { QA_API } from "../src/api/config";
import { organizerGroups } from "../src/organizer/premium-navigation";

test("premium dashboard periods follow Brasília civil dates across UTC midnight and leap days", () => {
  assert.equal(dayInSaoPaulo("2026-11-27T01:00:00.000Z"), "2026-11-26");
  assert.deepEqual(periodFor("week", "2024-03-01"), { start: "2024-02-24", end: "2024-03-01" });
  assert.deepEqual(periodFor("year", "2026-11-26"), { start: "2025-12-01", end: "2026-11-26" });
  assert.deepEqual(parseCustomPeriod("29/02/2024", "04/03/2024", "2026-11-26"), {
    start: "2024-02-29", end: "2024-03-04",
  });
  for (const [from, to] of [["29/02/2026","05/03/2026"],["03/04/2026","02/04/2026"],
    ["03/04/2026","29/11/2026"],["04/04/2024","08/04/2025"],["01/12/1999","01/01/2000"]]) {
    assert.equal(parseCustomPeriod(from!, to!, "2026-11-26"), null);
  }
});

const period = { start: "2026-11-20", end: "2026-11-26" };
const v1 = {
  version: 1, period: { ...period, timeZone: "America/Sao_Paulo" },
  summary: { grossRevenue: 17.42, soldTickets: 10, participants: 2, averageTicket: 8.71, paidOrders: 2 },
  revenueHistory: [{ date: "2026-11-20", revenue: 8.71 }, { date: "2026-11-24", revenue: 8.71 }],
};

test("premium period dashboard rejects invalid or mismatched server data without silently zeroing it", () => {
  assert.deepEqual(chartFor(parsePeriodDashboard(v1, period).revenueHistory!, period), [8.71,0,0,0,8.71,0,0]);
  for (const result of [
    { ...v1, period: { ...period, timeZone: "UTC" } },
    { ...v1, period: { ...v1.period, start: "2026-11-19" } },
    { ...v1, summary: { ...v1.summary, participants: 3 } },
    { ...v1, summary: { ...v1.summary, grossRevenue: Infinity } },
    { ...v1, revenueHistory: [...v1.revenueHistory].reverse() },
    { ...v1, revenueHistory: [{ date: "2026-11-27", revenue: 12 }] },
  ]) assert.throws(() => parsePeriodDashboard(result, period));
  assert.deepEqual(parseOrganizerDashboard({ ...data, revenueHistory: v1.revenueHistory, summary: { ...summary, averageTicket: 3.56 } }), {
    ...data, summary: { ...summary, averageTicket: 3.56 }, revenueHistory: v1.revenueHistory,
  });
});

test("only a 404 activates the old API fallback and session switches drop stale period data", async () => {
  let revision = 1;
  let failureStatus = 404;
  let replaceSessionOnRequest = false;
  const mock = {
    snapshot: () => ({ status: "signedIn", user: organizer }) as AuthState,
    activeSessionRevision: () => revision,
    request: async (path: string): Promise<never> => {
      assert.equal(path, "/dashboard/period?start=2026-11-20&end=2026-11-26");
      if (replaceSessionOnRequest) revision++;
      throw new ApiError("Request failed", failureStatus);
    },
  };
  const session = { organizerId: organizer.id, revision };
  assert.deepEqual(await loadDashboardPeriod(mock, session, period), { kind: "legacy" });
  failureStatus = 403;
  await assert.rejects(loadDashboardPeriod(mock, session, period), /Request failed/);
  replaceSessionOnRequest = true;
  assert.deepEqual(await loadDashboardPeriod(mock, session, period), { kind: "stale" });
});

test("share never exposes a draft, private test API, mismatched campaign, arbitrary host or unsafe slug", () => {
  const request = { id: "c1", slug: "boa-campanha" };
  const publicDetail = { ...request, status: "PUBLISHED" };
  assert.equal(organizerCampaignShareUrl(QA_API, request, publicDetail),
    "https://sortex-qa-privada.workspace-de-1136.chatgpt.site/campanha/boa-campanha");
  for (const candidate of [
    { ...publicDetail, id: "c2" }, { ...publicDetail, slug: "outro" },
    { ...publicDetail, status: "DRAFT" }, { ...publicDetail, publicationBlocked: true },
  ]) assert.equal(organizerCampaignShareUrl(QA_API, request, candidate), null);
  assert.equal(organizerCampaignShareUrl("https://other.example.test", request, publicDetail), null);
  assert.equal(organizerCampaignShareUrl(QA_API, { ...request, slug: ".." }, { ...publicDetail, slug: ".." }), null);
});

test("Mais catalog retains all requested modules and distinguish real native routes from unavailability", () => {
  assert.deepEqual(organizerGroups.map((group) => group.entries.length), [6, 6, 4]);
  for (const { entries } of organizerGroups) for (const item of entries) {
    assert.ok("route" in item ? !("unavailable" in item) : !!item.unavailable);
  }
});

test("Web and native use the same server UTC fallback at 01:30Z, without shifting custom dates", async () => {
  const web = await import("../../web/lib/api/dashboard-period");
  const generatedAt = "2026-11-27T01:30:00.000Z";
  assert.equal(dayInSaoPaulo(generatedAt), "2026-11-26");
  assert.equal(web.todayInSaoPaulo(new Date(generatedAt)), "2026-11-26");
  assert.equal(DEFAULT_DASHBOARD_PERIOD, "month");
  assert.equal(web.DEFAULT_DASHBOARD_PERIOD, DEFAULT_DASHBOARD_PERIOD);
  const ranges = [
    ["today", "2026-11-27"],
    ["week", "2026-11-21"],
    ["month", "2026-10-29"],
    ["year", "2025-12-01"],
  ] as const;
  const history = [
    { date: "2025-11-30", revenue: 1000 },
    { date: "2026-11-24", revenue: 10.01 },
    { date: "2026-11-25", revenue: 10.02 },
    { date: "2026-11-26", revenue: 70.03 },
    { date: "2026-11-27", revenue: 0.17 },
    { date: "2026-11-28", revenue: 1000 },
  ];
  for (const [preset, start] of ranges) {
    const expected = { start, end: "2026-11-27" };
    assert.deepEqual(legacyUtcRange(generatedAt, preset, null), expected);
    assert.deepEqual(web.legacyUtcRange(generatedAt, preset, null), expected);
    assert.deepEqual(chartFor(history, expected), web.salesChart(history, expected).map((row) => row.revenue));
  }
  assert.deepEqual(chartFor(history, legacyUtcRange(generatedAt, "today", null)!), [0.17]);
  assert.deepEqual(chartFor(history, periodFor("today", dayInSaoPaulo(generatedAt))), [70.03]);

  const custom = { start: "2026-11-23", end: "2026-11-26" };
  assert.deepEqual(legacyUtcRange(generatedAt, "custom", custom), custom);
  assert.deepEqual(web.legacyUtcRange(generatedAt, "custom", custom), custom);
  const unsupported = { start: "2025-11-30", end: "2026-01-01" };
  assert.equal(legacyHistoryCovers(generatedAt, unsupported), false);
  assert.equal(web.legacyHistoryCovers(generatedAt, unsupported), false);
  for (const invalidClock of [null, "2026-11-27", "2026-11-26T22:30:00.000-03:00", "invalid"]) {
    assert.equal(legacyUtcRange(invalidClock, "today", null), null);
    assert.equal(web.legacyUtcRange(invalidClock, "today", null), null);
  }
});

test("sales ticket geometry renders real increases in order without fabricating a value", () => {
  const shape = organizerRevenueGeometry([0, 13, 26]);
  assert.equal(shape?.maximum, 26);
  assert.equal(shape?.points, "2,59 150,32.5 298,6");
  assert.equal(shape?.area, "M2 59 L2 59 L150 32.5 L298 6 L298 59 Z");
});

test("sales ticket keeps a true zero as a flat line and does not invent missing values", () => {
  assert.equal(organizerRevenueGeometry([0])?.points, "2,59 298,59");
  assert.equal(organizerRevenueGeometry([25])?.points, "2,6 298,6");
  assert.equal(organizerRevenueGeometry([]), null);
  assert.equal(organizerRevenueGeometry([0, NaN]), null);
  assert.equal(organizerRevenueGeometry([0, -1]), null);
});
