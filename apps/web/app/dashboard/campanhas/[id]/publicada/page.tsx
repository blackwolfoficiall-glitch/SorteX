import CampaignPublishedSuccess from "@/components/campaigns/CampaignPublishedSuccess";

export default async function PublishedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CampaignPublishedSuccess id={id}/>;
}
