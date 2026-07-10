"use client";

import { Bell, Search, Plus, Settings } from "lucide-react";
import Link from "next/link";

export default function DashboardHeader() {
  return (
    <header className="flex items-center justify-between mb-10">

      <div>

        <p className="text-zinc-400 text-sm">
          Bem-vindo de volta 👋
        </p>

        <h1 className="text-4xl font-black mt-2">
          Dashboard
        </h1>

      </div>

      <div className="flex items-center gap-4">

        <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 w-80">

          <Search
            size={18}
            className="text-zinc-500"
          />

          <input
            placeholder="Pesquisar..."
            className="ml-3 bg-transparent outline-none w-full text-white"
          />

        </div>

        <button className="h-12 w-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center hover:bg-zinc-800">

          <Bell size={20} />

        </button>

        <button className="h-12 w-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center hover:bg-zinc-800">

          <Settings size={20} />

        </button>

        <Link
          href="/criar"
          className="bg-violet-600 hover:bg-violet-500 rounded-2xl px-6 py-3 font-semibold flex items-center gap-2"
        >

          <Plus size={18} />

          Nova Rifa

        </Link>

      </div>

    </header>
  );
}