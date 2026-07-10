"use client";

import Link from "next/link";
import { CheckCircle2, Sparkles, ArrowRight } from "lucide-react";

export default function CadastroSucesso() {
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

          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-700">

            <Sparkles size={16} />

            Cadastro concluído

          </div>

          <h2 className="mt-8 text-4xl font-black">
            Conta criada
            <br />
            com sucesso! 🎉
          </h2>

          <p className="mt-5 leading-7 text-zinc-500">

            Agora você já faz parte da SorteX.

            <br /><br />

            Sua conta está pronta para criar campanhas,
            vender cotas e acompanhar tudo em tempo real.

          </p>

        </div>

        <Link
          href="/dashboard"
          className="mt-10 flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-violet-700 to-purple-600 py-5 text-lg font-bold text-white"
        >

          Ir para o Dashboard

          <ArrowRight size={20} />

        </Link>

        <Link
          href="/criar"
          className="mt-4 flex w-full items-center justify-center rounded-2xl border border-violet-300 py-4 font-semibold text-violet-700"
        >
          Criar minha primeira campanha
        </Link>

        <div className="mt-8 rounded-2xl bg-zinc-50 p-5">

          <p className="text-sm text-zinc-500">

            🔒 Seus dados estão protegidos com criptografia
            e seguem os mais altos padrões de segurança.

          </p>

        </div>

      </div>

    </main>
  );
}