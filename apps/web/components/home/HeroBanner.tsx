"use client";

import { Gift, Clock, ShieldCheck, Search } from "lucide-react";

export default function HeroBanner() {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-700 via-purple-700 to-indigo-900 p-10 text-white">

      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,white,transparent_60%)]" />

      <div className="relative z-10 grid lg:grid-cols-2 gap-10 items-center">

        <div>

          <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm">
            🔥 Campanha em destaque
          </span>

          <h1 className="mt-6 text-6xl font-black leading-tight">
            Ganhe um
            <br />
            iPhone 15 Pro Max
          </h1>

          <p className="mt-6 text-lg text-violet-100 max-w-lg">
            Participe da campanha oficial da SorteX com pagamento via PIX,
            resultado transparente e compra em poucos segundos.
          </p>

          <div className="mt-8 flex gap-4">

            <button className="rounded-2xl bg-white px-8 py-4 font-bold text-violet-700 hover:scale-105 transition">
              Comprar números
            </button>

            <button className="rounded-2xl border border-white/30 px-8 py-4 hover:bg-white/10">
              Ver detalhes
            </button>

          </div>

          <div className="mt-10 flex flex-wrap gap-8">

            <div className="flex items-center gap-2">
              <Clock size={20} />
              <span>30/07 às 20:00</span>
            </div>

            <div className="flex items-center gap-2">
              <Gift size={20} />
              <span>12 prêmios</span>
            </div>

            <div className="flex items-center gap-2">
              <ShieldCheck size={20} />
              <span>Organizador Verificado</span>
            </div>

          </div>

          <div className="mt-10 flex items-center rounded-2xl bg-white px-5 py-4 text-black max-w-lg">

            <Search size={20} />

            <input
              placeholder="Buscar campanhas..."
              className="ml-3 w-full bg-transparent outline-none"
            />

          </div>

        </div>

        <div className="flex justify-center">

          <div className="rounded-[32px] bg-white/10 backdrop-blur-xl border border-white/20 p-8 w-full max-w-md">

            <img
              src="https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=900"
              alt="Prêmio"
              className="rounded-3xl"
            />

            <div className="mt-6">

              <div className="flex justify-between">

                <span>Campanha vendida</span>

                <strong>78%</strong>

              </div>

              <div className="mt-3 h-3 rounded-full bg-white/20">

                <div className="h-3 w-[78%] rounded-full bg-white" />

              </div>

            </div>

            <div className="grid grid-cols-3 gap-4 mt-8 text-center">

              <div>
                <h3 className="text-2xl font-black">
                  2.481
                </h3>

                <p className="text-sm text-violet-100">
                  Participantes
                </p>
              </div>

              <div>
                <h3 className="text-2xl font-black">
                  8.500
                </h3>

                <p className="text-sm text-violet-100">
                  Números
                </p>
              </div>

              <div>
                <h3 className="text-2xl font-black">
                  R$ 96 mil
                </h3>

                <p className="text-sm text-violet-100">
                  Arrecadado
                </p>
              </div>

            </div>

          </div>

                </div>

      </div>

    </section>
  );
}
