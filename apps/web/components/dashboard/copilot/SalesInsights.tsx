"use client";

import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
} from "lucide-react";

export default function SalesInsights() {
  return (
    <div className="mt-6 rounded-2xl border bg-white p-5">

      <h2 className="text-lg font-bold">
        📊 Análise Inteligente
      </h2>

      <div className="mt-5 space-y-4">

        <div className="flex items-start gap-3">

          <TrendingUp className="text-green-600 mt-1" />

          <div>

            <h3 className="font-semibold">
              Campanha em alta
            </h3>

            <p className="text-sm text-zinc-500">
              A campanha Hilux está vendendo 26% acima da média.
            </p>

          </div>

        </div>

        <div className="flex items-start gap-3">

          <TrendingDown className="text-orange-500 mt-1" />

          <div>

            <h3 className="font-semibold">
              Atenção
            </h3>

            <p className="text-sm text-zinc-500">
              A campanha iPhone perdeu ritmo nas últimas 6 horas.
            </p>

          </div>

        </div>

        <div className="flex items-start gap-3">

          <AlertTriangle className="text-red-500 mt-1" />

          <div>

            <h3 className="font-semibold">
              Ação recomendada
            </h3>

            <p className="text-sm text-zinc-500">
              Ative uma promoção &quot;Compre 10 e Ganhe 2&quot; para aumentar a
              conversão.
            </p>

          </div>

        </div>

      </div>

    </div>
  );
}
