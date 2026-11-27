export const organizerGroups = [
  {
    title: "Gerenciamento",
    entries: [
      { title: "Ganhadores", icon: "🏆", unavailable: "A gestão de ganhadores ainda não está homologada no aplicativo." },
      { title: "Pedidos", icon: "🧾", route: "CampaignOrders" },
      { title: "Mini campanhas", icon: "🎟️", unavailable: "A criação e gestão de mini campanhas ainda não estão homologadas no aplicativo." },
      { title: "Promoções", icon: "🏷️", unavailable: "A gestão de promoções ainda não está homologada no aplicativo." },
      { title: "Cotas premiadas", icon: "🎁", route: "Campaigns", hint: "Selecione um rascunho e toque em Gerenciar cotas premiadas." },
      { title: "Financeiro", icon: "📊", route: "OrganizerFinance" },
    ],
  },
  {
    title: "Crescimento e inteligência",
    entries: [
      { title: "SorteX Ads", icon: "📣", unavailable: "O painel nativo ainda não está disponível e nenhuma conta de anúncios foi conectada por esta tela." },
      { title: "CRM Intelligence", icon: "👥", unavailable: "A leitura do CRM ainda não está homologada no aplicativo." },
      { title: "IA SorteX", icon: "✦", route: "Copilot" },
      { title: "Afiliados", icon: "🤝", unavailable: "A gestão de afiliados ainda não está homologada no aplicativo." },
      { title: "Comunicação", icon: "💬", unavailable: "Nenhum canal de comunicação está habilitado no aplicativo." },
      { title: "Live SorteX", icon: "▶", unavailable: "A gestão de transmissões ainda não está homologada no aplicativo." },
    ],
  },
  {
    title: "Minha operação",
    entries: [
      { title: "Personalização", icon: "✧", route: "OrganizerProfile", hint: "Atualize o slogan da operação em Perfil." },
      { title: "Integrações", icon: "🔌", unavailable: "As conexões com provedores ainda são configuradas fora do aplicativo." },
      { title: "Configurações", icon: "⚙", route: "OrganizerProfile", hint: "Abra os dados da conta e a opção de sair." },
      { title: "Perfil", icon: "●", route: "OrganizerProfile" },
    ],
  },
] as const;

export const premiumNotices = {
  "Notificações": "A central de notificações do organizador ainda não está homologada no aplicativo.",
  "Sortear": "A apuração ainda não está homologada no aplicativo. Nenhum sorteio será iniciado por este atalho.",
  "Sacar": "A consulta financeira está disponível, mas iniciar saques ainda não está habilitado no aplicativo.",
} as const;
