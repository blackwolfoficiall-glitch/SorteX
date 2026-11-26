export type BuyerPrizeKind = "draw" | "instant";
export type BuyerPrize = {
  id: string;
  campaignTitle: string;
  prizeName: string;
  ticketNumber: string;
  status: string;
};
export type BuyerPrizeList =
  | { ok: true; items: BuyerPrize[] }
  | { ok: false };

const paths: Record<BuyerPrizeKind, string> = {
  draw: "/winners/my",
  instant: "/winners/my-instant-prizes",
};

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

type PrizeClient = {
  request<T>(path: string): Promise<T>;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function requiredText(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Registro de prêmio inválido.");
  return value.trim();
}

function parseBuyerPrizes(value: unknown, accountId: string, kind: BuyerPrizeKind): BuyerPrize[] {
  if (!Array.isArray(value)) throw new Error("Lista de prêmios inválida.");
  return value.map((entry: unknown) => {
    const item = record(entry);
    // The endpoints are scoped by the API. Never display a row for a different
    // account if that contract is violated, and keep only display fields.
    if (item.buyerId !== accountId) throw new Error("Prêmio fora da conta atual.");
    const ticketNumber = item.winningNumber;
    if (typeof ticketNumber !== "string" || !/^\d{1,12}$/.test(ticketNumber))
      throw new Error("Título do prêmio inválido.");
    const status = requiredText(item.status);
    return {
      id: requiredText(item.id),
      campaignTitle: requiredText(record(item.campaign).title),
      prizeName: requiredText(kind === "draw" ? item.prizeName : record(item.instantPrize).description),
      ticketNumber,
      status: (Object.hasOwn(statuses, status) ? statuses[status] : undefined) ?? "Situação não informada",
    };
  });
}

export async function loadBuyerPrizeList(
  client: PrizeClient, accountId: string, kind: BuyerPrizeKind,
): Promise<BuyerPrizeList> {
  try {
    const value = await client.request<unknown>(paths[kind]);
    return { ok: true, items: parseBuyerPrizes(value, accountId, kind) };
  } catch {
    return { ok: false };
  }
}
