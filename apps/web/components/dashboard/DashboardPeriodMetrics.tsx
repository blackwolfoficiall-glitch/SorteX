"use client";

import { Ticket } from "lucide-react";
import styles from "./organizer-dashboard-premium.module.css";
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
    <section className={styles.report} aria-labelledby="dashboard-sales-title">
      <header className={styles.panelHeading}>
        <div>
          <p className={styles.eyebrow}>Vendas confirmadas</p>
          <h2 id="dashboard-sales-title">Desempenho de vendas</h2>
          <p className={styles.muted}>
            {legacy
              ? "Histórico de vendas confirmadas por dias UTC da versão anterior."
              : "Vendas confirmadas por período (horário de Brasília)."}
          </p>
        </div>
        <span className={styles.panelIcon}><Ticket size={20} aria-hidden="true" /></span>
      </header>
      <div role="group" aria-label="Período de vendas" className={styles.filters}>
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
            className={styles.filter}
          >
            {label}
          </button>
        ))}
      </div>
      {choice === "custom" && (
        <form
          onSubmit={applyCustom}
          className={styles.dates}
        >
          <label className={styles.dateLabel}>
            Início
            <input
              type="date"
              min="2000-01-01"
              max={today}
              value={start}
              required
              onChange={(event) => changeStart(event.target.value)}
              className={styles.dateInput}
              aria-invalid={invalid || undefined}
            />
          </label>
          <label className={styles.dateLabel}>
            Fim
            <input
              type="date"
              min="2000-01-01"
              max={today}
              value={end}
              required
              onChange={(event) => changeEnd(event.target.value)}
              className={styles.dateInput}
              aria-invalid={invalid || undefined}
            />
          </label>
          <button
            type="submit"
            className={styles.primary}
          >
            Aplicar
          </button>
          {invalid && (
            <p role="alert" className={styles.invalid}>
              Informe as datas em ordem, sem datas futuras e com até 367 dias.
            </p>
          )}
        </form>
      )}
      {!period ? (
        <p className={styles.status}>
          Escolha as datas e toque em Aplicar.
        </p>
      ) : !current ? (
        <p role="status" className={styles.status}>
          Consultando vendas confirmadas…
        </p>
      ) : current.kind === "error" ? (
        <div className={styles.notice}>
          <p role="alert">{current.message}</p>
          <button
            type="button"
            className={styles.retry}
            onClick={() => retry((value) => value + 1)}
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <>
          {legacy && (
            <p role="status" className={styles.notice}>
              Na versão anterior, os filtros de receita usam os dias UTC do
              servidor. Títulos, participantes e ticket médio, quando disponíveis,
              são do histórico total, não do período.
            </p>
          )}
          <div className={styles.ticket}>
            <div className={styles.ticketTitle}>
              <span><Ticket size={17} aria-hidden="true" /> Total bruto confirmado</span>
              {rangeCaption && <p>{rangeCaption}</p>}
            </div>
            {relevantSales === null ? (
              <p className={styles.ticketEmpty}>
                Histórico de receita indisponível para esse intervalo.
              </p>
            ) : (
              <>
                <p className={styles.ticketAmount}>{money(relevantSales)}</p>
              {chart.some((point) => point.revenue > 0) ? (
                <div
                  role="img"
                  aria-label={`Receita no intervalo: ${money(relevantSales)}`}
                  className={styles.chart}
                >
                  {chart.map((point) => (
                    <div
                      key={point.first}
                      title={`${dateLabel(point.first)} a ${dateLabel(point.last)}: ${money(point.revenue)}`}
                      className={styles.chartBar}
                      style={{ height: `${(point.revenue / chartMax) * 100}%` }}
                    />
                  ))}
                </div>
              ) : (
                <p className={styles.ticketEmpty}>
                  Sem receita registrada nesse intervalo.
                </p>
              )}
              </>
            )}
          </div>
          <dl className={styles.periodStats}>
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
              <div key={label} className={styles.smallMetric}>
                <dt>
                  {label}{" "}
                  <span className={styles.metricScope}>({metricScope})</span>
                </dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  );
}
