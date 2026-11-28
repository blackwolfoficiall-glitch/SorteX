import PublicCampaignView from "@/components/campaigns/PublicCampaignView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Campanha",
  robots: { index: false, follow: false },
};

export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const [{ slug }, { view }] = await Promise.all([params, searchParams]);
  const openTitles = view === "meus-titulos";
  return (
    <PublicCampaignView
      key={slug}
      slug={slug}
      initiallyShowBuyerTitles={openTitles}
    />
  );
}
