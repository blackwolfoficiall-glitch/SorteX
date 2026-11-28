export default function FinancialSummary() {
  return (
    <section className="rounded-3xl bg-white p-6 shadow">
      <h2 className="text-xl font-bold">Resumo da configuração</h2>
      <dl className="mt-6 space-y-5">
        <div className="flex items-center justify-between gap-4 border-b pb-4">
          <dt className="text-zinc-500">Recebimentos reais</dt>
          <dd className="text-right font-bold">Desabilitados</dd>
        </div>
        <div className="flex items-center justify-between gap-4 border-b pb-4">
          <dt className="text-zinc-500">Gateway com adaptador de teste</dt>
          <dd className="text-right font-bold">Mercado Pago</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-zinc-500">Validação com o provedor</dt>
          <dd className="text-right font-bold">Pendente</dd>
        </div>
      </dl>
    </section>
  );
}
