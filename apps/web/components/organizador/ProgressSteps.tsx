"use client";

import { Check } from "lucide-react";

interface ProgressStepsProps {
  etapa: number;
  etapas?: string[];
}

export default function ProgressSteps({
  etapa,
  etapas = ["Dados", "Financeiro", "Confirmação"],
}: ProgressStepsProps) {

  const progresso = Math.min((etapa / etapas.length) * 100, 100);

  return (
    <div className="rounded-3xl border bg-white p-6 shadow-sm">

      <div className="flex items-start justify-between">

        <div>

          <p className="text-sm text-zinc-500">
            Cadastro do Organizador
          </p>

          <h1 className="mt-1 text-3xl font-black">
            Etapa {etapa} de {etapas.length}
          </h1>

        </div>

        <div className="rounded-full bg-violet-100 px-4 py-2">

          <span className="font-bold text-violet-700">
            {Math.round(progresso)}%
          </span>

        </div>

      </div>

      <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-zinc-200">

        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-700 to-fuchsia-600 transition-all duration-500"
          style={{
            width: `${progresso}%`,
          }}
        />

      </div>

      <div className="mt-8 flex items-start justify-between overflow-x-auto pb-2">
        {etapas.map((titulo, index) => (
          <div className="contents" key={titulo}>
            {index > 0 && <div className="mx-2 mt-6 h-1 min-w-4 flex-1 rounded bg-zinc-200" />}
            <Step
              numero={index + 1}
              titulo={titulo}
              ativo={etapa >= index + 1}
              concluido={etapa > index + 1}
            />
          </div>
        ))}
      </div>

    </div>
  );
}

interface StepProps {
  numero: number;
  titulo: string;
  ativo: boolean;
  concluido: boolean;
}

function Step({
  numero,
  titulo,
  ativo,
  concluido,
}: StepProps) {

  return (
    <div className="flex flex-col items-center">

      <div
        className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold transition-all ${
          ativo
            ? "bg-violet-700 text-white"
            : "bg-zinc-200 text-zinc-500"
        }`}
      >

        {concluido ? (
          <Check size={20} />
        ) : (
          numero
        )}

      </div>

      <span
        className={`mt-2 text-sm font-medium ${
          ativo
            ? "text-violet-700"
            : "text-zinc-500"
        }`}
      >
        {titulo}
      </span>

    </div>
  );
}
