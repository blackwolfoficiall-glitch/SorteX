import Link from "next/link";
import { ArrowLeft, CreditCard, QrCode, ShieldCheck } from "lucide-react";

export default function MercadoPagoPage() {
  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-md p-6">
        <Link
          href="/cadastro/organizador/financeiro"
          className="inline-flex items-center gap-2 text-violet-700"
        >
          <ArrowLeft aria-hidden="true" size={20} />
          Voltar
        </Link>

        <div className="mt-8 rounded-3xl bg-white p-8 shadow">
          <h1 className="text-center text-3xl font-black">Mercado Pago</h1>
          <p className="mt-3 text-center text-zinc-500">
            A SorteX possui um adaptador para testar Pix e cartão de crédito em
            sandbox. A validação com o provedor ainda está pendente.
          </p>

          <ul className="mt-8 space-y-4">
            <li className="flex items-center gap-3">
              <QrCode aria-hidden="true" className="text-violet-700" /> Pix de
              teste
            </li>
            <li className="flex items-center gap-3">
              <CreditCard aria-hidden="true" className="text-violet-700" />{" "}
              Cartão de teste
            </li>
            <li className="flex items-center gap-3">
              <ShieldCheck aria-hidden="true" className="text-violet-700" /> Sem
              recebimento, split ou saque real
            </li>
          </ul>

          <Link
            href="/dashboard/financeiro"
            className="mt-10 block w-full rounded-2xl bg-violet-700 py-5 text-center text-lg font-bold text-white transition hover:bg-violet-800"
          >
            Abrir painel financeiro
          </Link>
        </div>
      </div>
    </main>
  );
}
