export type BuyerPrize = {
  id: string;
  campaignTitle: string;
  prizeName: string;
  ticketNumber: string;
  status: string;
};

export const buyerPrizeEndpoints = {
  draw: "/winners/my",
  instant: "/winners/my-instant-prizes",
} as const;

export type BuyerPrizeKind = keyof typeof buyerPrizeEndpoints;
// null means an unreadable list; [] is a successfully loaded empty list.
export type BuyerPrizes = Record<BuyerPrizeKind, BuyerPrize[] | null>;

const statuses: Record<string, string> = {
  IDENTIFIED: "Prêmio identificado",
  PENDING_CONTACT: "Contato pendente",
  CONTACTED: "Ganhador contatado",
  CLAIMED: "Prêmio solicitado",
  PAYMENT_PENDING: "Pagamento do prêmio pendente",
  DELIVERED: "Entrega registrada",
  CONFIRMED_BY_WINNER: "Recebimento confirmado pelo ganhador",
  NOT_CLAIMED: "Prêmio não solicitado",
  CANCELLED: "Premiação cancelada",
  DISPUTED: "Premiação em disputa",
};

export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Registro de prêmio inválido.");
  return value.trim();
}

export function projectBuyerPrizes(rows: unknown, buyerId: string, kind: BuyerPrizeKind): BuyerPrize[] {
  if (!Array.isArray(rows)) throw new Error("Lista de prêmios inválida.");
  return rows.map((value) => {
    const item = record(value);
    // Nest already scopes these queries to the principal. Keep that guarantee
    // at the BFF boundary as well and never return the raw database record.
    if (item.buyerId !== buyerId) throw new Error("Prêmio fora da conta atual.");
    if (typeof item.winningNumber !== "string" || !/^\d{1,12}$/.test(item.winningNumber))
      throw new Error("Título do prêmio inválido.");
    const status = text(item.status);
    return {
      id: text(item.id),
      campaignTitle: text(record(item.campaign).title),
      prizeName: text(kind === "draw" ? item.prizeName : record(item.instantPrize).description),
      ticketNumber: item.winningNumber,
      status: Object.hasOwn(statuses, status) ? statuses[status] : "Situação não informada",
    };
  });
}
