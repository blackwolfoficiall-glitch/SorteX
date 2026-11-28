import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface GatewayCardProps {
  nome: string;
  descricao: string;
  detailsHref?: string;
}

export default function GatewayCard({
  nome,
  descricao,
  detailsHref,
}: GatewayCardProps) {
  return (
    <article
      aria-label={nome}
      className="rounded-3xl border-2 border-zinc-200 bg-white p-6"
    >
      <div className="flex items-start gap-4">
        <div
          aria-hidden="true"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-zinc-100 font-bold text-zinc-700"
        >
          {nome.substring(0, 2).toUpperCase()}
        </div>
        <div>
          <h2 className="text-xl font-bold">{nome}</h2>
          <p className="mt-1 text-sm text-zinc-500">{descricao}</p>
        </div>
      </div>

      {detailsHref ? (
        <Link
          href={detailsHref}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-700 py-4 font-bold text-white transition hover:bg-violet-800"
        >
          Ver ambiente de teste
          <ChevronRight aria-hidden="true" size={20} />
        </Link>
      ) : (
        <button
          type="button"
          disabled
          className="mt-6 w-full cursor-not-allowed rounded-2xl bg-zinc-100 py-4 font-bold text-zinc-600"
        >
          Integração indisponível
        </button>
      )}
    </article>
  );
}
