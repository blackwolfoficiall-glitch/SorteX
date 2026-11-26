"use client";

import Link from "next/link";
import { useAuthorizedUser } from "@/components/auth/RoleGate";
import CampaignCard from "@/components/comprador/CampaignCard";
import { useFavorites } from "@/lib/buyer/use-favorites";

export default function Favoritos() {
  const user = useAuthorizedUser();
  const { items, busy, error, update } = useFavorites(
    user?.role === "BUYER" ? user.id : null,
  );
  return (
    <section className="mx-auto max-w-6xl p-5 md:py-10" aria-busy={busy}>
      <h1 className="text-3xl font-black">Favoritos</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Sua lista é privada. Apenas campanhas que continuam públicas aparecem
        aqui.
      </p>
      <Link
        href="/comprador/sorteios"
        className="mt-3 inline-block text-sm font-bold text-violet-700"
      >
        Ver sorteios
      </Link>
      {user?.role !== "BUYER" && (
        <p role="alert" className="mt-4 text-red-700">
          Entre como comprador para consultar seus favoritos.
        </p>
      )}
      {busy && (
        <p role="status" className="mt-4 text-sm text-zinc-600">
          Atualizando favoritos…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      )}
      {items?.length === 0 && !busy && (
        <p className="mt-6 rounded-3xl bg-white p-10 text-center text-zinc-500">
          Nenhuma campanha pública salva.
        </p>
      )}
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items?.map(({ id, campaign }) => (
          <li key={id}>
            <CampaignCard campaign={campaign} />
            <button
              type="button"
              disabled={busy}
              aria-label={`Remover dos favoritos: ${campaign.title}`}
              onClick={() =>
                void update({ campaignId: campaign.id, saved: false })
              }
              className="mt-2 w-full rounded-xl bg-red-50 p-2 text-sm font-bold text-red-700 disabled:opacity-50"
            >
              Remover dos favoritos
            </button>
          </li>
        ))}
      </ul>
      {user?.role === "BUYER" && !busy && (
        <button
          type="button"
          onClick={() => void update()}
          className="mt-5 text-sm font-bold text-violet-700"
        >
          {error ? "Tentar novamente" : "Atualizar favoritos"}
        </button>
      )}
    </section>
  );
}
