"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle, Share2, Ticket } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { getPayment } from "@/lib/payments/client";
import type { Payment } from "@/lib/payments/types";
import PostPaymentRewards from "@/components/draws/PostPaymentRewards";

export default function PaymentSuccessPage() {
  const { id } = useParams<{ id: string }>();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  useEffect(() => {
    getPayment(id)
      .then(setPayment)
      .catch((cause) =>
        setError(
          cause instanceof Error ? cause.message : "Pagamento não encontrado.",
        ),
      );
  }, [id]);
  async function share() {
    if (!payment) return;
    const url = `${window.location.origin}/campanha/${payment.purchase.campaign.slug}`;
    if (navigator.share) {
      await navigator.share({
        title: payment.purchase.campaign.title,
        text: "Participei desta campanha pela SorteX.",
        url,
      });
    } else {
      await navigator.clipboard.writeText(url);
    }
  }
  async function completeProfile() {
    if (!payment) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/auth/checkout/complete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: payment.id,
          name,
          city,
          state,
          email,
          password,
          passwordConfirmation,
          termsAccepted,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          Array.isArray(payload.message)
            ? payload.message.join(" ")
            : payload.message || "Não foi possível concluir seu cadastro.",
        );
      setPayment(await getPayment(payment.id));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível concluir seu cadastro.",
      );
    } finally {
      setSaving(false);
    }
  }
  if (!payment && !error)
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <LoaderCircle className="animate-spin text-violet-700" />
      </main>
    );
  if (error)
    return <main className="p-10 text-center text-red-700">{error}</main>;
  if (!payment || payment.status !== "APPROVED")
    return (
      <main className="mx-auto max-w-xl p-8 text-center">
        <h1 className="text-2xl font-black">Confirmação em andamento</h1>
        <p className="mt-3 text-zinc-500">
          Aguarde a confirmação definitiva do webhook do Mercado Pago.
        </p>
        <Link href={`/comprador/checkout/${payment?.purchaseId}`}>
          <Button className="mt-5">Voltar ao pagamento</Button>
        </Link>
      </main>
    );
  return (
    <main className="mx-auto max-w-3xl p-5 py-10">
      <Card className="overflow-hidden text-center">
        <div className="bg-gradient-to-br from-green-500 to-emerald-700 p-8 text-white">
          <CheckCircle2 className="mx-auto" size={64} />
          <h1 className="mt-4 text-3xl font-black">Pagamento confirmado!</h1>
          <p className="mt-2 text-green-50">
            Seus títulos agora estão vendidos e protegidos pela SorteX.
          </p>
        </div>
        <div className="p-7">
          <h2 className="text-xl font-black">
            {payment.purchase.campaign.title}
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Info
              label="Quantidade"
              value={`${payment.purchase.quantity} títulos`}
            />
            <Info
              label="Valor pago"
              value={`R$ ${payment.amount.toFixed(2).replace(".", ",")}`}
            />
            <Info
              label="Método"
              value={payment.method === "PIX" ? "PIX" : "Cartão"}
            />
          </div>
          <p className="mt-5 text-xs text-zinc-500">
            Identificador: {payment.purchaseId}
          </p>
          {payment.profileComplete && (
            <PostPaymentRewards
              campaignId={payment.purchase.campaign.id}
              purchaseId={payment.purchaseId}
            />
          )}
          {!payment.profileComplete ? (
            <div className="mx-auto mt-6 max-w-xl rounded-2xl border bg-zinc-50 p-5 text-left">
              <h3 className="text-lg font-black">
                Pagamento confirmado! Complete seu cadastro para acessar seus
                títulos.
              </h3>
              <p className="mt-1 text-sm text-zinc-600">
                Você fará isso apenas nesta primeira compra.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Nome completo" value={name} onChange={setName} />
                <Field label="Cidade" value={city} onChange={setCity} />
                <label className="text-sm font-bold">
                  Estado
                  <select
                    value={state}
                    onChange={(event) => setState(event.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border bg-white px-3 font-normal"
                  >
                    <option value="">Selecione</option>
                    {[
                      "AC",
                      "AL",
                      "AP",
                      "AM",
                      "BA",
                      "CE",
                      "DF",
                      "ES",
                      "GO",
                      "MA",
                      "MT",
                      "MS",
                      "MG",
                      "PA",
                      "PB",
                      "PR",
                      "PE",
                      "PI",
                      "RJ",
                      "RN",
                      "RS",
                      "RO",
                      "RR",
                      "SC",
                      "SP",
                      "SE",
                      "TO",
                    ].map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <Field
                  label="E-mail"
                  value={email}
                  onChange={setEmail}
                  type="email"
                />
                <Field
                  label="Senha"
                  value={password}
                  onChange={setPassword}
                  type="password"
                />
                <Field
                  label="Confirmar senha"
                  value={passwordConfirmation}
                  onChange={setPasswordConfirmation}
                  type="password"
                />
              </div>
              <label className="mt-4 flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(event) => setTermsAccepted(event.target.checked)}
                  className="mt-1"
                />{" "}
                Aceito os Termos de Uso e a Política de Privacidade.
              </label>
              <Button
                className="mt-4 w-full"
                disabled={
                  saving ||
                  !name ||
                  !city ||
                  !state ||
                  !email ||
                  password.length < 8 ||
                  password !== passwordConfirmation ||
                  !termsAccepted
                }
                onClick={() => void completeProfile()}
              >
                {saving ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  "Concluir cadastro e ver meus títulos"
                )}
              </Button>
            </div>
          ) : (
            <div className="mt-5 flex max-h-44 flex-wrap justify-center gap-2 overflow-auto">
              {payment.purchase.tickets.map((ticket) => (
                <span
                  key={ticket.number}
                  className="rounded-lg bg-green-50 px-3 py-2 text-xs font-bold text-green-800"
                >
                  {ticket.number}
                </span>
              ))}
            </div>
          )}
          {payment.profileComplete && (
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/comprador/meus-numeros">
                <Button>
                  <Ticket size={17} /> Ver meus títulos
                </Button>
              </Link>
              <Button variant="outline" onClick={share}>
                <Share2 size={17} /> Compartilhar campanha
              </Button>
            </div>
          )}
        </div>
      </Card>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-zinc-50 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 font-black">{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="text-sm font-bold">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-11 w-full rounded-xl border bg-white px-3 font-normal"
      />
    </label>
  );
}
