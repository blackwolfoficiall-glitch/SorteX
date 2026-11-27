import { ApiError, type SortexClient } from "../api/client";
import {
  parseBuyerDrawResults,
  type BuyerDrawResult,
} from "../../../../packages/contracts/src/buyer-draw-results";
export type { BuyerDrawResult } from "../../../../packages/contracts/src/buyer-draw-results";

type DrawResultsClient = Pick<
  SortexClient,
  "snapshot" | "request" | "publicRequest"
> & Partial<Pick<SortexClient, "activeSessionRevision">>;
type Row = Record<string, unknown>;
const row = (value: unknown): Row =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : {};
const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null;
const rows = (value: unknown): Row[] =>
  Array.isArray(value) ? value.map(row) : [];

function assertBuyer(
  client: DrawResultsClient,
  accountId: string,
  revision: number | null | undefined,
) {
  const session = client.snapshot();
  if (
    session.status !== "signedIn" ||
    session.user?.role !== "BUYER" ||
    session.user.id !== accountId ||
    (client.activeSessionRevision &&
      (revision == null || client.activeSessionRevision() !== revision))
  )
    throw new ApiError("A conta mudou durante a consulta de resultados.", 401);
}

export async function loadBuyerDrawResults(
  client: DrawResultsClient,
  accountId: string,
): Promise<BuyerDrawResult[]> {
  const revision = client.activeSessionRevision?.();
  assertBuyer(client, accountId, revision);
  try {
    const response = await client.request<unknown>("/buyer/results/my");
    assertBuyer(client, accountId, revision);
    return parseBuyerDrawResults(response);
  } catch (cause) {
    // An older QA binary has no private route. Keep only the existing
    // published-results fallback; never reinterpret unsaved simulations.
    if (!(cause instanceof ApiError) || cause.status !== 404) throw cause;
  }
  assertBuyer(client, accountId, revision);
  const purchases = await client.request<unknown>("/purchases/my");
  assertBuyer(client, accountId, revision);
  if (!Array.isArray(purchases))
    throw new ApiError("Lista de pedidos inválida.");

  // Public profiles contain every public campaign for an organizer. Only use
  // organizer/campaign pairs present in this authenticated buyer's orders.
  const owned = new Map<string, Set<string>>();
  for (const purchase of rows(purchases)) {
    if (purchase.buyerId !== accountId || purchase.status !== "PAID") continue;
    const campaign = row(purchase.campaign);
    const organizerId = text(campaign.organizerId);
    const campaignId = text(campaign.id);
    if (!organizerId || !campaignId ||
        !rows(purchase.tickets).some(
          (ticket) => ticket.buyerId === accountId &&
            ticket.campaignId === campaignId &&
            ticket.purchaseId === purchase.id &&
            ticket.status === "SOLD",
        )) continue;
    const campaigns = owned.get(organizerId) ?? new Set<string>();
    campaigns.add(campaignId);
    owned.set(organizerId, campaigns);
  }

  const profiles = await Promise.all(
    [...owned].map(async ([organizerId, campaigns]) => {
      const profile = row(
        await client.publicRequest<unknown>(
          `/public/campaigns/organizers/${encodeURIComponent(organizerId)}/profile`,
        ),
      );
      if (
        row(profile.organizer).id !== organizerId ||
        !Array.isArray(profile.campaigns)
      )
        throw new ApiError(
          "O perfil público recebido não corresponde ao organizador.",
        );
      return { campaigns, published: rows(profile.campaigns) };
    }),
  );
  assertBuyer(client, accountId, revision);

  const confirmed = new Map<string, BuyerDrawResult>();
  for (const { campaigns, published } of profiles) {
    for (const campaign of published) {
      const id = text(campaign.id);
      const title = text(campaign.title);
      if (!id || !title || !campaigns.has(id) || confirmed.has(id)) continue;
      const draws = rows(campaign.draws).flatMap((draw) =>
        draw.status === "CONFIRMED" &&
        typeof draw.winningNumber === "string" &&
        /^[0-9]{1,12}$/.test(draw.winningNumber) &&
        !/[^0-9]/.test(draw.winningNumber)
          ? [{ winningNumber: draw.winningNumber }]
          : [],
      );
      if (!draws.length) continue;
      const winners = rows(campaign.winners).flatMap((winner) => {
        const winnerId = text(winner.id);
        const prizeName = text(winner.prizeName);
        return winnerId && prizeName
          ? [
              {
                id: winnerId,
                prizeName,
                publicDisplayName: text(winner.publicDisplayName),
              },
            ]
          : [];
      });
      confirmed.set(id, { id, title, draws, winners });
    }
  }
  return [...confirmed.values()];
}
