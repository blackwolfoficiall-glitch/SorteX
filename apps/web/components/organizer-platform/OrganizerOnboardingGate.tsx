"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getCurrentPlan } from "@/lib/organizer-platform/client";
import { getOrganizerProfile } from "@/lib/organizers/client";

export function OrganizerOnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([getCurrentPlan(), getOrganizerProfile()])
      .then(([current, profile]) => {
        if (!active) return;
        if (["PENDING", "UNDER_REVIEW", "CORRECTION_REQUESTED", "DOCUMENT_REQUESTED"].includes(profile.verificationStatus)) {
          setReady(true);
          return;
        }
        const status = current.profile.onboardingStatus;
        if (status === "PLAN_SELECTION") {
          router.replace("/organizador/escolher-plano");
          return;
        }
        if (status === "IDENTITY_SETUP" && !pathname.startsWith("/dashboard/personalizacao")) {
          router.replace("/dashboard/personalizacao?onboarding=1");
          return;
        }
        setReady(true);
      })
      .catch(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [pathname, router]);

  return ready ? children : <main className="grid min-h-screen place-items-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-700" aria-label="Carregando configuração" /></main>;
}
