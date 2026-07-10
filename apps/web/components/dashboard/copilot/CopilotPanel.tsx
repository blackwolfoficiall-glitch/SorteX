"use client";

import MissionCard from "./MissionCard";
import SalesInsights from "./SalesInsights";
import OpportunityCard from "./OpportunityCard";

export default function CopilotPanel() {
  return (
    <aside className="w-[390px] h-[calc(100vh-40px)] sticky top-5 rounded-3xl border bg-white p-6 shadow-xl overflow-y-auto">

      <div className="flex items-center gap-4">

        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-violet-700 to-fuchsia-600 text-3xl text-white">
          🤖
        </div>

        <div>

          <h2 className="text-2xl font-black">
            IA SorteX
          </h2>

          <p className="text-green-600 font-semibold">
            Online • Monitorando suas campanhas
          </p>

        </div>

      </div>

      <div className="mt-8 rounded-3xl bg-gradient-to-r from-violet-600 to-purple-600 p-6 text-white">

        <h3 className="text-xl font-bold">
          Bom dia Felipe 👋
        </h3>

        <p className="mt-3 text-white/80">
          Analisei suas campanhas e encontrei oportunidades para aumentar suas vendas hoje.
        </p>

      </div>

      <div className="mt-8 rounded-3xl border bg-zinc-50 p-5">

        <h3 className="font-bold">
          🎯 Meta de Hoje
        </h3>

        <div className="mt-5 h-3 rounded-full bg-zinc-200">

          <div className="h-3 w-[68%] rounded-full bg-violet-700"/>

        </div>

        <div className="mt-4 flex justify-between text-sm">

          <span>
            684 / 1.000 cotas
          </span>

          <strong>
            68%
          </strong>

        </div>

      </div>

      <div className="mt-8">

        <h2 className="text-xl font-black">
          🎯 Missões
        </h2>

        <div className="mt-4 space-y-4">

          <MissionCard
            titulo="Recuperar Clientes"
            descricao="18 clientes estão há mais de 30 dias sem comprar."
            potencial="R$ 2.850"
          />

          <MissionCard
            titulo="Criar Promoção"
            descricao="A IA prevê aumento de 14% nas vendas."
            potencial="+14%"
          />

          <MissionCard
            titulo="SorteX Ads"
            descricao="Investir R$30 pode gerar aproximadamente 320 novas cotas."
            potencial="ROI 6.8x"
          />

        </div>

      </div>

      <SalesInsights />

      <div className="mt-8">

        <h2 className="text-xl font-black">
          💰 Oportunidades
        </h2>

        <div className="mt-4 space-y-4">

          <OpportunityCard
            titulo="Clientes em risco"
            valor="18"
            descricao="Possuem alta chance de voltar hoje."
            cor="bg-red-100 text-red-700"
          />

          <OpportunityCard
            titulo="WhatsApp"
            valor="+R$2.840"
            descricao="Envie mensagens para clientes VIP."
            cor="bg-green-100 text-green-700"
          />

          <OpportunityCard
            titulo="Instagram"
            valor="20:10"
            descricao="Melhor horário para postar hoje."
            cor="bg-violet-100 text-violet-700"
          />

        </div>

      </div>

      <div className="mt-8">

        <h2 className="text-xl font-black mb-4">
          💬 Pergunte para IA
        </h2>

        <textarea
          placeholder="Ex: Como vender todas as cotas até sexta?"
          className="w-full rounded-2xl border p-4 outline-none focus:border-violet-600"
          rows={4}
        />

        <button className="mt-4 w-full rounded-2xl bg-violet-700 py-4 text-white font-bold hover:bg-violet-800">
          Conversar com a IA
        </button>

      </div>

    </aside>
  );
}