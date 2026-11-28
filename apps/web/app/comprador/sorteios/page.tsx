"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ArrowUpRight, BadgeCheck, CalendarDays, Heart, LoaderCircle, Search, Ticket } from "lucide-react";
import { useAuthorizedUser } from "@/components/auth/RoleGate";
import PremiumScope from "@/components/premium/PremiumScope";
import { getBuyerCampaigns } from "@/lib/buyer/client";
import type { BuyerCampaign } from "@/lib/buyer/types";
import { useFavorites } from "@/lib/buyer/use-favorites";
import { versionedCoverUrl } from "@/lib/campaigns/cover-revision";
import cardStyles from "../buyer-home-premium.module.css";
import styles from "./buyer-catalog-premium.module.css";

const categories = [
  ["ALL", "Todas"], ["AUTOMOBILE", "Automóveis"], ["MOTORCYCLE", "Motos"],
  ["ELECTRONICS", "Eletrônicos"], ["CASH", "Dinheiro"], ["TRAVEL", "Viagens"], ["OTHER", "Outros"],
] as const;
const filters = [
  ["", "Mais recentes"], ["LIVE", "Publicadas"], ["UPCOMING", "Em breve"],
  ["MOST_SOLD", "Mais vendidos"], ["LOWEST_PRICE", "Menor preço"], ["ENDING", "Data do sorteio mais próxima"],
] as const;
type Category = (typeof categories)[number][0];
type Filter = (typeof filters)[number][0];
type Catalog = Awaited<ReturnType<typeof getBuyerCampaigns>>;
type Result = { key: string } & ({ data: Catalog } | { failure: true });

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const percent = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });

function Loading() {
  return <div className={styles.state} role="status"><LoaderCircle size={19} aria-hidden="true" className={styles.spinner} /> Carregando campanhas…</div>;
}

export default function SorteiosPage() {
  return (
    <PremiumScope className={styles.page}>
      <Suspense fallback={<Loading />}><CatalogEntry /></Suspense>
    </PremiumScope>
  );
}

function CatalogEntry() {
  const initial = useSearchParams().get("filter");
  const user = useAuthorizedUser();
  const filter = filters.find(([value]) => value === initial)?.[0] ?? "";
  const buyerId = user?.role === "BUYER" ? user.id : null;
  return <BuyerCatalog key={`${user?.id ?? ""}:${filter}`} buyerId={buyerId} initialFilter={filter} />;
}

function BuyerCatalog({ buyerId, initialFilter }: { buyerId: string | null; initialFilter: Filter }) {
  const favorites = useFavorites(buyerId);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("ALL");
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const query = new URLSearchParams({ search: search.trim(), category, page: String(page), ...(filter ? { filter } : {}) }).toString();
  const key = `${query}:${attempt}`;
  const current = result?.key === key ? result : null;
  const data = current && "data" in current ? current.data : null;
  const saved = new Set(favorites.items?.map(({ campaign }) => campaign.id));

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void getBuyerCampaigns(`?${query}`)
        .then((data) => { if (active) setResult({ key, data }); })
        .catch(() => { if (active) setResult({ key, failure: true }); });
    }, search ? 220 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [key, query, search]);

  const refresh = () => setAttempt((n) => n + 1);
  function resetPage() {
    setPage(1);
    refresh();
  }
  function clear() {
    setSearch("");
    setCategory("ALL");
    setFilter("");
    resetPage();
  }
  const filtered = Boolean(search.trim() || category !== "ALL" || filter);

  return (
    <>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Área do comprador</p>
          <h1 className={styles.title}>Sorteios</h1>
          <p className={styles.copy}>Explore campanhas publicadas e confira prêmios, datas e valor por título.</p>
        </div>
        {buyerId && <Link href="/comprador/favoritos" className={styles.control}><Heart size={18} aria-hidden="true" /> Meus favoritos</Link>}
      </header>
      {buyerId && favorites.busy && <p role="status" className={styles.copy}>Atualizando favoritos…</p>}
      {favorites.error && (
        <div className={styles.notice}>
          <p role="alert">{favorites.error}</p>
          <button type="button" onClick={() => void favorites.update()} className={styles.control}>Tentar carregar favoritos novamente</button>
        </div>
      )}
      <section aria-label="Filtros de campanhas" className={styles.filters}>
        <div className={styles.fields}>
          <label>
            Buscar campanha ou prêmio
            <span className={styles.search}>
              <Search size={18} aria-hidden="true" />
              <input type="search" placeholder="Nome da campanha ou do prêmio" value={search} onChange={(event) => { setSearch(event.target.value); resetPage(); }} />
            </span>
          </label>
          <label>
            Exibição
            <select value={filter} aria-label="Exibição" onChange={(event) => {
              const selected = filters.find(([value]) => value === event.target.value);
              if (selected) { setFilter(selected[0]); resetPage(); }
            }}>
              {filters.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
        <div className={styles.categories} role="group" aria-label="Categorias">
          {categories.map(([value, label]) => (
            <button key={value} type="button" aria-pressed={category === value} className={styles.control}
              onClick={() => { setCategory(value); resetPage(); }}>{label}</button>
          ))}
        </div>
        {filtered && <button type="button" onClick={clear} className={styles.control}>Limpar filtros</button>}
        {filter === "LIVE" && <p className={styles.copy}>Esta opção lista campanhas publicadas. Confira a disponibilidade de títulos e as datas no detalhe.</p>}
      </section>

      {!current ? <Loading /> : "failure" in current ? (
        <section className={styles.state}>
          <p role="alert">Não foi possível carregar as campanhas.</p>
          <button type="button" onClick={refresh} className={styles.primary}>Tentar novamente</button>
        </section>
      ) : !data?.items.length ? (
        <section className={styles.state}><Ticket size={21} aria-hidden="true" />
          <h2 className={styles.heading}>Nenhuma campanha encontrada.</h2>
          {filtered && <p className={styles.copy}>Altere o termo de busca ou limpe os filtros.</p>}
        </section>
      ) : (
        <section aria-label="Campanhas encontradas" className={styles.list}>
          <p className={styles.copy} aria-live="polite">{data.total.toLocaleString("pt-BR")} {data.total === 1 ? "campanha encontrada" : "campanhas encontradas"}</p>
          <ul className={cardStyles.campaigns}>
            {data.items.map((campaign) => (
              <li key={campaign.id} className={styles.item}>
                <CatalogCard campaign={campaign} upcoming={filter === "UPCOMING"} />
                {favorites.items && (
                  <button type="button" disabled={favorites.busy} className={styles.favorite} aria-pressed={saved.has(campaign.id)}
                    aria-label={`${saved.has(campaign.id) ? "Remover dos favoritos" : "Salvar nos favoritos"}: ${campaign.title}`}
                    onClick={() => void favorites.update({ campaignId: campaign.id, saved: !saved.has(campaign.id) })}>
                    <Heart size={16} aria-hidden="true" />
                    {saved.has(campaign.id) ? "Remover dos favoritos" : "Salvar nos favoritos"}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {data.pages > 1 && (
            <nav aria-label="Paginação de sorteios" className={styles.pagination}>
              <button type="button" className={styles.control} disabled={data.page <= 1} onClick={() => { setPage(data.page - 1); refresh(); }}>Anterior</button>
              <span>Página {data.page} de {data.pages}</span>
              <button type="button" className={styles.control} disabled={data.page >= data.pages} onClick={() => { setPage(data.page + 1); refresh(); }}>Próxima</button>
            </nav>
          )}
        </section>
      )}
    </>
  );
}

function CatalogCard({ campaign, upcoming }: { campaign: BuyerCampaign; upcoming: boolean }) {
  const cover = campaign.coverImageUrl ? versionedCoverUrl(campaign.coverImageUrl, campaign.coverImageRevision) : null;
  const draw = campaign.drawDate && Number.isFinite(Date.parse(campaign.drawDate)) ? date.format(new Date(campaign.drawDate)) : "Data a definir";
  const sold = Number.isFinite(campaign.soldPercentage) ? Math.max(0, Math.min(100, campaign.soldPercentage)) : null;
  return (
    <Link href={`/campanha/${campaign.slug}`} prefetch={false} className={cardStyles.card}>
      <div className={cardStyles.media}>
        <CampaignCover key={cover ?? "no-cover"} src={cover} title={campaign.title} />
        <span className={cardStyles.price}>{money.format(campaign.numberPrice)} por título</span>
      </div>
      <div className={cardStyles.cardBody}>
        <p className={cardStyles.organizer}>
          {campaign.organizer.name}
          {campaign.organizer.verified && <BadgeCheck size={15} role="img" aria-label="Organizador verificado" />}
          {upcoming && <strong className={styles.upcoming}>Em breve</strong>}
        </p>
        <h2 className={styles.cardTitle}>{campaign.title}</h2>
        {sold !== null && <progress className={cardStyles.progress} value={sold} max={100} aria-label="Percentual de títulos vendidos" />}
        <div className={cardStyles.cardMeta}>
          {sold !== null && <span>{percent.format(sold)}% vendido</span>}
          <span><CalendarDays size={15} aria-hidden="true" /> {draw}</span>
        </div>
        <span className={cardStyles.cardCta}>Ver campanha <ArrowUpRight size={16} aria-hidden="true" /></span>
      </div>
    </Link>
  );
}

function CampaignCover({ src, title }: { src: string | null; title: string }) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? (
    <Image src={src} alt={title} fill sizes="(min-width: 1200px) 30vw, (min-width: 720px) 44vw, 94vw"
      className={cardStyles.cover} unoptimized onError={() => setFailed(true)} />
  ) : <div className={cardStyles.noCover}><Ticket size={32} aria-hidden="true" /> <span>Sem imagem disponível</span></div>;
}
