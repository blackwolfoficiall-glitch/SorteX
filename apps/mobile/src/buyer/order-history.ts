import type { SortexClient } from "../api/client";

type HistoryClient = Pick<
  SortexClient,
  "snapshot" | "activeSessionRevision" | "request"
>;
export type BuyerHistorySession = { buyerId: string; revision: number };
export type BuyerHistoryOrder = {
  id: string;
  campaignTitle: string;
  status: string;
  quantity: number;
  total: number;
  createdAt: string;
};

export function buyerHistorySession(client: HistoryClient): BuyerHistorySession | null {
  const { status, user } = client.snapshot();
  const revision = client.activeSessionRevision();
  return status === "signedIn" && user?.role === "BUYER" && revision !== null
    ? { buyerId: user.id, revision }
    : null;
}
function stillBuyer(client: HistoryClient, expected: BuyerHistorySession) {
  const session = buyerHistorySession(client);
  return session?.buyerId === expected.buyerId && session.revision === expected.revision;
}

export function buyerOrderStatus(value: string) {
  switch (value) {
    case "PENDING": return "Pendente";
    case "RESERVED": return "Reservado";
    case "AWAITING_PAYMENT": return "Aguardando pagamento";
    case "PAID": return "Pagamento confirmado";
    case "EXPIRED": return "Expirado";
    case "CANCELLED":
    case "CANCELED": return "Cancelado";
    case "REFUNDED": return "Estornado";
    default: return "Status indisponível";
  }
}

type Row = Omit<BuyerHistoryOrder, "campaignTitle"> & {
  campaign?: { title?: unknown } | null;
};

export async function readBuyerOrderHistory(
  client: HistoryClient,
  session: BuyerHistorySession,
): Promise<BuyerHistoryOrder[] | null> {
  if (!stillBuyer(client, session)) return null;
  try {
    const result = await client.request<unknown>("/purchases/my");
    if (!stillBuyer(client, session)) return null;
    const invalid = () => new Error("A API não retornou um histórico de pedidos válido.");
    if (!Array.isArray(result)) throw invalid();
    return result.map((value: unknown) => {
      if (!value || typeof value !== "object") throw invalid();
      const row = value as Partial<Row>;
      if (
        typeof row.id !== "string" ||
        !row.id ||
        typeof row.status !== "string" ||
        typeof row.quantity !== "number" ||
        !Number.isSafeInteger(row.quantity) ||
        row.quantity < 1 ||
        typeof row.total !== "number" ||
        !Number.isFinite(row.total) ||
        row.total < 0 ||
        typeof row.createdAt !== "string" ||
        !Number.isFinite(Date.parse(row.createdAt))
      ) throw invalid();
      return {
        id: row.id,
        status: row.status,
        quantity: row.quantity,
        total: row.total,
        createdAt: row.createdAt,
        campaignTitle:
          typeof row.campaign?.title === "string" && row.campaign.title.trim()
            ? row.campaign.title
            : "Campanha",
      };
    });
  } catch (error) {
    if (!stillBuyer(client, session)) return null;
    throw error;
  }
}
