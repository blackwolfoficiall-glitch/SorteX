"use client";

interface FinancialSummaryProps {
  metodo: string;
  gateway: string;
  conectado: boolean;
}

export default function FinancialSummary({
  metodo,
  gateway,
  conectado,
}: FinancialSummaryProps) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow">

      <h2 className="text-xl font-bold">
        Resumo da configuração
      </h2>

      <div className="mt-6 space-y-5">

        <div className="flex items-center justify-between border-b pb-4">

          <span className="text-zinc-500">
            Método de recebimento
          </span>

          <span className="font-bold">
            {metodo}
          </span>

        </div>

        <div className="flex items-center justify-between border-b pb-4">

          <span className="text-zinc-500">
            Gateway
          </span>

          <span className="font-bold">
            {gateway || "-"}
          </span>

        </div>

        <div className="flex items-center justify-between border-b pb-4">

          <span className="text-zinc-500">
            Status
          </span>

          {conectado ? (
            <span className="font-bold text-green-600">
              ● Conectado
            </span>
          ) : (
            <span className="font-bold text-red-500">
              ● Não conectado
            </span>
          )}

        </div>

        <div className="flex items-center justify-between border-b pb-4">

          <span className="text-zinc-500">
            Plano
          </span>

          <span className="font-bold">
            Gratuito
          </span>

        </div>

        <div className="flex items-center justify-between">

          <span className="text-zinc-500">
            Taxa SorteX
          </span>

          <span className="font-bold">
            2%
          </span>

        </div>

      </div>

    </section>
  );
}