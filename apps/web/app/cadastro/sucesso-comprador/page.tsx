"use client";

import Link from "next/link";
import { CheckCircle2, Gift } from "lucide-react";

export default function SucessoComprador() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-violet-50 to-white px-6">

      <div className="w-full max-w-md rounded-[36px] bg-white p-8 shadow-xl">

        <div className="flex justify-center">
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2
              size={70}
              className="text-green-600"
            />
          </div>
        </div>

        <div className="mt-8 text-center">

          <h1 className="text-5xl font-black">
            Sorte
            <span className="text-violet-600">X</span>
          </h1>

          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-2 text-sm font-bold text-green-700">
            Cadastro realizado
          </div>

          <h2 className="mt-8 text-4xl font-black">
            Bem-vindo! 🎉
          </h2>

          <p className="mt-6 leading-7 text-zinc-500">
            Sua conta foi criada com sucesso.

            <br /><br />

            Agora você já pode participar dos sorteios,
            comprar cotas e acompanhar seus números.
          </p>

        </div>

        <Link
          href="/login"
          className="mt-10 flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-violet-700 to-purple-600 py-5 text-lg font-bold text-white"
        >
          <Gift size={20} />
          Entrar na minha conta
        </Link>

        <Link
          href="/"
          className="mt-4 flex w-full items-center justify-center rounded-2xl border border-violet-300 py-4 font-semibold text-violet-700"
        >
          Voltar ao início
        </Link>

      </div>

    </main>
  );
}
