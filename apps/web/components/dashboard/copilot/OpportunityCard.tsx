"use client";

import { ArrowUpRight } from "lucide-react";

interface Props {
  titulo: string;
  valor: string;
  descricao: string;
  cor: string;
}

export default function OpportunityCard({
  titulo,
  valor,
  descricao,
  cor,
}: Props) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">

      <div className="flex items-center justify-between">

        <h3 className="font-bold text-lg">
          {titulo}
        </h3>

        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${cor}`}
        >
          {valor}
        </span>

      </div>

      <p className="mt-3 text-sm text-zinc-500">
        {descricao}
      </p>

      <button className="mt-5 flex items-center gap-2 font-semibold text-violet-700">

        Executar Agora

        <ArrowUpRight size={18} />

      </button>

    </div>
  );
}
