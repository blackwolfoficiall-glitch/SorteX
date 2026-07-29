import { Suspense } from "react";
import AbandonedReservationsAnalysis from "@/components/crm/AbandonedReservationsAnalysis";

export default function ReservasAbandonadasPage() {
  return (
    <Suspense
      fallback={<div className="min-h-[60vh] animate-pulse bg-zinc-100" />}
    >
      <AbandonedReservationsAnalysis />
    </Suspense>
  );
}
