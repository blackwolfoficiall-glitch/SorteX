import type { SortexClient } from "../api/client";
import {
  isBuyerNotificationId,
  parseBuyerInbox,
  type BuyerNotification,
} from "../../../../packages/contracts/src/buyer-inbox";

type BuyerInboxClient = Pick<
  SortexClient,
  "snapshot" | "activeSessionRevision" | "request"
>;
export type BuyerInboxSession = { buyerId: string; revision: number };

export function buyerInboxSession(
  client: BuyerInboxClient,
): BuyerInboxSession | null {
  const account = client.snapshot();
  const revision = client.activeSessionRevision();
  return account.status === "signedIn" &&
    account.user?.role === "BUYER" &&
    revision !== null
    ? { buyerId: account.user.id, revision }
    : null;
}

function stillBuyer(client: BuyerInboxClient, expected: BuyerInboxSession) {
  const current = buyerInboxSession(client);
  return (
    current?.buyerId === expected.buyerId &&
    current.revision === expected.revision
  );
}

export async function readBuyerInbox(
  client: BuyerInboxClient,
  session: BuyerInboxSession,
  mark?: { kind: "one"; id: string } | { kind: "all" },
): Promise<BuyerNotification[] | null> {
  if (!stillBuyer(client, session)) return null;
  try {
    if (mark) {
      if (mark.kind === "one" && !isBuyerNotificationId(mark.id))
        throw new Error("Notificação inválida.");
      await client.request(
        mark.kind === "all"
          ? "/buyer/notifications/read-all"
          : `/buyer/notifications/${encodeURIComponent(mark.id)}/read`,
        "POST",
      );
      if (!stillBuyer(client, session)) return null;
    }
    const payload = await client.request<unknown>("/buyer/notifications");
    return stillBuyer(client, session) ? parseBuyerInbox(payload) : null;
  } catch (error) {
    if (!stillBuyer(client, session)) return null;
    throw error;
  }
}
