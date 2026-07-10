"use client";

import { Brain, Sparkles } from "lucide-react";

export default function SorteXCopilot() {
  return (
    <div className="rounded-3xl bg-gradient-to-br from-violet-700 to-fuchsia-600 p-8 text-white shadow-xl">

      <div className="flex items-center gap-4">

        <Brain size={40} />

        <div>

          <h2 className="text-3xl font-black">
            SorteX Copilot
          </h2>

          <p className="opacity-80">
            Seu consultor inteligente
          </p>

        </div>

      </div>

      <div className="mt-8 rounded-2xl bg-white/10 p-5">

        <div className="flex items-center gap-3">

          <Sparkles />

          <h3 className="font-bold">
            Resumo de Hoje
          </h3>

        </div>

        <ul className="mt-5 space-y-3 text-sm">

          <li>✅ Hoje é seu melhor dia de vendas.</li>

          <li>📈 A previsão é vender 82% das cotas.</li>

          <li>👥 Existem 27 clientes há mais de 15 dias sem comprar.</li>

          <li>💰 Pix representa 81% das vendas.</li>

          <li>🕖 O melhor horário para divulgar será às 19h.</li>

        </ul>

      </div>

    </div>
  );
}