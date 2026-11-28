import { BadRequestException } from '@nestjs/common';
import { Matches } from 'class-validator';

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/u;
const DAY_MS = 86_400_000;
const MAX_INCLUSIVE_DAYS = 367;
export const DASHBOARD_TIME_ZONE = 'America/Sao_Paulo' as const;
const todayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: DASHBOARD_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export class DashboardPeriodQuery {
  @Matches(DATE_FORMAT, { message: 'start deve usar o formato AAAA-MM-DD.' })
  start!: string;

  @Matches(DATE_FORMAT, { message: 'end deve usar o formato AAAA-MM-DD.' })
  end!: string;
}

function calendarDay(value: string) {
  if (
    typeof value !== 'string' ||
    value.length !== 10 ||
    !DATE_FORMAT.test(value) ||
    value < '2000-01-01'
  )
    return NaN;
  const parsed = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
    ? parsed.getTime() / DAY_MS
    : NaN;
}

export function validateDashboardPeriod(
  { start, end }: DashboardPeriodQuery,
  now = new Date(),
) {
  const parts = Object.fromEntries(
    todayFormatter.formatToParts(now).map(({ type, value }) => [type, value]),
  );
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const days = calendarDay(end) - calendarDay(start) + 1;
  if (
    !Number.isFinite(days) ||
    days < 1 ||
    days > MAX_INCLUSIVE_DAYS ||
    end > today
  )
    throw new BadRequestException(
      'Informe datas válidas, em ordem, sem datas futuras e com até 367 dias de intervalo.',
    );
  return { start, end, timeZone: DASHBOARD_TIME_ZONE };
}
