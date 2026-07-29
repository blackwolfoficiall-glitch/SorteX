"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import Button from "@/components/ui/Button";
import ReservationCountdown from "@/components/purchases/ReservationCountdown";
import type { Payment } from "@/lib/payments/types";

export default function PixPaymentView({ payment }: { payment: Payment }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (!payment.pixCopyPaste) return;
    await navigator.clipboard.writeText(payment.pixCopyPaste);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="text-center">
      <p className="text-sm font-bold uppercase tracking-wider text-violet-700">
        PIX Mercado Pago · Sandbox
      </p>
      {payment.pixQrCodeBase64 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`data:image/png;base64,${payment.pixQrCodeBase64}`}
          alt="QR Code PIX"
          className="mx-auto mt-5 h-60 w-60 rounded-2xl border bg-white p-3"
        />
      )}
      <p className="mt-5 text-sm text-zinc-500">Valor</p>
      <p className="text-3xl font-black">
        R$ {payment.amount.toFixed(2).replace(".", ",")}
      </p>
      {payment.expiresAt && (
        <p className="mt-3 text-sm text-zinc-500">
          Tempo restante: <ReservationCountdown expiresAt={payment.expiresAt} />
        </p>
      )}
      {payment.pixCopyPaste && (
        <div className="mt-5 rounded-2xl bg-zinc-50 p-4 text-left">
          <p className="break-all text-xs text-zinc-600">
            {payment.pixCopyPaste}
          </p>
          <Button className="mt-3 w-full" variant="outline" onClick={copy}>
            {copied ? <Check size={17} /> : <Copy size={17} />}
            {copied ? "Copiado" : "Copiar código PIX"}
          </Button>
        </div>
      )}
      {payment.boletoUrl && (
        <a
          href={payment.boletoUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-violet-700"
        >
          Abrir instruções do Mercado Pago <ExternalLink size={15} />
        </a>
      )}
      <p className="mt-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
        Aguardando pagamento. A confirmação definitiva será recebida pelo webhook do Mercado Pago.
      </p>
    </div>
  );
}
