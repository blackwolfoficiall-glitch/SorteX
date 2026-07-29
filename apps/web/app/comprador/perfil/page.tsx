"use client";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Heart, Bell, LifeBuoy, ShieldCheck } from "lucide-react";
import { authRequest } from "@/lib/auth/client";
import { getBuyerProfile, updateBuyerProfile } from "@/lib/buyer/client";
import type { BuyerProfile } from "@/lib/buyer/types";
export default function Perfil() {
  const router = useRouter();
  const [user, setUser] = useState<BuyerProfile | null>(null),
    [saved, setSaved] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadError, setLoadError] = useState("");
  async function loadProfile() {
    setLoadingProfile(true);
    setLoadError("");
    try {
      setUser(await getBuyerProfile());
    } finally {
      setLoadingProfile(false);
    }
  }
  useEffect(() => {
    loadProfile().catch((cause) =>
      setLoadError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar o perfil.",
      ),
    );
  }, []);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (user)
      setUser(
        await updateBuyerProfile({
          name: user.name,
          phone: user.phone,
          city: user.city,
          state: user.state,
        }),
      );
    setSaved(true);
  }
  async function logout() {
    await authRequest("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }
  if (loadingProfile)
    return <p className="p-10 text-center">Carregando perfil...</p>;
  if (loadError || !user)
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-xl font-black">Não foi possível carregar seu perfil</h1>
        <p className="mt-2 text-sm text-zinc-600">
          {loadError || "Os dados do perfil estão indisponíveis."}
        </p>
        <button
          type="button"
          onClick={() => void loadProfile().catch((cause) => setLoadError(cause instanceof Error ? cause.message : "Não foi possível carregar o perfil."))}
          className="mt-5 rounded-xl bg-violet-700 px-5 py-3 font-bold text-white"
        >
          Tentar novamente
        </button>
      </main>
    );
  return (
    <main className="mx-auto max-w-3xl p-5 md:py-10">
      <section className="rounded-3xl bg-gradient-to-br from-violet-800 to-purple-600 p-6 text-white">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 text-3xl font-black">
          {user.name[0]}
        </div>
        <h1 className="mt-4 text-3xl font-black">{user.name}</h1>
        <p>{user.email}</p>
      </section>
      <form
        onSubmit={save}
        className="mt-5 grid gap-3 rounded-3xl bg-white p-5 sm:grid-cols-2"
      >
        {(["name", "phone", "city", "state"] as const).map((k) => (
          <label key={k} className="text-sm font-bold capitalize">
            {k}
            <input
              value={user[k] || ""}
              onChange={(e) => setUser({ ...user, [k]: e.target.value })}
              className="mt-1 h-12 w-full rounded-xl border px-3"
            />
          </label>
        ))}
        <p className="text-sm text-zinc-500">
          CPF: {user.cpf || "Não informado"}
        </p>
        <button className="h-12 rounded-xl bg-violet-700 font-bold text-white">
          Salvar dados
        </button>
        {saved && <p className="text-sm text-green-700">Dados atualizados.</p>}
      </form>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Item href="/comprador/favoritos" icon={<Heart />} label="Favoritos" />
        <Item
          href="/comprador/notificacoes"
          icon={<Bell />}
          label="Notificações"
        />
        <Item href="/comprador/suporte" icon={<LifeBuoy />} label="Suporte" />
        <Item
          href="/esqueci-senha"
          icon={<ShieldCheck />}
          label="Segurança e senha"
        />
      </div>
      <button
        onClick={logout}
        className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-red-600 font-bold text-white"
      >
        <LogOut />
        Sair da conta
      </button>
    </main>
  );
}
function Item({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl bg-white p-4 font-bold shadow-sm"
    >
      <span className="text-violet-700">{icon}</span>
      {label}
    </Link>
  );
}
