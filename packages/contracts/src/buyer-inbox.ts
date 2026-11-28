export const buyerInboxLimit = 100;
export type BuyerNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
};

export function isBuyerNotificationId(value: unknown): value is string {
  return (
    typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value)
  );
}

function timestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

export function parseBuyerInbox(payload: unknown): BuyerNotification[] {
  const invalid = () =>
    new Error("A API retornou uma caixa de notificações inválida.");
  if (!Array.isArray(payload) || payload.length > buyerInboxLimit)
    throw invalid();
  const seen = new Set<string>();
  return payload.map((value: unknown) => {
    if (!value || typeof value !== "object") throw invalid();
    const row = value as Record<string, unknown>;
    const { id, type, title, message, readAt, createdAt } = row;
    if (
      !isBuyerNotificationId(id) ||
      seen.has(id) ||
      typeof type !== "string" ||
      typeof title !== "string" ||
      typeof message !== "string" ||
      !(readAt === null || timestamp(readAt)) ||
      !timestamp(createdAt)
    )
      throw invalid();
    seen.add(id);
    return { id, type, title, message, readAt, createdAt };
  });
}
