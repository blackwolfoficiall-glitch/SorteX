import Link from "next/link";
import ProgressSteps from "@/components/organizador/ProgressSteps";
import GatewayCard from "@/components/organizador/GatewayCard";
import FinancialSummary from "@/components/organizador/FinancialSummary";

const unavailableGateways = [
  { nome: "Stone", descricao: "Sem integração de cobrança nesta versão." },
  { nome: "PagBank", descricao: "Sem integração de cobrança nesta versão." },
  { nome: "Pagar.me", descricao: "Sem integração de cobrança nesta versão." },
  { nome: "Asaas", descricao: "Sem integração de cobrança nesta versão." },
];

export default function FinanceiroPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <ProgressSteps etapa={2} />

      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold">Configuração Financeira</h1>
        <p className="mt-2 text-zinc-500">
          Esta versão não conecta sua conta de recebimento. Você pode continuar
          para o painel sem configurar um gateway.
        </p>
      </div>

      <GatewayCard
        nome="Mercado Pago"
        descricao="Adaptador de teste para Pix e cartão. Cobranças reais desabilitadas."
        detailsHref="/organizador/gateways/mercado-pago"
      />

      {unavailableGateways.map((gateway) => (
        <GatewayCard key={gateway.nome} {...gateway} />
      ))}

      <FinancialSummary />

      <Link
        href="/dashboard"
        className="block rounded-3xl bg-violet-700 py-5 text-center text-lg font-bold text-white transition hover:bg-violet-800"
      >
        Ir para o painel
      </Link>
    </main>
  );
}
