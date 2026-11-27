import { Suspense } from "react";
import PromotionsCenter from "@/components/growth/PromotionsCenter";
import PremiumScope from "@/components/premium/PremiumScope";

export default function PromocoesPage() {
  return (
    <Suspense fallback={
      <PremiumScope className="sx-promo">
        <p role="status" className="sx-premium-muted">Carregando promoções…</p>
      </PremiumScope>
    }>
      <PromotionsCenter />
    </Suspense>
  );
}
