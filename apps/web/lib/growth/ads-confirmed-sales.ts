export const adsSalesPeriods = [
  ["TODAY", "Hoje"],
  ["YESTERDAY", "Ontem"],
  ["7D", "7 dias"],
  ["15D", "15 dias"],
  ["30D", "30 dias"],
  ["90D", "90 dias"],
  ["CUSTOM", "Personalizado"],
] as const;

export const originOptions = [
  ["ALL", "Todas as origens"],
  ["AFFILIATE", "Afiliados verificados"],
  ["UNKNOWN", "Origem não identificada"],
] as const;

export const adsReportingProviders = [
  "META_ADS",
  "GOOGLE_ADS",
  "TIKTOK_ADS",
] as const;

type OrderOrigin = (typeof originOptions)[1 | 2][0];
export type OriginFilter = (typeof originOptions)[number][0];

const dayMs = 86_400_000;

export type AdsSalesFilter = {
  period: (typeof adsSalesPeriods)[number][0];
  campaignId: string;
  origin?: OriginFilter;
  startDate: string;
  endDate: string;
};

type SalesMetrics = {
  confirmedOrders: number;
  buyers: number;
  titlesSold: number;
  paidOrderValue: string;
  averageOrderValue: string | null;
};

export type ConfirmedAdsSales = {
  period: { fromDate: string; toDateExclusive: string };
  totals: SalesMetrics;
  daily: Array<SalesMetrics & { date: string }>;
  attribution: Array<SalesMetrics & { origin: OrderOrigin }>;
  originFilter: OriginFilter;
  supportsOriginFilter: boolean;
  readOnlyReportingProviders: Array<(typeof adsReportingProviders)[number]>;
};

const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const moneyPattern = /^\d{1,30}\.\d{2}$/;
function isDay(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !dayPattern.test(value) ||
    value.startsWith("0000")
  )
    return false;
  const date = Date.parse(value + "T00:00:00.000Z");
  return (
    Number.isFinite(date) && new Date(date).toISOString().slice(0, 10) === value
  );
}

function invalid(): never {
  throw new Error("O relatório de vendas confirmadas não pôde ser validado.");
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const count = (value: unknown): number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : invalid();
const money = (value: unknown): string =>
  typeof value === "string" && moneyPattern.test(value) ? value : invalid();

function metrics(value: unknown): SalesMetrics {
  if (!isRecord(value)) return invalid();
  return {
    confirmedOrders: count(value.confirmedOrders),
    buyers: count(value.buyers),
    titlesSold: count(value.titlesSold),
    paidOrderValue: money(value.paidOrderValue),
    averageOrderValue:
      value.averageOrderValue === null ? null : money(value.averageOrderValue),
  };
}

export function parseConfirmedAdsSales(
  value: unknown,
  filters: AdsSalesFilter,
): ConfirmedAdsSales {
  const originFilter = filters.origin ?? "ALL";
  const expectedOrigins: OrderOrigin[] =
    originFilter === "ALL" ? ["AFFILIATE", "UNKNOWN"] : [originFilter];
  if (
    !isRecord(value) ||
    value.source !== "SORTEX_CONFIRMED_PURCHASES" ||
    value.currency !== "BRL" ||
    !isRecord(value.period) ||
    value.period.key !== filters.period ||
    value.period.timeZone !== "America/Sao_Paulo" ||
    !isDay(value.period.fromDate) ||
    !isDay(value.period.toDateExclusive) ||
    value.period.fromDate >= value.period.toDateExclusive ||
    value.campaignId !== (filters.campaignId || null) ||
    (value.originFilter === undefined && originFilter !== "ALL") ||
    (value.originFilter !== undefined && value.originFilter !== originFilter) ||
    !isRecord(value.attribution) ||
    value.attribution.model !== "APPROVED_AFFILIATE_CONVERSION_ONLY" ||
    !Array.isArray(value.attribution.channels) ||
    value.attribution.channels.length !== expectedOrigins.length ||
    !Array.isArray(value.daily) ||
    value.daily.length > 366
  ) {
    return invalid();
  }
  const { fromDate, toDateExclusive } = value.period;
  const calendarDays =
    (Date.parse(toDateExclusive) - Date.parse(fromDate)) / dayMs;
  if (!Number.isInteger(calendarDays) || calendarDays < 1 || calendarDays > 366)
    return invalid();
  if (
    filters.period === "CUSTOM" &&
    (fromDate !== filters.startDate ||
      Date.parse(toDateExclusive) - Date.parse(filters.endDate) !== dayMs)
  )
    return invalid();
  const channels: unknown[] = value.attribution.channels;
  const attribution = expectedOrigins.map((origin) => {
    const rows = channels.filter(
      (row) => isRecord(row) && row.origin === origin,
    );
    if (rows.length !== 1) return invalid();
    return { origin, ...metrics(rows[0]) };
  });
  const seen = new Set<string>();
  const daily = value.daily.map((row: unknown) => {
    if (
      !isRecord(row) ||
      !isDay(row.date) ||
      seen.has(row.date) ||
      row.date < fromDate ||
      row.date >= toDateExclusive
    )
      return invalid();
    seen.add(row.date);
    return { ...metrics(row), date: row.date };
  });
  const totals = metrics(value.totals);
  const cents = (value: string) => BigInt(value.replace(".", ""));
  for (const rows of [daily, attribution]) {
    if (
      rows.reduce((total, row) => total + row.confirmedOrders, 0) !==
        totals.confirmedOrders ||
      rows.reduce((total, row) => total + row.titlesSold, 0) !==
        totals.titlesSold ||
      rows.reduce(
        (total, row) => total + cents(row.paidOrderValue),
        BigInt(0),
      ) !== cents(totals.paidOrderValue)
    )
      return invalid();
  }
  const providerRows: unknown[] =
    isRecord(value.paidMedia) &&
    value.paidMedia.status === "UNAVAILABLE" &&
    Array.isArray(value.paidMedia.reportingProviders)
      ? value.paidMedia.reportingProviders
      : [];
  const readOnlyReportingProviders = adsReportingProviders.filter(
    (provider) =>
      providerRows.filter((row) => isRecord(row) && row.provider === provider)
        .length === 1 &&
      providerRows.some(
        (row) =>
          isRecord(row) &&
          row.provider === provider &&
          row.intendedCapability === "READ_ONLY_REPORTING" &&
          row.status === "DISABLED" &&
          row.canReadProviderData === false &&
          row.canPublish === false &&
          row.canChangeBudget === false,
      ),
  );
  return {
    period: { fromDate, toDateExclusive },
    totals,
    daily,
    attribution,
    originFilter,
    supportsOriginFilter: value.originFilter !== undefined,
    readOnlyReportingProviders,
  };
}

export function confirmedAdsQuery(filters: AdsSalesFilter) {
  const query = new URLSearchParams({ period: filters.period });
  if (filters.campaignId) query.set("campaignId", filters.campaignId);
  if (filters.origin && filters.origin !== "ALL")
    query.set("origin", filters.origin);
  if (filters.period === "CUSTOM") {
    if (
      !isDay(filters.startDate) ||
      !isDay(filters.endDate) ||
      filters.startDate > filters.endDate
    ) {
      throw new Error("Informe as datas inicial e final em ordem cronológica.");
    }
    query.set("startDate", filters.startDate);
    query.set("endDate", filters.endDate);
  }
  return query.toString();
}

export function summarizeConfirmedAdsOrigins(
  data: Pick<ConfirmedAdsSales, "originFilter" | "totals" | "attribution">,
) {
  if (data.originFilter !== "ALL") {
    return { kind: "FILTERED", origin: data.originFilter } as const;
  }
  if (!data.totals.confirmedOrders) return { kind: "EMPTY" } as const;

  const affiliateOrders =
    data.attribution.find((row) => row.origin === "AFFILIATE")
      ?.confirmedOrders ?? 0;
  const unknownOrders =
    data.attribution.find((row) => row.origin === "UNKNOWN")?.confirmedOrders ??
    0;
  // The paid-report contract currently recognizes one verified origin.
  // UNKNOWN remains a coverage gap, never a candidate in an origin ranking.
  if (!affiliateOrders) {
    return { kind: "UNKNOWN_ONLY", unknownOrders } as const;
  }
  return {
    kind: "KNOWN_AFFILIATE",
    affiliateOrders,
    unknownOrders,
    equalCoverage: affiliateOrders === unknownOrders,
  } as const;
}

export function confirmedAdsTimeline(data: ConfirmedAdsSales) {
  const start = Date.parse(data.period.fromDate);
  const count = (Date.parse(data.period.toDateExclusive) - start) / dayMs;
  if (!Number.isInteger(count) || count < 1 || count > 366) return [];
  const ordersByDay = new Map(
    data.daily.map((row) => [row.date, row.confirmedOrders]),
  );
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start + index * dayMs).toISOString().slice(0, 10);
    return { date, orders: ordersByDay.get(date) ?? 0 };
  });
}

const amountFormat = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatConfirmedAdsMoney(value: string | null) {
  if (value === null) return "Não disponível";
  const [reais, centavos] = money(value).split(".");
  return amountFormat
    .formatToParts(BigInt(reais))
    .map(({ type, value }) => (type === "fraction" ? centavos : value))
    .join("");
}
