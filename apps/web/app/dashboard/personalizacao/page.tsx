import { Suspense } from "react";
import PremiumScope from "@/components/premium/PremiumScope";
import { PersonalizationCenter } from "@/components/organizer-platform/PersonalizationCenter";
import "./personalization-premium.css";

export default function PersonalizacaoPage() {
  return (
    <Suspense fallback={<PremiumScope className="sx-personalization"><p role="status" className="sx-premium-muted">Carregando personalização…</p></PremiumScope>}>
      <PersonalizationCenter premium />
    </Suspense>
  );
}
