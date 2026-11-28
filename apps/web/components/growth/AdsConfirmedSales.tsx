"use client";

import { ChartNoAxesCombined, CircleSlash, Database, SlidersHorizontal, Ticket } from "lucide-react";
import styles from "./ads-premium.module.css";
import { type FormEvent, useEffect, useState } from "react";
import { AuthApiError, authRequest } from "@/lib/auth/client";
import {
  adsSalesPeriods,
  confirmedAdsQuery,
  confirmedAdsTimeline,
  formatConfirmedAdsMoney,
  originOptions,
  summarizeConfirmedAdsOrigins,
  parseConfirmedAdsSales,
  type AdsSalesFilter,
  type ConfirmedAdsSales,
} from "@/lib/growth/ads-confirmed-sales";

const initial: AdsSalesFilter = {
  period: "30D",
  campaignId: "",
  origin: "ALL",
  startDate: "",
  endDate: "",
};

type Load = {
  query: string;
  attempt: number;
} & ({ data: ConfirmedAdsSales } | { error: string });

const counts = new Intl.NumberFormat("pt-BR");
const dateLabel = (date: string) => date.split("-").reverse().join("/");
const field = styles.field;

export default function AdsConfirmedSales({
  campaigns,
}: {
  campaigns: ReadonlyArray<{ id: string; title: string }>;
}) {
  const [draft, setDraft] = useState(initial);
  const [applied, setApplied] = useState(initial);
  const [filterError, setFilterError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [originSupported, setOriginSupported] = useState(false);
  const [load, setLoad] = useState<Load>();
  const query = confirmedAdsQuery(applied);
  const view = load?.query === query && load.attempt === attempt ? load : null;

  useEffect(() => {
    const controller = new AbortController();
    authRequest<unknown>(`/api/platform/sortex-ads/confirmed-sales?${query}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((value) => parseConfirmedAdsSales(value, applied))
      .then((data) => {
        if (controller.signal.aborted) return;
        setOriginSupported(data.supportsOriginFilter);
        setLoad({ query, attempt, data });
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        const error =
          reason instanceof AuthApiError && reason.status === 404
            ? "Esta versão da API ainda não disponibiliza o relatório de pedidos pagos."
            : reason instanceof AuthApiError &&
                [400, 401, 403].includes(reason.status)
              ? reason.message
              : "Não foi possível carregar as vendas confirmadas. Tente novamente.";
        setLoad({ query, attempt, error });
      });
    return () => controller.abort();
  }, [applied, attempt, query]);

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      confirmedAdsQuery(draft);
      setFilterError("");
      setApplied(draft);
      setAttempt((value) => value + 1);
    } catch {
      setFilterError("Informe as datas inicial e final em ordem cronológica.");
    }
  }

  const data = view && "data" in view ? view.data : null;

  return (
    <section
      aria-labelledby="ads-confirmed-sales-title"
      className={styles.report}
    >
      <header className={styles.reportHeader}>
        <div>
          <p className={styles.eyebrow}>Dados internos da SorteX</p>
          <h2 id="ads-confirmed-sales-title">Vendas confirmadas</h2>
        </div>
        <span className={styles.icon}><Database size={21} aria-hidden="true" /></span>
      </header>
      <p className={styles.copy}>
        O relatório conta pedidos pagos pela data de confirmação. O total bruto
        soma os valores registrados nos pedidos, com os descontos já aplicados
        na compra. Não é receita líquida: estornos, taxas e gastos de mídia não
        são deduzidos aqui.
      </p>
      <form
        onSubmit={apply}
        className={styles.filters}
        aria-label="Filtros de vendas confirmadas"
      >
        <p className={styles.filterHeading}><SlidersHorizontal size={17} aria-hidden="true" /> Ajustar relatório</p>
        <label className={styles.label}>
          Período
          <select
            aria-label="Período"
            className={field}
            value={draft.period}
            onChange={(event) => {
              const selected = adsSalesPeriods.find(
                ([key]) => event.target.value === key,
              );
              if (selected)
                setDraft((current) => ({ ...current, period: selected[0] }));
            }}
          >
            {adsSalesPeriods.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.label}>
          Campanha SorteX
          <select
            aria-label="Campanha SorteX"
            className={field}
            value={draft.campaignId}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                campaignId: event.target.value,
              }))
            }
          >
            <option value="">Todas as campanhas</option>
            {campaigns.map(({ id, title }) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.label}>
          Origem dos pedidos
          <select
            aria-label="Origem dos pedidos"
            className={field}
            value={draft.origin ?? "ALL"}
            disabled={!originSupported}
            onChange={(event) => {
              const selected = originOptions.find(
                ([key]) => key === event.target.value,
              );
              if (selected)
                setDraft((current) => ({ ...current, origin: selected[0] }));
            }}
          >
            {originOptions.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {draft.period === "CUSTOM" && (
          <>
            <label className={styles.label}>
              Data inicial
              <input
                className={field}
                type="date"
                required
                value={draft.startDate}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    startDate: event.target.value,
                  }))
                }
              />
            </label>
            <label className={styles.label}>
              Data final
              <input
                className={field}
                type="date"
                required
                min={draft.startDate || undefined}
                value={draft.endDate}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    endDate: event.target.value,
                  }))
                }
              />
            </label>
          </>
        )}
        <button
          type="submit"
          className={styles.primary}
        >
          Aplicar filtros
        </button>
      </form>
      <p className={styles.muted}>
        Datas no horário de Brasília.
      </p>
      {data && !data.supportsOriginFilter && (
        <p className={styles.muted}>
          O filtro por origem requer a próxima versão da API.
        </p>
      )}
      {filterError && (
        <p role="alert" className={styles.error}>
          {filterError}
        </p>
      )}
      <div aria-busy={!view} className={styles.reportResults}>
        {!view && (
          <p role="status" className={styles.copy}>
            Carregando vendas confirmadas…
          </p>
        )}
        {view && "error" in view && (
          <div className={styles.subpanel}>
            <p role="alert" className={styles.error}>
              {view.error}
            </p>
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              className={styles.secondary}
            >
              Tentar novamente
            </button>
          </div>
        )}
        {data && <SalesSnapshot data={data} />}
      </div>
      <aside className={styles.providers} aria-labelledby="ads-provider-status">
        <header className={styles.reportHeader}>
          <div>
            <p className={styles.eyebrow}>Plataformas externas</p>
            <h3 id="ads-provider-status">Desempenho de mídia indisponível</h3>
          </div>
          <span className={styles.icon}><CircleSlash size={20} aria-hidden="true" /></span>
        </header>
        <p className={styles.copy}>
          Investimento, conversões das plataformas, ROAS, ROI e CPA só aparecem
          quando houver dados de mídia e atribuição verificados. Os pedidos
          pagos neste relatório não são conversões de anúncios.
        </p>
        <ul aria-label="Leitura de plataformas publicitárias" className={styles.providerList}>
          {Object.entries(providerNames).map(([key, name]) => {
            const disabled = data?.readOnlyReportingProviders.some((provider) => provider === key);
            return (
              <li key={key}>
                <span className={styles.providerName}>{name}</span>
                <strong className={styles.providerBadge}>{disabled ? "Leitura desativada" : "Sem dados verificados"}</strong>
                <p className={styles.muted}>
                  {disabled ? "Credenciais e permissões não verificadas." : "Status de leitura não informado neste relatório."}
                </p>
              </li>
            );
          })}
        </ul>
      </aside>
    </section>
  );
}

const providerNames = {
  META_ADS: "Meta Ads",
  GOOGLE_ADS: "Google Ads",
  TIKTOK_ADS: "TikTok Ads",
};
const originLabel = (origin: ConfirmedAdsSales["originFilter"]) =>
  originOptions.find(([key]) => key === origin)?.[1] ?? originOptions[0][1];

function SalesSnapshot({ data }: { data: ConfirmedAdsSales }) {
  const {
    confirmedOrders,
    buyers,
    titlesSold,
    paidOrderValue,
    averageOrderValue,
  } = data.totals;
  const headline = [
    ["Pedidos pagos", counts.format(confirmedOrders)],
    ["Compradores únicos", counts.format(buyers)],
    ["Títulos vendidos", counts.format(titlesSold)],
    ["Ticket médio", formatConfirmedAdsMoney(averageOrderValue)],
  ];
  const lastDay = new Date(Date.parse(data.period.toDateExclusive) - 86_400_000)
    .toISOString()
    .slice(0, 10);
  return (
    <div className={styles.snapshot}>
      <div className={styles.ticket}>
        <dl>
          <dt><Ticket size={18} aria-hidden="true" /> Valor bruto dos pedidos pagos</dt>
          <dd>{formatConfirmedAdsMoney(paidOrderValue)}</dd>
        </dl>
        <p>
          Período aplicado: {dateLabel(data.period.fromDate)} a{" "}
          {dateLabel(lastDay)} · {originLabel(data.originFilter)}
        </p>
      </div>
      <dl className={styles.kpis}>
        {headline.map(([label, value]) => (
          <div
            key={label}
            className={styles.kpi}
          >
            <dt className={styles.copy}>{label}</dt>
            <dd>
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <AdsOriginSummary data={data} />
      {confirmedOrders === 0 ? (
        <p className={styles.empty}>
          Nenhum pedido pago no período selecionado.
        </p>
      ) : (
        <div className={styles.insights}>
          <article className={styles.subpanel}>
            <h3 className="font-bold">Origem dos pedidos pagos</h3>
            <p className={styles.muted}>
              Origem não identificada não significa acesso direto, orgânico ou
              pago.
            </p>
            <dl className={styles.origins}>
              {data.attribution.map((row) => (
                <div
                  key={row.origin}
                  className={styles.origin}
                >
                  <dt className="font-semibold">{originLabel(row.origin)}</dt>
                  <dd className={styles.originValue}>
                    {counts.format(row.confirmedOrders)}{" "}
                    {row.confirmedOrders === 1 ? "pedido" : "pedidos"} ·{" "}
                    {formatConfirmedAdsMoney(row.paidOrderValue)}
                    {data.originFilter === "ALL" && (
                      <OriginShare
                        orders={row.confirmedOrders}
                        total={confirmedOrders}
                      />
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </article>
          <article className={styles.subpanel}>
            <h3 className={styles.chartHeading}><ChartNoAxesCombined size={19} aria-hidden="true" /> Evolução diária</h3>
            <DailyPaidOrders data={data} />
            <div
              className={styles.tableRegion}
              tabIndex={0}
              role="region"
              aria-label="Tabela de evolução diária de pedidos pagos"
            >
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col" className="py-2 pr-2">
                      Dia
                    </th>
                    <th scope="col" className="py-2 pr-2">
                      Pedidos
                    </th>
                    <th scope="col" className="py-2 text-right">
                      Valor
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.daily.map((row) => (
                    <tr key={row.date} className={styles.tableRow}>
                      <td className="py-2 pr-2">{dateLabel(row.date)}</td>
                      <td className="py-2 pr-2">
                        {counts.format(row.confirmedOrders)}
                      </td>
                      <td className="py-2 text-right">
                        {formatConfirmedAdsMoney(row.paidOrderValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      )}
    </div>
  );
}

function AdsOriginSummary({ data }: { data: ConfirmedAdsSales }) {
  const summary = summarizeConfirmedAdsOrigins(data);
  return (
    <aside
      aria-label="Resumo das origens internas"
      className={styles.originSummary}
    >
      <h3 className="font-bold">O que sabemos sobre a origem dos pedidos</h3>
      {summary.kind === "FILTERED" ? (
        <p className="mt-1">
          Origem selecionada: <strong>{originLabel(summary.origin)}</strong>.
          Este recorte não compara origens.
        </p>
      ) : summary.kind === "EMPTY" ? (
        <p className="mt-1">
          Não há pedidos para comparar origens neste recorte.
        </p>
      ) : summary.kind === "UNKNOWN_ONLY" ? (
        <p className="mt-1">
          Nenhuma origem verificada neste recorte. Pedidos sem origem
          identificada: <strong>{counts.format(summary.unknownOrders)}</strong>.
        </p>
      ) : (
        <p className="mt-1">
          Única origem verificada:{" "}
          <strong>Afiliados ({counts.format(summary.affiliateOrders)})</strong>.{" "}
          Pedidos sem origem identificada:{" "}
          <strong>{counts.format(summary.unknownOrders)}</strong>.
          {summary.equalCoverage &&
            " A quantidade é a mesma, mas origem não identificada não é um canal."}
        </p>
      )}
      <p className={styles.muted}>
        Esses números não medem eficiência de mídia.
      </p>
    </aside>
  );
}

function OriginShare({ orders, total }: { orders: number; total: number }) {
  const share = orders / total;
  const label = new Intl.NumberFormat("pt-BR", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(share);
  return (
    <span className="mt-2 block">
      <span className={styles.shareLabel}>
        {label} dos pedidos
      </span>
      <span
        aria-hidden="true"
        className={styles.shareTrack}
      >
        <span
          className={styles.shareFill}
          style={{ width: `${share * 100}%` }}
        />
      </span>
    </span>
  );
}

function DailyPaidOrders({ data }: { data: ConfirmedAdsSales }) {
  const series = confirmedAdsTimeline(data);
  if (!series.length) return null;
  const max = Math.max(1, ...series.map(({ orders }) => orders));
  const points = series.map(({ date, orders }, index) => ({
    date,
    orders,
    x: series.length === 1 ? 160 : 6 + (index / (series.length - 1)) * 308,
    y: 88 - (orders / max) * 78,
  }));
  return (
    <figure
      aria-label="Gráfico diário de pedidos pagos"
      className={styles.figure}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 320 96"
        className={styles.svg}
      >
        <line
          x1="6"
          x2="314"
          y1="88"
          y2="88"
          className={styles.chartAxis}
          strokeWidth="1"
        />
        <line
          x1="6"
          x2="314"
          y1="10"
          y2="10"
          className={styles.chartAxis}
          strokeWidth="1"
        />
        {points.length > 1 && (
          <polyline
            points={points
              .map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`)
              .join(" ")}
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
            strokeLinejoin="round"
          />
        )}
        {points
          .filter(({ orders }) => orders > 0)
          .map(({ date, x, y }) => (
            <circle
              key={date}
              cx={x}
              cy={y}
              r={points.length > 90 ? 1.25 : 2.75}
              fill="currentColor"
            />
          ))}
      </svg>
      <figcaption className={styles.figcaption}>
        <span>
          {dateLabel(series[0].date)} a {dateLabel(series.at(-1)!.date)}
        </span>
        <span>
          Pico: {counts.format(max)} {max === 1 ? "pedido" : "pedidos"}/dia
        </span>
      </figcaption>
    </figure>
  );
}
