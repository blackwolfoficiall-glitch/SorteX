import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, CalendarDays, Ticket } from "lucide-react";
import type { FavoriteCampaignCard } from "../../../../packages/contracts/src/buyer-favorites";
import { versionedCoverUrl } from "@/lib/campaigns/cover-revision";
import styles from "./favorite-campaign.module.css";

export default function CampaignCard({ campaign }: { campaign: FavoriteCampaignCard }) {
  return (
    <Link href={`/campanha/${campaign.slug}`} className={styles.card}>
      <div className={styles.cover}>
        {campaign.coverImageUrl ? (
          <Image
            src={versionedCoverUrl(campaign.coverImageUrl, campaign.coverImageRevision)}
            alt={campaign.title}
            fill
            className={styles.photo}
            unoptimized
          />
        ) : (
          <Ticket aria-hidden="true" size={44} />
        )}
        <span className={styles.price}>R$ {campaign.numberPrice.toFixed(2).replace(".", ",")}</span>
      </div>
      <div className={styles.body}>
        <div className={styles.organizer}>
          <span>{campaign.organizer.name}</span>
          {campaign.organizer.verified && <BadgeCheck size={15} aria-label="Organizador verificado" role="img" />}
        </div>
        <h2 className={styles.title}>{campaign.title}</h2>
        <div className={styles.track} aria-hidden="true">
          <div className={styles.fill} style={{ width: `${campaign.soldPercentage}%` }} />
        </div>
        <div className={styles.metrics}>
          <span>{campaign.soldPercentage}% vendido</span>
          <span><CalendarDays size={14} aria-hidden="true" />{campaign.drawDate ? new Date(campaign.drawDate).toLocaleDateString("pt-BR") : "A definir"}</span>
        </div>
      </div>
    </Link>
  );
}
