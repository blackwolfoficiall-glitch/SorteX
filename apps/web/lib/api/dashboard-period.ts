export const DASHBOARD_ZONE = "America/Sao_Paulo";
const DAY_MS = 86_400_000;
const MAX_DAYS = 367;
const formatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: DASHBOARD_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export type PeriodRange = { start: string; end: string };
export type PeriodPreset = "today" | "week" | "month" | "year";
export const DEFAULT_DASHBOARD_PERIOD = "month" satisfies PeriodPreset;
export type RevenuePoint = { date: string; revenue: number };
type PeriodSummary = {
  grossRevenue: number;
  soldTickets: number;
  participants: number;
  averageTicket: number;
  paidOrders: number;
};
export type DashboardPeriod = {
  period: PeriodRange;
  summary: PeriodSummary;
  revenueHistory: RevenuePoint[];
};

function stamp(day: string) {
  return Date.parse(day + "T00:00:00Z");
}
function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}
function validDay(day: unknown): day is string {
  return (
    typeof day === "string" &&
    /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(day) &&
    Number.isFinite(stamp(day)) &&
    isoDay(new Date(stamp(day))) === day
  );
}

export function todayInSaoPaulo(now = new Date()) {
  const fields = Object.fromEntries(
    formatter.formatToParts(now).map(({ type, value }) => [type, value]),
  );
  return `${fields.year}-${fields.month}-${fields.day}`;
}

export function queryPeriod(
  params: URLSearchParams,
  today = todayInSaoPaulo(),
) {
  if (
    [...params.keys()].length !== 2 ||
    params.getAll("start").length !== 1 ||
    params.getAll("end").length !== 1
  )
    return null;
  return validatePeriod(params.get("start"), params.get("end"), today);
}

export function validatePeriod(start: unknown, end: unknown, today: string) {
  if (
    !validDay(start) ||
    !validDay(end) ||
    start < "2000-01-01" ||
    start > end ||
    end > today ||
    (stamp(end) - stamp(start)) / DAY_MS >= MAX_DAYS
  )
    return null;
  return { start, end };
}

export function presetPeriod(preset: PeriodPreset, end: string): PeriodRange {
  const start = new Date(stamp(end));
  if (preset === "year") {
    start.setUTCDate(1);
    start.setUTCMonth(start.getUTCMonth() - 11);
  } else {
    start.setUTCDate(
      start.getUTCDate() -
        (preset === "month" ? 29 : preset === "week" ? 6 : 0),
    );
  }
  return { start: isoDay(start), end };
}

const validAmount = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= Number.MAX_SAFE_INTEGER / 100;
const validCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

export function parseRevenueHistory(
  history: unknown,
  period?: PeriodRange,
): RevenuePoint[] {
  const invalid = () =>
    new Error("A API não devolveu um histórico válido para o painel.");
  if (!Array.isArray(history) || history.length > MAX_DAYS) throw invalid();
  let last = "";
  return history.map((point) => {
    const { date, revenue } = (point ?? {}) as Partial<RevenuePoint>;
    if (
      !validDay(date) ||
      date <= last ||
      !validAmount(revenue) ||
      (period && (date < period.start || date > period.end))
    )
      throw invalid();
    last = date;
    return { date, revenue };
  });
}

export function parseDashboardPeriod(
  payload: unknown,
  expected: PeriodRange,
): DashboardPeriod {
  const value = (payload ?? {}) as Partial<DashboardPeriod> & {
    version?: number;
    period?: { timeZone?: string };
  };
  const summary = value.summary;
  if (
    value.version !== 1 ||
    value.period?.timeZone !== DASHBOARD_ZONE ||
    value.period.start !== expected.start ||
    value.period.end !== expected.end ||
    !summary ||
    !validAmount(summary.grossRevenue) ||
    !validAmount(summary.averageTicket) ||
    !validCount(summary.soldTickets) ||
    !validCount(summary.participants) ||
    !validCount(summary.paidOrders) ||
    summary.participants > summary.paidOrders ||
    (summary.paidOrders === 0 &&
      (summary.grossRevenue !== 0 ||
        summary.averageTicket !== 0 ||
        summary.soldTickets !== 0))
  )
    throw new Error("A API não devolveu indicadores válidos para o período.");
  return {
    period: expected,
    summary: {
      grossRevenue: summary.grossRevenue,
      averageTicket: summary.averageTicket,
      soldTickets: summary.soldTickets,
      participants: summary.participants,
      paidOrders: summary.paidOrders,
    },
    revenueHistory: parseRevenueHistory(value.revenueHistory, expected),
  };
}

export function parseLegacyPeriodMetrics(summary: unknown) {
  const raw = (summary ?? {}) as Partial<PeriodSummary>;
  if (
    !validCount(raw.soldTickets) ||
    !validCount(raw.participants) ||
    (raw.averageTicket !== undefined && !validAmount(raw.averageTicket))
  )
    return null;
  return {
    soldTickets: raw.soldTickets,
    participants: raw.participants,
    averageTicket: raw.averageTicket,
  };
}

/** Old /dashboard rows were grouped by UTC, not Brasilia. Use its own clock. */
export function legacyUtcRange(
  generatedAt: unknown,
  preset: PeriodPreset | "custom",
  custom: PeriodRange | null,
): PeriodRange | null {
  if (typeof generatedAt !== "string") return null;
  const generated = new Date(generatedAt);
  if (
    !Number.isFinite(generated.getTime()) ||
    generated.toISOString() !== generatedAt
  )
    return null;
  const utcToday = isoDay(generated);
  return preset === "custom"
    ? validatePeriod(custom?.start, custom?.end, utcToday)
    : presetPeriod(preset, utcToday);
}

export function legacyHistoryCovers(generatedAt: unknown, period: PeriodRange) {
  const supported = legacyUtcRange(generatedAt, "year", null);
  return !!supported &&
    !!validatePeriod(period.start, period.end, supported.end) &&
    period.start >= supported.start;
}

export function salesChart(history: RevenuePoint[], period: PeriodRange) {
  const start = stamp(period.start);
  const days = (stamp(period.end) - start) / DAY_MS + 1;
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) return [];
  const count = days > 45 ? 12 : days > 14 ? 10 : days;
  const buckets = Array.from({ length: count }, (_, index) => ({
    first: isoDay(new Date(start + Math.ceil((index * days) / count) * DAY_MS)),
    last: isoDay(
      new Date(start + (Math.ceil(((index + 1) * days) / count) - 1) * DAY_MS),
    ),
    cents: 0,
  }));
  for (const row of history) {
    if (row.date < period.start || row.date > period.end) continue;
    const bucket = Math.floor(
      (((stamp(row.date) - start) / DAY_MS) * count) / days,
    );
    const target = buckets[bucket];
    if (target) target.cents += Math.round(row.revenue * 100);
  }
  return buckets.map(({ first, last, cents }) => ({
    first,
    last,
    revenue: cents / 100,
  }));
}
