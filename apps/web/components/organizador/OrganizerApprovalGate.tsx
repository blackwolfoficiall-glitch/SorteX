"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getOrganizerProfile } from "@/lib/organizers/client";

const permittedStatuses = [
  "PENDING",
  "UNDER_REVIEW",
  "CORRECTION_REQUESTED",
  "DOCUMENT_REQUESTED",
  "VERIFIED",
];

export default function OrganizerApprovalGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [state, setState] = useState<"loading" | "allowed" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const request = new AbortController();
    getOrganizerProfile(request.signal)
      .then((profile) => {
        if (request.signal.aborted) return;
        if (permittedStatuses.includes(profile.verificationStatus)) {
          setState("allowed");
          return;
        }
        router.replace("/organizador/verificacao");
      })
      .catch(() => {
        // Navigation or a network failure says nothing about approval status.
        if (!request.signal.aborted) setState("failed");
      });
    return () => request.abort();
  }, [attempt, router]);

  if (state === "allowed") return children;
  if (state === "failed") {
    return (
      <main className="grid min-h-[60vh] place-items-center p-4">
        <div role="alert" className="rounded-2xl border bg-white p-5 text-center">
          <p className="font-semibold">Não foi possível verificar a aprovação do organizador.</p>
          <button
            type="button"
            className="mt-3 rounded-xl bg-violet-700 px-4 py-2 font-semibold text-white"
            onClick={() => {
              setState("loading");
              setAttempt((value) => value + 1);
            }}
          >
            Tentar verificar novamente
          </button>
        </div>
      </main>
    );
  }
  return (
    <main className="grid min-h-[60vh] place-items-center">
      <div
        className="h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-700"
        aria-label="Validando aprovação do organizador"
      />
    </main>
  );
}
