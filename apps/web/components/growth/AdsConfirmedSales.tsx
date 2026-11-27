"use client";

import { type FormEvent, useEffect, useState } from "react";
import { AuthApiError, authRequest } from "@/lib/auth/client";
import {
  adsSalesPeriods,
  confirmedAdsQuery,
  formatConfirmedAdsMoney,
  parseConfirmedAdsSales,
  type AdsSalesFilter,
  type ConfirmedAdsSales,
} from "@/lib/growth/ads-confirmed-sales";

const initial: AdsSalesFilter = {
  period: "30D",
  campaignId: "",
  startDate: "",
  endDate: "",
};

type Load = {
  query: string;
  attempt: number;
} & ({ data: ConfirmedAdsSales } | { error: string });

const counts = new Intl.NumberFormat("pt-BR");
const dateLabel = (date: string) => date.split("-").reverse().join("/");
const field = "mt-1 min-h-11 w-full min-w-0 rounded-lg border bg-white px-3";

export default function AdsConfirmedSales({
  campaigns,
}: {
  campaigns: ReadonlyArray<{ id: string; title: string }>;
}) {
  const [draft, setDraft] = useState(initial);
  const [applied, setApplied] = useState(initial);
  const [filterError, setFilterError] = useState("");
  const [attempt, setAttempt] = useState(0);
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
        if (!controller.signal.aborted) setLoad({ query, attempt, data });
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
      className="mt-6 rounded-[2rem] border bg-white p-5 shadow-sm md:p-7"
    >
      <p className="text-xs font-black uppercase tracking-[.18em] text-violet-700">
        Dados da SorteX
      </p>
      <h2 id="ads-confirmed-sales-title" className="mt-1 text-2xl font-black">
        Vendas confirmadas
      </h2>
      <p className="mt-2 max-w-3xl text-sm text-zinc-600">
        O relatório conta pedidos pagos na SorteX pela data de confirmação. O
        valor dos pedidos não é receita líquida nem lucro.
      </p>
      <form
        onSubmit={apply}
        className="mt-5 grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-5"
      >
        <label className="min-w-0 text-sm font-semibold">
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
        <label className="min-w-0 text-sm font-semibold">
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
        {draft.period === "CUSTOM" && (
          <>
            <label className="min-w-0 text-sm font-semibold">
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
            <label className="min-w-0 text-sm font-semibold">
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
          className="min-h-11 rounded-lg bg-violet-700 px-4 font-bold text-white hover:bg-violet-800"
        >
          Aplicar filtros
        </button>
      </form>
      <p className="mt-2 text-xs text-zinc-600">
        Datas no horário de Brasília.
      </p>
      {filterError && (
        <p role="alert" className="mt-2 text-sm font-semibold text-red-800">
          {filterError}
        </p>
      )}
      <div aria-busy={!view} className="mt-6">
        {!view && (
          <p role="status" className="text-sm text-zinc-700">
            Carregando vendas confirmadas…
          </p>
        )}
        {view && "error" in view && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p role="alert" className="text-sm font-semibold text-red-800">
              {view.error}
            </p>
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              className="mt-2 min-h-10 font-bold text-violet-800"
            >
              Tentar novamente
            </button>
          </div>
        )}
        {data && <SalesSnapshot data={data} />}
      </div>
      <aside className="mt-6 rounded-2xl bg-violet-50 p-4 text-sm text-violet-950">
        <h3 className="font-bold">Desempenho de mídia indisponível</h3>
        <p className="mt-1">
          Investimento, conversões das plataformas, ROAS, ROI e CPA só aparecem
          quando houver dados de mídia e atribuição verificados. Os pedidos
          pagos neste relatório não são conversões de anúncios.
        </p>
      </aside>
    </section>
  );
}

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
    ["Valor dos pedidos pagos", formatConfirmedAdsMoney(paidOrderValue)],
    ["Ticket médio", formatConfirmedAdsMoney(averageOrderValue)],
  ];
  const lastDay = new Date(Date.parse(data.period.toDateExclusive) - 86_400_000)
    .toISOString()
    .slice(0, 10);
  return (
    <div className="space-y-5">
      <p className="text-sm font-semibold text-zinc-700">
        Período aplicado: {dateLabel(data.period.fromDate)} a{" "}
        {dateLabel(lastDay)}
      </p>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {headline.map(([label, value]) => (
          <div
            key={label}
            className="min-w-0 rounded-xl border border-violet-100 bg-violet-50/60 p-3"
          >
            <dt className="text-sm text-zinc-700">{label}</dt>
            <dd className="mt-2 break-words text-lg font-black text-violet-950">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {confirmedOrders === 0 ? (
        <p className="rounded-xl border p-4 text-sm text-zinc-700">
          Nenhum pedido pago no período selecionado.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <article className="min-w-0 rounded-xl border p-4">
            <h3 className="font-bold">Origem dos pedidos pagos</h3>
            <p className="mt-1 text-xs text-zinc-600">
              Origem não identificada não significa acesso direto, orgânico ou
              pago.
            </p>
            <dl className="mt-4 space-y-3">
              {data.attribution.map((row) => (
                <div
                  key={row.origin}
                  className="border-b pb-2 last:border-none"
                >
                  <dt className="font-semibold">
                    {row.origin === "AFFILIATE"
                      ? "Afiliados verificados"
                      : "Origem não identificada"}
                  </dt>
                  <dd className="mt-1 text-sm text-zinc-700">
                    {counts.format(row.confirmedOrders)}{" "}
                    {row.confirmedOrders === 1 ? "pedido" : "pedidos"} ·{" "}
                    {formatConfirmedAdsMoney(row.paidOrderValue)}
                  </dd>
                </div>
              ))}
            </dl>
          </article>
          <article className="min-w-0 rounded-xl border p-4">
            <h3 className="font-bold">Evolução diária</h3>
            <div
              className="mt-2 max-h-72 overflow-auto"
              tabIndex={0}
              role="region"
              aria-label="Tabela de evolução diária de pedidos pagos"
            >
              <table className="w-full text-left text-sm">
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
                    <tr key={row.date} className="border-t">
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
