import CampaignWizard from "@/components/campaigns/CampaignWizard";
export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CampaignWizard campaignId={id} />;
}
