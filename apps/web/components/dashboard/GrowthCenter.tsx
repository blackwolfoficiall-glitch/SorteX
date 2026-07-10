"use client";

import {
  TrendingUp,
  MessageCircle,
  Megaphone,
  Gift,
  ArrowRight,
} from "lucide-react";

const oportunidades = [
  {
    titulo: "Recuperar Clientes",
    potencial: "R$ 2.840",
    descricao: "18 clientes possuem alta chance de comprar novamente.",
    cor: "bg-green-100 text-green-700",
    icone: MessageCircle,
  },
  {
    titulo: "Criar Promoção",
    potencial: "+14%",
    descricao: "Ative 'Compre 10 e Ganhe 2' para aumentar as vendas.",
    cor: "bg-violet-100 text-violet-700",
    icone: Gift,
  },
  {
    titulo: "Impulsionar Campanha",
    potencial: "ROI 6.8x",
    descricao: "A IA recomenda investir R$30 em SorteX Ads.",
    cor: "bg-orange-100 text-orange-700",
    icone: Megaphone,
  },
  {
    titulo: "Meta do Dia",
    potencial: "1.000 cotas",
    descricao: "Faltam apenas 316 cotas para atingir sua meta diária.",
    cor: "bg-blue-100 text-blue-700",
    icone: TrendingUp,
  },
];

export default function GrowthCenter() {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">

      <div className="flex items-center justify-between">

        <div>

          <h2 className="text-2xl font-black">
            🚀 Centro de Oportunidades
          </h2>

          <p className="text-zinc-500">
            A IA encontrou oportunidades para aumentar seu faturamento hoje.
          </p>

        </div>

      </div>

      <div className="mt-8 space-y-5">

        {oportunidades.map((item) => {

          const Icon = item.icone;

          return (

            <div
              key={item.titulo}
              className="rounded-2xl border p-5 hover:border-violet-600 transition"
            >

              <div className="flex items-center justify-between">

                <div className="flex items-center gap-4">

                  <div className="rounded-xl bg-zinc-100 p-3">
                    <Icon size={24} />
                  </div>

                  <div>

                    <h3 className="font-bold text-lg">
                      {item.titulo}
                    </h3>

                    <p className="text-sm text-zinc-500">
                      {item.descricao}
                    </p>

                  </div>

                </div>

                <span className={`rounded-full px-4 py-2 text-sm font-bold ${item.cor}`}>
                  {item.potencial}
                </span>

              </div>

              <button className="mt-5 flex items-center gap-2 rounded-xl bg-violet-700 px-5 py-3 font-bold text-white hover:bg-violet-800">

                Executar

                <ArrowRight size={18} />

              </button>

            </div>

          );

        })}

      </div>

    </div>
  );
}