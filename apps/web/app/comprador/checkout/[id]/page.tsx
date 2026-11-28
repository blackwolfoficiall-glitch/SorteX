"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CreditCard,
  LoaderCircle,
  QrCode,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import PremiumScope from "@/components/premium/PremiumScope";
import MercadoPagoCardBrick from "@/components/payments/MercadoPagoCardBrick";
import PixPaymentView from "@/components/payments/PixPaymentView";
import ReservationCountdown from "@/components/purchases/ReservationCountdown";
import {
  cancelPayment,
  createPixPayment,
  getPaymentByPurchase,
  refreshPaymentStatus,
} from "@/lib/payments/client";
import type { Payment } from "@/lib/payments/types";
import { cancelPurchase, getPurchase } from "@/lib/purchases/client";
import { purchaseStatusLabels } from "@/lib/purchases/status";
import type { Purchase } from "@/lib/purchases/types";
import styles from "./buyer-checkout-premium.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function CheckoutPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [method, setMethod] = useState<"PIX" | "CARD">("PIX");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");

  useEffect(() => {
    getPurchase(id)
      .then(setPurchase)
      .catch((cause) =>
        setError(
          cause instanceof Error ? cause.message : "Reserva não encontrada.",
        ),
      );
    getPaymentByPurchase(id)
      .then(setPayment)
      .catch(() => undefined);
  }, [id]);

  useEffect(() => {
    if (!payment?.id || payment.status === "APPROVED") return;
    const timer = window.setInterval(() => {
      refreshPaymentStatus(payment.id)
        .then((latest) => {
          setRefreshError("");
          setPayment(latest);
          if (latest.status === "APPROVED") {
            router.replace(`/comprador/pagamento/sucesso/${latest.id}`);
          }
        })
        .catch(() =>
          setRefreshError(
            "Não foi possível consultar agora. Tente novamente em instantes.",
          ),
        );
    }, 5000);
    return () => window.clearInterval(timer);
  }, [payment?.id, payment?.status, router]);

  const receivePayment = useCallback(
    (created: Payment) => {
      setPayment(created);
      if (created.status === "APPROVED") {
        router.replace(`/comprador/pagamento/sucesso/${created.id}`);
      }
    },
    [router],
  );

  async function refreshStatus() {
    if (!payment || refreshing) return;
    setRefreshing(true);
    setRefreshError("");
    try {
      const latest = await refreshPaymentStatus(payment.id);
      setPayment(latest);
      if (latest.status === "APPROVED") {
        router.replace(`/comprador/pagamento/sucesso/${latest.id}`);
      }
    } catch {
      setRefreshError(
        "Não foi possível consultar agora. Tente novamente em instantes.",
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function payPix() {
    if (!acceptedTerms) return;
    setBusy(true);
    setError("");
    try {
      receivePayment(await createPixPayment(id));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível gerar o PIX.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!purchase) return;
    setBusy(true);
    try {
      if (payment) await cancelPayment(payment.id);
      else await cancelPurchase(purchase.id);
      router.push(`/campanha/${purchase.campaign.slug}`);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível cancelar.",
      );
    } finally {
      setBusy(false);
    }
  }

  const isOpen = purchase?.status === "RESERVED" || purchase?.status === "AWAITING_PAYMENT";
  return (
    <PremiumScope className={styles.page}>
      <div className={styles.wrap}>
        <Link href="/comprador/meus-numeros" className={styles.control}>
          <ArrowLeft aria-hidden="true" size={17} /> Voltar aos meus títulos
        </Link>
        <header className={styles.hero}>
          <div>
            <p className={styles.kicker}>Checkout · Ambiente de teste</p>
            <h1>Finalize sua participação</h1>
            <p>Use somente dados de teste. Não faça pagamentos reais.</p>
          </div>
          <Ticket size={31} aria-hidden="true" />
        </header>
        {!purchase && !error && <div className={styles.state} role="status">
          <LoaderCircle className={styles.spinner} size={20} aria-hidden="true" /> Carregando reserva…
        </div>}
        {error && <p role="alert" className={styles.error}>
          <AlertCircle aria-hidden="true" size={18} /> {error}
        </p>}
        {purchase && (
          <div className={styles.grid}>
            <div className={styles.summaryColumn}>
              <section className={styles.card} aria-labelledby="checkout-campaign">
                <header className={styles.cardHead}>
                  <div>
                    <span className={styles.badge}>{purchaseStatusLabels[purchase.status]}</span>
                    <h2 id="checkout-campaign">{purchase.campaign.title}</h2>
                    <p>{purchase.quantity.toLocaleString("pt-BR")} {purchase.quantity === 1 ? "título" : "títulos"} no pedido</p>
                  </div>
                  <span className={styles.icon}><Ticket size={20} aria-hidden="true" /></span>
                </header>
                {isOpen && <div className={styles.timer}>
                  <p>Tempo restante da reserva</p>
                  <div><ReservationCountdown expiresAt={purchase.expiresAt} /></div>
                </div>}
                <dl className={styles.facts}>
                  <Summary label="Subtotal" value={purchase.subtotal} />
                  <Summary label="Desconto" value={purchase.discount} />
                  <Summary label="Total do pedido" value={purchase.total} strong />
                </dl>
                {purchase.buyer?.phone && <p className={styles.muted}><strong>WhatsApp:</strong> {formatPhone(purchase.buyer.phone)}</p>}
                <p className={styles.notice}>Seus números serão disponibilizados após a confirmação do pagamento.</p>
              </section>
              <label className={styles.terms}>
                <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} />
                <span>Li e aceito o regulamento da campanha e os termos de pagamento em ambiente de teste.</span>
              </label>
              <p className={styles.security}><ShieldCheck size={16} aria-hidden="true" /> O valor é recalculado no backend e não depende do navegador.</p>
            </div>
            <section className={styles.card} aria-labelledby="checkout-payment">
              <h2 id="checkout-payment">Pagamento</h2>
              {purchase.status === "EXPIRED" ? (
                <div className={styles.expired}>
                  <AlertCircle aria-hidden="true" size={30} />
                  <h3>O tempo da sua reserva terminou.</h3>
                  <p>Escolha novamente a quantidade para continuar.</p>
                  <Link href={`/campanha/${purchase.campaign.slug}`} className={`${styles.control} ${styles.primary} ${styles.full}`}>
                    Iniciar nova reserva
                  </Link>
                </div>
              ) : payment?.method === "PIX" && payment.status !== "REJECTED" ? (
                <div className={styles.pix}>
                  <PixPaymentView payment={payment} refreshing={refreshing} refreshError={refreshError} onRefresh={refreshStatus} />
                </div>
              ) : (
                <>
                  <div className={styles.methods} role="group" aria-label="Forma de pagamento">
                    <button type="button" aria-pressed={method === "PIX"} onClick={() => setMethod("PIX")} className={styles.control}>
                      <QrCode size={19} aria-hidden="true" /> Pix
                    </button>
                    <button type="button" aria-pressed={method === "CARD"} onClick={() => setMethod("CARD")} className={styles.control}>
                      <CreditCard size={19} aria-hidden="true" /> Cartão
                    </button>
                  </div>
                  {method === "PIX" ? (
                    <button type="button" className={`${styles.control} ${styles.primary} ${styles.full}`} disabled={!acceptedTerms || busy} onClick={payPix}>
                      {busy && <LoaderCircle className={styles.spinner} size={19} aria-hidden="true" />}
                      Gerar Pix de teste
                    </button>
                  ) : (
                    <div>
                      {!acceptedTerms ? <p className={styles.notice}>Aceite os termos para abrir o formulário seguro.</p> : (
                        <MercadoPagoCardBrick purchaseId={purchase.id} amount={purchase.total} enabled={acceptedTerms} onPayment={receivePayment} />
                      )}
                    </div>
                  )}
                  {payment?.status === "REJECTED" && <p role="alert" className={styles.error}>
                    Pagamento rejeitado: {payment.failureReason || "tente outro cartão"}.
                  </p>}
                </>
              )}
              {purchase.status !== "EXPIRED" && <button type="button" className={`${styles.control} ${styles.full}`} disabled={busy} onClick={cancel}>
                Cancelar e voltar
              </button>}
              <Link href="/comprador/meus-numeros" className={`${styles.control} ${styles.full}`}>Ver meus títulos</Link>
            </section>
          </div>
        )}
      </div>
    </PremiumScope>
  );
}

function Summary({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div data-total={strong || undefined}>
      <dt>{label}</dt>
      <dd>{money.format(value)}</dd>
    </div>
  );
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^55/, "");
  return digits.length === 11 ? `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}` : value;
}
