"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import AiSortexCenter from "@/components/growth/AiSortexCenter";
import AbandonedReservationsAnalysis from "@/components/crm/AbandonedReservationsAnalysis";
function IaContent() {
  const params = useSearchParams();
  return params.get("analysis") === "abandoned-reservations" ? (
    <AbandonedReservationsAnalysis fromAi />
  ) : (
    <AiSortexCenter />
  );
}
export default function IaPage() {
  return (
    <Suspense
      fallback={<div className="min-h-[60vh] animate-pulse bg-zinc-100" />}
    >
      <IaContent />
    </Suspense>
  );
}
