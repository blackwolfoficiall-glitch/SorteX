import { ApiError } from "../api/client";
import { organizerDashboardSession, type DashboardClient, type DashboardSession } from "./dashboard";

export type DayRevenue = { date: string; revenue: number };
export type Period = { start: string; end: string };
export type PeriodKey = "today" | "week" | "month" | "year" | "custom";
export type PeriodDashboard = {
  period: Period;
  summary: { grossRevenue: number; soldTickets: number; participants: number; averageTicket: number; paidOrders: number };
  revenueHistory?: DayRevenue[];
};
const tz = "America/Sao_Paulo";
const DAY_MS = 86_400_000;
const dayFormat = new Intl.DateTimeFormat("sv-SE", {
  timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
});
const isoDay = (n: number) => new Date(n).toISOString().slice(0, 10);
const stamp = (day: string) => Date.parse(day + "T00:00:00Z");

export const validDay = (day: unknown): day is string =>
  typeof day === "string" && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(day) && Number.isFinite(stamp(day)) && isoDay(stamp(day)) === day;
export const validAmount = (amount: unknown): amount is number =>
  typeof amount === "number" && Number.isFinite(amount) && amount >= 0 && amount <= Number.MAX_SAFE_INTEGER / 100;
const validCount = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

export function dayInSaoPaulo(now: string | Date) {
  const parts = Object.fromEntries(dayFormat.formatToParts(new Date(now)).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function periodFor(key: Exclude<PeriodKey, "custom">, end: string): Period {
  const date = new Date(stamp(end));
  if (key === "year") {
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() - 11);
  } else date.setUTCDate(date.getUTCDate() - (key === "week" ? 6 : key === "month" ? 29 : 0));
  return { start: isoDay(date.getTime()), end };
}

export function parseCustomPeriod(from: string, to: string, today: string): Period | null {
  const convert = (input: string) => {
    const parts = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(input.trim());
    return parts ? `${parts[3]}-${parts[2]}-${parts[1]}` : "";
  };
  const [start, end] = [convert(from), convert(to)];
  return validDay(start) && validDay(end) && start >= "2000-01-01" && start <= end && end <= today &&
    stamp(end) - stamp(start) <= 366 * DAY_MS ? { start, end } : null;
}

export function parseRevenueHistory(payload: unknown, period?: Period): DayRevenue[] {
  const invalid = () => new Error("A API não devolveu um histórico válido para o painel.");
  if (!Array.isArray(payload) || payload.length > 367) throw invalid();
  let after = "";
  return payload.map((value: unknown) => {
    const { date, revenue } = (value ?? {}) as Partial<DayRevenue>;
    if (!validDay(date) || date <= after || !validAmount(revenue) ||
        (period && (date < period.start || date > period.end))) throw invalid();
    after = date;
    return { date, revenue };
  });
}

export function parsePeriodDashboard(payload: unknown, expected: Period): PeriodDashboard {
  const data = (payload ?? {}) as Partial<PeriodDashboard> & { version?: number; period?: {timeZone?: string} };
  const summary = data.summary;
  if (data.version !== 1 || data.period?.start !== expected.start || data.period?.end !== expected.end ||
      data.period?.timeZone !== tz || !summary || !validAmount(summary.grossRevenue) ||
      !validAmount(summary.averageTicket) || !validCount(summary.soldTickets) ||
      !validCount(summary.participants) || !validCount(summary.paidOrders) ||
      summary.participants > summary.paidOrders ||
      (summary.paidOrders === 0 && (summary.grossRevenue !== 0 || summary.averageTicket !== 0 || summary.soldTickets !== 0)))
    throw new Error("A API não devolveu indicadores válidos para o período.");
  const revenueHistory = data.revenueHistory === undefined ? undefined : parseRevenueHistory(data.revenueHistory, expected);
  return {
    period: expected, summary: {
      grossRevenue: summary.grossRevenue, averageTicket: summary.averageTicket,
      soldTickets: summary.soldTickets, participants: summary.participants, paidOrders: summary.paidOrders,
    }, ...(revenueHistory ? { revenueHistory } : {}),
  };
}

export async function loadDashboardPeriod(client: DashboardClient, session: DashboardSession, period: Period) {
  const same = () => {
    const active = organizerDashboardSession(client);
    return active?.organizerId === session.organizerId && active.revision === session.revision;
  };
  if (!same()) return { kind: "stale" } as const;
  try {
    const payload = await client.request<unknown>(`/dashboard/period?start=${encodeURIComponent(period.start)}&end=${encodeURIComponent(period.end)}`);
    if (!same()) return { kind: "stale" } as const;
    return { kind: "ok", data: parsePeriodDashboard(payload, period) } as const;
  } catch (error) {
    if (!same()) return { kind: "stale" } as const;
    if (error instanceof ApiError && error.status === 404) return { kind: "legacy" } as const;
    throw error;
  }
}

export function chartFor(history: DayRevenue[], period: Period): number[] {
  const days = (stamp(period.end) - stamp(period.start)) / DAY_MS + 1;
  const buckets = days > 45 ? 12 : days > 14 ? 10 : days;
  const amounts = Array<number>(buckets).fill(0);
  for (const row of history) {
    if (row.date >= period.start && row.date <= period.end) {
      const day = (stamp(row.date) - stamp(period.start)) / DAY_MS;
      amounts[Math.floor(day * buckets / days)]! += row.revenue;
    }
  }
  return amounts;
}
