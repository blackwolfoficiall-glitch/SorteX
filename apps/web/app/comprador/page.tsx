"use client";

import Header from "@/components/comprador/Header";
import {
  Ticket,
  Flame,
  Trophy,
  ArrowRight,
} from "lucide-react";

export default function CompradorHome() {
  return (
    <main className="mx-auto max-w-md space-y-6 p-5">

      <Header />

      {/* Minhas cotas */}

      <section className="rounded-3xl bg-gradient-to-r from-violet-700 to-purple-600 p-6 text-white shadow-xl">

        <div className="flex items-center gap-3">
          <Ticket size={28} />
          <h2 className="text-2xl font-bold">
            Minhas cotas
          </h2>
        </div>

        <div className="mt-6 rounded-2xl bg-white/10 p-4">

          <h3 className="font-bold">
            Você ainda não comprou nenhuma cota.
          </h3>

          <p className="mt-2 text-sm text-violet-100">
            Assim que participar de uma campanha ela aparecerá aqui.
          </p>

        </div>

      </section>

      {/* Promoções */}

      <section className="rounded-3xl bg-white p-5 shadow">

        <div className="flex items-center gap-3">
          <Flame className="text-orange-500" />
          <h2 className="text-xl font-bold">
            Promoções
          </h2>
        </div>

        <div className="mt-5 rounded-2xl border p-4">

          <h3 className="font-bold">
            🔥 Compre 10 cotas e ganhe 2
          </h3>

          <p className="mt-2 text-sm text-zinc-500">
            Promoção válida nas campanhas participantes.
          </p>

        </div>

      </section>

      {/* Campanhas */}

      <section className="rounded-3xl bg-white p-5 shadow">

        <div className="flex items-center justify-between">

          <div className="flex items-center gap-3">

            <Trophy className="text-violet-600" />

            <h2 className="text-xl font-bold">
              Recomendadas
            </h2>

          </div>

          <ArrowRight />

        </div>

        <div className="mt-5 rounded-2xl border p-4">

          <h3 className="font-bold">
            📱 iPhone 16 Pro Max
          </h3>

          <p className="mt-2 text-sm text-zinc-500">
            Restam poucas cotas.
          </p>

        </div>

        <div className="mt-4 rounded-2xl border p-4">

          <h3 className="font-bold">
            🏍 Honda CG 160
          </h3>

          <p className="mt-2 text-sm text-zinc-500">
            Sorteio neste domingo.
          </p>

        </div>

      </section>

    </main>
  );
}