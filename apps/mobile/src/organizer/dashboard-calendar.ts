import { validDay } from "./dashboard-period";

export type CalendarField = "start" | "end";
export type CalendarDates = Record<CalendarField, string>;
export type CalendarLimits = { min: string; max: string };
const firstDay = "2000-01-01";
const dayMS = 86_400_000;
const timestamp = (day: string) => Date.parse(day + "T00:00:00Z");
const iso = (date: Date) => date.toISOString().slice(0, 10);
export const calendarMonth = (day: string) => day.slice(0, 7) + "-01";
const moveDays = (day: string, delta: number) => iso(new Date(timestamp(day) + delta * dayMS));

export function dashboardCalendarLimits(field: CalendarField, dates: CalendarDates, today: string): CalendarLimits | null {
  if (!validDay(today) || today < firstDay) return null;
  const opposite = field === "start" ? dates.end : dates.start;
  if (!validDay(opposite) || opposite < firstDay || opposite > today)
    return { min: firstDay, max: today };
  // Mirror the existing API/UI contract: at most 367 days inclusive.
  return field === "start"
    ? { min: [firstDay, moveDays(opposite, -366)].sort()[1]!, max: opposite }
    : { min: opposite, max: [today, moveDays(opposite, 366)].sort()[0]! };
}
export function calendarDayAllowed(day: string, limits: CalendarLimits) {
  return validDay(day) && day >= limits.min && day <= limits.max;
}
export function moveCalendarMonth(month: string, delta: number, limits: CalendarLimits) {
  const next = new Date(timestamp(calendarMonth(month)));
  next.setUTCMonth(next.getUTCMonth() + delta);
  const value = iso(next);
  return value >= calendarMonth(limits.min) && value <= calendarMonth(limits.max) ? value : null;
}
export function dashboardCalendarCells(month: string): (string | null)[][] {
  const first = calendarMonth(month);
  const weekday = new Date(timestamp(first)).getUTCDay();
  const next = new Date(timestamp(first));
  next.setUTCMonth(next.getUTCMonth() + 1);
  const days = (next.getTime() - timestamp(first)) / dayMS;
  const length = Math.ceil((weekday + days) / 7) * 7;
  const cells = Array.from({ length }, (_, i) => i < weekday || i >= weekday + days
    ? null : moveDays(first, i - weekday));
  return Array.from({ length: length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}
