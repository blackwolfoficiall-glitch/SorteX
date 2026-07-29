import PublicCampaignView from "@/components/campaigns/PublicCampaignView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Campanha",
  robots: { index: false, follow: false },
};

export default async function CampaignPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicCampaignView slug={slug} />;
}
