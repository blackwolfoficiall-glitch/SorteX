"use client";

import { useEffect, useState } from "react";
import { useAuthorizedUser } from "@/components/auth/RoleGate";
import { authRequest } from "@/lib/auth/client";
import type { BuyerPrize, BuyerPrizes as PrizeGroups } from "@/lib/buyer/prizes";

const panel = "rounded-3xl border border-violet-100 bg-white p-5 shadow-sm md:p-6";

export default function BuyerPrizes() {
  const user = useAuthorizedUser();
  return (
    <div className="mx-auto max-w-3xl space-y-5 p-5 md:py-8">
      <header>
        <h1 className="text-3xl font-black text-slate-950">Meus prêmios</h1>
        <p className="mt-2 text-sm text-slate-600">
          Acompanhe os prêmios dos seus títulos e a situação de cada entrega.
        </p>
      </header>
      {user?.role === "BUYER"
        ? <PrizeLists key={user.id} />
        : <p className={panel}>A consulta de prêmios é exclusiva para a conta compradora.</p>}
    </div>
  );
}

function PrizeLists() {
  const [groups, setGroups] = useState<PrizeGroups | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const aborter = new AbortController();
    authRequest<PrizeGroups>("/api/buyer/prizes", { cache: "no-store", signal: aborter.signal })
      .then((result) => {
        if (!aborter.signal.aborted) setGroups({
          draw: Array.isArray(result?.draw) ? result.draw : null,
          instant: Array.isArray(result?.instant) ? result.instant : null,
        });
      })
      .catch(() => {
        if (!aborter.signal.aborted) setGroups({ draw: null, instant: null });
      });
    return () => aborter.abort();
  }, [attempt]);

  function retry() {
    setGroups(null);
    setAttempt((value) => value + 1);
  }

  return (
    <div className="space-y-5">
      <PrizeSection id="premios-sorteios" title="Prêmios de sorteios"
        empty="Você ainda não tem prêmios de sorteios."
        items={groups === null ? undefined : groups.draw} />
      <PrizeSection id="cotas-premiadas" title="Cotas premiadas"
        empty="Você ainda não tem cotas premiadas."
        items={groups === null ? undefined : groups.instant} />
      {groups && (groups.draw === null || groups.instant === null) && (
        <button onClick={retry} type="button"
          className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-bold text-white hover:bg-violet-800">
          Tentar novamente
        </button>
      )}
    </div>
  );
}

function PrizeSection({ id, title, empty, items }: {
  id: string; title: string; empty: string; items: BuyerPrize[] | null | undefined;
}) {
  return (
    <section aria-labelledby={id} aria-busy={items === undefined} className={panel}>
      <h2 id={id} className="text-lg font-bold text-slate-950">{title}</h2>
      {items === undefined ? (
        <p className="mt-3 text-sm text-slate-600" role="status">Carregando prêmios...</p>
      ) : items === null ? (
        <p className="mt-3 text-sm text-red-700" role="alert">Não foi possível carregar esta lista.</p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">{empty}</p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {items.map((prize) => (
            <li key={prize.id} className="rounded-2xl border bg-slate-50 p-4">
              <p className="break-words font-bold text-slate-950">{prize.prizeName}</p>
              <p className="mt-1 break-words text-sm text-slate-600">{prize.campaignTitle}</p>
              <p className="mt-2 text-sm text-slate-700">Título <strong>{prize.ticketNumber}</strong></p>
              <p className="mt-2 text-sm font-semibold text-violet-800">{prize.status}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
