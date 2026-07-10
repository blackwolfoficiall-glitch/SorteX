"use client";

interface Props {
  titulo: string;
  descricao: string;
  potencial: string;
}

export default function MissionCard({
  titulo,
  descricao,
  potencial,
}: Props) {
  return (
    <div className="rounded-2xl border p-5 hover:border-violet-600 transition">

      <div className="flex items-center justify-between">

        <h3 className="font-bold">
          {titulo}
        </h3>

        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
          {potencial}
        </span>

      </div>

      <p className="mt-3 text-sm text-zinc-500">
        {descricao}
      </p>

      <button className="mt-5 w-full rounded-xl bg-violet-700 py-3 font-bold text-white hover:bg-violet-800">
        Executar Missão
      </button>

    </div>
  );
}
