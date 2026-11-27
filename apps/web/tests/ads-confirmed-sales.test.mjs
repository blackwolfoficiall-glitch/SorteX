import test from "node:test";
import assert from "node:assert/strict";
import {
  confirmedAdsQuery,
  confirmedAdsTimeline,
  formatConfirmedAdsMoney,
  parseConfirmedAdsSales,
} from "../lib/growth/ads-confirmed-sales.ts";

const filter = { period: "30D", campaignId: "", startDate: "", endDate: "" };
const metrics = (
  confirmedOrders,
  paidOrderValue,
  titlesSold = confirmedOrders,
) => ({
  confirmedOrders,
  buyers: confirmedOrders,
  titlesSold,
  paidOrderValue,
  averageOrderValue: confirmedOrders > 0 ? paidOrderValue : null,
});
const fixture = () => ({
  source: "SORTEX_CONFIRMED_PURCHASES",
  currency: "BRL",
  campaignId: null,
  period: {
    key: "30D",
    timeZone: "America/Sao_Paulo",
    fromDate: "2026-11-01",
    toDateExclusive: "2026-12-01",
  },
  totals: metrics(1, "9007199254740992.01", 2),
  daily: [{ date: "2026-11-20", ...metrics(1, "9007199254740992.01", 2) }],
  attribution: {
    model: "APPROVED_AFFILIATE_CONVERSION_ONLY",
    channels: [
      { origin: "AFFILIATE", ...metrics(0, "0.00") },
      { origin: "UNKNOWN", ...metrics(1, "9007199254740992.01", 2) },
    ],
  },
});

test("formats exact BRL cents even above the JS safe integer range and distinguishes unavailable", () => {
  assert.equal(
    formatConfirmedAdsMoney("9007199254740992.01").replace(/\s/g, " "),
    "R$ 9.007.199.254.740.992,01",
  );
  assert.equal(formatConfirmedAdsMoney("0.00").replace(/\s/g, " "), "R$ 0,00");
  assert.equal(formatConfirmedAdsMoney(null), "Não disponível");
});

test("uses only verified aggregates and rejects stale filters and vendor data", () => {
  const value = fixture();
  const data = parseConfirmedAdsSales(
    { ...value, paidMedia: { roas: 99 } },
    filter,
  );
  assert.equal(data.attribution[1].origin, "UNKNOWN");
  assert.equal("paidMedia" in data, false);
  assert.throws(() =>
    parseConfirmedAdsSales({ ...value, source: "META_ADS" }, filter),
  );
  assert.throws(() =>
    parseConfirmedAdsSales(value, {
      ...filter,
      campaignId: "not-this-campaign",
    }),
  );
  assert.throws(() =>
    parseConfirmedAdsSales(value, { ...filter, period: "90D" }),
  );
});

test("rejects double counting and ambiguous origins without displaying zeros as fallback", () => {
  const value = fixture();
  assert.throws(() =>
    parseConfirmedAdsSales(
      { ...value, daily: [...value.daily, ...value.daily] },
      filter,
    ),
  );
  assert.throws(() =>
    parseConfirmedAdsSales(
      { ...value, totals: metrics(2, "9007199254740992.01", 2) },
      filter,
    ),
  );
  assert.throws(() =>
    parseConfirmedAdsSales(
      {
        ...value,
        attribution: {
          ...value.attribution,
          channels: value.attribution.channels.map((row) => ({
            ...row,
            origin: "UNKNOWN",
          })),
        },
      },
      filter,
    ),
  );
  assert.throws(() => parseConfirmedAdsSales({}, filter));
});

test("encodes only the supported filters and requires ordered custom dates", () => {
  assert.equal(
    confirmedAdsQuery({
      ...filter,
      period: "YESTERDAY",
      startDate: "2026-11-19",
    }),
    "period=YESTERDAY",
  );
  assert.equal(
    confirmedAdsQuery({
      ...filter,
      period: "CUSTOM",
      startDate: "2026-11-09",
      endDate: "2026-11-12",
      campaignId: "r1",
    }),
    "period=CUSTOM&campaignId=r1&startDate=2026-11-09&endDate=2026-11-12",
  );
  assert.throws(() =>
    confirmedAdsQuery({
      ...filter,
      period: "CUSTOM",
      startDate: "2026-11-12",
      endDate: "2026-11-09",
    }),
  );
});

test("filters only internal origins and remains readable against the older aggregate contract", () => {
  const value = fixture();
  assert.equal(
    parseConfirmedAdsSales(value, filter).supportsOriginFilter,
    false,
  );
  assert.throws(() =>
    parseConfirmedAdsSales(value, { ...filter, origin: "UNKNOWN" }),
  );
  const selected = {
    ...value,
    originFilter: "UNKNOWN",
    attribution: {
      ...value.attribution,
      channels: [value.attribution.channels[1]],
    },
  };
  const parsed = parseConfirmedAdsSales(selected, {
    ...filter,
    origin: "UNKNOWN",
  });
  assert.equal(parsed.originFilter, "UNKNOWN");
  assert.equal(parsed.supportsOriginFilter, true);
  assert.deepEqual(
    parsed.attribution.map(({ origin }) => origin),
    ["UNKNOWN"],
  );
  assert.throws(() =>
    parseConfirmedAdsSales(selected, { ...filter, origin: "AFFILIATE" }),
  );
  assert.equal(
    confirmedAdsQuery({ ...filter, origin: "UNKNOWN" }),
    "period=30D&origin=UNKNOWN",
  );
  assert.equal(confirmedAdsQuery({ ...filter, origin: "ALL" }), "period=30D");
});

test("shows only explicitly disabled reporting capability and no vendor metrics", () => {
  const disabled = {
    intendedCapability: "READ_ONLY_REPORTING",
    status: "DISABLED",
    canReadProviderData: false,
    canPublish: false,
    canChangeBudget: false,
  };
  const data = parseConfirmedAdsSales(
    {
      ...fixture(),
      paidMedia: {
        status: "UNAVAILABLE",
        reportingProviders: [
          { provider: "META_ADS", ...disabled, roas: 99 },
          { provider: "GOOGLE_ADS", ...disabled, canChangeBudget: true },
          { provider: "TIKTOK_ADS", ...disabled },
          { provider: "OTHER", ...disabled },
        ],
      },
    },
    filter,
  );
  assert.deepEqual(data.readOnlyReportingProviders, ["META_ADS", "TIKTOK_ADS"]);
  assert.equal("paidMedia" in data, false);
});

test("plots a calendar day for every position without shifting holes", () => {
  const data = parseConfirmedAdsSales(fixture(), filter);
  const days = confirmedAdsTimeline(data);
  assert.equal(days.length, 30);
  assert.deepEqual(days[18], { date: "2026-11-19", orders: 0 });
  assert.deepEqual(days[19], { date: "2026-11-20", orders: 1 });
  assert.deepEqual(days[29], { date: "2026-11-30", orders: 0 });
  const unsupported = fixture();
  unsupported.period.toDateExclusive = "2030-01-01";
  assert.throws(() => parseConfirmedAdsSales(unsupported, filter));
});
