export const CAMPAIGN_DRAW_TIME_ZONE = 'America/Sao_Paulo' as const;

const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const WALL_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const localFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: CAMPAIGN_DRAW_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function isCivilDate(value: string) {
  if (!CIVIL_DATE.test(value)) return false;
  const parsed = new Date(value);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function isDrawClock(value: string) {
  return WALL_TIME.test(value);
}

export function civilDrawInstant(date: string, time: string) {
  if (!isCivilDate(date) || !isDrawClock(time)) return null;

  // Interpret the civil fields in Brasília, not in the host or browser zone.
  // Convert the guessed instant back through the IANA zone to find its offset.
  const base = Date.parse(`${date}T${time}:00.000Z`);
  let guess = base;
  for (let attempt = 0; attempt < 4; attempt++) {
    const fields = Object.fromEntries(
      localFormatter
        .formatToParts(guess)
        .map(({ type, value }) => [type, value]),
    );
    const rendered = `${fields.year.padStart(4, '0')}-${fields.month}-${fields.day}T${fields.hour}:${fields.minute}`;
    const offset = base - Date.parse(`${rendered}:00.000Z`);
    if (offset === 0) return new Date(guess);
    guess += offset;
  }
  return null;
}

type DrawFields = {
  drawDate: Date | null;
  drawTime?: string | null;
  drawTimeZone?: string | null;
};

export function campaignDrawInstant(campaign: DrawFields) {
  const date = campaign.drawDate;
  if (!date || !Number.isFinite(date.getTime())) return null;
  if (!campaign.drawTimeZone) return date;
  if (campaign.drawTimeZone !== CAMPAIGN_DRAW_TIME_ZONE) return null;
  return campaign.drawTime
    ? civilDrawInstant(date.toISOString().slice(0, 10), campaign.drawTime)
    : null;
}

type SalesFields = DrawFields & {
  salesStartAt: Date | null;
  salesEndAt: Date | null;
};

export function campaignSalesWindow(campaign: SalesFields, now = new Date()) {
  const drawAt = campaignDrawInstant(campaign);
  const opensAt = campaign.salesStartAt;
  const explicitEnd = campaign.salesEndAt;
  const endBeforeDraw = explicitEnd && (!drawAt || explicitEnd <= drawAt);
  const closesAt = endBeforeDraw ? explicitEnd : drawAt;

  const status =
    campaign.drawTimeZone && !drawAt
      ? 'UNSCHEDULED'
      : closesAt && closesAt <= now
        ? endBeforeDraw
          ? 'SALES_ENDED'
          : 'DRAW_TIME_REACHED'
        : opensAt && opensAt > now
          ? 'NOT_STARTED'
          : 'OPEN';
  return { status, opensAt, closesAt };
}

export function campaignSalesBlockMessage(campaign: SalesFields, now?: Date) {
  const { status } = campaignSalesWindow(campaign, now);
  switch (status) {
    case 'UNSCHEDULED':
      return 'O horário do sorteio não foi confirmado.';
    case 'NOT_STARTED':
      return 'As vendas ainda não começaram.';
    case 'SALES_ENDED':
      return 'As vendas foram encerradas.';
    case 'DRAW_TIME_REACHED':
      return 'O sorteio desta campanha já ocorreu.';
    default:
      return null;
  }
}

type ExistingSchedule = DrawFields & { status?: string };

export function authoredDrawSchedule(
  dateInput?: string | null,
  timeInput?: string | null,
  current?: ExistingSchedule,
) {
  let drawDate: Date | undefined;
  let drawTimeZone: typeof CAMPAIGN_DRAW_TIME_ZONE | null | undefined;
  if (dateInput) {
    if (CIVIL_DATE.test(dateInput)) {
      if (!isCivilDate(dateInput))
        throw new Error('Informe uma data de sorteio válida.');
      const sameStoredDay =
        current?.drawDate?.toISOString().slice(0, 10) === dateInput;
      // DTOs in the Web wizard carry the date on routine edits. A no-op date
      // round trip must not rewrite a legacy timestamp or opt it into a zone.
      if (!sameStoredDay) {
        drawDate = new Date(dateInput);
        if (
          !current?.drawDate ||
          current.status === 'DRAFT' ||
          current.drawTimeZone
        ) {
          drawTimeZone = CAMPAIGN_DRAW_TIME_ZONE;
        }
      }
    } else {
      drawDate = new Date(dateInput);
      if (!Number.isFinite(drawDate.getTime()))
        throw new Error('Informe uma data de sorteio válida.');
      drawTimeZone = null;
    }
  }
  const effectiveDate = drawDate ?? current?.drawDate;
  const effectiveZone =
    drawTimeZone === undefined ? current?.drawTimeZone : drawTimeZone;
  const effectiveTime = timeInput ?? current?.drawTime;
  if (
    effectiveZone &&
    effectiveDate &&
    effectiveTime &&
    !civilDrawInstant(effectiveDate.toISOString().slice(0, 10), effectiveTime)
  ) {
    throw new Error(
      'Informe um horário de sorteio válido no horário de Brasília.',
    );
  }
  return { drawDate, drawTimeZone };
}
