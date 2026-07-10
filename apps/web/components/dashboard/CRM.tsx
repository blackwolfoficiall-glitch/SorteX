"use client";

import {
  Crown,
  Clock,
  Calendar,
  TrendingUp,
  Users,
  MessageCircle,
} from "lucide-react";

export default function CRM() {
  return (
    <div className="rounded-3xl bg-white p-8 shadow-xl">

      <div className="flex items-center justify-between">

        <div>

          <h2 className="text-3xl font-bold">
            🧠 CRM Inteligente
          </h2>

          <p className="mt-2 text-zinc-500">
            A IA analisa seus clientes automaticamente.
          </p>

        </div>

        <Users className="text-violet-600" size={38} />

      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">

        <div className="rounded-2xl bg-violet-50 p-5">
          <div className="flex items-center gap-3">
            <Calendar className="text-violet-600" />
            <h3 className="font-bold">Melhor dia para vender</h3>
          </div>

          <p className="mt-3 text-zinc-600">
            Sexta-feira gera aproximadamente
            <span className="font-bold text-violet-700">
              {" "}34% mais vendas.
            </span>
          </p>
        </div>

        <div className="rounded-2xl bg-green-50 p-5">
          <div className="flex items-center gap-3">
            <Clock className="text-green-600" />
            <h3 className="font-bold">Melhor horário</h3>
          </div>

          <p className="mt-3 text-zinc-600">
            Entre
            <span className="font-bold text-green-700">
              {" "}19h e 22h
            </span>
            {" "}seus clientes compram mais.
          </p>
        </div>

        <div className="rounded-2xl bg-orange-50 p-5">
          <div className="flex items-center gap-3">
            <TrendingUp className="text-orange-600" />
            <h3 className="font-bold">
              Clientes sem comprar
            </h3>
          </div>

          <p className="mt-3 text-zinc-600">
            27 clientes estão há mais de
            <span className="font-bold text-orange-600">
              {" "}15 dias
            </span>
            sem comprar cotas.
          </p>
        </div>

        <div className="rounded-2xl bg-blue-50 p-5">
          <div className="flex items-center gap-3">
            <Crown className="text-blue-600" />
            <h3 className="font-bold">
              Cliente VIP
            </h3>
          </div>

          <p className="mt-3 text-zinc-600">
            Felipe Rocha representa
            <span className="font-bold text-blue-700">
              {" "}58% do faturamento.
            </span>
          </p>
        </div>

      </div>

      <button className="mt-8 flex items-center gap-3 rounded-2xl bg-violet-600 px-6 py-4 font-bold text-white hover:bg-violet-700 transition">

        <MessageCircle size={20} />

        Enviar campanha para clientes inativos

      </button>

    </div>
  );
}