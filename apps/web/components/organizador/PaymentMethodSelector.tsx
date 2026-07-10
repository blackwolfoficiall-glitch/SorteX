"use client";

export type PaymentMethod = "pix" | "bank" | "both";

interface PaymentMethodSelectorProps {
  value: PaymentMethod;
  onChange: (value: PaymentMethod) => void;
}

export default function PaymentMethodSelector({
  value,
  onChange,
}: PaymentMethodSelectorProps) {
  const methods = [
    {
      id: "pix",
      titulo: "PIX",
      descricao: "Recebimento instantâneo",
    },
    {
      id: "bank",
      titulo: "Conta Bancária",
      descricao: "Transferência bancária",
    },
    {
      id: "both",
      titulo: "PIX + Conta",
      descricao: "As duas opções",
    },
  ] as const;

  return (
    <section className="rounded-3xl bg-white p-6 shadow">

      <h2 className="text-xl font-bold">
        Como deseja receber?
      </h2>

      <p className="mt-2 text-sm text-zinc-500">
        Escolha o método de recebimento principal.
      </p>

      <div className="mt-6 space-y-4">

        {methods.map((method) => (
          <button
            key={method.id}
            type="button"
            onClick={() => onChange(method.id)}
            className={`w-full rounded-2xl border-2 p-5 text-left transition-all ${
              value === method.id
                ? "border-violet-700 bg-violet-50"
                : "border-zinc-200 hover:border-violet-400"
            }`}
          >
            <div className="flex items-center justify-between">

              <div>

                <h3 className="text-lg font-bold">
                  {method.titulo}
                </h3>

                <p className="mt-1 text-sm text-zinc-500">
                  {method.descricao}
                </p>

              </div>

              <div
                className={`h-6 w-6 rounded-full border-2 ${
                  value === method.id
                    ? "border-violet-700 bg-violet-700"
                    : "border-zinc-300"
                }`}
              />

            </div>
          </button>
        ))}

      </div>

    </section>
  );
}