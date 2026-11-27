"use client";

import Link from "next/link";
import { ArrowUpRight, Award, Clock3, LoaderCircle, Ticket, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuthorizedUser } from "@/components/auth/RoleGate";
import PremiumScope from "@/components/premium/PremiumScope";
import { authRequest } from "@/lib/auth/client";
import type { BuyerPrize, BuyerPrizes as PrizeGroups } from "@/lib/buyer/prizes";

import styles from "./buyer-prizes-premium.module.css";

export default function BuyerPrizes() {
  const user = useAuthorizedUser();
  return (
    <PremiumScope className={styles.page}>
      <div className={styles.wrap}>
        <header className={styles.hero}>
          <div>
            <p className={styles.kicker}>Área do comprador</p>
            <h1>Meus prêmios</h1>
            <p>Acompanhe seus prêmios e a situação de cada entrega.</p>
          </div>
          <Award size={32} aria-hidden="true" />
        </header>
        <nav className={styles.links} aria-label="Atalhos dos prêmios">
          <Link className={styles.button} href="/comprador/resultados"><Trophy size={17} aria-hidden="true" /> Resultados <ArrowUpRight size={15} aria-hidden="true" /></Link>
          <Link className={styles.button} href="/comprador/meus-numeros"><Ticket size={17} aria-hidden="true" /> Meus títulos <ArrowUpRight size={15} aria-hidden="true" /></Link>
        </nav>
        {user?.role === "BUYER"
          ? <PrizeLists key={user.id} />
          : <p className={styles.restricted}>A consulta de prêmios é exclusiva para a conta compradora.</p>}
      </div>
    </PremiumScope>
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
    <div className={styles.lists}>
      <div className={styles.grid}>
        <PrizeSection id="premios-sorteios" title="Prêmios de sorteios" icon={Trophy}
          empty="Você ainda não tem prêmios de sorteios."
          items={groups === null ? undefined : groups.draw} />
        <PrizeSection id="cotas-premiadas" title="Cotas premiadas" icon={Ticket}
          empty="Você ainda não tem cotas premiadas."
          items={groups === null ? undefined : groups.instant} />
      </div>
      {groups && (groups.draw === null || groups.instant === null) && (
        <button onClick={retry} type="button" className={styles.button}>Tentar novamente</button>
      )}
    </div>
  );
}

function PrizeSection({ id, title, empty, icon: Icon, items }: {
  id: string; title: string; empty: string; icon: typeof Trophy; items: BuyerPrize[] | null | undefined;
}) {
  return (
    <section aria-labelledby={id} className={styles.panel}>
      <header className={styles.panelHead}>
        <span className={styles.icon}><Icon size={20} aria-hidden="true" /></span>
        <h2 id={id}>{title}</h2>
      </header>
      {items === undefined ? (
        <p className={styles.state} role="status"><LoaderCircle className={styles.spinner} size={17} aria-hidden="true" /> Carregando prêmios…</p>
      ) : items === null ? (
        <p className={styles.state} role="alert">Não foi possível carregar esta lista.</p>
      ) : items.length === 0 ? (
        <p className={styles.state}>{empty}</p>
      ) : (
        <ul className={styles.prizes} role="list">
          {items.map((prize) => (
            <li key={prize.id}>
              <h3>{prize.prizeName}</h3>
              <p className={styles.campaign}>{prize.campaignTitle}</p>
              <dl className={styles.facts}>
                <div><dt>Título</dt><dd className={styles.number}>{prize.ticketNumber}</dd></div>
                <div><dt>Situação</dt><dd className={styles.status}><Clock3 size={14} aria-hidden="true" /> {prize.status}</dd></div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
