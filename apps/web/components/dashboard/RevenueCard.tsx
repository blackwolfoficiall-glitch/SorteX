"use client";

import { ArrowUpRight, Target } from "lucide-react";

export default function RevenueCard() {
  return (
    <div className="rounded-3xl bg-gradient-to-r from-violet-700 via-purple-600 to-fuchsia-600 p-8 text-white shadow-xl">

      <div className="flex items-start justify-between">

        <div>

          <p className="text-lg opacity-90">
            Receita Total
          </p>

          <h2 className="mt-3 text-5xl font-black">
            R$ 0,00
          </h2>

          <div className="mt-4 flex items-center gap-2 text-green-300">

            <ArrowUpRight size={18} />

            <span className="font-semibold">
              +0% este mês
            </span>

          </div>

        </div>

        <div className="rounded-2xl bg-white/10 p-4">
          <Target size={42} />
        </div>

      </div>

      <div className="mt-8">

        <div className="mb-2 flex justify-between text-sm">

          <span>Meta do mês</span>

          <span>0%</span>

        </div>

        <div className="h-3 rounded-full bg-white/20">

          <div className="h-3 w-0 rounded-full bg-white"></div>

        </div>

      </div>

    </div>
  );
}