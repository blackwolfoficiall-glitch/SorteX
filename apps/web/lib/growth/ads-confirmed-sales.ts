export const adsSalesPeriods = [
  ["TODAY", "Hoje"],
  ["YESTERDAY", "Ontem"],
  ["7D", "7 dias"],
  ["15D", "15 dias"],
  ["30D", "30 dias"],
  ["90D", "90 dias"],
  ["CUSTOM", "Personalizado"],
] as const;

export type AdsSalesFilter = {
  period: (typeof adsSalesPeriods)[number][0];
  campaignId: string;
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
  attribution: Array<SalesMetrics & { origin: "AFFILIATE" | "UNKNOWN" }>;
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
    !isRecord(value.attribution) ||
    value.attribution.model !== "APPROVED_AFFILIATE_CONVERSION_ONLY" ||
    !Array.isArray(value.attribution.channels) ||
    value.attribution.channels.length !== 2 ||
    !Array.isArray(value.daily) ||
    value.daily.length > 366
  ) {
    return invalid();
  }
  const { fromDate, toDateExclusive } = value.period;
  if (
    filters.period === "CUSTOM" &&
    (fromDate !== filters.startDate ||
      Date.parse(toDateExclusive) - Date.parse(filters.endDate) !== 86_400_000)
  )
    return invalid();
  const channels: unknown[] = value.attribution.channels;
  const attribution = (["AFFILIATE", "UNKNOWN"] as const).map((origin) => {
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
  return { period: { fromDate, toDateExclusive }, totals, daily, attribution };
}

export function confirmedAdsQuery(filters: AdsSalesFilter) {
  const query = new URLSearchParams({ period: filters.period });
  if (filters.campaignId) query.set("campaignId", filters.campaignId);
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
