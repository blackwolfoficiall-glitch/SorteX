"use client";

import {
  Users,
  UserCheck,
  UserX,
  Crown,
  ArrowUpRight,
} from "lucide-react";

export default function CRMInsights() {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">

      <div className="flex items-center justify-between">

        <div>

          <h2 className="text-2xl font-black">
            CRM Inteligente
          </h2>

          <p className="text-zinc-500">
            A IA está monitorando seus compradores em tempo real.
          </p>

        </div>

        <button className="rounded-xl bg-violet-700 px-5 py-3 text-white font-bold hover:bg-violet-800">
          Ver CRM
        </button>

      </div>

      <div className="mt-8 grid grid-cols-2 gap-5">

        <Card
          icon={<Users className="text-blue-600" />}
          titulo="Clientes Ativos"
          valor="2.842"
          descricao="Compraram nos últimos 30 dias"
        />

        <Card
          icon={<UserCheck className="text-green-600" />}
          titulo="Clientes VIP"
          valor="186"
          descricao="Alta frequência de compra"
        />

        <Card
          icon={<UserX className="text-red-500" />}
          titulo="Clientes em Risco"
          valor="42"
          descricao="Sem compras há mais de 30 dias"
        />

        <Card
          icon={<Crown className="text-yellow-500" />}
          titulo="Receita Recuperável"
          valor="R$ 8.420"
          descricao="Potencial estimado pela IA"
        />

      </div>

      <div className="mt-8 rounded-2xl border border-orange-200 bg-orange-50 p-5">

        <div className="flex items-start justify-between">

          <div>

            <h3 className="text-lg font-bold">
              🎯 Oportunidade da IA
            </h3>

            <p className="mt-2 text-zinc-600">
              Existem 42 clientes que costumavam comprar toda semana e não compram há mais de 30 dias.
            </p>

          </div>

          <ArrowUpRight className="text-orange-600" />

        </div>

        <button className="mt-5 rounded-xl bg-orange-500 px-5 py-3 font-bold text-white hover:bg-orange-600">
          Recuperar Clientes
        </button>

      </div>

    </div>
  );
}

interface CardProps {
  icon: React.ReactNode;
  titulo: string;
  valor: string;
  descricao: string;
}

function Card({
  icon,
  titulo,
  valor,
  descricao,
}: CardProps) {
  return (
    <div className="rounded-2xl border p-5">

      <div className="flex items-center justify-between">

        <div>

          <p className="text-sm text-zinc-500">
            {titulo}
          </p>

          <h3 className="mt-2 text-3xl font-black">
            {valor}
          </h3>

          <p className="mt-2 text-sm text-zinc-500">
            {descricao}
          </p>

        </div>

        <div className="rounded-xl bg-zinc-100 p-4">
          {icon}
        </div>

      </div>

    </div>
  );
}