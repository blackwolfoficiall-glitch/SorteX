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
    path: "/dashboard/pedidos/[id]",
    detail: "detalhe pago e pendente, histórico e contagem de títulos, erro e isolamento; sem confirmar recebimento ou transação",
    source: "apps/web/e2e-local/run-organizer-order-detail-premium.mjs",
    revision: "092c77a",
  },
  {
    path: "/dashboard/campanhas/nova",
    detail: "abertura e primeira etapa do editor, validação sem salvar, temas e foco a 320 px; etapas seguintes não testadas",
    source: "apps/web/e2e/campaign-wizard-premium.spec.ts",
    revision: "2b47158",
  },
  {
    path: "/dashboard/campanhas/[id]/editar",
    detail: "abertura de rascunho e campanha publicada próprios, acesso de outro organizador bloqueado; não testou salvar nem publicar",
    source: "apps/web/e2e/campaign-wizard-premium.spec.ts",
    revision: "2b47158",
  },
  {
    path: "/dashboard/financeiro",
    detail: "consulta de saldos, taxas, extrato, filtros, XLS e impressão; sem movimentação ou conciliação externa",
    source: "apps/web/e2e/organizer-finance-premium.spec.ts",
    revision: "4e13760",
  },
  {
    path: "/dashboard/ads",
    detail: "vendas internas, filtros, temas e origem; leitura Meta, Google e TikTok desativada, sem métricas não comprovadas",
    source: "apps/web/e2e-local/run-organizer-ads-premium.mjs",
    revision: "46dceef",
  },
  {
    path: "/dashboard/crm",
    detail: "visão geral, filtros e links, origem geográfica, teclado e separação por conta; não enviou comunicação",
    source: "apps/web/e2e/crm-overview-premium.spec.ts",
    revision: "37d36c5",
  },
  {
    path: "/dashboard/ia",
    detail: "chat local, presets, simulação, rascunhos e isolamento; provedores reais desligados",
    source: "apps/web/e2e-local/run-organizer-advisor-premium.mjs",
    revision: "fe7cc53",
  },
  {
    path: "/dashboard/campanhas/ganhadores",
    detail: "ganhadores próprios, histórico e prova sintética, zeros e troca segura de campanha; sem executar apuração",
    source: "apps/web/e2e/winner-center-premium.spec.ts",
    revision: "0190f04",
  },
  {
    path: "/dashboard/promocoes",
    detail: "lista, filtros, editor e validação sem gravar, teclado e isolamento; sem criar ou ativar promoção",
    source: "apps/web/e2e/promotions-premium.spec.ts",
    revision: "ff07d71",
  },
  {
    path: "/dashboard/afiliados",
    detail: "comissões e origens com dados fictícios, filtros, falha e isolamento; sem convite, repasse ou transferência",
    source: "apps/web/e2e-local/run-organizer-affiliates-premium.mjs",
    revision: "81b5571",
  },
  {
    path: "/dashboard/ganhadores",
    detail: "cotas premiadas, zeros, estados e restrições, editor sem gravar e isolamento; sem compra ou sorteio",
    source: "apps/web/e2e/prize-tickets-premium.spec.ts",
    revision: "a0abca0",
  },
  {
    path: "/dashboard/mini-campanhas",
    detail: "lista e editor sem gravar, link público só quando publicado, recuperação e isolamento",
    source: "apps/web/e2e-local/run-organizer-mini-campaigns-premium.mjs",
    revision: "b39e26a",
  },
  {
    path: "/dashboard/comunicacao",
    detail: "prévia pela API, modelos e validações, teclado e isolamento; sem envio nem configuração de canal",
    source: "apps/web/e2e/communication-premium.spec.ts",
    revision: "3374c43",
  },
];
