"use client";
import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, KeyRound, LogOut, Save, ShieldCheck } from "lucide-react";
import { authRequest, getCurrentUser } from "@/lib/auth/client";
import type { AuthUser } from "@/lib/auth/types";
import {
  getPersonalization,
  updateBrand,
  uploadBrandAsset,
  type Brand,
} from "@/lib/organizer-platform/client";
import { updateOrganizerAccount } from "@/lib/organizers/client";
const input =
  "mt-2 h-11 w-full rounded-xl border px-3 outline-none focus:border-violet-500";
export default function PerfilPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    cpf: "",
    cnpj: "",
    city: "",
    state: "",
    currentPassword: "",
    newPassword: "",
  });
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [busy, setBusy] = useState(false);
  async function load() {
    setLoadingProfile(true);
    setLoadError("");
    try {
      const [u, p] = await Promise.all([getCurrentUser(), getPersonalization()]);
      setUser(u);
      setBrand(p.brand);
      setForm((v) => ({
        ...v,
        name: u.name,
        email: u.email,
        phone: u.phone || "",
        cpf: u.cpf || "",
        cnpj: u.cnpj || "",
        city: u.city || "",
        state: u.state || "",
      }));
    } finally {
      setLoadingProfile(false);
    }
  }
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((cause) =>
        setLoadError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível carregar o perfil.",
        ),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!brand) return;
    setBusy(true);
    try {
      await updateOrganizerAccount({
        ...form,
        phone: form.phone.replace(/\D/g, "") || undefined,
        cpf: form.cpf.replace(/\D/g, "") || undefined,
        cnpj: form.cnpj.replace(/\D/g, "") || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim().toUpperCase() || undefined,
        currentPassword: form.currentPassword || undefined,
        newPassword: form.newPassword || undefined,
      });
      await updateBrand({
        publicName: brand.publicName,
        fantasyName: brand.fantasyName,
        slogan: brand.slogan,
        publicPhone: brand.publicPhone,
        publicEmail: brand.publicEmail,
      });
      setMessage("Perfil salvo com sucesso.");
      setForm((v) => ({ ...v, currentPassword: "", newPassword: "" }));
      await load();
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Não foi possível salvar o perfil.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function upload(kind: "profile" | "logo", file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      await uploadBrandAsset(kind, file);
      setMessage(kind === "profile" ? "Foto atualizada." : "Logo atualizada.");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erro no upload.");
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    await authRequest("/api/auth/logout", { method: "POST" }).catch(
      () => undefined,
    );
    router.replace("/login");
  }
  if (loadingProfile)
    return (
      <main className="grid min-h-screen place-items-center">
        Carregando perfil...
      </main>
    );
  if (loadError || !user || !brand)
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <section className="max-w-md rounded-3xl border bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-black">Não foi possível carregar seu perfil</h1>
          <p className="mt-2 text-sm text-zinc-600">
            {loadError || "Os dados do perfil estão indisponíveis."}
          </p>
          <button
            type="button"
            onClick={() => void load().catch((cause) => setLoadError(cause instanceof Error ? cause.message : "Não foi possível carregar o perfil."))}
            className="mt-5 rounded-xl bg-violet-700 px-5 py-3 text-sm font-bold text-white"
          >
            Tentar novamente
          </button>
        </section>
      </main>
    );
  const avatar = `/api/brand-assets/${user.id}/profile`;
  const logo = `/api/brand-assets/${user.id}/logo`;
  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-8">
      <form onSubmit={save} className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-3xl bg-gradient-to-br from-violet-800 to-purple-600 p-6 text-white">
          <div className="flex flex-wrap items-center gap-5">
            <div className="relative">
              <div className="h-24 w-24 overflow-hidden rounded-full bg-white/15">
                {brand.profileImageUrl ? (
                  <Image
                    src={avatar}
                    width={96}
                    height={96}
                    unoptimized
                    alt="Foto do perfil"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="grid h-full place-items-center text-3xl font-black">
                    {user.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <label
                aria-label="Trocar foto"
                className="absolute -bottom-1 -right-1 grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-white text-violet-700"
              >
                <Camera size={17} />
                <input
                  hidden
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => upload("profile", e.target.files?.[0])}
                />
              </label>
            </div>
            <div>
              <p className="text-sm text-violet-100">Meu perfil SorteX</p>
              <h1 className="text-3xl font-black">
                {brand.publicName || user.name}
              </h1>
              {user.verified && (
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
                  <ShieldCheck size={14} />
                  Organizador verificado
                </span>
              )}
            </div>
          </div>
        </header>
        {message && (
          <p
            role="status"
            className="rounded-2xl bg-white p-4 text-sm font-semibold text-violet-800"
          >
            {message}
          </p>
        )}
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Dados pessoais">
            <Field label="Nome completo">
              <input
                className={input}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="E-mail">
              <input
                type="email"
                className={input}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="Telefone">
              <input
                className={input}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cidade">
                <input
                  className={input}
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </Field>
              <Field label="Estado">
                <input
                  maxLength={2}
                  className={input}
                  value={form.state}
                  onChange={(e) =>
                    setForm({ ...form, state: e.target.value.toUpperCase() })
                  }
                />
              </Field>
            </div>
            <Field label="CPF ou CNPJ">
              <input
                className={input}
                value={form.cnpj || form.cpf}
                onChange={(e) =>
                  user.cnpj
                    ? setForm({ ...form, cnpj: e.target.value })
                    : setForm({ ...form, cpf: e.target.value })
                }
              />
            </Field>
          </Section>
          <Section title="Dados públicos">
            <Field label="Nome público">
              <input
                className={input}
                value={brand.publicName}
                onChange={(e) =>
                  setBrand({ ...brand, publicName: e.target.value })
                }
              />
            </Field>
            <Field label="Nome fantasia">
              <input
                className={input}
                value={brand.fantasyName || ""}
                onChange={(e) =>
                  setBrand({ ...brand, fantasyName: e.target.value })
                }
              />
            </Field>
            <Field label="Slogan">
              <input
                maxLength={60}
                className={input}
                value={brand.slogan || ""}
                onChange={(e) => setBrand({ ...brand, slogan: e.target.value })}
              />
            </Field>
            <div className="mt-5 flex items-center gap-4">
              <div className="h-20 w-20 overflow-hidden rounded-2xl border bg-zinc-50">
                {brand.primaryLogoUrl ? (
                  <Image
                    src={logo}
                    width={80}
                    height={80}
                    unoptimized
                    alt="Logo da marca"
                    className="h-full w-full object-contain"
                  />
                ) : null}
              </div>
              <label className="cursor-pointer rounded-xl border px-4 py-3 text-sm font-bold">
                Trocar logo
                <input
                  hidden
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => upload("logo", e.target.files?.[0])}
                />
              </label>
            </div>
          </Section>
          <Section title="Segurança">
            <KeyRound className="text-violet-700" />
            <p className="mt-2 text-sm text-zinc-500">
              Para alterar a senha, confirme a senha atual.
            </p>
            <Field label="Senha atual">
              <input
                type="password"
                className={input}
                value={form.currentPassword}
                onChange={(e) =>
                  setForm({ ...form, currentPassword: e.target.value })
                }
              />
            </Field>
            <Field label="Nova senha">
              <input
                type="password"
                minLength={8}
                className={input}
                value={form.newPassword}
                onChange={(e) =>
                  setForm({ ...form, newPassword: e.target.value })
                }
              />
            </Field>
          </Section>
          <Section title="Identidade visual">
            <p className="text-sm text-zinc-600">
              A foto identifica você no painel. A logo identifica sua marca nas
              campanhas. Elas são armazenadas separadamente.
            </p>
            <a
              href="/dashboard/personalizacao"
              className="mt-5 inline-block rounded-xl bg-violet-50 px-4 py-3 text-sm font-bold text-violet-700"
            >
              Abrir Personalização completa
            </a>
          </Section>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            disabled={busy}
            className="flex h-12 items-center gap-2 rounded-xl bg-violet-700 px-6 font-bold text-white"
          >
            <Save size={18} />
            {busy ? "Salvando..." : "Salvar perfil"}
          </button>
          <button
            type="button"
            onClick={logout}
            className="flex h-12 items-center gap-2 rounded-xl border border-red-200 px-6 font-bold text-red-600"
          >
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </form>
    </main>
  );
}
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-black">{title}</h2>
      {children}
    </section>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mt-4 block text-sm font-bold">
      {label}
      {children}
    </label>
  );
}
