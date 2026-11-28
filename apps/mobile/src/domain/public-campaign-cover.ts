import type { Campaign } from "../../../../packages/contracts/src/mobile";
import { validateApiUrl } from "../api/config";

type CampaignCover = Pick<Campaign, "id" | "status" | "coverImageUrl" | "coverImageRevision">;

/** Resolve only the API's no-auth cover route for the currently published campaign. */
export function publicCampaignCoverSource(
  api: string,
  campaign: CampaignCover,
  allowLocal = false,
) {
  if (campaign.status !== "PUBLISHED" || !/^[A-Za-z0-9_-]{1,128}$/.test(campaign.id))
    return null;

  const relative = `/public/campaigns/media/${campaign.id}/cover`;
  if (campaign.coverImageUrl !== relative) return null;

  const revision = campaign.coverImageRevision;
  const version = typeof revision === "string" && /^[a-f0-9]{16}$/.test(revision)
    ? `?v=${revision}`
    : "";
  try {
    return {
      uri: validateApiUrl(api, allowLocal) + relative + version,
      cache: "reload" as const,
    };
  } catch {
    return null;
  }
}
