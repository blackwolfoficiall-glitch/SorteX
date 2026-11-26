import AffiliateInvitation from "../AffiliateInvitation";

export default async function Page({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  return <AffiliateInvitation initialCode={(await params).code} />;
}
