import { ApiError, type SortexClient } from "../api/client";

export type BuyerDrawResult = {
  id: string;
  title: string;
  draws: { winningNumber: string }[];
  winners: {
    id: string;
    prizeName: string;
    publicDisplayName: string | null;
  }[];
};

type DrawResultsClient = Pick<
  SortexClient,
  "snapshot" | "request" | "publicRequest"
>;
type Row = Record<string, unknown>;
const row = (value: unknown): Row =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : {};
const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null;
const rows = (value: unknown): Row[] =>
  Array.isArray(value) ? value.map(row) : [];

function assertBuyer(client: DrawResultsClient, accountId: string) {
  const session = client.snapshot();
  if (
    session.status !== "signedIn" ||
    session.user?.role !== "BUYER" ||
    session.user.id !== accountId
  )
    throw new ApiError("A conta mudou durante a consulta de resultados.", 401);
}

export async function loadBuyerDrawResults(
  client: DrawResultsClient,
  accountId: string,
): Promise<BuyerDrawResult[]> {
  assertBuyer(client, accountId);
  const purchases = await client.request<unknown>("/purchases/my");
  assertBuyer(client, accountId);
  if (!Array.isArray(purchases))
    throw new ApiError("Lista de pedidos inválida.");

  // Public profiles contain every public campaign for an organizer. Only use
  // organizer/campaign pairs present in this authenticated buyer's orders.
  const owned = new Map<string, Set<string>>();
  for (const purchase of rows(purchases)) {
    if (purchase.buyerId !== accountId) continue;
    const campaign = row(purchase.campaign);
    const organizerId = text(campaign.organizerId);
    const campaignId = text(campaign.id);
    if (!organizerId || !campaignId) continue;
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
  assertBuyer(client, accountId);

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
