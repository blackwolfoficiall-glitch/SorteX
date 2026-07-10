"use client";

import {
  Wallet,
  Calendar,
  Ticket,
  Trophy,
} from "lucide-react";

const indicadores = [
  {
    titulo: "Saldo Arrecadado",
    valor: "R$ 128.450",
    descricao: "Campanhas em andamento",
    icone: Wallet,
    cor: "text-violet-700",
  },
  {
    titulo: "Recebido Hoje",
    valor: "R$ 2.480",
    descricao: "Vendas de hoje",
    icone: Calendar,
    cor: "text-green-600",
  },
  {
    titulo: "Receita do Mês",
    valor: "R$ 68.920",
    descricao: "Julho 2026",
    icone: Trophy,
    cor: "text-blue-600",
  },
  {
    titulo: "Cotas Vendidas",
    valor: "18.452",
    descricao: "Todas as campanhas",
    icone: Ticket,
    cor: "text-orange-500",
  },
];

export default function KPICards() {
  return (
    <div className="grid grid-cols-4 gap-6">

      {indicadores.map((item) => {

        const Icon = item.icone;

        return (

          <div
            key={item.titulo}
            className="rounded-3xl bg-white p-6 shadow-sm hover:shadow-lg transition"
          >

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm text-zinc-500">
                  {item.titulo}
                </p>

                <h2 className="mt-2 text-3xl font-black">
                  {item.valor}
                </h2>

                <p className="mt-2 text-sm text-zinc-500">
                  {item.descricao}
                </p>

              </div>

              <div className="rounded-2xl bg-zinc-100 p-4">

                <Icon
                  size={28}
                  className={item.cor}
                />

              </div>

            </div>

          </div>

        );

      })}

    </div>
  );
}