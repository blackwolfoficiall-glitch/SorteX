"use client";

import {
  Crown,
  Clock,
  AlertTriangle,
  MessageCircle,
} from "lucide-react";

const clientes = [
  {
    nome: "João Silva",
    cidade: "Feira de Santana",
    compras: 42,
    gasto: "R$ 3.280",
    status: "VIP",
  },
  {
    nome: "Maria Souza",
    cidade: "Salvador",
    compras: 18,
    gasto: "R$ 1.420",
    status: "Em risco",
  },
  {
    nome: "Pedro Lima",
    cidade: "Juazeiro",
    compras: 8,
    gasto: "R$ 640",
    status: "Inativo",
  },
];

export default function CRMCustomerTable() {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">

      <div className="flex items-center justify-between">

        <div>

          <h2 className="text-2xl font-black">
            Clientes Inteligentes
          </h2>

          <p className="text-zinc-500">
            A IA prioriza quem possui maior chance de comprar novamente.
          </p>

        </div>

      </div>

      <div className="mt-6 space-y-4">

        {clientes.map((cliente) => (
          <div
            key={cliente.nome}
            className="rounded-2xl border p-5 hover:border-violet-600 transition"
          >
            <div className="flex items-center justify-between">

              <div>

                <h3 className="text-lg font-bold">
                  {cliente.nome}
                </h3>

                <p className="text-sm text-zinc-500">
                  {cliente.cidade}
                </p>

              </div>

              {cliente.status === "VIP" && (
                <Crown className="text-yellow-500" />
              )}

              {cliente.status === "Em risco" && (
                <AlertTriangle className="text-orange-500" />
              )}

              {cliente.status === "Inativo" && (
                <Clock className="text-red-500" />
              )}

            </div>

            <div className="mt-5 grid grid-cols-2 gap-4">

              <div>

                <p className="text-sm text-zinc-500">
                  Compras
                </p>

                <h3 className="font-bold">
                  {cliente.compras}
                </h3>

              </div>

              <div>

                <p className="text-sm text-zinc-500">
                  Total gasto
                </p>

                <h3 className="font-bold">
                  {cliente.gasto}
                </h3>

              </div>

            </div>

            <button className="mt-5 flex items-center gap-2 rounded-xl bg-green-600 px-5 py-3 font-bold text-white">

              <MessageCircle size={18} />

              Entrar em contato

            </button>

          </div>
        ))}

      </div>

    </div>
  );
}