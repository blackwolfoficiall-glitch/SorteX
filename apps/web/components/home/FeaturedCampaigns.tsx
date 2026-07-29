import type { Campaign } from "@/lib/campaigns/types";
import CampaignCard from "./CampaignCard";

export default function FeaturedCampaigns({ campaigns }: { campaigns: Campaign[] }) {
  return (
    <section className="py-8">
      <h2 className="mb-6 text-2xl font-bold">Campanhas em destaque</h2>
      {campaigns.length ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} />)}
        </div>
      ) : (
        <div className="rounded-2xl border bg-white p-8 shadow-sm">
          <h3 className="text-xl font-bold">Nenhuma outra campanha publicada</h3>
          <p className="mt-2 text-gray-500">As campanhas válidas aparecerão aqui.</p>
        </div>
      )}
    </section>
  );
}
