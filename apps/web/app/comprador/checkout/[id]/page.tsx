"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CreditCard,
  LoaderCircle,
  QrCode,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
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
import type { Purchase } from "@/lib/purchases/types";

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

  if (!purchase && !error) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <LoaderCircle className="animate-spin text-violet-700" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl p-5 md:py-10">
      <p className="text-sm font-bold uppercase tracking-wider text-violet-700">
        Checkout seguro · Sandbox
      </p>
      <h1 className="mt-2 text-3xl font-black">Finalize sua participação</h1>
      {error && (
        <p className="mt-5 flex items-start gap-2 rounded-2xl bg-red-50 p-4 text-red-700">
          <AlertCircle className="mt-0.5 shrink-0" size={18} /> {error}
        </p>
      )}
      {purchase && (
        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_420px]">
          <div className="space-y-5">
            <Card className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black">
                    {purchase.campaign.title}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {purchase.quantity.toLocaleString("pt-BR")} títulos
                    reservados
                  </p>
                </div>
                <Ticket className="text-violet-700" />
              </div>
              <div className="mt-5 rounded-2xl bg-violet-50 p-4 text-center">
                <p className="text-sm text-violet-700">
                  Tempo restante da reserva
                </p>
                <p className="mt-1 text-3xl">
                  <ReservationCountdown expiresAt={purchase.expiresAt} />
                </p>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Summary label="Subtotal" value={purchase.subtotal} />
                <Summary label="Desconto" value={purchase.discount} success />
                <Summary label="Total" value={purchase.total} strong />
              </div>
              {purchase.buyer?.phone && <p className="mt-5 text-sm text-zinc-600"><strong>WhatsApp:</strong> {formatPhone(purchase.buyer.phone)}</p>}
              <div className="mt-5 rounded-2xl border border-violet-100 bg-violet-50 p-4 text-sm font-bold text-violet-800">
                Seus números serão disponibilizados após a confirmação do pagamento.
              </div>
            </Card>
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border bg-white p-4">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) => setAcceptedTerms(event.target.checked)}
                className="mt-1 h-4 w-4 accent-violet-700"
              />
              <span className="text-sm leading-6 text-zinc-600">
                Li e aceito o regulamento da campanha e os termos de pagamento
                em ambiente de teste.
              </span>
            </label>
            <p className="flex items-center gap-2 text-xs text-zinc-500">
              <ShieldCheck size={15} /> O valor é recalculado no backend e nunca
              depende do navegador.
            </p>
          </div>
          <Card className="h-fit p-6">
            {purchase.status === "EXPIRED" ? <div className="text-center"><AlertCircle className="mx-auto text-amber-600" size={38}/><h2 className="mt-3 text-lg font-black">O tempo da sua reserva terminou.</h2><p className="mt-2 text-sm text-zinc-600">Escolha novamente a quantidade para continuar.</p><Link href={`/campanha/${purchase.campaign.slug}`}><Button className="mt-5 w-full">Iniciar nova reserva</Button></Link></div> : payment?.method === "PIX" && payment.status !== "REJECTED" ? (
              <PixPaymentView
                payment={payment}
                refreshing={refreshing}
                refreshError={refreshError}
                onRefresh={refreshStatus}
              />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setMethod("PIX")}
                    className={`rounded-xl border p-3 text-sm font-bold ${method === "PIX" ? "border-violet-600 bg-violet-50 text-violet-700" : ""}`}
                  >
                    <QrCode className="mx-auto mb-1" /> PIX
                  </button>
                  <button
                    onClick={() => setMethod("CARD")}
                    className={`rounded-xl border p-3 text-sm font-bold ${method === "CARD" ? "border-violet-600 bg-violet-50 text-violet-700" : ""}`}
                  >
                    <CreditCard className="mx-auto mb-1" /> Cartão
                  </button>
                </div>
                {method === "PIX" ? (
                  <Button
                    className="mt-5 h-14 w-full"
                    disabled={!acceptedTerms || busy}
                    onClick={payPix}
                  >
                    {busy && <LoaderCircle className="animate-spin" />}
                    Gerar PIX de teste
                  </Button>
                ) : (
                  <div className="mt-5">
                    {!acceptedTerms ? (
                      <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                        Aceite os termos para abrir o formulário seguro.
                      </p>
                    ) : (
                      <MercadoPagoCardBrick
                        purchaseId={purchase.id}
                        amount={purchase.total}
                        enabled={acceptedTerms}
                        onPayment={receivePayment}
                      />
                    )}
                  </div>
                )}
                {payment?.status === "REJECTED" && (
                  <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                    Pagamento rejeitado:{" "}
                    {payment.failureReason || "tente outro cartão"}.
                  </p>
                )}
              </>
            )}
            {purchase.status !== "EXPIRED" && <Button
              variant="ghost"
              className="mt-4 w-full"
              disabled={busy}
              onClick={cancel}
            >
              Cancelar e voltar
            </Button>}
            <Link
              href="/comprador/meus-numeros"
              className="mt-3 block text-center text-sm font-bold text-violet-700"
            >
              Ver meus títulos
            </Link>
          </Card>
        </div>
      )}
    </main>
  );
}

function Summary({
  label,
  value,
  success,
  strong,
}: {
  label: string;
  value: number;
  success?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="rounded-xl bg-zinc-50 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p
        className={`mt-1 ${strong ? "text-2xl font-black" : "font-bold"} ${success ? "text-green-700" : ""}`}
      >
        R$ {value.toFixed(2).replace(".", ",")}
      </p>
    </div>
  );
}

function formatPhone(value:string){const digits=value.replace(/\D/g,"").replace(/^55/,"");return digits.length===11?`(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`:value}
