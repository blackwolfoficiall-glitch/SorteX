// Scoped source-level evidence only. A passed local browser check never grants
// an entire functional journey, a hosted release, or physical iPhone approval.
export const pageEvidence = [
  {
    path: "/dashboard",
    detail: "Dashboard e navegação, vendas por período, estado vazio e recuperação, temas e foco a 320 px",
    source: "apps/web/e2e-local/run-organizer-dashboard-premium.mjs",
    revision: "db136a8",
  },
  {
    path: "/dashboard/campanhas",
    detail: "lista, filtros, capas reais no banco de teste, isolamento e recuperação; sem executar mutações",
    source: "apps/web/e2e/campaign-list-premium.spec.ts",
    revision: "f14ad80",
  },
  {
    path: "/dashboard/pedidos",
    detail: "lista, busca, filtros, CSV e diálogo de detalhes; não cobre a página de detalhes separada nem os demais formatos",
    source: "apps/web/e2e-local/run-organizer-orders-premium.mjs",
    revision: "db9d50c",
  },
  {
    path: "/dashboard/financeiro",
    detail: "consulta de saldos, taxas, extrato, filtros, XLS e impressão; sem movimentação ou conciliação externa",
    source: "apps/web/e2e/organizer-finance-premium.spec.ts",
    revision: "4e13760",
  },
];
