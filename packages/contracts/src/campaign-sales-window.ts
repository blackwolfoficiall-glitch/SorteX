export type CampaignSalesWindow = {
  status: 'OPEN' | 'NOT_STARTED' | 'SALES_ENDED' | 'DRAW_TIME_REACHED' | 'UNSCHEDULED';
  opensAt: string | null;
  closesAt: string | null;
};

export function salesWindowMessage(window?: CampaignSalesWindow | null) {
  switch (window?.status) {
    case 'NOT_STARTED': return 'As vendas ainda não começaram.';
    case 'SALES_ENDED': return 'As vendas foram encerradas.';
    case 'DRAW_TIME_REACHED': return 'O horário do sorteio já chegou.';
    case 'UNSCHEDULED': return 'O horário do sorteio não foi confirmado.';
    default: return '';
  }
}
