"use client";

import {
  Wallet,
  TrendingUp,
  Calendar,
  Ticket,
} from "lucide-react";

export default function FinancialOverview() {
  return (
    <div className="grid grid-cols-4 gap-6">

      {/* Saldo arrecadado */}

      <div className="col-span-2 rounded-3xl bg-gradient-to-r from-violet-700 to-purple-600 p-8 text-white shadow-xl">

        <div className="flex items-center justify-between">

          <div>

            <p className="text-white/70">
              Saldo Arrecadado
            </p>

            <h1 className="mt-3 text-5xl font-black">
              R$ 128.450
            </h1>

            <p className="mt-4 text-white/70">
              Valor arrecadado das campanhas em andamento.
            </p>

          </div>

          <div className="rounded-2xl bg-white/20 p-5">

            <Wallet size={42} />

          </div>

        </div>

      </div>

      {/* Recebido Hoje */}

      <div className="rounded-3xl bg-white p-6 shadow">

        <TrendingUp
          className="text-green-600"
          size={34}
        />

        <p className="mt-6 text-zinc-500">
          Recebido Hoje
        </p>

        <h2 className="mt-2 text-3xl font-black">
          R$ 2.480
        </h2>

        <p className="mt-3 text-green-600 font-semibold">
          +18% em relação a ontem
        </p>

      </div>

      {/* Receita do mês */}

      <div className="rounded-3xl bg-white p-6 shadow">

        <Calendar
          className="text-violet-700"
          size={34}
        />

        <p className="mt-6 text-zinc-500">
          Receita do Mês
        </p>

        <h2 className="mt-2 text-3xl font-black">
          R$ 68.920
        </h2>

        <p className="mt-3 text-zinc-500">
          Julho de 2026
        </p>

      </div>

      {/* Cotas vendidas */}

      <div className="rounded-3xl bg-white p-6 shadow">

        <Ticket
          className="text-orange-500"
          size={34}
        />

        <p className="mt-6 text-zinc-500">
          Cotas Vendidas
        </p>

        <h2 className="mt-2 text-3xl font-black">
          18.452
        </h2>

        <p className="mt-3 text-zinc-500">
          Campanhas ativas
        </p>

      </div>

      {/* Campanhas */}

      <div className="rounded-3xl bg-white p-6 shadow">

        <div className="flex items-center justify-between">

          <h2 className="text-xl font-bold">
            Campanhas Ativas
          </h2>

          <span className="rounded-full bg-green-100 px-4 py-2 text-sm font-bold text-green-700">
            12 Ativas
          </span>

        </div>

        <div className="mt-8 h-3 rounded-full bg-zinc-200">

          <div className="h-3 w-[74%] rounded-full bg-violet-700" />

        </div>

        <div className="mt-4 flex justify-between text-sm">

          <span>
            Média vendida
          </span>

          <strong>
            74%
          </strong>

        </div>

      </div>

    </div>
  );
}
