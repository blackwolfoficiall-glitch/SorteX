import type { SortexClient } from "../api/client";
import {
  buyerHistorySession,
  type BuyerHistorySession,
} from "./order-history";

type CampaignTitlesClient = Pick<
  SortexClient, "snapshot" | "activeSessionRevision" | "request"
>;

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
): Promise<CampaignTitleOrder[] | null> {
  const current = () => {
    const active = buyerHistorySession(client);
    return active?.buyerId === session.buyerId && active.revision === session.revision;
  };

  if (!current()) return null;
  if (!campaignId.trim()) throw new Error("Abra uma campanha para consultar seus títulos.");

  try {
    // Both clients use the authenticated buyer endpoint; only the selected
    // campaign's validated projection is retained in the native screen.
    const purchases = await client.request<unknown>("/purchases/my");
    if (!current()) return null;
    const invalid = () => new Error("A API não retornou os títulos da campanha corretamente.");
    if (!Array.isArray(purchases)) throw invalid();
    const orders: CampaignTitleOrder[] = [];
    for (const purchase of purchases) {
      if (!record(purchase)) throw invalid();
      const row = purchase as Row;
      if (row.campaignId !== campaignId || row.buyerId !== session.buyerId) continue;
      if (
        typeof row.id !== "string" || !row.id ||
        typeof row.status !== "string" ||
        typeof row.total !== "number" || !Number.isFinite(row.total) || row.total < 0 ||
        typeof row.quantity !== "number" || !Number.isSafeInteger(row.quantity) || row.quantity < 1 ||
        typeof row.createdAt !== "string" || !Number.isFinite(Date.parse(row.createdAt))
      ) throw invalid();

      const numbers = new Set<number>();
      if (row.status === "PAID") {
        if (!Array.isArray(row.tickets)) throw invalid();
        for (const item of row.tickets) {
          if (!record(item)) continue;
          const ticket = item as Ticket;
          if (
            ticket.purchaseId === row.id && ticket.campaignId === campaignId &&
            ticket.buyerId === session.buyerId && ticket.status === "SOLD" &&
            typeof ticket.number === "number" && Number.isSafeInteger(ticket.number) &&
            ticket.number >= 0
          ) numbers.add(ticket.number);
        }
      }
      orders.push({
        id: row.id, status: row.status, total: row.total,
        quantity: row.quantity, createdAt: row.createdAt,
        numbers: [...numbers].sort((a, b) => a - b),
      });
    }
    return orders;
  } catch (error) {
    if (!current()) return null;
    throw error;
  }
}
