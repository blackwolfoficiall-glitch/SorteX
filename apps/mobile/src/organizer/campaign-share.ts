import { QA_API } from "../api/config";

const QA_WEB = "https://sortex-qa-privada.workspace-de-1136.chatgpt.site";
export const shareableSlug = (slug: unknown): slug is string =>
  typeof slug === "string" && slug.length <= 150 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);

export function organizerCampaignShareUrl(api: string, item: { id: string; slug: string }, payload: unknown): string | null {
  const campaign = (payload ?? {}) as Partial<{ id: string; slug: string; status: string; publicationBlocked: boolean }>;
  return api === QA_API && shareableSlug(item.slug) && campaign.id === item.id &&
    campaign.slug === item.slug && campaign.status === "PUBLISHED" && campaign.publicationBlocked !== true
    ? QA_WEB + "/campanha/" + encodeURIComponent(item.slug)
    : null;
}
