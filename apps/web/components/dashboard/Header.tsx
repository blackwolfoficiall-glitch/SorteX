"use client";

import {
  Bell,
  Search,
  Plus,
  ChevronDown,
} from "lucide-react";

export default function Header() {
  return (
    <header className="flex items-center justify-between rounded-3xl bg-white p-6 shadow-sm">

      <div>

        <p className="text-sm text-zinc-500">
          Bem-vindo de volta 👋
        </p>

        <h1 className="mt-1 text-3xl font-black">
          Painel do Organizador
        </h1>

      </div>

      <div className="flex items-center gap-4">

        <div className="flex items-center gap-3 rounded-2xl border bg-zinc-50 px-4 py-3">

          <Search size={18} />

          <input
            placeholder="Pesquisar campanhas, clientes..."
            className="bg-transparent outline-none w-72"
          />

        </div>

        <button className="rounded-2xl bg-violet-700 p-4 text-white hover:bg-violet-800 transition">
          <Plus size={22} />
        </button>

        <button className="relative rounded-2xl border p-4">

          <Bell size={22} />

          <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-red-500" />

        </button>

        <button className="flex items-center gap-3 rounded-2xl border px-4 py-2">

          <div className="h-11 w-11 rounded-full bg-violet-700 flex items-center justify-center text-white font-bold">
            FR
          </div>

          <div className="text-left">

            <p className="font-bold">
              Felipe Rocha
            </p>

            <p className="text-xs text-zinc-500">
              Organizador Verificado
            </p>

          </div>

          <ChevronDown size={18} />

        </button>

      </div>

    </header>
  );
}