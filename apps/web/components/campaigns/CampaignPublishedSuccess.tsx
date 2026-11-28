"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Edit3, ExternalLink, LoaderCircle } from "lucide-react";
import PremiumScope from "@/components/premium/PremiumScope";
import { getCampaign } from "@/lib/campaigns/client";
import type { Campaign } from "@/lib/campaigns/types";
import CampaignPublicLink from "./CampaignPublicLink";
import CampaignShare, {
  cleanTitle,
  isValidCampaignSlug,
  useCampaignPublicUrl,
} from "./CampaignShare";
import styles from "./campaign-published-premium.module.css";

export default function CampaignPublishedSuccess({ id }: { id: string }) {
  const [result, setResult] = useState<
    | { id: string; campaign: Campaign; error?: never }
    | { id: string; error: string; campaign?: never }
  >();
  useEffect(() => {
    let active = true;
    getCampaign(id)
      .then((campaign) => {
        if (active) setResult({ id, campaign });
      })
      .catch((cause) => {
        if (active)
          setResult({
            id,
            error:
              cause instanceof Error
                ? cause.message
                : "Não foi possível carregar a campanha.",
          });
      });
    return () => {
      active = false;
    };
  }, [id]);
  const campaign = result?.id === id ? result.campaign : undefined;
  const error = result?.id === id ? result.error : undefined;
  const published =
    campaign?.status === "PUBLISHED" && !campaign.publicationBlocked;
  const publicUrl = useCampaignPublicUrl(published ? campaign.slug : undefined);
  const validSlug = isValidCampaignSlug(campaign?.slug);

  return (
    <PremiumScope className={styles.scope}>
      <section className={styles.content} aria-label="Publicação da campanha">
        {error ? (
          <div className={styles.state}>
            <p role="alert">{error}</p>
            <Link href="/dashboard/campanhas" className="sx-premium-button">
              Voltar para Minhas campanhas
            </Link>
          </div>
        ) : !campaign ? (
          <div role="status" className={styles.state}>
            <LoaderCircle
              aria-hidden="true"
              size={22}
              className="motion-safe:animate-spin"
            />
            Carregando campanha…
          </div>
        ) : !published ? (
          <div className={styles.state}>
            <h1 className="sx-premium-title">
              Campanha indisponível para divulgação
            </h1>
            <p>
              O endereço público e as opções de compartilhamento são exibidos
              apenas para campanhas publicadas e liberadas.
            </p>
            <Link
              href={`/dashboard/campanhas/${campaign.id}/editar`}
              className="sx-premium-button"
            >
              Editar campanha
            </Link>
            <Link href="/dashboard/campanhas" className="sx-premium-button">
              Voltar para Minhas campanhas
            </Link>
          </div>
        ) : (
          <article className={styles.ticket}>
            <header className={styles.banner}>
              <CheckCircle2 aria-hidden="true" size={50} />
              <h1 className="sx-premium-title">
                Campanha publicada com sucesso
              </h1>
              <p>Sua campanha já está disponível para os compradores.</p>
            </header>
            <div className={styles.details}>
              <span className={styles.badge}>Publicada</span>
              <h2>{cleanTitle(campaign.title)}</h2>
              <div className={styles.linkBox}>
                <p>Endereço público da campanha</p>
                <CampaignPublicLink
                  slug={campaign.slug}
                  editHref={`/dashboard/campanhas/${campaign.id}/editar`}
                />
              </div>
              <div className={styles.actions}>
                {validSlug && publicUrl ? (
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="sx-premium-button"
                    data-variant="primary"
                  >
                    <ExternalLink aria-hidden="true" size={17} /> Abrir campanha
                  </a>
                ) : (
                  <Link
                    href={`/dashboard/campanhas/${campaign.id}/editar`}
                    className="sx-premium-button"
                  >
                    Corrigir link
                  </Link>
                )}
                <Link
                  href={`/dashboard/campanhas/${campaign.id}/editar`}
                  className="sx-premium-button"
                >
                  <Edit3 aria-hidden="true" size={17} /> Editar campanha
                </Link>
                <div className={styles.share}>
                  <CampaignShare title={campaign.title} slug={campaign.slug} />
                </div>
              </div>
            </div>
          </article>
        )}
      </section>
    </PremiumScope>
  );
}
