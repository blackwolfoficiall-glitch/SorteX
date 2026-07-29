"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, LoaderCircle, Search } from "lucide-react";
import CampaignCard from "@/components/comprador/CampaignCard";
import { getBuyerHome } from "@/lib/buyer/client";
import { authRequest } from "@/lib/auth/client";
import type { BuyerHome } from "@/lib/buyer/types";
export default function CompradorHome() {
  const router = useRouter();
  const [data, setData] = useState<BuyerHome | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    setError("");
    try {
      setData(await getBuyerHome());
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar seus dados.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function logout() {
    await authRequest("/api/auth/logout", { method: "POST" }).catch(
      () => undefined,
    );
    router.replace("/login");
  }
  if (loading && !data)
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-center">
        <div>
          <LoaderCircle className="mx-auto animate-spin text-violet-700" />
          <p className="mt-3 text-sm text-zinc-600">Carregando sua conta...</p>
        </div>
      </div>
    );
  if (error && !data)
    return (
      <main className="mx-auto grid min-h-[60vh] max-w-md place-items-center p-5">
        <section className="rounded-3xl border bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-black">Não foi possível carregar seus dados.</h1>
          <p className="mt-2 text-sm text-zinc-600">{error}</p>
          <div className="mt-5 grid gap-2">
            <button onClick={() => void load()} className="rounded-xl bg-violet-700 px-4 py-3 font-bold text-white">Tentar novamente</button>
            <button onClick={() => router.replace("/")} className="rounded-xl border px-4 py-3 font-bold">Voltar ao início</button>
            <button onClick={() => void logout()} className="rounded-xl border border-red-200 px-4 py-3 font-bold text-red-700">Sair da conta</button>
          </div>
        </section>
      </main>
    );
  return (
    <main className="mx-auto max-w-6xl space-y-8 p-5 md:py-8">
      {error && (
        <p className="rounded-2xl bg-red-50 p-4 text-red-700">{error}</p>
      )}
      {data && (
        <>
          <header className="flex items-center justify-between">
            <div>
              <p className="text-sm text-zinc-500">Olá,</p>
              <h1 className="text-3xl font-black">
                {data.profile.name.split(" ")[0]} 👋
              </h1>
              <p className="text-sm text-violet-700">Sua sorte começa aqui.</p>
            </div>
            <Link
              href="/comprador/notificacoes"
              className="relative rounded-2xl bg-white p-3 shadow"
            >
              <Bell />
              {data.unreadNotifications > 0 && (
                <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
                  {data.unreadNotifications}
                </span>
              )}
            </Link>
          </header>
          {data.banners.map((b) => (
            <Link
              key={b.id}
              href={b.linkUrl || "#"}
              className="block rounded-3xl bg-gradient-to-r from-violet-800 to-purple-600 p-6 text-white"
            >
              <h2 className="text-2xl font-black">{b.title}</h2>
              {b.subtitle && (
                <p className="mt-2 text-violet-100">{b.subtitle}</p>
              )}
            </Link>
          ))}
          <Link
            href="/comprador/sorteios"
            className="flex items-center gap-3 rounded-2xl bg-white p-4 text-zinc-500 shadow-sm"
          >
            <Search size={20} />
            Buscar campanhas e prêmios
          </Link>
          <Section title="Em destaque" items={data.featured} />
          <Section title="Campanhas ao vivo" items={data.live} />
          <Section title="Em breve" items={data.upcoming} />
        </>
      )}
    </main>
  );
}
function Section({
  title,
  items,
}: {
  title: string;
  items: BuyerHome["live"];
}) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-black">{title}</h2>
        <Link
          href="/comprador/sorteios"
          className="text-sm font-bold text-violet-700"
        >
          Ver todas
        </Link>
      </div>
      {items.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <CampaignCard key={c.id} campaign={c} />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed bg-white p-8 text-center text-zinc-500">
          Nenhuma campanha disponível agora.
        </div>
      )}
    </section>
  );
}
