"use client";

import { campaignPublicationNotice, publicationError } from "@/lib/campaigns/publication";
import { versionedCoverUrl } from "@/lib/campaigns/cover-revision";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Copy,
  Edit3,
  ExternalLink,
  Gift,
  LoaderCircle,
  PauseCircle,
  Plus,
  Rocket,
  Search,
  Ticket,
  Trash2,
} from "lucide-react";
import PremiumScope from "@/components/premium/PremiumScope";
import styles from "./CampaignDashboard.module.css";
import {
  deleteCampaign,
  duplicateCampaign,
  finishCampaign,
  getMyCampaigns,
  pauseCampaign,
  publishCampaign,
} from "@/lib/campaigns/client";
import type { Campaign, CampaignStatus } from "@/lib/campaigns/types";
import CampaignShare, { cleanTitle, isValidCampaignSlug } from "./CampaignShare";
import CampaignPublicLink from "./CampaignPublicLink";

type CampaignTab = "DRAFT" | "PUBLISHED" | "PAUSED" | "FINISHED";
type SortOption = "default" | "sold" | "recent" | "revenue" | "drawDate";

const PAGE_SIZE = 6;
const tabs: Array<{ label: string; value?: CampaignTab }> = [
  { label: "Todas" },
  { label: "Rascunhos", value: "DRAFT" },
  { label: "Publicadas", value: "PUBLISHED" },
  { label: "Pausadas", value: "PAUSED" },
  { label: "Finalizadas", value: "FINISHED" },
];
const sortOptions: Array<{ label: string; value: SortOption }> = [
  { label: "Todos", value: "default" },
  { label: "Mais vendidos", value: "sold" },
  { label: "Mais recentes", value: "recent" },
  { label: "Maior faturamento", value: "revenue" },
  { label: "Data do sorteio", value: "drawDate" },
];
const statusLabel: Record<CampaignStatus, string> = {
  DRAFT: "Rascunho",
  PENDING_REVIEW: "Rascunho",
  PUBLISHED: "Publicada",
  PAUSED: "Pausada",
  SOLD_OUT: "Finalizada",
  DRAWN: "Finalizada",
  FINISHED: "Finalizada",
  CANCELLED: "Finalizada",
};
const statusTone: Record<CampaignStatus, "neutral" | "live" | "paused"> = {
  DRAFT: "neutral",
  PENDING_REVIEW: "neutral",
  PUBLISHED: "live",
  PAUSED: "paused",
  SOLD_OUT: "neutral",
  DRAWN: "neutral",
  FINISHED: "neutral",
  CANCELLED: "neutral",
};

export default function CampaignDashboard() {
  const searchParams = useSearchParams();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const requestedStatus = searchParams.get("status");
  const [status, setStatus] = useState<CampaignTab | undefined>(requestedStatus && ["DRAFT", "PUBLISHED", "PAUSED", "FINISHED"].includes(requestedStatus) ? requestedStatus as CampaignTab : undefined);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("default");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState<{ id: string; message: string; publication: boolean }>();
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError("");
    try {
      const items = await getMyCampaigns();
      if (sequence === requestSequence.current) setCampaigns(items);
    } catch (cause) {
      if (sequence === requestSequence.current) setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar as campanhas.",
      );
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const sequence = ++requestSequence.current;
    getMyCampaigns()
      .then((items) => {
        if (sequence === requestSequence.current) setCampaigns(items);
      })
      .catch((cause) => {
        if (sequence === requestSequence.current)
          setError(cause instanceof Error ? cause.message : "Não foi possível carregar as campanhas.");
      })
      .finally(() => {
        if (sequence === requestSequence.current) setLoading(false);
      });
    return () => {
      requestSequence.current += 1;
    };
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return campaigns
      .filter((campaign) => {
        if (status === "DRAFT" && !["DRAFT", "PENDING_REVIEW"].includes(campaign.status)) return false;
        if (status === "FINISHED" && !["FINISHED", "SOLD_OUT", "DRAWN", "CANCELLED"].includes(campaign.status)) return false;
        if (status && !["DRAFT", "FINISHED"].includes(status) && campaign.status !== status) return false;
        if (query && !cleanTitle(campaign.title).toLocaleLowerCase("pt-BR").includes(query)) return false;
        return true;
      })
      .sort((a, b) => {
        if (sort === "revenue") return b.grossRevenue - a.grossRevenue;
        if (sort === "sold") return soldPercent(b) - soldPercent(a);
        if (sort === "drawDate") return dateValue(a.drawDate) - dateValue(b.drawDate);
        if (sort === "recent") return +new Date(b.createdAt) - +new Date(a.createdAt);
        return 0;
      });
  }, [campaigns, status, search, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleCampaigns = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function run(id: string, operation: () => Promise<unknown>, publication = false) {
    if (busyId) return;
    setBusyId(id);
    setActionError(undefined);
    try {
      await operation();
      await load();
    } catch (cause) {
      setActionError({
        id,
        publication,
        message: publication ? publicationError(cause) : cause instanceof Error ? cause.message : "Não foi possível concluir a ação.",
      });
    } finally {
      setBusyId("");
    }
  }

  function remove(campaign: Campaign) {
    if (!window.confirm(`Excluir o rascunho “${cleanTitle(campaign.title)}”?`)) return;
    void run(campaign.id, () => deleteCampaign(campaign.id));
  }

  return (
    <PremiumScope className={styles.scope}>
      <section className={styles.content} aria-labelledby="campaigns-title">
        <header className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>Central do organizador</p>
            <h1 id="campaigns-title" className="sx-premium-title">Minhas Campanhas</h1>
            <p className={styles.muted}>Gerencie suas campanhas e acompanhe as cotas vendidas.</p>
          </div>
          <Link href="/dashboard/campanhas/nova" className={styles.primary}>
            <Plus size={19} aria-hidden="true" /> Criar nova rifa
          </Link>
        </header>

        <section className={styles.filters} aria-label="Filtros de campanhas">
          <div className={styles.chips} role="group" aria-label="Situação da campanha">
            {tabs.map((tab) => (
              <button
                key={tab.label}
                type="button"
                aria-pressed={status === tab.value}
                onClick={() => { setStatus(tab.value); setPage(1); }}
                className={styles.chip}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className={styles.filterRow}>
            <label className={styles.search}>
              <Search size={18} aria-hidden="true" />
              <input
                type="search"
                aria-label="Pesquisar campanha"
                placeholder="Pesquisar campanha"
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              />
            </label>
            <div className={styles.chips} role="group" aria-label="Ordenar campanhas">
              {sortOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={sort === option.value}
                  onClick={() => { setSort(option.value); setPage(1); }}
                  className={styles.chip}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {error && (
          <div className={styles.error} role="alert">
            <p>Não foi possível carregar suas campanhas.</p>
            <button type="button" className={styles.control} disabled={loading} onClick={() => void load()}>
              Tentar novamente
            </button>
          </div>
        )}
        {loading ? (
          <div className={styles.state} role="status">
            <LoaderCircle className={styles.loadingIcon} aria-hidden="true" />
            Carregando campanhas…
          </div>
        ) : error ? null : visibleCampaigns.length === 0 ? (
          <section className={styles.state}>
            <Ticket size={36} aria-hidden="true" />
            <h2 className="sx-premium-section">Nenhuma campanha encontrada</h2>
            <p>Ajuste os filtros ou crie uma nova campanha.</p>
          </section>
        ) : (
          <>
            <p className={styles.resultCount} role="status">
              {filtered.length === 1 ? "1 campanha encontrada" : `${filtered.length} campanhas encontradas`}
            </p>
            <div className={styles.grid}>
              {visibleCampaigns.map((campaign) => (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  busy={Boolean(busyId)}
                  actionError={actionError?.id === campaign.id ? actionError : undefined}
                  refresh={() => { setActionError(undefined); void load(); }}
                  run={run}
                  remove={remove}
                />
              ))}
            </div>
          </>
        )}

        {filtered.length > PAGE_SIZE && (
          <nav aria-label="Paginação das campanhas" className={styles.pagination}>
            <button type="button" className={styles.control} disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Anterior</button>
            <span>Página {page} de {totalPages}</span>
            <button type="button" className={styles.control} disabled={page === totalPages} onClick={() => setPage((current) => current + 1)}>Próxima</button>
          </nav>
        )}
      </section>
    </PremiumScope>
  );
}

function CampaignCard({ campaign, busy, actionError, refresh, run, remove }: {
  campaign: Campaign;
  busy: boolean;
  actionError?: { message: string; publication: boolean };
  refresh: () => void;
  run: (id: string, operation: () => Promise<unknown>, publication?: boolean) => Promise<void>;
  remove: (campaign: Campaign) => void;
}) {
  const [failedCover, setFailedCover] = useState("");
  const coverUrl = campaign.coverImageUrl
    ? versionedCoverUrl(ownedMediaUrl(campaign.coverImageUrl), campaign.coverImageRevision)
    : "";
  const percent = soldPercent(campaign);
  const isDraft = ["DRAFT", "PENDING_REVIEW"].includes(campaign.status);
  const canPublish = isDraft || campaign.status === "PAUSED";
  const canPause = campaign.status === "PUBLISHED";
  const canFinish = ["PUBLISHED", "PAUSED"].includes(campaign.status);
  const publishNotice = canPublish ? campaignPublicationNotice(campaign) : undefined;
  const editable = isDraft || campaign.status === "PUBLISHED" || campaign.status === "PAUSED";
  function finish() {
    if (window.confirm("Encerrar esta campanha? O link público ficará indisponível e esta ação não pode ser desfeita aqui.")) {
      void run(campaign.id, () => finishCampaign(campaign.id));
    }
  }
  return (
    <article className={styles.campaign}>
      <div className={styles.cover}>
        {coverUrl && failedCover !== coverUrl ? (
          <Image
            src={coverUrl}
            onError={() => setFailedCover(coverUrl)}
            alt={campaign.title}
            fill
            unoptimized
            sizes="(min-width: 1100px) 45vw, 100vw"
            className={styles.coverPhoto}
          />
        ) : (
          <Ticket size={45} aria-hidden="true" />
        )}
      </div>
      <div className={styles.cardBody}>
        <div className={styles.cardHeading}>
          <span className={styles.badge} data-tone={statusTone[campaign.status]}>
            {statusLabel[campaign.status]}
          </span>
          <h2 className="sx-premium-section">{cleanTitle(campaign.title)}</h2>
        </div>
        <dl className={styles.metrics}>
          <Info label="Valor arrecadado" value={money(campaign.grossRevenue)} />
          <Info label="Quantidade vendida" value={campaign.soldNumbers.toLocaleString("pt-BR")} />
        </dl>
        <div className={styles.saleProgress}>
          <div className={styles.progressLabel}>
            <span>Percentual vendido</span>
            <strong>{percent.toFixed(1)}%</strong>
          </div>
          <div
            role="progressbar"
            aria-label="Percentual vendido"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Number(percent.toFixed(1))}
            className={styles.track}
          >
            <div style={{ width: `${percent}%` }} />
          </div>
        </div>
        <p className={styles.drawDate}>
          <CalendarDays size={16} aria-hidden="true" />
          {campaign.drawDate ? new Date(campaign.drawDate).toLocaleDateString("pt-BR") : "Sorteio não definido"}
        </p>

        {campaign.instantPrizes.length > 0 && (
          <section className={styles.prizes}>
            <h3><Gift size={16} aria-hidden="true" /> Cotas premiadas</h3>
            <dl className={styles.prizeMetrics}>
              <Info label="Total" value={String(campaign.instantPrizes.length)} />
              <Info label="Encontradas" value={String(campaign.instantPrizes.filter(prize => ["FOUND", "DELIVERED"].includes(prize.status)).length)} />
              <Info label="Disponíveis" value={String(campaign.instantPrizes.filter(prize => prize.status === "AVAILABLE").length)} />
            </dl>
          </section>
        )}

        {campaign.status === "PUBLISHED" && (
          <div className={styles.publicLink}>
            <p>Link da campanha</p>
            <CampaignPublicLink compact slug={campaign.slug} editHref={`/dashboard/campanhas/${campaign.id}/editar`} />
          </div>
        )}
        {publishNotice && <p className={styles.notice}>{publishNotice}</p>}
        {actionError && (
          <div role="alert" className={styles.error}>
            <p>{actionError.message}</p>
            <div className={styles.errorActions}>
              {actionError.publication && editable && <Link href={`/dashboard/campanhas/${campaign.id}/editar`}>Revisar dados da campanha</Link>}
              <button type="button" onClick={refresh}>Atualizar situação</button>
            </div>
          </div>
        )}

        <div className={styles.actions}>
          {campaign.status === "PUBLISHED" && isValidCampaignSlug(campaign.slug) && (
            <Link href={`/campanha/${campaign.slug}`} target="_blank" rel="noopener noreferrer" className={styles.primary}>
              <ExternalLink size={16} aria-hidden="true" /> Abrir campanha
            </Link>
          )}
          {campaign.status === "PUBLISHED" && !isValidCampaignSlug(campaign.slug) && (
            <Link href={`/dashboard/campanhas/${campaign.id}/editar`} className={styles.control}>Corrigir link</Link>
          )}
          {editable && (
            <Link href={`/dashboard/campanhas/${campaign.id}/editar`} className={isDraft ? styles.primary : styles.control}>
              <Edit3 size={16} aria-hidden="true" /> Editar
            </Link>
          )}
          <button type="button" className={styles.control} disabled={busy} onClick={() => void run(campaign.id, () => duplicateCampaign(campaign.id))}><Copy size={16} aria-hidden="true" /> Duplicar</button>
          {campaign.status === "PUBLISHED" && (
            <div className={styles.share}>
              <CampaignShare compact label="Compartilhar" title={campaign.title} slug={campaign.slug} />
            </div>
          )}
          {canPause && <button type="button" className={styles.control} disabled={busy} onClick={() => void run(campaign.id, () => pauseCampaign(campaign.id))}><PauseCircle size={16} aria-hidden="true" /> Pausar</button>}
          {canFinish && <button type="button" className={styles.control} disabled={busy} onClick={finish}><CheckCircle2 size={16} aria-hidden="true" /> Encerrar</button>}
          {canPublish && !publishNotice && <button type="button" className={styles.control} disabled={busy} onClick={() => void run(campaign.id, () => publishCampaign(campaign.id), true)}><Rocket size={16} aria-hidden="true" /> {campaign.status === "PAUSED" ? "Reativar" : "Publicar"}</button>}
          {campaign.status === "DRAFT" && <button type="button" className={styles.control} data-danger disabled={busy} onClick={() => remove(campaign)}><Trash2 size={16} aria-hidden="true" /> Excluir</button>}
        </div>
      </div>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className={styles.metric}><dt>{label}</dt><dd>{value}</dd></div>;
}
function soldPercent(campaign: Campaign) { return campaign.totalNumbers ? Math.min(100, (campaign.soldNumbers / campaign.totalNumbers) * 100) : 0; }
function dateValue(value?: string) { return value ? +new Date(value) : Number.MAX_SAFE_INTEGER; }
function money(value = 0) { return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
export function mediaUrl(path: string | null) { return path?.replace("/public/campaigns/media/", "/api/public/campaign-media/") || ""; }

export function ownedMediaUrl(path: string) {
  return path.replace(/^\/public\/campaigns\/media\/([^/]+)\//, "/api/campaigns/$1/media/");
}
