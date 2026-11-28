"use client";

import Link from "next/link";
import { ArrowUpRight, Award, FlaskConical, LoaderCircle, Ticket, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuthorizedUser } from "@/components/auth/RoleGate";
import PremiumScope from "@/components/premium/PremiumScope";
import { AuthApiError, authRequest } from "@/lib/auth/client";
import {
  parseBuyerDrawResults,
  type BuyerDrawResult,
} from "../../../../../packages/contracts/src/buyer-draw-results";
import styles from "./buyer-results-premium.module.css";

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
    <PremiumScope className={styles.page}>
      <div className={styles.wrap}>
        <header className={styles.hero}>
          <div>
            <p className={styles.kicker}>Área do comprador</p>
            <h1>Resultados</h1>
            <p>Veja as apurações disponíveis para os títulos da sua conta.</p>
          </div>
          <Trophy size={32} aria-hidden="true" />
        </header>
        <nav className={styles.links} aria-label="Atalhos dos resultados">
          <Link className={styles.button} href="/comprador/meus-numeros"><Ticket size={17} aria-hidden="true" /> Meus títulos <ArrowUpRight size={15} aria-hidden="true" /></Link>
          <Link className={styles.button} href="/comprador/meus-premios"><Award size={17} aria-hidden="true" /> Meus prêmios <ArrowUpRight size={15} aria-hidden="true" /></Link>
        </nav>
        <section aria-label="Apurações disponíveis">
          {!accountId ? <div className={styles.state}><p>Entre como comprador para consultar seus resultados.</p></div> :
            !result ? <div className={styles.state} role="status"><LoaderCircle className={styles.spinner} size={20} aria-hidden="true" /> Consultando os resultados dos seus pedidos…</div> :
            "message" in result ? (
              <div className={styles.state}>
                <p role="alert">{result.message}</p>
                <button className={styles.button} type="button" onClick={() => setAttempt((value) => value + 1)}>Tentar novamente</button>
              </div>
            ) : !result.items.length ? (
              <div className={styles.state}>
                <Trophy size={25} aria-hidden="true" />
                <p>Nenhum resultado disponível para os seus títulos.</p>
              </div>
            ) : (
              <ul className={styles.results} role="list">
                {result.items.map((campaign) => <ResultCard key={campaign.id} campaign={campaign} />)}
              </ul>
            )}
        </section>
      </div>
    </PremiumScope>
  );
}

function ResultCard({ campaign }: { campaign: BuyerDrawResult }) {
  return (
    <li>
      <article className={styles.card}>
        <header className={styles.cardHead}>
          <span className={styles.icon}>
            {campaign.synthetic ? <FlaskConical size={20} aria-hidden="true" /> : <Trophy size={20} aria-hidden="true" />}
          </span>
          <div>
            <p className={styles.badge} data-synthetic={campaign.synthetic || undefined}>
              {campaign.synthetic ? "Simulação de avaliação" : "Apuração confirmada"}
            </p>
            <h2>{campaign.title}</h2>
          </div>
        </header>
        {campaign.synthetic && <p className={styles.notice}>Resultado fictício de avaliação. Não houve sorteio nem premiação real.</p>}
        <dl className={styles.numbers}>
          {campaign.draws.map(({ winningNumber }, index) => (
            <div key={`${winningNumber}:${index}`}>
              <dt>{campaign.synthetic ? "Número simulado" : "Número apurado"}</dt>
              <dd>{winningNumber}</dd>
            </div>
          ))}
        </dl>
        {campaign.winners.length > 0 && (
          <section className={styles.prizes} aria-label="Prêmios desta apuração na sua conta">
            <h3>Prêmios desta apuração</h3>
            <ul role="list">
              {campaign.winners.map((winner) => (
                <li key={winner.id}>
                  <Award size={18} aria-hidden="true" />
                  <div><strong>{winner.prizeName}</strong><p>{winner.publicDisplayName || "Ganhador com divulgação restrita"}</p></div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </li>
  );
}
