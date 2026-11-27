"use client";

import { useEffect, useState } from "react";
import { useAuthorizedUser } from "@/components/auth/RoleGate";
import { AuthApiError, authRequest } from "@/lib/auth/client";
import {
  parseBuyerDrawResults,
  type BuyerDrawResult,
} from "../../../../../packages/contracts/src/buyer-draw-results";

type Result =
  | { items: BuyerDrawResult[] }
  | { message: string };
type Load = { accountId: string; attempt: number } & Result;

export default function BuyerResultsPage() {
  const user = useAuthorizedUser();
  const accountId = user?.role === "BUYER" ? user.id : null;
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState<Load>();

  useEffect(() => {
    if (!accountId) return;
    const controller = new AbortController();
    const update = (result: Result) => {
      if (!controller.signal.aborted) setLoad({ accountId, attempt, ...result });
    };
    void authRequest<unknown>("/api/buyer/results/my", {
      cache: "no-store",
      signal: controller.signal,
    }).then(parseBuyerDrawResults).then((items) => update({ items })).catch((cause) => {
      update({
        message: cause instanceof AuthApiError && cause.status === 404
          ? "Esta versão do ambiente ainda não oferece a consulta de resultados."
          : "Não foi possível consultar os resultados dos seus pedidos.",
      });
    });
    return () => controller.abort();
  }, [accountId, attempt]);

  const result = load?.accountId === accountId && load.attempt === attempt ? load : null;
  return (
    <section className="mx-auto max-w-3xl space-y-4 p-5 md:py-10">
      <h1 className="text-3xl font-black">Resultados</h1>
      {!accountId ? <p>Entre como comprador para consultar seus resultados.</p> :
        !result ? <p role="status">Consultando os resultados dos seus pedidos…</p> :
        "message" in result ? (
          <div className="space-y-2 rounded-2xl bg-white p-4">
            <p role="alert">{result.message}</p>
            <button className="font-bold text-violet-700" type="button"
              onClick={() => setAttempt((value) => value + 1)}>
              Tentar novamente
            </button>
          </div>
        ) : !result.items.length ? <p>Nenhum resultado disponível para os seus títulos.</p> :
          result.items.map((campaign) => (
            <article key={campaign.id} className="space-y-2 rounded-2xl bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold">{campaign.title}</h2>
              {campaign.synthetic && (
                <p className="text-sm font-semibold text-violet-900">
                  Resultado fictício de avaliação. Não houve sorteio nem premiação real.
                </p>
              )}
              {campaign.draws.map(({ winningNumber }) => (
                <p key={winningNumber}>
                  {campaign.synthetic ? "Número simulado" : "Número apurado"}: {winningNumber}
                </p>
              ))}
              {campaign.winners.map((winner) => (
                <p key={winner.id}>
                  {winner.publicDisplayName || "Ganhador com divulgação restrita"} · {winner.prizeName}
                </p>
              ))}
            </article>
          ))}
    </section>
  );
}
