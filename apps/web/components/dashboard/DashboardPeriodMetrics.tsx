"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  DEFAULT_DASHBOARD_PERIOD,
  type DashboardPeriod,
  type PeriodPreset,
  type PeriodRange,
  legacyHistoryCovers,
  legacyUtcRange,
  parseDashboardPeriod,
  parseLegacyPeriodMetrics,
  parseRevenueHistory,
  presetPeriod,
  salesChart,
  todayInSaoPaulo,
  validatePeriod,
} from "@/lib/api/dashboard-period";
import type { DashboardResponse } from "@/lib/api/dashboard";
import { AuthApiError, authRequest } from "@/lib/auth/client";

const periods = [
  ["today", "Hoje"],
  ["week", "7 dias"],
  ["month", "30 dias"],
  ["year", "12 meses"],
  ["custom", "Personalizado"],
] as const;
type Choice = PeriodPreset | "custom";
type PeriodRequest =
  | { kind: "ready"; value: DashboardPeriod }
  | { kind: "legacy" }
  | { kind: "error"; message: string };

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateLabel = (date: string) => date.split("-").reverse().join("/");

export default function DashboardPeriodMetrics({
  snapshot,
  renderedAt,
}: {
  snapshot: DashboardResponse | null;
  renderedAt: number;
}) {
  const today = todayInSaoPaulo(new Date(renderedAt));
  const [choice, choose] = useState<Choice>(DEFAULT_DASHBOARD_PERIOD);
  const [start, changeStart] = useState(
    () => presetPeriod(DEFAULT_DASHBOARD_PERIOD, today).start,
  );
  const [end, changeEnd] = useState(today);
  const [custom, setCustom] = useState<PeriodRange | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [attempt, retry] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    value: PeriodRequest;
  } | null>(null);

  const period = choice === "custom" ? custom : presetPeriod(choice, today);
  const requestedStart = period?.start;
  const requestedEnd = period?.end;
  const key =
    requestedStart && requestedEnd
      ? `${requestedStart}|${requestedEnd}|${attempt}`
      : null;

  useEffect(() => {
    if (!key || !requestedStart || !requestedEnd) return;
    const controller = new AbortController();
    const period = { start: requestedStart, end: requestedEnd };
    void authRequest<unknown>(
      `/api/dashboard/period?${new URLSearchParams(period)}`,
      {
        cache: "no-store",
        signal: controller.signal,
      },
    )
      .then((payload) => {
        if (!controller.signal.aborted)
          setResult({
            key,
            value: {
              kind: "ready",
              value: parseDashboardPeriod(payload, period),
            },
          });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setResult({
            key,
            value:
              error instanceof AuthApiError && error.status === 404
                ? { kind: "legacy" }
                : {
                    kind: "error",
                    message:
                      error instanceof Error
                        ? error.message
                        : "Não foi possível consultar as vendas.",
                  },
          });
      });
    return () => controller.abort();
  }, [key, requestedStart, requestedEnd]);

  function applyCustom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const valid = validatePeriod(start, end, today);
    setInvalid(!valid);
    if (valid) setCustom(valid);
  }

  const current = key && result?.key === key ? result.value : null;
  const data = current?.kind === "ready" ? current.value : null;
  const legacy = current?.kind === "legacy";
  const confirmed = legacy
    ? parseLegacyPeriodMetrics(snapshot?.summary)
    : data?.summary;
  const displayRange = legacy
    ? legacyUtcRange(snapshot?.generatedAt, choice, custom)
    : data?.period ?? null;
  let history = data?.revenueHistory;
  if (
    legacy &&
    snapshot &&
    displayRange &&
    legacyHistoryCovers(snapshot.generatedAt, displayRange)
  ) {
    try {
      history = parseRevenueHistory(snapshot.revenueHistory);
    } catch {
      /* Unsupported or malformed legacy history is not a zero. */
    }
  }
  const chart = history && displayRange ? salesChart(history, displayRange) : [];
  const chartMax = Math.max(1, ...chart.map((item) => item.revenue));
  const relevantSales =
    data?.summary.grossRevenue ??
    (history
      ? chart.reduce(
          (total, item) => total + Math.round(item.revenue * 100),
          0,
        ) / 100
      : null);
  const metricScope = legacy ? "histórico total" : "no período";
  const rangeCaption = displayRange
    ? `Intervalo: ${dateLabel(displayRange.start)} a ${dateLabel(displayRange.end)} · ${legacy ? "UTC" : "Brasília"}`
    : null;

  return (
    <div className="min-w-0 rounded-3xl border bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-xl font-black">Desempenho de vendas</h2>
      <p className="mt-1 text-sm text-zinc-500">
        {legacy
          ? "Histórico de vendas confirmadas por dias UTC da versão anterior."
          : "Vendas confirmadas por período (horário de Brasília)."}
      </p>
      <div aria-label="Período de vendas" className="mt-3 flex flex-wrap gap-2">
        {periods.map(([item, label]) => (
          <button
            key={item}
            type="button"
            aria-pressed={choice === item}
            onClick={() => {
              if (item !== choice) {
                choose(item);
                retry((value) => value + 1);
              }
            }}
            className={`rounded-xl px-3 py-2 text-xs font-bold focus-visible:outline-2 focus-visible:outline-violet-700 ${choice === item ? "bg-violet-700 text-white" : "bg-zinc-100"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {choice === "custom" && (
        <form
          onSubmit={applyCustom}
          className="mt-4 flex flex-wrap items-end gap-2"
        >
          <label className="text-xs font-bold">
            Início
            <input
              type="date"
              min="2000-01-01"
              max={today}
              value={start}
              required
              onChange={(event) => changeStart(event.target.value)}
              className="mt-1 block rounded-xl border px-2 py-2"
            />
          </label>
          <label className="text-xs font-bold">
            Fim
            <input
              type="date"
              min="2000-01-01"
              max={today}
              value={end}
              required
              onChange={(event) => changeEnd(event.target.value)}
              className="mt-1 block rounded-xl border px-2 py-2"
            />
          </label>
          <button
            type="submit"
            className="rounded-xl bg-violet-700 px-3 py-2 text-xs font-bold text-white"
          >
            Aplicar
          </button>
          {invalid && (
            <p role="alert" className="w-full text-sm text-red-800">
              Informe as datas em ordem, sem datas futuras e com até 367 dias.
            </p>
          )}
        </form>
      )}
      {!period ? (
        <p className="mt-5 text-sm text-zinc-500">
          Escolha as datas e toque em Aplicar.
        </p>
      ) : !current ? (
        <p role="status" className="mt-5 text-sm text-zinc-500">
          Consultando vendas confirmadas…
        </p>
      ) : current.kind === "error" ? (
        <div className="mt-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
          <p role="alert">{current.message}</p>
          <button
            type="button"
            className="mt-2 font-bold underline"
            onClick={() => retry((value) => value + 1)}
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <>
          {legacy && (
            <p role="status" className="mt-4 text-sm text-amber-800">
              Na versão anterior, os filtros de receita usam os dias UTC do
              servidor. Títulos, participantes e ticket médio, quando disponíveis,
              são do histórico total, não do período.
            </p>
          )}
          {rangeCaption && <p className="mt-3 text-xs text-zinc-600">{rangeCaption}</p>}
          {relevantSales === null ? (
            <p className="mt-4 text-sm text-zinc-500">
              Histórico de receita indisponível para esse intervalo.
            </p>
          ) : (
            <>
              <p className="mt-4 text-xl font-black">{money(relevantSales)}</p>
              {chart.some((point) => point.revenue > 0) ? (
                <div
                  role="img"
                  aria-label={`Receita no intervalo: ${money(relevantSales)}`}
                  className="mt-4 flex h-44 min-w-0 items-end gap-1 rounded-2xl bg-gradient-to-b from-violet-50/70 to-white px-3 pt-6"
                >
                  {chart.map((point) => (
                    <div
                      key={point.first}
                      title={`${dateLabel(point.first)} a ${dateLabel(point.last)}: ${money(point.revenue)}`}
                      className="min-w-0 flex-1 rounded-t-lg bg-gradient-to-t from-violet-700 to-violet-400"
                      style={{ height: `${(point.revenue / chartMax) * 100}%` }}
                    />
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-zinc-500">
                  Sem receita registrada nesse intervalo.
                </p>
              )}
            </>
          )}
          <dl className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              [
                "Títulos vendidos",
                confirmed?.soldTickets.toLocaleString("pt-BR") ?? "—",
              ],
              [
                "Participantes",
                confirmed?.participants.toLocaleString("pt-BR") ?? "—",
              ],
              [
                "Ticket médio",
                confirmed?.averageTicket === undefined ? "—" : money(confirmed.averageTicket),
              ],
              [
                "Pedidos pagos",
                data?.summary.paidOrders.toLocaleString("pt-BR") ?? "—",
              ],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-zinc-50 p-3">
                <dt className="text-xs text-zinc-600">
                  {label}{" "}
                  <span className="block text-zinc-500">({metricScope})</span>
                </dt>
                <dd className="mt-1 font-black">{value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </div>
  );
}
