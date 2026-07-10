"use client";

import { useRouter } from "next/navigation";

export default function ConfirmacaoPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl text-center">

        <div className="text-6xl mb-6">🎉</div>

        <h1 className="text-3xl font-bold">
          Cadastro concluído!
        </h1>

        <p className="mt-4 text-zinc-600">
          Sua conta de organizador foi criada com sucesso.
        </p>

        <button
          onClick={() => router.push("/dashboard")}
          className="mt-8 w-full rounded-2xl bg-violet-700 py-4 text-white font-bold"
        >
          Ir para o Dashboard
        </button>

      </div>
    </main>
  );
}