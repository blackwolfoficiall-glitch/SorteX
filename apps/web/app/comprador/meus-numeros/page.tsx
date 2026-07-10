"use client";

export default function MeusNumerosPage() {
  return (
    <main className="mx-auto max-w-md p-5">
      <h1 className="text-3xl font-black">
        🎟️ Minhas Cotas
      </h1>

      <p className="mt-3 text-zinc-500">
        Aqui aparecerão todas as campanhas em que você comprou cotas.
      </p>

      <div className="mt-6 rounded-3xl border bg-white p-5 shadow">
        <h2 className="font-bold">
          Você ainda não possui cotas.
        </h2>

        <p className="mt-2 text-sm text-zinc-500">
          Quando comprar uma campanha ela aparecerá aqui.
        </p>
      </div>
    </main>
  );
}