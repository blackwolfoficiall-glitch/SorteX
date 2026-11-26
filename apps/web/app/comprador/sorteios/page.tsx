"use client";
import Link from "next/link";
import { useAuthorizedUser } from "@/components/auth/RoleGate";
import { useFavorites } from "@/lib/buyer/use-favorites";
import { useEffect, useState } from "react";
import CampaignCard from "@/components/comprador/CampaignCard";
import { getBuyerCampaigns } from "@/lib/buyer/client";
import type { BuyerCampaign } from "@/lib/buyer/types";
const cats = [
  ["ALL", "Todas"],
  ["AUTOMOBILE", "Automóveis"],
  ["MOTORCYCLE", "Motos"],
  ["ELECTRONICS", "Eletrônicos"],
  ["CASH", "Dinheiro"],
  ["OTHER", "Outros"],
];
export default function Sorteios() {
  const user = useAuthorizedUser();
  const buyer = user?.role === "BUYER";
  const favorites = useFavorites(buyer ? user.id : null);
  const saved = new Set(favorites.items?.map(({ campaign }) => campaign.id));
  const [items, setItems] = useState<BuyerCampaign[]>([]),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState("ALL"),
    [filter, setFilter] = useState("");
  useEffect(() => {
    const q = new URLSearchParams({
      search,
      category,
      ...(filter ? { filter } : {}),
    });
    getBuyerCampaigns(`?${q}`)
      .then((r) => setItems(r.items))
      .catch(() => setItems([]));
  }, [search, category, filter]);
  return (
    <main className="mx-auto max-w-6xl p-5 md:py-10">
      <h1 className="text-3xl font-black">Sorteios</h1>
      {buyer && (
        <Link
          href="/comprador/favoritos"
          className="mt-3 inline-block text-sm font-bold text-violet-700"
        >
          Meus favoritos
        </Link>
      )}
      {buyer && favorites.busy && (
        <p role="status" className="mt-2 text-sm text-zinc-600">
          Atualizando favoritos…
        </p>
      )}
      {favorites.error && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <p role="alert" className="text-red-700">
            {favorites.error}
          </p>
          <button
            type="button"
            onClick={() => void favorites.update()}
            className="font-bold text-violet-700"
          >
            Tentar carregar favoritos novamente
          </button>
        </div>
      )}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar campanha ou prêmio"
        className="mt-5 h-14 w-full rounded-2xl border bg-white px-5 outline-none focus:border-violet-600"
      />
      <div className="mt-4 flex gap-2 overflow-auto pb-2">
        {cats.map(([v, l]) => (
          <button
            key={v}
            onClick={() => setCategory(v)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${category === v ? "bg-violet-700 text-white" : "bg-white"}`}
          >
            {l}
          </button>
        ))}
      </div>
      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="mt-2 rounded-xl border bg-white p-3"
      >
        <option value="">Mais recentes</option>
        <option value="LIVE">Ao vivo</option>
        <option value="UPCOMING">Em breve</option>
        <option value="MOST_SOLD">Mais vendidos</option>
        <option value="LOWEST_PRICE">Menor preço</option>
        <option value="ENDING">Encerrando</option>
      </select>
      {items.length ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <div key={c.id}>
              <CampaignCard campaign={c} />
              {favorites.items && (
                <button
                  type="button"
                  disabled={favorites.busy}
                  aria-label={`${saved.has(c.id) ? "Remover dos favoritos" : "Salvar nos favoritos"}: ${c.title}`}
                  onClick={() =>
                    void favorites.update({
                      campaignId: c.id,
                      saved: !saved.has(c.id),
                    })
                  }
                  className="mt-2 w-full rounded-xl border border-violet-200 bg-white p-2 text-sm font-bold text-violet-700 disabled:opacity-50"
                >
                  {saved.has(c.id)
                    ? "Remover dos favoritos"
                    : "Salvar nos favoritos"}
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-8 rounded-3xl bg-white p-10 text-center text-zinc-500">
          Nenhuma campanha encontrada.
        </p>
      )}
    </main>
  );
}
