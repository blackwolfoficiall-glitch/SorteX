"use client";

import { Wallet, Plus } from "lucide-react";

export default function WalletCard() {
  return (
    <section className="rounded-3xl bg-gradient-to-r from-violet-700 to-purple-600 p-6 text-white shadow-xl">

      <div className="flex items-center gap-3">
        <Wallet size={28} />
        <h2 className="text-xl font-bold">
          Carteira SorteX
        </h2>
      </div>

      <p className="mt-6 text-sm text-violet-100">
        Saldo disponível
      </p>

      <h3 className="text-4xl font-black">
        R$ 0,00
      </h3>

      <button className="mt-6 flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-bold text-violet-700">
        <Plus size={20} />
        Adicionar saldo
      </button>

    </section>
  );
}