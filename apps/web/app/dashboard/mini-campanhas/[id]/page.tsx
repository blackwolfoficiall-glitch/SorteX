"use client";

import { type FormEvent, use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Boxes,
  ClipboardList,
  LoaderCircle,
  Ticket,
  Trophy,
} from "lucide-react";
import PremiumScope from "@/components/premium/PremiumScope";
import {
  getMiniCampaign,
  recordMiniCampaignResult,
} from "@/lib/organizer-platform/client";
import styles from "./mini-campaign-detail.module.css";

type Detail = {
  name: string;
  status: string;
  maxTickets: number;
  soldTickets: number;
  mainCampaign: { title: string };
  orders: Array<{
    id: string;
    code: string;
    status: string;
    quantity: number;
    total: string | number;
    buyer: { name: string };
  }>;
  result: null | { winningNumber: number; winner: null | { name: string } };
};

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const campaignStatus: Record<string, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicada",
  PAUSED: "Pausada",
  FINISHED: "Encerrada",
  CANCELLED: "Cancelada",
};
const orderStatus: Record<string, string> = {
  RESERVED: "Reservado",
  AWAITING_PAYMENT: "Aguardando pagamento",
  PAID: "Pago",
  EXPIRED: "Expirado",
  CANCELLED: "Cancelado",
  REFUNDED: "Estornado",
  FAILED: "Falhou",
};
const statusLabel = (labels: Record<string, string>, value: string) =>
  Object.hasOwn(labels, value) ? labels[value] : value;

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [result, setResult] = useState<{
    id: string;
    value?: Detail;
    error?: string;
  }>();
  const [number, setNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [actionError, setActionError] = useState("");
  const read = useCallback(
    () => getMiniCampaign(id).then((value) => value as unknown as Detail),
    [id],
  );
  useEffect(() => {
    let active = true;
    read().then(
      (value) => {
        if (active) setResult({ id, value });
      },
      (cause) => {
        if (active)
          setResult({
            id,
            error:
              cause instanceof Error
                ? cause.message
                : "Mini Campanha não encontrada.",
          });
      },
    );
    return () => {
      active = false;
    };
  }, [id, read, attempt]);
  const current = result?.id === id ? result : undefined;
  const data = current?.value;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setActionError("");
    try {
      await recordMiniCampaignResult(id, Number(number), notes || undefined);
      const value = await read();
      setResult({ id, value });
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível registrar o resultado.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <PremiumScope className={styles.scope}>
      <section className={styles.content} aria-label="Detalhe da Mini Campanha">
        <Link
          href="/dashboard/mini-campanhas"
          className={`sx-premium-button ${styles.back}`}
        >
          <ArrowLeft size={17} aria-hidden="true" /> Voltar
        </Link>
        {!current ? (
          <div role="status" className={styles.state}>
            <LoaderCircle
              aria-hidden="true"
              size={21}
              className="motion-safe:animate-spin"
            />
            Carregando Mini Campanha…
          </div>
        ) : !data ? (
          <div className={styles.state}>
            <p role="alert">{current.error}</p>
            <button
              type="button"
              className="sx-premium-button"
              onClick={() => {
                setResult(undefined);
                setAttempt((value) => value + 1);
              }}
            >
              Tentar novamente
            </button>
          </div>
        ) : (
          <>
            <header className={styles.banner}>
              <span className={styles.heroIcon}>
                <Boxes size={23} aria-hidden="true" />
              </span>
              <div>
                <p className={styles.eyebrow}>Mini Campanha</p>
                <h1 className="sx-premium-title">{data.name}</h1>
                <p className={styles.muted}>
                  Vinculada a {data.mainCampaign.title}
                </p>
              </div>
              <span className={styles.badge}>
                {statusLabel(campaignStatus, data.status)}
              </span>
            </header>

            {actionError && (
              <p role="alert" className={styles.actionError}>
                {actionError}
              </p>
            )}

            <dl className={styles.metrics} aria-label="Resumo da Mini Campanha">
              <div>
                <Ticket size={20} aria-hidden="true" />
                <dt>Estoque</dt>
                <dd>
                  {data.soldTickets}/{data.maxTickets}
                </dd>
              </div>
              <div>
                <ClipboardList size={20} aria-hidden="true" />
                <dt>Pedidos</dt>
                <dd>{data.orders.length}</dd>
              </div>
              <div>
                <Trophy size={20} aria-hidden="true" />
                <dt>Status do resultado</dt>
                <dd>
                  {data.result
                    ? "Resultado registrado"
                    : "Aguardando resultado"}
                </dd>
              </div>
            </dl>

            {data.result ? (
              <section
                className={styles.outcome}
                aria-labelledby="mini-result-title"
              >
                <Trophy size={24} aria-hidden="true" />
                <div>
                  <h2 id="mini-result-title">
                    Número vencedor: {data.result.winningNumber}
                  </h2>
                  <p>
                    {data.result.winner?.name || "Sem ganhador identificado"}
                  </p>
                </div>
              </section>
            ) : (
              <section
                className={styles.surface}
                aria-labelledby="mini-result-form-title"
              >
                <h2 id="mini-result-form-title">Registrar resultado</h2>
                {!data.orders.length && (
                  <p className={styles.muted} id="mini-result-unavailable">
                    É preciso ter um pedido registrado para disponibilizar esta
                    ação.
                  </p>
                )}
                <form onSubmit={submit} className={styles.form}>
                  <label>
                    Número vencedor
                    <input
                      required
                      type="number"
                      min={0}
                      value={number}
                      onChange={(event) => setNumber(event.target.value)}
                    />
                  </label>
                  <label>
                    Observação
                    <input
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                    />
                  </label>
                  <button
                    disabled={busy || !data.orders.length}
                    aria-describedby={
                      !data.orders.length
                        ? "mini-result-unavailable"
                        : undefined
                    }
                    className="sx-premium-button"
                    data-variant="primary"
                  >
                    {busy ? "Registrando…" : "Registrar resultado"}
                  </button>
                </form>
              </section>
            )}

            <section
              className={styles.surface}
              aria-labelledby="mini-orders-title"
            >
              <h2 id="mini-orders-title">Pedidos próprios</h2>
              {data.orders.length ? (
                <ul
                  className={styles.orders}
                  aria-label="Pedidos da Mini Campanha"
                >
                  {data.orders.map((order) => (
                    <li key={order.id} className={styles.order}>
                      <div>
                        <strong>{order.buyer.name}</strong>
                        <span className={styles.muted}>#{order.code}</span>
                      </div>
                      <span>
                        {order.quantity}{" "}
                        {order.quantity === 1 ? "título" : "títulos"}
                      </span>
                      <strong>{money.format(Number(order.total))}</strong>
                      <span
                        className={styles.badge}
                        data-order-status={order.status}
                      >
                        {statusLabel(orderStatus, order.status)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.muted}>Nenhum pedido registrado.</p>
              )}
            </section>
          </>
        )}
      </section>
    </PremiumScope>
  );
}
