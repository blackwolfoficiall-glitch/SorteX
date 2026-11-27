import test from "node:test";
import assert from "node:assert/strict";
import {
  confirmedAdsQuery,
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
