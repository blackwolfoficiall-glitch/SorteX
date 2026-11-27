export type BuyerDrawResult = {
  id: string;
  title: string;
  synthetic?: true;
  draws: { winningNumber: string }[];
  winners: {
    id: string;
    prizeName: string;
    publicDisplayName: string | null;
  }[];
};

type Row = Record<string, unknown>;
const record = (value: unknown): Row =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Row)
    : {};
const text = (value: unknown): value is string =>
  typeof value === 'string' && Boolean(value.trim());

export function parseBuyerDrawResults(value: unknown): BuyerDrawResult[] {
  if (!Array.isArray(value)) throw new Error('Lista de resultados inválida.');
  return value.map((entry) => {
    const { id, title, synthetic, draws, winners } = record(entry);
    if (!text(id) || !text(title) ||
        (synthetic !== undefined && synthetic !== true) ||
        !Array.isArray(draws) || !draws.length || !Array.isArray(winners) ||
        (synthetic && (!title.startsWith('[FICTÍCIO] ') || winners.length))) {
      throw new Error('Resultado inválido.');
    }
    return {
      id,
      title,
      ...(synthetic ? { synthetic: true as const } : {}),
      draws: draws.map((draw) => {
        const { winningNumber } = record(draw);
        if (!text(winningNumber) || !/^\d{1,12}$/.test(winningNumber) ||
            /[^0-9]/.test(winningNumber)) throw new Error('Número inválido.');
        return { winningNumber };
      }),
      winners: winners.map((winner) => {
        const { id: winnerId, prizeName, publicDisplayName } = record(winner);
        if (!text(winnerId) || !text(prizeName) ||
            !(publicDisplayName === null || text(publicDisplayName))) {
          throw new Error('Prêmio inválido.');
        }
        return { id: winnerId, prizeName, publicDisplayName };
      }),
    };
  });
}
