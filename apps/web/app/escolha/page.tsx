"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Ticket,
  Store,
  ShieldCheck,
  Gift,
  CheckCircle,
} from "lucide-react";

export default function EscolhaPage() {
  const [tipo, setTipo] = useState<"comprador" | "organizador" | null>(null);

  const router = useRouter();

function continuar() {
  if (!tipo) return;

  if (tipo === "comprador") {
    router.push("/cadastro/comprador");
    return;
  }

  if (tipo === "organizador") {
    router.push("/cadastro/organizador");
    return;
  }
}
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-zinc-100 flex items-center justify-center py-10">
      <div className="w-full max-w-md px-6">

        {/* Logo */}

        <div className="text-center">

          <h1 className="text-6xl font-black">
            Sorte
            <span className="text-violet-600">X</span>
          </h1>

          <h2 className="mt-10 text-4xl font-bold leading-tight">
            Participe dos melhores sorteios
          </h2>

          <p className="mt-4 text-zinc-500 text-lg">
            ou{" "}
            <span className="text-violet-600 font-bold">
              organize o seu
            </span>{" "}
            e alcance milhares de pessoas.
          </p>

        </div>

        <h3 className="mt-12 text-center text-3xl font-bold">
          Como você deseja continuar?
        </h3>

        <p className="text-center text-zinc-500 mt-2">
          Escolha uma opção abaixo.
        </p>

        {/* Cards */}

        <div className="grid grid-cols-2 gap-5 mt-8">

          <button
            onClick={() => setTipo("comprador")}
            className={`rounded-3xl border-2 p-6 transition-all duration-300 ${
              tipo === "comprador"
                ? "border-violet-600 shadow-2xl scale-105 bg-violet-50"
                : "border-zinc-200 hover:border-violet-500 bg-white"
            }`}
          >
            <Ticket
              size={60}
              className="mx-auto text-violet-600"
            />

            <h2 className="mt-5 text-2xl font-bold text-violet-700">
              Comprador
            </h2>

            <p className="mt-3 text-sm text-zinc-500">
              Participar de sorteios e ganhar prêmios.
            </p>

            <div className="mt-6 flex justify-center">
              {tipo === "comprador" ? (
                <CheckCircle
                  size={32}
                  className="text-violet-600"
                />
              ) : (
                <div className="h-8 w-8 rounded-full border-2 border-zinc-300" />
              )}
            </div>

          </button>

          <button
            onClick={() => setTipo("organizador")}
            className={`rounded-3xl border-2 p-6 transition-all duration-300 ${
              tipo === "organizador"
                ? "border-green-500 shadow-2xl scale-105 bg-green-50"
                : "border-zinc-200 hover:border-green-500 bg-white"
            }`}
          >
            <Store
              size={60}
              className="mx-auto text-green-600"
            />

            <h2 className="mt-5 text-2xl font-bold text-green-600">
              Organizador
            </h2>

            <p className="mt-3 text-sm text-zinc-500">
              Criar campanhas e vender títulos.
            </p>

            <div className="mt-6 flex justify-center">
              {tipo === "organizador" ? (
                <CheckCircle
                  size={32}
                  className="text-green-600"
                />
              ) : (
                <div className="h-8 w-8 rounded-full border-2 border-zinc-300" />
              )}
            </div>

          </button>

        </div>

        {/* Benefícios */}

        <div className="mt-10 rounded-3xl border border-zinc-200 bg-white overflow-hidden shadow-sm">

          <div className="flex items-center gap-4 p-5 border-b">

            <ShieldCheck className="text-violet-600" />

            <div>
              <h3 className="font-bold">
                100% Seguro
              </h3>

              <p className="text-sm text-zinc-500">
                Seus dados e pagamentos protegidos.
              </p>
            </div>

          </div>

          <div className="flex items-center gap-4 p-5">

            <Gift className="text-violet-600" />

            <div>
              <h3 className="font-bold">
                Prêmios incríveis
              </h3>

              <p className="text-sm text-zinc-500">
                Milhares de campanhas disponíveis.
              </p>
            </div>

          </div>

        </div>

        {/* Botão */}

        <button
          onClick={continuar}
          disabled={!tipo}
          className={`mt-8 w-full rounded-2xl py-5 text-xl font-bold transition-all duration-300 ${
            tipo
              ? "bg-gradient-to-r from-violet-700 to-purple-600 text-white hover:scale-[1.02]"
              : "bg-zinc-300 text-zinc-500 cursor-not-allowed"
          }`}
        >
          Continuar →
        </button>

        <p className="mt-8 text-center text-zinc-500">
          Já possui uma conta?{" "}
          <Link
            href="/login"
            className="font-bold text-violet-600 hover:underline"
          >
            Entrar
          </Link>
        </p>

      </div>
    </main>
  );
}