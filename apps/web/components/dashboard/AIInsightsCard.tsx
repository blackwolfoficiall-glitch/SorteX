import { Sparkles, TrendingUp, ArrowRight } from "lucide-react";

export default function AIInsightsCard() {
  return (
    <div className="rounded-3xl bg-gradient-to-r from-violet-700 to-purple-500 p-6 text-white shadow-xl">

      <div className="flex items-center gap-3">

        <div className="rounded-2xl bg-white/20 p-3">
          <Sparkles size={28} />
        </div>

        <div>
          <h2 className="text-2xl font-bold">
            IA SorteX
          </h2>

          <p className="text-sm text-violet-100">
            Seu assistente comercial inteligente
          </p>
        </div>

      </div>

      <div className="mt-6 rounded-2xl bg-white/10 p-4">

        <p className="text-lg font-semibold">
          Hoje encontrei
          <span className="ml-2 text-yellow-300">
            5 oportunidades
          </span>
          para aumentar suas vendas.
        </p>

      </div>

      <div className="mt-5 space-y-3">

        <div className="flex items-center justify-between rounded-xl bg-white/10 p-3">
          <span>Recuperar 18 clientes inativos</span>
          <TrendingUp size={18} />
        </div>

        <div className="flex items-center justify-between rounded-xl bg-white/10 p-3">
          <span>Impulsionar campanha Hilux</span>
          <TrendingUp size={18} />
        </div>

        <div className="flex items-center justify-between rounded-xl bg-white/10 p-3">
          <span>Ativar afiliados inativos</span>
          <TrendingUp size={18} />
        </div>

      </div>

      <div className="mt-6 rounded-2xl bg-white p-4 text-zinc-900">

        <p className="text-sm text-zinc-500">
          Impacto estimado
        </p>

        <h1 className="mt-1 text-4xl font-black text-green-600">
          +R$ 13.100
        </h1>

      </div>

      <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 font-bold text-violet-700 transition hover:bg-zinc-100">

        Ver plano de ação

        <ArrowRight size={18} />

      </button>

    </div>
  );
}