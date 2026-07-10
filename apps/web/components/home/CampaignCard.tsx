"use client";

type Props = {
  titulo: string;
  preco: string;
  progresso: number;
  promocao?: string;
};

export default function CampaignCard({
  titulo,
  preco,
  progresso,
  promocao,
}: Props) {
  return (
    <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">

      <div className="flex h-56 items-center justify-center bg-zinc-100">
        📷 Imagem da campanha
      </div>

      <div className="space-y-4 p-5">

        <h3 className="text-xl font-bold">
          {titulo}
        </h3>

        <div className="h-3 rounded-full bg-zinc-200">

          <div
            className="h-3 rounded-full bg-violet-600"
            style={{ width: `${progresso}%` }}
          />

        </div>

        <div className="flex justify-between text-sm">

          <span>{progresso}% vendido</span>

          <strong>{preco}</strong>

        </div>

        {promocao && (
          <div className="rounded-xl bg-orange-50 p-3 text-sm font-semibold text-orange-600">
            🔥 {promocao}
          </div>
        )}

        <button className="w-full rounded-2xl bg-violet-700 py-4 font-bold text-white">
          Comprar cotas
        </button>

      </div>

    </div>
  );
}