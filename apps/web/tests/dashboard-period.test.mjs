import assert from "node:assert/strict";
import { test } from "node:test";
import {
  legacyHistoryCovers,
  parseDashboardPeriod,
  parseLegacyPeriodMetrics,
  presetPeriod,
  queryPeriod,
  salesChart,
  todayInSaoPaulo,
  validatePeriod,
} from "../lib/api/dashboard-period.ts";

test("uses São Paulo's civil day and the same date boundaries as mobile", () => {
  assert.equal(
    todayInSaoPaulo(new Date("2026-11-27T02:59:59.999Z")),
    "2026-11-26",
  );
  assert.equal(
    todayInSaoPaulo(new Date("2026-11-27T03:00:00.000Z")),
    "2026-11-27",
  );
  const today = "2026-11-27";
  const starts = [
    ["today", "2026-11-27"],
    ["week", "2026-11-21"],
    ["month", "2026-10-29"],
    ["year", "2025-12-01"],
  ];
  for (const [preset, start] of starts)
    assert.deepEqual(presetPeriod(preset, today), { start, end: today });
});

test("accepts bounded custom ranges and refuses malformed/duplicated queries", () => {
  const now = "2026-11-27",
    end = "2026-11-27";
  assert.deepEqual(validatePeriod("2025-11-26", end, now), {
    start: "2025-11-26",
    end,
  });
  assert.deepEqual(validatePeriod("2024-02-29", "2024-02-29", now), {
    start: "2024-02-29",
    end: "2024-02-29",
  });
  for (const text of [
    "start=2025-11-25&end=2026-11-27",
    "start=2026-11-28&end=2026-11-28",
    "start=2025-02-29&end=2025-03-01",
    "start=2026-11-26&end=2026-11-25",
    "start=2026-11-25&end=2026-11-26&organizerId=another",
    "start=2026-11-25&start=2026-11-25&end=2026-11-26",
    "start=2026-11-25%0A&end=2026-11-26",
    "end=2026-11-26",
  ])
    assert.equal(queryPeriod(new URLSearchParams(text), now), null, text);
});

test("guards matching scoped payloads, positive metrics, and sorted sparse series", () => {
  const period = { start: "2026-11-25", end: "2026-11-27" };
  const data = {
    version: 1,
    period: { ...period, timeZone: "America/Sao_Paulo" },
    summary: {
      grossRevenue: 25.01,
      averageTicket: 12.51,
      soldTickets: 4,
      participants: 1,
      paidOrders: 2,
    },
    revenueHistory: [
      { date: "2026-11-25", revenue: 10 },
      { date: "2026-11-27", revenue: 15.01 },
    ],
  };
  assert.deepEqual(parseDashboardPeriod(data, period).summary, data.summary);
  for (const invalid of [
    { version: 2 },
    { period: { ...period, timeZone: "UTC" } },
    { period: { ...data.period, end: "2026-11-26" } },
    { summary: { ...data.summary, participants: 4 } },
    { summary: { ...data.summary, averageTicket: Infinity } },
    { revenueHistory: data.revenueHistory.toReversed() },
    {
      revenueHistory: [
        ...data.revenueHistory,
        { date: "2026-11-28", revenue: 1 },
      ],
    },
    { revenueHistory: undefined },
  ])
    assert.throws(() => parseDashboardPeriod({ ...data, ...invalid }, period));
});

test("aggregates in cents without mistaking lack of legacy coverage for zero", () => {
  const period = { start: "2026-01-01", end: "2026-01-31" };
  const buckets = salesChart(
    [
      { date: "2025-12-31", revenue: 100 },
      { date: "2026-01-01", revenue: 0.01 },
      { date: "2026-01-04", revenue: 0.02 },
      { date: "2026-01-05", revenue: 0.03 },
      { date: "2026-01-31", revenue: 12.07 },
      { date: "2026-02-01", revenue: 100 },
    ],
    period,
  );
  assert.equal(buckets.length, 10);
  assert.deepEqual(buckets[0], {
    first: "2026-01-01",
    last: "2026-01-04",
    revenue: 0.03,
  });
  assert.equal(buckets[1].revenue, 0.03);
  assert.equal(buckets.at(-1).revenue, 12.07);
  assert.equal(legacyHistoryCovers("2026-12-10T20:00:00.000Z", period), true);
  assert.equal(legacyHistoryCovers("2027-01-10T20:00:00.000Z", period), false);
  assert.equal(legacyHistoryCovers("invalid", period), false);
  assert.equal(
    parseLegacyPeriodMetrics({
      soldTickets: 3,
      participants: "3",
      averageTicket: 5,
    }),
    null,
  );
  assert.deepEqual(
    parseLegacyPeriodMetrics({
      soldTickets: 3,
      participants: 1,
      averageTicket: 5,
    }),
    {
      soldTickets: 3,
      participants: 1,
      averageTicket: 5,
    },
  );
});
