"use client";

import { Search } from "lucide-react";

export default function SearchBar() {
  return (
    <div className="relative">

      <Search
        size={20}
        className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
      />

      <input
        placeholder="Buscar campanhas..."
        className="w-full rounded-2xl border border-zinc-200 bg-white py-4 pl-12 pr-4 outline-none shadow-sm"
      />

    </div>
  );
}