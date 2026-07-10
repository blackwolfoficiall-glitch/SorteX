"use client";

import {
  Brain,
  Lightbulb,
  Clock,
  Calendar,
  TrendingUp,
  Target,
} from "lucide-react";

export default function AIInsights() {
  return (
    <div className="rounded-3xl bg-gradient-to-br from-violet-700 to-fuchsia-600 p-8 text-white shadow-xl">

      <div className="flex items-center gap-3">

        <Brain size={34} />

        <div>

          <h2 className="text-3xl font-bold">
            SorteX Intelligence
          </h2>

          <p className="opacity-80">
            Inteligência Artificial da Plataforma
          </p>

        </div>

      </div>

      <div className="mt-8 space-y-4">

        <Insight
          icon={<Calendar size={20} />}
          titulo="Melhor dia para lançar campanha"
          texto="Sexta-feira"
        />

        <Insight
          icon={<Clock size={20} />}
          titulo="Melhor horário"
          texto="19:00 às 22:00"
        />

        <Insight
          icon={<TrendingUp size={20} />}
          titulo="Previsão de vendas"
          texto="Sua próxima campanha pode vender 92% das cotas em até 5 dias."
        />

        <Insight
          icon={<Target size={20} />}
          titulo="Ação recomendada"
          texto="Hoje é um excelente dia para publicar uma campanha."
        />

        <Insight
          icon={<Lightbulb size={20} />}
          titulo="Sugestão da IA"
          texto="Envie uma mensagem para clientes que estão há mais de 15 dias sem comprar."
        />

      </div>

    </div>
  );
}

function Insight({
  icon,
  titulo,
  texto,
}: {
  icon: React.ReactNode;
  titulo: string;
  texto: string;
}) {
  return (
    <div className="rounded-2xl bg-white/10 p-4">

      <div className="flex items-center gap-3">

        {icon}

        <div>

          <h3 className="font-bold">
            {titulo}
          </h3>

          <p className="text-sm opacity-90">
            {texto}
          </p>

        </div>

      </div>

    </div>
  );
}