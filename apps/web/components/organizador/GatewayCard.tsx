"use client";

import { CheckCircle2, ChevronRight } from "lucide-react";

interface GatewayCardProps {
  logo: string;
  nome: string;
  descricao: string;
  pix: string;
  credito: string;
  debito: string;
  conectado: boolean;
  recomendado?: boolean;
  onConfigurar: () => void;
}

export default function GatewayCard({
  nome,
  descricao,
  pix,
  credito,
  debito,
  conectado,
  recomendado = false,
  onConfigurar,
}: GatewayCardProps) {
  return (
    <div
      className={`rounded-3xl border-2 bg-white p-6 transition ${
        conectado
          ? "border-green-500"
          : "border-zinc-200 hover:border-violet-600"
      }`}
    >
      <div className="flex items-start justify-between">

        <div className="flex items-center gap-4">

          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-100 font-bold text-zinc-700">
            {nome.substring(0, 2).toUpperCase()}
          </div>

          <div>

            <div className="flex items-center gap-2">

              <h2 className="text-xl font-bold">
                {nome}
              </h2>

              {recomendado && (
                <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700">
                  Recomendado
                </span>
              )}

            </div>

            <p className="mt-1 text-sm text-zinc-500">
              {descricao}
            </p>

          </div>

        </div>

        {conectado && (
          <CheckCircle2
            size={28}
            className="text-green-600"
          />
        )}

      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">

        <div className="rounded-2xl bg-zinc-100 p-3 text-center">
          <p className="text-xs text-zinc-500">PIX</p>
          <h3 className="mt-1 font-bold">{pix}</h3>
        </div>

        <div className="rounded-2xl bg-zinc-100 p-3 text-center">
          <p className="text-xs text-zinc-500">Crédito</p>
          <h3 className="mt-1 font-bold">{credito}</h3>
        </div>

        <div className="rounded-2xl bg-zinc-100 p-3 text-center">
          <p className="text-xs text-zinc-500">Débito</p>
          <h3 className="mt-1 font-bold">{debito}</h3>
        </div>

      </div>

      <button
        type="button"
        onClick={onConfigurar}
        className={`mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-bold transition ${
          conectado
            ? "bg-green-600 text-white"
            : "bg-violet-700 text-white hover:bg-violet-800"
        }`}
      >
        {conectado ? "Gerenciar conexão" : "Configurar"}

        <ChevronRight size={20} />
      </button>

    </div>
  );
}