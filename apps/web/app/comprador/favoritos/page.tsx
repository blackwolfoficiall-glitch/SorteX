"use client";

import { ArrowUpRight, Heart, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useAuthorizedUser } from "@/components/auth/RoleGate";
import CampaignCard from "@/components/comprador/CampaignCard";
import PremiumScope from "@/components/premium/PremiumScope";
import { useFavorites } from "@/lib/buyer/use-favorites";
import styles from "./favorites-premium.module.css";

export default function Favoritos() {
  const user = useAuthorizedUser();
  const { items, busy, error, update } = useFavorites(
    user?.role === "BUYER" ? user.id : null,
  );
  return (
    <PremiumScope className={styles.scope}>
      <section className={styles.content} aria-labelledby="buyer-favorites-title" aria-busy={busy}>
        <header className={styles.banner}>
          <span className={styles.icon}><Heart aria-hidden="true" size={22} /></span>
          <div className={styles.intro}>
            <p className={styles.eyebrow}>Área do comprador</p>
            <h1 id="buyer-favorites-title" className="sx-premium-title">Favoritos</h1>
            <p className={styles.description}>
              Sua lista é privada. Apenas campanhas que continuam públicas aparecem aqui.
            </p>
          </div>
          <Link href="/comprador/sorteios" className="sx-premium-button">
            Ver sorteios <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </header>
        {user?.role !== "BUYER" && (
          <p role="alert" className={styles.error}>
            Entre como comprador para consultar seus favoritos.
          </p>
        )}
        {busy && (
          <p role="status" className={styles.status}>Atualizando favoritos…</p>
        )}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {items?.length === 0 && !busy && (
          <p className={styles.empty}>Nenhuma campanha pública salva.</p>
        )}
        {!!items?.length && (
          <ul className={styles.grid} aria-label="Campanhas favoritas">
            {items.map(({ id, campaign }) => (
              <li key={id} className={styles.item}>
                <CampaignCard campaign={campaign} />
                <button
                  type="button"
                  disabled={busy}
                  aria-label={`Remover dos favoritos: ${campaign.title}`}
                  onClick={() =>
                    void update({ campaignId: campaign.id, saved: false })
                  }
                  className={styles.remove}
                >
                  <Trash2 size={16} aria-hidden="true" /> Remover dos favoritos
                </button>
              </li>
            ))}
          </ul>
        )}
        {user?.role === "BUYER" && !busy && (
          <button type="button" onClick={() => void update()} className={`sx-premium-button ${styles.refresh}`}>
            <RefreshCw size={16} aria-hidden="true" />
            {error ? "Tentar novamente" : "Atualizar favoritos"}
          </button>
        )}
      </section>
    </PremiumScope>
  );
}
