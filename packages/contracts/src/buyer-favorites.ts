export const privateFavoritesPath = "/buyer/favorites/private";

export type FavoriteCampaignCard = {
  id: string;
  slug: string;
  title: string;
  numberPrice: number;
  soldPercentage: number;
  drawDate: string | null;
  coverImageUrl: string | null;
  coverImageRevision?: string | null;
  organizer: { name: string; verified: boolean };
};
export type BuyerFavorite = { id: string; campaign: FavoriteCampaignCard };

export function privateFavoritePath(campaignId: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(campaignId))
    throw new Error("Campanha inválida.");
  return `${privateFavoritesPath}/${encodeURIComponent(campaignId)}`;
}

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

export function parseBuyerFavorites(payload: unknown): BuyerFavorite[] {
  const invalid = () =>
    new Error("A API retornou uma lista de favoritos inválida.");
  if (!Array.isArray(payload)) throw invalid();
  const campaigns = new Set<string>();
  return payload.map((value: unknown) => {
    const row = record(value),
      c = record(row?.campaign),
      o = record(c?.organizer);
    if (
      !row ||
      typeof row.id !== "string" ||
      !row.id ||
      !c ||
      typeof c.id !== "string" ||
      !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(c.id) ||
      campaigns.has(c.id) ||
      c.status !== "PUBLISHED" ||
      typeof c.slug !== "string" ||
      !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,179}$/.test(c.slug) ||
      typeof c.title !== "string" ||
      typeof c.numberPrice !== "number" ||
      !Number.isFinite(c.numberPrice) ||
      c.numberPrice < 0 ||
      typeof c.soldPercentage !== "number" ||
      !Number.isFinite(c.soldPercentage) ||
      c.soldPercentage < 0 ||
      c.soldPercentage > 100 ||
      !(
        c.drawDate === null ||
        (typeof c.drawDate === "string" &&
          Number.isFinite(Date.parse(c.drawDate)))
      ) ||
      !(
        c.coverImageUrl === null ||
        c.coverImageUrl === `/api/public/campaign-media/${c.id}/cover`
      ) ||
      !o ||
      typeof o.name !== "string" ||
      typeof o.verified !== "boolean"
    )
      throw invalid();
    campaigns.add(c.id);
    return {
      id: row.id,
      campaign: {
        id: c.id,
        title: c.title,
        slug: c.slug,
        numberPrice: c.numberPrice,
        soldPercentage: c.soldPercentage,
        drawDate: c.drawDate,
        coverImageUrl: c.coverImageUrl,
        coverImageRevision:
          typeof c.coverImageRevision === "string"
            ? c.coverImageRevision
            : null,
        organizer: { name: o.name, verified: o.verified },
      },
    };
  });
}
