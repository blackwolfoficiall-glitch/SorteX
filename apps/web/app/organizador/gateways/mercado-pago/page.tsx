"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ShieldCheck,
  CreditCard,
  Smartphone,
  CircleCheck,
} from "lucide-react";

export default function MercadoPagoPage() {
  return (
    <main className="min-h-screen bg-zinc-50">

      <div className="mx-auto max-w-md p-6">

        <Link
          href="/cadastro/organizador/financeiro"
          className="inline-flex items-center gap-2 text-violet-700"
        >
          <ArrowLeft size={20} />
          Voltar
        </Link>

        <div className="mt-8 rounded-3xl bg-white p-8 shadow">

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/gateways/mercadopago.png"
            alt="Mercado Pago"
            className="mx-auto h-16 object-contain"
          />

          <h1 className="mt-6 text-center text-3xl font-black">
            Mercado Pago
          </h1>

          <p className="mt-3 text-center text-zinc-500">
            Conecte sua conta para começar a receber
            pagamentos automaticamente pela SorteX.
          </p>

          <div className="mt-8 space-y-4">

            <div className="flex items-center gap-3">

              <CircleCheck className="text-green-600" />

              PIX

            </div>

            <div className="flex items-center gap-3">

              <CreditCard className="text-green-600" />

              Cartão de Crédito

            </div>

            <div className="flex items-center gap-3">

              <Smartphone className="text-green-600" />

              Cartão de Débito

            </div>

            <div className="flex items-center gap-3">

              <ShieldCheck className="text-green-600" />

              Recebimento automático

            </div>

          </div>

          <button
            className="mt-10 w-full rounded-2xl bg-sky-500 py-5 text-lg font-bold text-white"
          >
            Conectar com Mercado Pago
          </button>

          <p className="mt-6 text-center text-sm text-zinc-500">
            Você será redirecionado para o Mercado Pago
            para autorizar a conexão.
          </p>

        </div>

      </div>

    </main>
  );
}
