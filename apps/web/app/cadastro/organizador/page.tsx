"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  Camera,
  User,
  Mail,
  Phone,
  CreditCard,
  Building2,
  MapPin,
  Upload,
} from "lucide-react";

export default function CadastroOrganizador() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    nome: "",
    email: "",
    telefone: "",
    cpf: "",
    organizacao: "",
    instagram: "",
    cidade: "",
    estado: "",
    termos: false,
  });

  function alterar(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value, checked, type } = e.target;

    setForm((old) => ({
      ...old,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function continuar(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);

    setTimeout(() => {
      router.push("/cadastro/organizador/financeiro");
    }, 800);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-violet-50 to-white">
      <div className="mx-auto max-w-md px-6 py-8">
              <Link href="/escolha">
          <ArrowLeft className="text-violet-700" />
        </Link>

        <h1 className="mt-4 text-center text-6xl font-black">
          Sorte<span className="text-violet-600">X</span>
        </h1>

        <p className="mt-3 text-center font-semibold text-green-600">
          Conta Organizador
        </p>

        <div className="mt-8 flex items-center">

          <div className="flex flex-col items-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-600 text-white font-bold">
              1
            </div>
            <span className="mt-2 text-xs font-semibold text-violet-700">
              Dados
            </span>
          </div>

          <div className="mx-2 h-1 flex-1 bg-zinc-200"></div>

          <div className="flex flex-col items-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-200 font-bold">
              2
            </div>
            <span className="mt-2 text-xs text-zinc-500">
              Financeiro
            </span>
          </div>

          <div className="mx-2 h-1 flex-1 bg-zinc-200"></div>

          <div className="flex flex-col items-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-200 font-bold">
              3
            </div>
            <span className="mt-2 text-xs text-zinc-500">
              Sucesso
            </span>
          </div>

        </div>

        <h2 className="mt-10 text-4xl font-bold">
          Vamos conhecer sua organização!
        </h2>

        <p className="mt-2 text-zinc-500">
          Preencha os dados abaixo para começar a vender suas rifas.
        </p>

        <form
          onSubmit={continuar}
          className="mt-8 rounded-[32px] bg-white border border-zinc-100 shadow-lg p-6 space-y-5"
        >

          <div className="flex justify-center">

            <button
              type="button"
              className="flex h-32 w-32 items-center justify-center rounded-full border-2 border-dashed border-violet-300 bg-violet-50"
            >
              <Camera size={42} className="text-violet-600" />
            </button>

          </div>

          <p className="text-center font-semibold">
            Adicionar logo da organização
          </p>
                    <Campo
            icon={<User size={20} />}
            name="nome"
            placeholder="Nome completo"
            value={form.nome}
            onChange={alterar}
          />

          <Campo
            icon={<Mail size={20} />}
            name="email"
            placeholder="Seu melhor e-mail"
            value={form.email}
            onChange={alterar}
          />

          <Campo
            icon={<Phone size={20} />}
            name="telefone"
            placeholder="WhatsApp"
            value={form.telefone}
            onChange={alterar}
          />

          <Campo
            icon={<CreditCard size={20} />}
            name="cpf"
            placeholder="CPF"
            value={form.cpf}
            onChange={alterar}
          />

          <Campo
            icon={<Building2 size={20} />}
            name="organizacao"
            placeholder="Nome da organização"
            value={form.organizacao}
            onChange={alterar}
          />

          <Campo
            icon={<Building2 size={20} />}
            name="instagram"
            placeholder="Instagram (opcional)"
            value={form.instagram}
            onChange={alterar}
          />

          <Campo
            icon={<MapPin size={20} />}
            name="cidade"
            placeholder="Cidade"
            value={form.cidade}
            onChange={alterar}
          />

          <Campo
            icon={<MapPin size={20} />}
            name="estado"
            placeholder="Estado"
            value={form.estado}
            onChange={alterar}
          />

          <div className="rounded-2xl border-2 border-dashed border-violet-300 bg-violet-50 p-6 text-center">
            <Upload className="mx-auto mb-3 text-violet-600" size={36} />
            <p className="font-semibold">
              Enviar documento (RG ou CNH)
            </p>
          </div>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="termos"
              checked={form.termos}
              onChange={alterar}
            />
            <span>
              Li e aceito os{" "}
              <span className="font-semibold text-violet-600">
                Termos de Uso
              </span>{" "}
              e a{" "}
              <span className="font-semibold text-violet-600">
                Política de Privacidade
              </span>.
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-gradient-to-r from-violet-700 to-purple-600 py-5 text-lg font-bold text-white"
          >
            {loading ? "Continuando..." : "Continuar →"}
          </button>

        </form>

      </div>
    </main>
  );
}

type CampoProps = {
  icon: React.ReactNode;
  name: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

function Campo({
  icon,
  name,
  placeholder,
  value,
  onChange,
}: CampoProps) {
  return (
    <div className="flex items-center rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
      <div className="text-zinc-400">{icon}</div>

      <input
        className="ml-4 w-full bg-transparent outline-none"
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    </div>
  );
}