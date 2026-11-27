"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, BadgeCheck, Bell, CalendarDays, LoaderCircle, Search, Ticket } from "lucide-react";
import PremiumScope from "@/components/premium/PremiumScope";
import { useAuthorizedUser } from "@/components/auth/RoleGate";
import { authRequest } from "@/lib/auth/client";
import { getBuyerHome } from "@/lib/buyer/client";
import type { BuyerCampaign, BuyerHome } from "@/lib/buyer/types";
import { versionedCoverUrl } from "@/lib/campaigns/cover-revision";
import styles from "./buyer-home-premium.module.css";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const percent = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });

export default function CompradorHome() {
  const user = useAuthorizedUser();
  return <BuyerHomeContent key={user?.id ?? "buyer-home"} />;
}

function BuyerHomeContent() {
  const router = useRouter();
  const [data, setData] = useState<BuyerHome | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getBuyerHome());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar seus dados.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function logout() {
    await authRequest("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
  }

  return (
    <PremiumScope className={styles.page}>
      {loading ? (
        <div className={styles.state} role="status">
          <LoaderCircle size={22} className={styles.spinner} aria-hidden="true" /> Carregando sua conta…
        </div>
      ) : error ? (
        <section className={styles.state}>
          <h1 className={styles.heading}>Não foi possível carregar seus dados.</h1>
          <p role="alert" className={styles.error}>{error}</p>
          <div className={styles.errorActions}>
            <button type="button" onClick={() => void load()} className={styles.primary}>Tentar novamente</button>
            <button type="button" onClick={() => router.replace("/")} className={styles.control}>Voltar ao início</button>
            <button type="button" onClick={() => void logout()} className={styles.control}>Sair da conta</button>
          </div>
        </section>
      ) : data && (
        <>
          <header className={styles.hero}>
            <div>
              <p className={styles.eyebrow}>Área do comprador</p>
              <h1 className={styles.title}>Olá, {data.profile.name.trim().split(/\s+/)[0] || "comprador"}</h1>
              <p className={styles.copy}>Encontre campanhas, confira os prêmios e acompanhe seus títulos.</p>
            </div>
            <Link href="/comprador/notificacoes" className={styles.inbox} aria-label="Notificações" aria-describedby={data.unreadNotifications ? "buyer-home-unread" : undefined}>
              <Bell size={22} aria-hidden="true" />
              {data.unreadNotifications > 0 && (
                <>
                  <span className={styles.inboxCount} aria-hidden="true">{data.unreadNotifications}</span>
                  <span id="buyer-home-unread" className="sr-only">
                    {data.unreadNotifications === 1 ? "1 notificação não lida" : `${data.unreadNotifications} notificações não lidas`}
                  </span>
                </>
              )}
            </Link>
            <Link href="/comprador/sorteios" className={styles.search}>
              <Search size={19} aria-hidden="true" /> Buscar campanhas e prêmios <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </header>
          {!!data.banners.length && (
            <section className={styles.banners} aria-label="Avisos">
              {data.banners.map((banner) => <Banner key={banner.id} banner={banner} />)}
            </section>
          )}
          <CampaignSection title="Em destaque" items={data.featured} />
          <CampaignSection title="Campanhas publicadas" items={data.live} />
          <CampaignSection title="Em breve" items={data.upcoming} />
        </>
      )}
    </PremiumScope>
  );
}

function usableBannerHref(value: string | null) {
  if (!value || value.includes("\\")) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? value : null;
  } catch {
    return null;
  }
}

function Banner({ banner }: { banner: BuyerHome["banners"][number] }) {
  const content = (
    <>
      <h2 className={styles.bannerTitle}>{banner.title}</h2>
      {banner.subtitle && <p>{banner.subtitle}</p>}
    </>
  );
  const href = usableBannerHref(banner.linkUrl);
  return href ? (
    <Link href={href} prefetch={false} className={styles.banner}>
      <div>{content}</div><ArrowUpRight size={20} aria-hidden="true" />
    </Link>
  ) : <article className={styles.banner}><div>{content}</div></article>;
}

function CampaignSection({ title, items }: { title: string; items: BuyerHome["live"] }) {
  const sectionId = `buyer-home-${title === "Em destaque" ? "featured" : title === "Em breve" ? "upcoming" : "published"}`;
  return (
    <section aria-labelledby={sectionId} className={styles.campaignSection}>
      <header>
        <h2 className={styles.heading} id={sectionId}>{title}</h2>
        <Link href="/comprador/sorteios" className={styles.control}>
          Ver todas <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      </header>
      {items.length ? (
        <ul className={styles.campaigns}>
          {items.map((campaign) => <li key={campaign.id}><HomeCampaignCard campaign={campaign} /></li>)}
        </ul>
      ) : <p className={styles.empty}>Nenhuma campanha disponível agora.</p>}
    </section>
  );
}

function HomeCampaignCard({ campaign }: { campaign: BuyerCampaign }) {
  const cover = campaign.coverImageUrl
    ? versionedCoverUrl(campaign.coverImageUrl, campaign.coverImageRevision)
    : null;
  const draw = campaign.drawDate && Number.isFinite(Date.parse(campaign.drawDate)) ? date.format(new Date(campaign.drawDate)) : "Data a definir";
  const sold = Number.isFinite(campaign.soldPercentage) ? Math.max(0, Math.min(100, campaign.soldPercentage)) : null;
  return (
    <Link href={`/campanha/${campaign.slug}`} prefetch={false} className={styles.card}>
      <div className={styles.media}>
        <CampaignCover key={cover ?? "no-cover"} url={cover} title={campaign.title} />
        <span className={styles.price}>{brl.format(campaign.numberPrice)} por título</span>
      </div>
      <div className={styles.cardBody}>
        <p className={styles.organizer}>
          {campaign.organizer.name}
          {campaign.organizer.verified && <BadgeCheck size={15} role="img" aria-label="Organizador verificado" />}
        </p>
        <h3>{campaign.title}</h3>
        {sold !== null && <progress className={styles.progress} value={sold} max={100} aria-label="Percentual de títulos vendidos" />}
        <div className={styles.cardMeta}>
          {sold !== null && <span>{percent.format(sold)}% vendido</span>}
          <span><CalendarDays size={15} aria-hidden="true" /> {draw}</span>
        </div>
        <span className={styles.cardCta}>Ver campanha <ArrowUpRight size={16} aria-hidden="true" /></span>
      </div>
    </Link>
  );
}

function CampaignCover({ url, title }: { url: string | null; title: string }) {
  const [failed, setFailed] = useState(false);
  return url && !failed ? (
    <Image src={url} alt={title} fill sizes="(min-width: 1200px) 30vw, (min-width: 720px) 44vw, 94vw"
      className={styles.cover} unoptimized onError={() => setFailed(true)} />
  ) : (
    <div className={styles.noCover}><Ticket size={32} aria-hidden="true" /> <span>Sem imagem disponível</span></div>
  );
}
