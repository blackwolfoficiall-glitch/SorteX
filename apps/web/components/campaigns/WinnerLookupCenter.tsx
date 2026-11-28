"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Clipboard,
  Download,
  History,
  LoaderCircle,
  Search,
  Share2,
  Sparkles,
  Trophy,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { authRequest } from "@/lib/auth/client";
import { getMyCampaigns } from "@/lib/campaigns/client";
import type { Campaign } from "@/lib/campaigns/types";
import PremiumScope from "@/components/premium/PremiumScope";
import styles from "./WinnerLookupCenter.module.css";

type Mode = "AUTOMATIC" | "MANUAL";
type LookupResult = {
  mode: Mode;
  campaign: { id: string; title: string };
  calculatedNumber: string;
  winningNumber: string;
  prize: { name: string; value: number | null };
  buyer: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    city: string | null;
    state: string | null;
    profileImageUrl: string | null;
  };
  purchase: {
    id: string;
    createdAt: string;
    status: string;
    total: number;
    payment: {
      status: string;
      method: string;
      approvedAt: string | null;
    } | null;
  };
  consultedAt: string;
};
type LookupHistory = {
  id: string;
  action: string;
  newData: {
    mode?: Mode;
    informedNumber?: string;
    resolvedNumber?: number | null;
    found?: boolean;
  } | null;
  createdAt: string;
  actor: { name: string; role: string } | null;
};

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default function WinnerLookupCenter() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [mode, setMode] = useState<Mode>("AUTOMATIC");
  const [number, setNumber] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [history, setHistory] = useState<LookupHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [campaignError, setCampaignError] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const activeCampaignId = useRef("");
  const campaignSequence = useRef(0);
  const historySequence = useRef(0);
  const querySequence = useRef(0);
  const queryInFlight = useRef(false);

  const campaign = useMemo(
    () => campaigns.find((item) => item.id === campaignId) ?? null,
    [campaignId, campaigns],
  );

  const loadHistory = useCallback(async (id: string) => {
    const sequence = ++historySequence.current;
    setHistory([]);
    setHistoryError(false);
    setHistoryLoading(Boolean(id));
    if (!id) return;
    try {
      const records = await authRequest<LookupHistory[]>(
        `/api/draws/campaigns/${id}/winner-lookup/history`,
        { cache: "no-store" },
      );
      if (sequence === historySequence.current) setHistory(records);
    } catch {
      if (sequence === historySequence.current) setHistoryError(true);
    } finally {
      if (sequence === historySequence.current) setHistoryLoading(false);
    }
  }, []);

  const selectCampaign = useCallback((id: string) => {
    activeCampaignId.current = id;
    querySequence.current += 1;
    setCampaignId(id);
    setResult(null);
    setError("");
    void loadHistory(id);
  }, [loadHistory]);

  const loadCampaigns = useCallback(() => {
    const sequence = ++campaignSequence.current;
    getMyCampaigns()
      .then((items) => {
        if (sequence === campaignSequence.current) {
          setCampaigns(items);
          selectCampaign(items[0]?.id ?? "");
        }
      })
      .catch(() => {
        if (sequence === campaignSequence.current) setCampaignError(true);
      })
      .finally(() => {
        if (sequence === campaignSequence.current) setLoading(false);
      });
  }, [selectCampaign]);

  useEffect(() => {
    void loadCampaigns();
    return () => {
      campaignSequence.current += 1;
      historySequence.current += 1;
      querySequence.current += 1;
      activeCampaignId.current = "";
    };
  }, [loadCampaigns]);

  function retryCampaigns() {
    setLoading(true);
    setCampaignError(false);
    void loadCampaigns();
  }

  function selectMode(next: Mode) {
    querySequence.current += 1;
    setMode(next);
    setResult(null);
    setError("");
  }

  async function lookup() {
    if (queryInFlight.current || !campaignId || (mode === "MANUAL" && !number.trim())) return;
    const sequence = ++querySequence.current;
    queryInFlight.current = true;
    setSearching(true);
    setError("");
    setResult(null);
    try {
      const path =
        mode === "AUTOMATIC"
          ? `/api/draws/campaigns/${campaignId}/winner-lookup/automatic`
          : `/api/draws/campaigns/${campaignId}/winner-lookup/manual`;
      const found = await authRequest<LookupResult>(path, {
        method: "POST",
        body:
          mode === "MANUAL"
            ? JSON.stringify({ winningNumber: number.trim() })
            : undefined,
      });
      if (sequence === querySequence.current) setResult(found);
    } catch (cause) {
      if (sequence === querySequence.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível consultar o ganhador.",
        );
      }
    } finally {
      if (campaignId === activeCampaignId.current) await loadHistory(campaignId);
      queryInFlight.current = false;
      setSearching(false);
    }
  }

  async function copyResult() {
    if (!result) return;
    await navigator.clipboard.writeText(resultText(result));
    toast.success("Resultado copiado.");
  }

  async function shareResult() {
    if (!result) return;
    const text = resultText(result);
    if (navigator.share) {
      await navigator
        .share({ title: `Ganhador — ${result.campaign.title}`, text })
        .catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(text);
    toast.success("Resultado copiado para compartilhar.");
  }

  function generateCard() {
    if (!result) return;
    const svg = winnerCard(result);
    const url = URL.createObjectURL(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ganhador-${result.winningNumber}.svg`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Card do ganhador gerado.");
  }

  return (
    <PremiumScope className={styles.scope}>
      <section className={styles.layout} aria-labelledby="winner-lookup-title">
        <header className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>Apuração segura</p>
            <h1 id="winner-lookup-title" className="sx-premium-title">Ganhadores</h1>
            <p className={styles.muted}>
              Consulte o resultado pela regra publicada ou localize o comprador
              de um título. A consulta não publica nem confirma um sorteio.
            </p>
          </div>
          <span className={styles.heroIcon}><Trophy size={30} aria-hidden="true" /></span>
        </header>

        <div className={styles.grid}>
          <section className={styles.panel} aria-labelledby="winner-query-title">
            <h2 id="winner-query-title" className="sx-premium-section">Consultar campanha</h2>
            <label className={styles.field}>
              Campanha
              <span className={styles.selectClip}>
                <select
                  value={campaignId}
                  onChange={(event) => selectCampaign(event.target.value)}
                  disabled={loading || !campaigns.length}
                >
                  {!campaigns.length && (
                    <option value="">{loading ? "Carregando campanhas…" : "Nenhuma campanha"}</option>
                  )}
                  {campaigns.map((item) => (
                    <option key={item.id} value={item.id}>{item.title}</option>
                  ))}
                </select>
              </span>
            </label>

            <fieldset className={styles.modeGroup}>
              <legend>Forma de apuração</legend>
              <ModeButton
                active={mode === "AUTOMATIC"}
                icon={<Sparkles aria-hidden="true" />}
                title="Resultado automático"
                text="Usa a regra publicada e o resultado verificado."
                onClick={() => selectMode("AUTOMATIC")}
              />
              <ModeButton
                active={mode === "MANUAL"}
                icon={<Search aria-hidden="true" />}
                title="Resultado manual"
                text="Consulta um título sem alterar o sorteio."
                onClick={() => selectMode("MANUAL")}
              />
            </fieldset>
            {mode === "MANUAL" && (
              <label className={styles.field}>
                Número vencedor
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={number}
                  onChange={(event) => setNumber(event.target.value.replace(/\D/g, ""))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void lookup();
                  }}
                  placeholder="Ex.: 54873"
                />
              </label>
            )}
            <button
              type="button"
              onClick={() => void lookup()}
              disabled={searching || !campaignId || (mode === "MANUAL" && !number.trim())}
              className={styles.primary}
            >
              {searching ? (
                <LoaderCircle className={styles.spinner} size={19} aria-hidden="true" />
              ) : mode === "AUTOMATIC" ? (
                <Sparkles size={19} aria-hidden="true" />
              ) : (
                <Search size={19} aria-hidden="true" />
              )}
              {mode === "AUTOMATIC" ? "Buscar resultado" : "Ver ganhador"}
            </button>
            <p className={styles.muted}>
              A consulta manual identifica o comprador do título e não registra
              um resultado oficial.
            </p>
          </section>

          <div className={styles.stage}>
            {loading ? (
              <div className={styles.state} role="status">
                <LoaderCircle className={styles.spinner} size={28} aria-hidden="true" />
                Carregando campanhas…
              </div>
            ) : campaignError ? (
              <div className={styles.state} role="alert">
                <p>Não foi possível carregar suas campanhas.</p>
                <button type="button" className={styles.control} onClick={retryCampaigns}>Tentar novamente</button>
              </div>
            ) : searching ? (
              <div className={styles.state} role="status">
                <LoaderCircle className={styles.spinner} size={28} aria-hidden="true" />
                Consultando resultado…
              </div>
            ) : error ? (
              <div className={styles.state} role="alert">
                <Search size={30} aria-hidden="true" />
                <p>{error}</p>
              </div>
            ) : result ? (
              <WinnerStage
                result={result}
                copy={() => void copyResult()}
                share={() => void shareResult()}
                generate={generateCard}
              />
            ) : (
              <div className={styles.state}>
                <UserRound size={36} aria-hidden="true" />
                <h2 className="sx-premium-section">
                  {campaign ? "Pronto para localizar o ganhador" : "Nenhuma campanha disponível"}
                </h2>
                <p className={styles.muted}>
                  {campaign
                    ? "Selecione a forma de apuração e revise o resultado antes de compartilhar."
                    : "Suas campanhas aparecerão aqui quando estiverem disponíveis."}
                </p>
              </div>
            )}
          </div>
        </div>

        <section className={styles.panel} aria-labelledby="winner-history-title">
          <header className={styles.historyHeading}>
            <History size={24} aria-hidden="true" />
            <div>
              <h2 id="winner-history-title" className="sx-premium-section">Histórico de consultas</h2>
              <p className={styles.muted}>Registro automático de modo, número, responsável, data e hora.</p>
            </div>
          </header>
          {historyLoading ? (
            <p className={styles.historyPlaceholder} role="status">Carregando histórico…</p>
          ) : historyError ? (
            <div className={styles.historyPlaceholder} role="alert">
              <p>Não foi possível carregar o histórico.</p>
              <button
                type="button"
                className={styles.control}
                onClick={() => void loadHistory(campaignId)}
              >
                Tentar novamente
              </button>
            </div>
          ) : history.length ? (
            <div className={styles.history}>
              {history.map((item) => (
                <article key={item.id} className={styles.historyEntry}>
                  <div>
                    <strong>{item.action.endsWith("MANUAL") ? "Resultado manual" : "Resultado automático"}</strong>
                    <p className={styles.muted}>{item.actor?.name ?? "Responsável não disponível"}</p>
                  </div>
                  <dl className={styles.historyNumbers}>
                    <Info label="Informado" value={item.newData?.informedNumber || "—"} />
                    <Info label="Resolvido" value={String(item.newData?.resolvedNumber ?? "—")} />
                  </dl>
                  <div>
                    {typeof item.newData?.found === "boolean" && (
                      <span className={styles.historyBadge} data-found={item.newData.found}>
                        {item.newData.found ? "Localizado" : "Não localizado"}
                      </span>
                    )}
                    <time className={styles.muted} dateTime={item.createdAt}>
                      {new Date(item.createdAt).toLocaleString("pt-BR")}
                    </time>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.historyPlaceholder}>
              {campaign ? "Nenhuma consulta registrada para esta campanha." : "Selecione uma campanha para consultar o histórico."}
            </p>
          )}
        </section>
      </section>
    </PremiumScope>
  );
}

function ModeButton({
  active,
  icon,
  title,
  text,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={styles.mode}
    >
      <span className={styles.modeIcon}>{icon}</span>
      <span>
        <strong>{title}</strong>
        <span className={styles.muted}>{text}</span>
      </span>
    </button>
  );
}

function WinnerStage({
  result,
  copy,
  share,
  generate,
}: {
  result: LookupResult;
  copy: () => void;
  share: () => void;
  generate: () => void;
}) {
  const payment = result.purchase.payment;
  return (
    <section className={styles.result} aria-labelledby="winner-result-title">
      <header className={styles.ticket}>
        <CheckCircle2 size={34} aria-hidden="true" />
        <h2 id="winner-result-title">Ganhador localizado</h2>
        <strong className={styles.winningNumber}>{result.winningNumber}</strong>
        {result.calculatedNumber !== result.winningNumber && (
          <p>
            Número calculado {result.calculatedNumber}, aplicado conforme a política publicada da campanha.
          </p>
        )}
      </header>
      <div className={styles.resultBody}>
        <div className={styles.person}>
          <div className={styles.avatar}>
            {result.buyer.profileImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={result.buyer.profileImageUrl} alt={`Foto de ${result.buyer.name}`} />
            ) : (
              <span aria-hidden="true">{result.buyer.name.trim().charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div>
            <h3 className="sx-premium-section">{result.buyer.name}</h3>
            <p className={styles.muted}>
              {[result.buyer.city, result.buyer.state].filter(Boolean).join(" — ") || "Localidade não informada"}
            </p>
            <p className={styles.prize}>
              {result.prize.name}{result.prize.value != null ? ` · ${money.format(result.prize.value)}` : ""}
            </p>
          </div>
        </div>
        <dl className={styles.resultDetails}>
          <Info label="Pedido" value={`#${result.purchase.id.slice(-8).toUpperCase()}`} />
          <Info label="Data da compra" value={new Date(result.purchase.createdAt).toLocaleString("pt-BR")} />
          <Info label="Pagamento" value={payment?.status ?? result.purchase.status} />
          <Info label="Contato" value={result.buyer.phone ?? result.buyer.email} />
          <Info label="Consulta" value={new Date(result.consultedAt).toLocaleString("pt-BR")} />
          <Info label="Modo" value={result.mode === "AUTOMATIC" ? "Automático" : "Manual"} />
        </dl>
        <div className={styles.resultActions}>
          <button type="button" onClick={copy} className={styles.control}>
            <Clipboard size={17} aria-hidden="true" /> Copiar resultado
          </button>
          <button type="button" onClick={share} className={styles.control}>
            <Share2 size={17} aria-hidden="true" /> Compartilhar
          </button>
          <button type="button" onClick={generate} className={styles.primary}>
            <Download size={17} aria-hidden="true" /> Gerar card
          </button>
        </div>
        <Link href={`/dashboard/pedidos/${result.purchase.id}`} className={styles.orderLink}>Abrir pedido completo</Link>
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className={styles.info}><dt>{label}</dt><dd>{value}</dd></div>;
}

function resultText(result: LookupResult) {
  return [
    `Ganhador — ${result.campaign.title}`,
    `Número: ${result.winningNumber}`,
    `Nome: ${result.buyer.name}`,
    `Cidade: ${[result.buyer.city, result.buyer.state].filter(Boolean).join(" — ") || "Não informada"}`,
    `Prêmio: ${result.prize.name}`,
  ].join("\n");
}

function winnerCard(result: LookupResult) {
  const escape = (value: string) =>
    value.replace(/[&<>"']/g, (char) => {
      const entities: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      };
      return entities[char];
    });
  const place =
    [result.buyer.city, result.buyer.state].filter(Boolean).join(" — ") ||
    "Localidade não informada";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#4c1d95"/><stop offset="1" stop-color="#a21caf"/></linearGradient></defs>
  <rect width="1080" height="1080" rx="64" fill="url(#g)"/>
  <text x="540" y="150" text-anchor="middle" fill="#ddd6fe" font-family="Arial" font-size="38" font-weight="700">GANHADOR LOCALIZADO</text>
  <text x="540" y="390" text-anchor="middle" fill="white" font-family="monospace" font-size="150" font-weight="900">${escape(result.winningNumber)}</text>
  <circle cx="540" cy="570" r="90" fill="#ede9fe"/>
  <text x="540" y="605" text-anchor="middle" fill="#6d28d9" font-family="Arial" font-size="92" font-weight="900">${escape(result.buyer.name.charAt(0).toUpperCase())}</text>
  <text x="540" y="735" text-anchor="middle" fill="white" font-family="Arial" font-size="58" font-weight="900">${escape(result.buyer.name)}</text>
  <text x="540" y="805" text-anchor="middle" fill="#e9d5ff" font-family="Arial" font-size="34">${escape(place)}</text>
  <text x="540" y="900" text-anchor="middle" fill="#fef3c7" font-family="Arial" font-size="40" font-weight="700">${escape(result.prize.name)}</text>
  <text x="540" y="990" text-anchor="middle" fill="white" font-family="Arial" font-size="30">SorteX · ${escape(result.campaign.title)}</text>
</svg>`;
}
