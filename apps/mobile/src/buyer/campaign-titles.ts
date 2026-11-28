import type { SortexClient } from "../api/client";
import { buyerHistorySession, type BuyerHistorySession } from "./order-history";

type CampaignTitlesClient = Pick<SortexClient, "snapshot" | "activeSessionRevision" | "request">;

export type CampaignTitleOrder = {
  id: string;
  status: string;
  total: number;
  quantity: number;
  createdAt: string;
  numbers: number[];
};

type Row = {
  id?: unknown;
  buyerId?: unknown;
  campaignId?: unknown;
  status?: unknown;
  total?: unknown;
  quantity?: unknown;
  createdAt?: unknown;
  tickets?: unknown;
};

type Ticket = {
  purchaseId?: unknown;
  buyerId?: unknown;
  campaignId?: unknown;
  status?: unknown;
  number?: unknown;
};

export function campaignOrderAmountLabel(status: string) {
  return status === "PAID" ? "Valor pago" : "Valor do pedido";
}

function record(value: unknown): value is object {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function readBuyerCampaignTitles(
  client: CampaignTitlesClient,
  session: BuyerHistorySession,
  campaignId: string,
  totalNumbers?: number,
): Promise<CampaignTitleOrder[] | null> {
  const current = () => {
    const active = buyerHistorySession(client);
    return active?.buyerId === session.buyerId && active.revision === session.revision;
  };

  if (!current()) return null;
  if (
    !campaignId.trim() ||
    (totalNumbers !== undefined && (!Number.isSafeInteger(totalNumbers) || totalNumbers < 1))
  )
    throw new Error("Abra uma campanha para consultar seus títulos.");

  try {
    // Both clients use the authenticated buyer endpoint; only the selected
    // campaign's validated projection is retained in the native screen.
    const purchases = await client.request<unknown>("/purchases/my");
    if (!current()) return null;
    const invalid = () => new Error("A API não retornou os títulos da campanha corretamente.");
    if (!Array.isArray(purchases)) throw invalid();
    const orders: CampaignTitleOrder[] = [];
    const seen = new Set<string>();
    for (const purchase of purchases) {
      if (!record(purchase)) throw invalid();
      const row = purchase as Row;
      if (row.campaignId !== campaignId || row.buyerId !== session.buyerId) continue;
      if (
        typeof row.id !== "string" ||
        !row.id ||
        typeof row.status !== "string" ||
        typeof row.total !== "number" ||
        !Number.isFinite(row.total) ||
        row.total < 0 ||
        typeof row.quantity !== "number" ||
        !Number.isSafeInteger(row.quantity) ||
        row.quantity < 1 ||
        typeof row.createdAt !== "string" ||
        !Number.isFinite(Date.parse(row.createdAt))
      )
        throw invalid();

      if (seen.has(row.id)) throw invalid();
      seen.add(row.id);
      const numbers = new Set<number>();
      if (row.status === "PAID") {
        if (!Array.isArray(row.tickets)) throw invalid();
        for (const item of row.tickets) {
          if (!record(item)) continue;
          const ticket = item as Ticket;
          if (
            ticket.purchaseId === row.id &&
            ticket.campaignId === campaignId &&
            ticket.buyerId === session.buyerId &&
            ticket.status === "SOLD" &&
            typeof ticket.number === "number" &&
            Number.isSafeInteger(ticket.number) &&
            ticket.number >= 0 &&
            (totalNumbers === undefined || ticket.number < totalNumbers)
          )
            numbers.add(ticket.number);
        }
      }
      orders.push({
        id: row.id,
        status: row.status,
        total: row.total,
        quantity: row.quantity,
        createdAt: row.createdAt,
        numbers: [...numbers].sort((a, b) => a - b),
      });
    }
    return orders;
  } catch (error) {
    if (!current()) return null;
    throw error;
  }
}

export function confirmedCampaignTitleCount(orders: readonly CampaignTitleOrder[]) {
  const confirmed = new Set<number>();
  for (const order of orders) {
    if (order.status === "PAID") for (const number of order.numbers) confirmed.add(number);
  }
  return confirmed.size;
}

export const campaignTitlePageSize = 40;
export function campaignTitlePage(numbers: readonly number[], page: number) {
  const lastPage = Math.max(0, Math.ceil(numbers.length / campaignTitlePageSize) - 1);
  const selected = Number.isSafeInteger(page) ? Math.min(Math.max(0, page), lastPage) : 0;
  const start = selected * campaignTitlePageSize;
  const end = Math.min(start + campaignTitlePageSize, numbers.length);
  return {
    entries: numbers.slice(start, end),
    first: numbers.length ? start + 1 : 0,
    last: end,
    total: numbers.length,
    hasPrevious: selected > 0,
    hasNext: end < numbers.length,
  };
}
