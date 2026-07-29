"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { UserPlus } from "lucide-react";
import { AuthShell, authInputClass } from "@/components/auth/AuthShell";
import { authRequest } from "@/lib/auth/client";

export default function CadastroComprador() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    cpf: "",
    phone: "",
    email: "",
    city: "",
    state: "",
    password: "",
    confirmation: "",
  });
  const [accepted, setAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [dataAccepted, setDataAccepted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function change(event: React.ChangeEvent<HTMLInputElement>) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (form.password !== form.confirmation) return setError("As senhas não conferem.");
    if (!accepted || !privacyAccepted || !dataAccepted) return setError("Confirme todos os aceites obrigatórios para continuar.");
    setLoading(true);
    try {
      const digits = (value: string) => value.replace(/\D/g, "");
      await authRequest("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          cpf: digits(form.cpf),
          phone: digits(form.phone),
          email: form.email.trim().toLowerCase(),
          city: form.city.trim() || undefined,
          state: form.state.trim().toUpperCase() || undefined,
          password: form.password,
          passwordConfirmation: form.confirmation,
          role: "BUYER",
          termsAccepted: accepted,
          privacyAccepted,
          dataProcessingAccepted: dataAccepted,
        }),
      });
      router.push("/cadastro/sucesso-comprador");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar a conta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Conta de comprador" description="Participe de campanhas e acompanhe suas cotas em um só lugar.">
      <form onSubmit={submit} className="space-y-4">
        <input className={authInputClass} name="name" value={form.name} onChange={change} placeholder="Nome completo" autoComplete="name" required />
        <input className={authInputClass} name="cpf" value={form.cpf} onChange={change} placeholder="CPF" inputMode="numeric" required />
        <input className={authInputClass} name="phone" value={form.phone} onChange={change} placeholder="WhatsApp" inputMode="tel" autoComplete="tel" required />
        <input className={authInputClass} name="email" value={form.email} onChange={change} placeholder="E-mail" type="email" autoComplete="email" required />
        <div className="grid grid-cols-3 gap-3">
          <input className={`${authInputClass} col-span-2`} name="city" value={form.city} onChange={change} placeholder="Cidade" />
          <input className={authInputClass} name="state" value={form.state} onChange={change} placeholder="UF" maxLength={2} />
        </div>
        <input className={authInputClass} name="password" value={form.password} onChange={change} placeholder="Senha (mínimo 8 caracteres)" type="password" minLength={8} autoComplete="new-password" required />
        <input className={authInputClass} name="confirmation" value={form.confirmation} onChange={change} placeholder="Confirmar senha" type="password" minLength={8} autoComplete="new-password" required />
        <label className="flex items-start gap-3 text-sm text-zinc-600">
          <input type="checkbox" className="mt-1" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
          <span>Li e concordo com os Termos de Uso.</span>
        </label>
        <label className="flex items-start gap-3 text-sm text-zinc-600"><input type="checkbox" className="mt-1" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} /><span>Li e concordo com a Política de Privacidade.</span></label>
        <label className="flex items-start gap-3 text-sm text-zinc-600"><input type="checkbox" className="mt-1" checked={dataAccepted} onChange={(event) => setDataAccepted(event.target.checked)} /><span>Autorizo o tratamento dos meus dados conforme a LGPD.</span></label>
        {error && <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={loading} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-violet-700 font-bold text-white disabled:opacity-60">
          <UserPlus size={20} />
          {loading ? "Criando conta..." : "Criar conta de comprador"}
        </button>
        <p className="text-center text-sm text-zinc-500">Já possui conta? <Link href="/login" className="font-bold text-violet-700">Entrar</Link></p>
      </form>
    </AuthShell>
  );
}
