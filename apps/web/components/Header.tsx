"use client";

import { Bell } from "lucide-react";

export default function Header() {
  return (
    <header className="flex items-center justify-between">

      <div>

        <h1 className="text-4xl font-black">
          Sorte<span className="text-violet-600">X</span>
        </h1>

        <p className="mt-2 text-zinc-500">
          Encontre sua próxima sorte.
        </p>

      </div>

      <button className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
        <Bell size={22} />
      </button>

    </header>
  );
}