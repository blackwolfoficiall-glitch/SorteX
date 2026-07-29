"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { createCardPayment, getPaymentConfig } from "@/lib/payments/client";
import type { Payment } from "@/lib/payments/types";

type BrickController = { unmount: () => void };
type BrickSubmitData = {
  formData?: {
    token?: string;
    payment_method_id?: string;
    installments?: number;
  };
};
type MercadoPagoInstance = {
  bricks: () => {
    create: (
      type: string,
      container: string,
      settings: Record<string, unknown>,
    ) => Promise<BrickController>;
  };
};
declare global {
  interface Window {
    MercadoPago?: new (
      publicKey: string,
      options: { locale: string },
    ) => MercadoPagoInstance;
  }
}

export default function MercadoPagoCardBrick({
  purchaseId,
  amount,
  enabled,
  onPayment,
}: {
  purchaseId: string;
  amount: number;
  enabled: boolean;
  onPayment: (payment: Payment) => void;
}) {
  const [sdkReady, setSdkReady] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const controller = useRef<BrickController | null>(null);

  useEffect(() => {
    if (!sdkReady || !enabled || !window.MercadoPago) return;
    let active = true;
    getPaymentConfig()
      .then(async (config) => {
        if (!config.publicKey) {
          throw new Error("Chave pública do Mercado Pago não configurada.");
        }
        const mp = new window.MercadoPago!(config.publicKey, {
          locale: "pt-BR",
        });
        controller.current = await mp
          .bricks()
          .create("cardPayment", "sortex-card-payment-brick", {
            initialization: { amount },
            customization: {
              paymentMethods: {
                maxInstallments: config.maxInstallments,
              },
              visual: { style: { theme: "default" } },
            },
            callbacks: {
              onReady: () => active && setLoading(false),
              onError: (cause: unknown) => {
                if (active)
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Erro no formulário seguro do Mercado Pago.",
                  );
              },
              onSubmit: async ({ formData }: BrickSubmitData) => {
                if (
                  !formData?.token ||
                  !formData.payment_method_id ||
                  !formData.installments
                ) {
                  throw new Error("Tokenização do cartão incompleta.");
                }
                const payment = await createCardPayment({
                  purchaseId,
                  cardToken: formData.token,
                  paymentMethodId: formData.payment_method_id,
                  installments: Number(formData.installments),
                });
                onPayment(payment);
              },
            },
          });
      })
      .catch((cause) => {
        if (active) {
          setLoading(false);
          setError(
            cause instanceof Error
              ? cause.message
              : "Não foi possível abrir o pagamento com cartão.",
          );
        }
      });
    return () => {
      active = false;
      controller.current?.unmount();
      controller.current = null;
    };
  }, [amount, enabled, onPayment, purchaseId, sdkReady]);

  return (
    <div>
      <Script
        src="https://sdk.mercadopago.com/js/v2"
        strategy="afterInteractive"
        onReady={() => setSdkReady(true)}
        onError={() =>
          setError("Não foi possível carregar o SDK do Mercado Pago.")
        }
      />
      {loading && (
        <p className="flex items-center gap-2 text-sm text-zinc-500">
          <LoaderCircle className="animate-spin" size={18} /> Carregando
          formulário seguro…
        </p>
      )}
      {error && (
        <p className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 shrink-0" size={17} /> {error}
        </p>
      )}
      <div id="sortex-card-payment-brick" />
      <p className="mt-3 text-xs text-zinc-500">
        Número completo e CVV são enviados diretamente ao Mercado Pago e nunca
        passam pelo backend da SorteX.
      </p>
    </div>
  );
}
