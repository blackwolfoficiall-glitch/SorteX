"use client";

import {
  HeartPulse,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
} from "lucide-react";

export default function BusinessHealth() {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">

      <div className="flex items-center gap-3">

        <HeartPulse
          className="text-violet-700"
          size={30}
        />

        <div>

          <h2 className="text-2xl font-black">
            Saúde do Negócio
          </h2>

          <p className="text-zinc-500">
            A IA analisa sua operação em tempo real.
          </p>

        </div>

      </div>

      <div className="mt-8 space-y-5">

        <div className="flex items-center justify-between rounded-2xl bg-green-50 p-4">

          <div>

            <h3 className="font-bold">
              Campanhas
            </h3>

            <p className="text-sm text-zinc-500">
              Ritmo acima da média
            </p>

          </div>

          <TrendingUp className="text-green-600" />

        </div>

        <div className="flex items-center justify-between rounded-2xl bg-yellow-50 p-4">

          <div>

            <h3 className="font-bold">
              CRM
            </h3>

            <p className="text-sm text-zinc-500">
              42 clientes precisam de atenção.
            </p>

          </div>

          <AlertTriangle className="text-yellow-600" />

        </div>

        <div className="flex items-center justify-between rounded-2xl bg-red-50 p-4">

          <div>

            <h3 className="font-bold">
              Conversão
            </h3>

            <p className="text-sm text-zinc-500">
              Caiu 8% nas últimas 24 horas.
            </p>

          </div>

          <TrendingDown className="text-red-600" />

        </div>

      </div>

    </div>
  );
}