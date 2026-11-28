import { ApiError, type SortexClient } from "../api/client";
import { buyerInboxSession, type BuyerInboxSession } from "./inbox";
import {
  parseBuyerFavorites,
  privateFavoritePath,
  privateFavoritesPath,
  type BuyerFavorite,
} from "../../../../packages/contracts/src/buyer-favorites";

type Client = Pick<
  SortexClient,
  "request" | "snapshot" | "activeSessionRevision"
>;
export type FavoriteChange = { campaignId: string; saved: boolean };

export async function readFavorites(
  client: Client,
  expected: BuyerInboxSession,
  change?: FavoriteChange,
): Promise<
  { kind: "ok"; items: BuyerFavorite[] } | { kind: "stale" | "unavailable" }
> {
  const active = () => {
    const session = buyerInboxSession(client);
    return (
      session?.buyerId === expected.buyerId &&
      session.revision === expected.revision
    );
  };
  if (!active()) return { kind: "stale" };
  try {
    if (change) {
      await client.request(
        privateFavoritePath(change.campaignId),
        change.saved ? "POST" : "DELETE",
      );
      if (!active()) return { kind: "stale" };
    }
    const payload = await client.request<unknown>(privateFavoritesPath);
    return active()
      ? { kind: "ok", items: parseBuyerFavorites(payload) }
      : { kind: "stale" };
  } catch (error) {
    if (!active()) return { kind: "stale" };
    if (error instanceof ApiError && error.status === 404 && !change)
      return { kind: "unavailable" };
    throw error;
  }
}
