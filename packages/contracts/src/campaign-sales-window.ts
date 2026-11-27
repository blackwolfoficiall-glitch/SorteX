export type CampaignSalesWindow = {
  status: 'OPEN' | 'NOT_STARTED' | 'SALES_ENDED' | 'DRAW_TIME_REACHED' | 'UNSCHEDULED';
  opensAt: string | null;
  closesAt: string | null;
};

export type BuyerSalesWindow = CampaignSalesWindow | {
  status: 'UNAVAILABLE';
  opensAt: null;
  closesAt: null;
};

const unavailable = (): BuyerSalesWindow => ({
  status: 'UNAVAILABLE',
  opensAt: null,
  closesAt: null,
});

const isTimestamp = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;

function optionalTimestamp(value: unknown): value is string | null {
  return value === null || isTimestamp(value);
}

function isWindow(value: unknown): value is CampaignSalesWindow {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return typeof data.status === 'string' &&
    ['OPEN', 'NOT_STARTED', 'SALES_ENDED', 'DRAW_TIME_REACHED', 'UNSCHEDULED'].includes(data.status) &&
    optionalTimestamp(data.opensAt) && optionalTimestamp(data.closesAt);
}

/**
 * Keep the API as authority. The previous API publishes all three raw UTC
 * fields (including explicit nulls) but no salesWindow. Only in that case
 * reproduce its gate; do not try to reconstruct drawDate from civil time.
 */
export function resolveBuyerSalesWindow(
  window: unknown,
  legacy?: unknown,
  now = Date.now(),
): BuyerSalesWindow {
  if (isWindow(window)) return window;
  if (window !== undefined || !legacy || typeof legacy !== 'object')
    return unavailable();
  const campaign = legacy as Record<string, unknown>;
  const { salesStartAt, salesEndAt, drawDate } = campaign;
  if (
    campaign.status !== 'PUBLISHED' || campaign.purchasesBlocked !== false ||
    campaign.scheduledDrawAt !== undefined || campaign.drawTimeZone !== undefined ||
    !optionalTimestamp(salesStartAt) || !optionalTimestamp(salesEndAt) ||
    !optionalTimestamp(drawDate) || !Number.isFinite(now)
  ) return unavailable();

  const starts = salesStartAt ? Date.parse(salesStartAt) : null;
  const ends = salesEndAt ? Date.parse(salesEndAt) : null;
  const draw = drawDate ? Date.parse(drawDate) : null;
  return {
    status: starts !== null && starts > now ? 'NOT_STARTED'
      : ends !== null && ends <= now ? 'SALES_ENDED'
      : draw !== null && draw <= now ? 'DRAW_TIME_REACHED'
      : 'OPEN',
    opensAt: salesStartAt,
    closesAt: ends !== null && (draw === null || ends <= draw) ? salesEndAt : drawDate,
  };
}

export function salesWindowMessage(window: BuyerSalesWindow) {
  switch (window.status) {
    case 'NOT_STARTED': return 'As vendas ainda não começaram.';
    case 'SALES_ENDED': return 'As vendas foram encerradas.';
    case 'DRAW_TIME_REACHED': return 'O horário do sorteio já chegou.';
    case 'UNSCHEDULED': return 'O horário do sorteio não foi confirmado.';
    case 'UNAVAILABLE': return 'Não foi possível confirmar se as vendas estão abertas.';
    case 'OPEN': return '';
  }
}
