# Inventário Web Premium — mapa de código gerado

Gerado por `node apps/web/qa/inventory-web.mjs`. Verificação com `--check`. O relatório orienta a rodada visual, não comprova execução.

**109 páginas, 90 handlers (88 em /api), 8 layouts, 215 arquivos de componentes.**
Padrões parametrizados: 17 páginas, 50 handlers; destes, 16 catch-all. Grupos reais no inventário: 0.
Páginas por área: Acesso 13; Admin 26; Afiliado 3; Campanha e prova pública 4; Comprador 13; Conta 2; Diagnóstico 1; Equipe · entrada 2; Institucional/público a revisar 5; Organizador 39; Prévia 1.

Controle de revisão dos gates: alterações nestas fontes exigem rever a interpretação manual, ainda que os nomes das rotas não mudem:

- [proxy.ts](../../apps/web/proxy.ts) · `8274dc833db3`
- [next.config.ts](../../apps/web/next.config.ts) · `47f3597a8e3f`
- [layout.tsx](../../apps/web/app/admin/layout.tsx) · `1f3fd5ec7246`
- [layout.tsx](../../apps/web/app/comprador/layout.tsx) · `ef68cad9cf95`
- [layout.tsx](../../apps/web/app/dashboard/layout.tsx) · `b7f943ecf21b`
- [layout.tsx](../../apps/web/app/organizador/layout.tsx) · `8f3335a8a678`
- [RoleGate.tsx](../../apps/web/components/auth/RoleGate.tsx) · `daeb30542d0f`
- [OrganizerApprovalGate.tsx](../../apps/web/components/organizador/OrganizerApprovalGate.tsx) · `5ea877c2df12`
- [OrganizerOnboardingGate.tsx](../../apps/web/components/organizer-platform/OrganizerOnboardingGate.tsx) · `5ccabe451009`
- [LegalAcceptanceGate.tsx](../../apps/web/components/legal/LegalAcceptanceGate.tsx) · `b651d4ed2716`
- [authorization.ts](../../apps/web/lib/admin/authorization.ts) · `b74849cce1a0`
- [server.ts](../../apps/web/lib/auth/server.ts) · `90454a504bbb`

## Páginas

**V/F/T** = visual da nova revisão / jornada funcional completa / execução nesta auditoria. `? / ? / não rodado` não significa defeito nem reprovação: verifique no navegador antes de mudar o status no registro manual. A evidência de um recorte local é parcial: não aprova a jornada integral, a publicação ou o iPhone. O código traz gates aparentes, não substitui os testes de autorização do backend.

| Rota e fonte | Área e gate de origem | Alias puro | Imports locais diretos | Fontes que referenciam formulário, tabela ou sobreposição | V/F/T |
|---|---|---|---|---|---|
| [/admin/afiliados](../../apps/web/app/admin/afiliados/page.tsx) | Admin · ADMIN da equipe + FINANCE_READ | — | [AdminExistingModuleCenter](../../apps/web/components/admin/AdminExistingModuleCenter.tsx) | [AdminExistingModuleCenter](../../apps/web/components/admin/AdminExistingModuleCenter.tsx) | ? / ? / não rodado |
| [/admin/aprovacoes](../../apps/web/app/admin/aprovacoes/page.tsx) | Admin · ADMIN da equipe + ORGANIZERS_REVIEW | — | [AdminApprovalsCenter](../../apps/web/components/admin/AdminApprovalsCenter.tsx) | [AdminApprovalsCenter](../../apps/web/components/admin/AdminApprovalsCenter.tsx) | ? / ? / não rodado |
| [/admin/auditoria](../../apps/web/app/admin/auditoria/page.tsx) | Admin · ADMIN da equipe + AUDIT_READ | — | [PremiumScope](../../apps/web/components/premium/PremiumScope.tsx) | [page](../../apps/web/app/admin/auditoria/page.tsx) | verificado no recorte local / parcial / passou local · [0ebc52f](../../apps/web/e2e/admin-audit-premium.spec.ts): lista por ação e período, paginação, recuperação e permissão; sem exportar ou mostrar metadados |
| [/admin/campanhas](../../apps/web/app/admin/campanhas/page.tsx) | Admin · ADMIN da equipe + CAMPAIGNS_REVIEW | — | [AdminResourcePage](../../apps/web/components/admin/AdminResourcePage.tsx) | [AdminResourcePage](../../apps/web/components/admin/AdminResourcePage.tsx) | verificado no recorte local / parcial / passou local · [da1b44b](../../apps/web/e2e/admin-campaigns-premium.spec.ts): lista, contagens, filtros, paginação e papéis; sem abrir detalhes ou executar moderação |
| [/admin/configuracoes](../../apps/web/app/admin/configuracoes/page.tsx) | Admin · ADMIN da equipe + SETTINGS_WRITE | — | [AdminOperationsCenter](../../apps/web/components/admin/AdminOperationsCenter.tsx) | [AdminOperationsCenter](../../apps/web/components/admin/AdminOperationsCenter.tsx) | ? / ? / não rodado |
| [/admin/conteudo](../../apps/web/app/admin/conteudo/page.tsx) | Admin · ADMIN da equipe + CONTENT_WRITE | — | [AdminOperationsCenter](../../apps/web/components/admin/AdminOperationsCenter.tsx) | [AdminOperationsCenter](../../apps/web/components/admin/AdminOperationsCenter.tsx) | ? / ? / não rodado |
| [/admin/convite/\[token\]](../../apps/web/app/admin/convite/%5Btoken%5D/page.tsx) | Equipe · entrada · Exceção do proxy e layout; convite validado no fluxo | — | — | [page](../../apps/web/app/admin/convite/%5Btoken%5D/page.tsx) | ? / ? / não rodado |
| [/admin/crm](../../apps/web/app/admin/crm/page.tsx) | Admin · ADMIN da equipe + AUDIT_READ | — | [AdminExistingModuleCenter](../../apps/web/components/admin/AdminExistingModuleCenter.tsx) | [AdminExistingModuleCenter](../../apps/web/components/admin/AdminExistingModuleCenter.tsx) | ? / ? / não rodado |
| [/admin/dashboard](../../apps/web/app/admin/dashboard/page.tsx) | Admin · ADMIN da equipe | — | [AdminDashboard](../../apps/web/components/admin/AdminDashboard.tsx) | — | verificado no recorte local / parcial / passou local · [cf9f29e](../../apps/web/e2e/admin-overview-premium.spec.ts): visão geral, datas e valores, suporte restrito e acesso vedado a outros papéis; sem operações administrativas |
| [/admin/denuncias](../../apps/web/app/admin/denuncias/page.tsx) | Admin · ADMIN da equipe + SUPPORT_WRITE | — | [AdminResourcePage](../../apps/web/components/admin/AdminResourcePage.tsx) | [AdminResourcePage](../../apps/web/components/admin/AdminResourcePage.tsx) | ? / ? / não rodado |
| [/admin/equipe/\[id\]](../../apps/web/app/admin/equipe/%5Bid%5D/page.tsx) | Admin · ADMIN da equipe + USERS_READ | — | [RoleGate](../../apps/web/components/auth/RoleGate.tsx) | — | ? / ? / não rodado |
| [/admin/equipe](../../apps/web/app/admin/equipe/page.tsx) | Admin · ADMIN da equipe + USERS_READ | — | [AdminTeamCenter](../../apps/web/components/admin/AdminTeamCenter.tsx) | [AdminTeamCenter](../../apps/web/components/admin/AdminTeamCenter.tsx) | ? / ? / não rodado |
| [/admin/financeiro](../../apps/web/app/admin/financeiro/page.tsx) | Admin · ADMIN da equipe + FINANCE_READ | — | [AdminFinanceDashboard](../../apps/web/components/dashboard/finance/AdminFinanceDashboard.tsx) | [AdminFinanceDashboard](../../apps/web/components/dashboard/finance/AdminFinanceDashboard.tsx) | verificado no recorte local / parcial / passou local · [87b13b2](../../apps/web/e2e/admin-finance-premium.spec.ts): visão geral, seis abas consultadas, distinção de moeda e saldo interno, restrições de perfil; sem repasse ou ações |
| [/admin/ganhadores](../../apps/web/app/admin/ganhadores/page.tsx) | Admin · ADMIN da equipe + DRAWS_REVIEW | — | [AdminResourcePage](../../apps/web/components/admin/AdminResourcePage.tsx) | [AdminResourcePage](../../apps/web/components/admin/AdminResourcePage.tsx) | ? / ? / não rodado |
| [/admin/gateways](../../apps/web/app/admin/gateways/page.tsx) | Admin · ADMIN da equipe + FINANCE_READ | — | [AdminManagement](../../apps/web/components/admin/AdminManagement.tsx) | [AdminManagement](../../apps/web/components/admin/AdminManagement.tsx) | verificado no recorte local / parcial / passou local · [6567895](../../apps/web/e2e/admin-gateways-premium.spec.ts): lista, configurações registradas e permissão de leitura; sem conexão, edição ou credenciais |
| [/admin/juridico](../../apps/web/app/admin/juridico/page.tsx) | Admin · ADMIN da equipe + SETTINGS_WRITE | — | [LegalAdminCenter](../../apps/web/components/legal/LegalAdminCenter.tsx) | — | ? / ? / não rodado |
| [/admin/login](../../apps/web/app/admin/login/page.tsx) | Equipe · entrada · Exceção do proxy e layout; convite validado no fluxo | — | — | [page](../../apps/web/app/admin/login/page.tsx) | ? / ? / não rodado |
| [/admin/loteria](../../apps/web/app/admin/loteria/page.tsx) | Admin · ADMIN da equipe + LOTTERY_RESULTS_WRITE | — | [DrawWorkspace](../../apps/web/components/draws/DrawWorkspace.tsx) | [DrawWorkspace](../../apps/web/components/draws/DrawWorkspace.tsx) | verificado no recorte local / parcial / passou local · [717d04d](../../apps/web/e2e/admin-loteria-premium.spec.ts): histórico e detalhes da extração, datas UTC, zeros e acesso administrativo; sem importar, revisar ou apurar |
| [/admin/midia](../../apps/web/app/admin/midia/page.tsx) | Admin · ADMIN da equipe + CONTENT_WRITE | — | [AdminExistingModuleCenter](../../apps/web/components/admin/AdminExistingModuleCenter.tsx) | [AdminExistingModuleCenter](../../apps/web/components/admin/AdminExistingModuleCenter.tsx) | ? / ? / não rodado |
| [/admin/organizadores/\[id\]](../../apps/web/app/admin/organizadores/%5Bid%5D/page.tsx) | Admin · ADMIN da equipe + ORGANIZERS_REVIEW | — | [RoleGate](../../apps/web/components/auth/RoleGate.tsx), [VerificationStatusBadge](../../apps/web/components/organizador/VerificationStatusBadge.tsx), [Button](../../apps/web/components/ui/Button.tsx), [Card](../../apps/web/components/ui/Card.tsx), [Input](../../apps/web/components/ui/Input.tsx), [textarea](../../apps/web/components/ui/textarea.tsx) | — | ? / ? / não rodado |
| [/admin/organizadores](../../apps/web/app/admin/organizadores/page.tsx) | Admin · ADMIN da equipe + ORGANIZERS_REVIEW | — | [VerificationStatusBadge](../../apps/web/components/organizador/VerificationStatusBadge.tsx), [PremiumScope](../../apps/web/components/premium/PremiumScope.tsx) | [page](../../apps/web/app/admin/organizadores/page.tsx) | verificado no recorte local / parcial / passou local · [6b040c7](../../apps/web/e2e/admin-organizers-premium.spec.ts): lista, paginação, filtros e acesso autorizado restrito, recuperação; sem aprovar, editar ou alterar permissões |
| [/admin/pagamentos](../../apps/web/app/admin/pagamentos/page.tsx) | Admin · ADMIN da equipe + FINANCE_READ | — | [AdminResourcePage](../../apps/web/components/admin/AdminResourcePage.tsx) | [AdminResourcePage](../../apps/web/components/admin/AdminResourcePage.tsx) | verificado no recorte local / parcial / passou local · [6b0c62b](../../apps/web/e2e/admin-payments-premium.spec.ts): lista local autorizada, moedas e estados, sem confundir com liquidação; sem acionar revisão ou provedor |
| [/admin](../../apps/web/app/admin/page.tsx) | Admin · ADMIN da equipe | redireciona → /admin/dashboard | — | — | ? / ? / não rodado |
| [/admin/planos](../../apps/web/app/admin/planos/page.tsx) | Admin · ADMIN da equipe + SETTINGS_WRITE | — | [AdminManagement](../../apps/web/components/admin/AdminManagement.tsx) | [AdminManagement](../../apps/web/components/admin/AdminManagement.tsx) | verificado no recorte local / parcial / passou local · [50f0fcf](../../apps/web/e2e/admin-plans-premium.spec.ts): catálogo e estado, limites, período e permissões; sem alterar planos ou faturamento |
| [/admin/saude](../../apps/web/app/admin/saude/page.tsx) | Admin · ADMIN da equipe + AUDIT_READ | — | [AdminOperationsCenter](../../apps/web/components/admin/AdminOperationsCenter.tsx) | [AdminOperationsCenter](../../apps/web/components/admin/AdminOperationsCenter.tsx) | ? / ? / não rodado |
| [/admin/suporte](../../apps/web/app/admin/suporte/page.tsx) | Admin · ADMIN da equipe + SUPPORT_WRITE | — | [AdminResourcePage](../../apps/web/components/admin/AdminResourcePage.tsx) | [AdminResourcePage](../../apps/web/components/admin/AdminResourcePage.tsx) | ? / ? / não rodado |
| [/admin/taxas](../../apps/web/app/admin/taxas/page.tsx) | Admin · ADMIN da equipe + FINANCE_WRITE | — | [AdminManagement](../../apps/web/components/admin/AdminManagement.tsx) | [AdminManagement](../../apps/web/components/admin/AdminManagement.tsx) | ? / ? / não rodado |
| [/admin/usuarios](../../apps/web/app/admin/usuarios/page.tsx) | Admin · ADMIN da equipe + USERS_READ | — | [AdminResourcePage](../../apps/web/components/admin/AdminResourcePage.tsx) | [AdminResourcePage](../../apps/web/components/admin/AdminResourcePage.tsx) | verificado no recorte local / parcial / passou local · [d30060a](../../apps/web/e2e/admin-users-premium.spec.ts): lista, ordenação, filtros, paginação e permissão de leitura; sem abrir detalhes ou executar ações da conta |
| [/afiliado/convite/\[code\]](../../apps/web/app/afiliado/convite/%5Bcode%5D/page.tsx) | Afiliado · Sem proxy de página; continuação por convite/conta | — | [AffiliateInvitation](../../apps/web/app/afiliado/convite/AffiliateInvitation.tsx) | — | ? / ? / não rodado |
| [/afiliado/convite/continuar](../../apps/web/app/afiliado/convite/continuar/page.tsx) | Afiliado · Sem proxy de página; continuação por convite/conta | — | [AffiliateInvitation](../../apps/web/app/afiliado/convite/AffiliateInvitation.tsx) | — | ? / ? / não rodado |
| [/afiliado](../../apps/web/app/afiliado/page.tsx) | Afiliado · Sem gate no layout; consulta de sessão/dados na API | — | — | — | ? / ? / não rodado |
| [/cadastro/completar](../../apps/web/app/cadastro/completar/page.tsx) | Acesso · Sem proxy de página; validações próprias do fluxo | — | [SocialCompletion](../../apps/web/components/auth/SocialCompletion.tsx) | [RegistrationForm](../../apps/web/components/auth/RegistrationForm.tsx), [SocialCompletion](../../apps/web/components/auth/SocialCompletion.tsx) | ? / ? / não rodado |
| [/cadastro/comprador](../../apps/web/app/cadastro/comprador/page.tsx) | Acesso · Sem proxy de página; validações próprias do fluxo | — | [RegistrationAccessScope](../../apps/web/app/cadastro/RegistrationAccessScope.tsx), [RegistrationForm](../../apps/web/components/auth/RegistrationForm.tsx) | [page](../../apps/web/app/cadastro/comprador/page.tsx), [RegistrationForm](../../apps/web/components/auth/RegistrationForm.tsx) | verificado no recorte local / parcial / passou local · [a0a0805](../../apps/web/e2e/registration-forms-premium.spec.ts): três etapas, catálogo local de endereços, teclado e validação visual; sem criar conta |
| [/cadastro/organizador/confirmacao](../../apps/web/app/cadastro/organizador/confirmacao/page.tsx) | Acesso · Sem proxy de página; validações próprias do fluxo | — | — | — | ? / ? / não rodado |
| [/cadastro/organizador/financeiro](../../apps/web/app/cadastro/organizador/financeiro/page.tsx) | Acesso · Sem proxy de página; validações próprias do fluxo | — | [FinancialSummary](../../apps/web/components/organizador/FinancialSummary.tsx), [GatewayCard](../../apps/web/components/organizador/GatewayCard.tsx), [ProgressSteps](../../apps/web/components/organizador/ProgressSteps.tsx) | — | ? / ? / não rodado |
| [/cadastro/organizador](../../apps/web/app/cadastro/organizador/page.tsx) | Acesso · Sem proxy de página; validações próprias do fluxo | — | [RegistrationAccessScope](../../apps/web/app/cadastro/RegistrationAccessScope.tsx), [RegistrationForm](../../apps/web/components/auth/RegistrationForm.tsx) | [page](../../apps/web/app/cadastro/organizador/page.tsx), [RegistrationForm](../../apps/web/components/auth/RegistrationForm.tsx) | verificado no recorte local / parcial / passou local · [a0a0805](../../apps/web/e2e/registration-forms-premium.spec.ts): três etapas, PF/PJ e catálogo local, temas e validações vazias; sem aprovar, enviar ou cadastrar |
| [/cadastro](../../apps/web/app/cadastro/page.tsx) | Acesso · Sem proxy de página; validações próprias do fluxo | — | [AuthShell](../../apps/web/components/auth/AuthShell.tsx), [SocialAccess](../../apps/web/components/auth/SocialAccess.tsx), [PremiumScope](../../apps/web/components/premium/PremiumScope.tsx) | — | verificado no recorte local / parcial / passou local · [4f38406](../../apps/web/e2e/registration-choice-premium.spec.ts): escolha de perfil e destinos PF/PJ e comprador; não criou contas |
| [/cadastro/sucesso](../../apps/web/app/cadastro/sucesso/page.tsx) | Acesso · Sem proxy de página; validações próprias do fluxo | — | — | — | ? / ? / não rodado |
| [/cadastro/sucesso-comprador](../../apps/web/app/cadastro/sucesso-comprador/page.tsx) | Acesso · Sem proxy de página; validações próprias do fluxo | — | — | — | ? / ? / não rodado |
| [/cadastro/sucesso-organizador](../../apps/web/app/cadastro/sucesso-organizador/page.tsx) | Acesso · Sem proxy de página; validações próprias do fluxo | — | — | — | ? / ? / não rodado |
| [/campanha/\[slug\]](../../apps/web/app/campanha/%5Bslug%5D/page.tsx) | Campanha e prova pública · Sem proxy de página; regras e visibilidade dependem da API | — | [PublicCampaignView](../../apps/web/components/campaigns/PublicCampaignView.tsx) | [CampaignPublicChrome](../../apps/web/components/campaigns/CampaignPublicChrome.tsx), [PublicCampaignView](../../apps/web/components/campaigns/PublicCampaignView.tsx), [PurchasePanel](../../apps/web/components/purchases/PurchasePanel.tsx) | verificado no recorte local / parcial / passou local · [96e9cd5](../../apps/web/e2e-local/run-quick-quantity-contrast.mjs): painel de quantidade e cotação d4 (96e9cd5); topo, galeria, capas, personalização, status e rascunho oculto (42c0214); sem reservar ou pagar |
| [/comprador/checkout/\[id\]](../../apps/web/app/comprador/checkout/%5Bid%5D/page.tsx) | Comprador · Proxy; BUYER ou ADMIN da equipe; aviso legal | — | [MercadoPagoCardBrick](../../apps/web/components/payments/MercadoPagoCardBrick.tsx), [PixPaymentView](../../apps/web/components/payments/PixPaymentView.tsx), [PremiumScope](../../apps/web/components/premium/PremiumScope.tsx), [ReservationCountdown](../../apps/web/components/purchases/ReservationCountdown.tsx) | — | verificado no recorte local / parcial / passou local · [0c3dc48](../../apps/web/e2e-local/run-buyer-checkout-premium.mjs): reservas sem pagamento, preços, termos, estados e isolamento; sem recarregar status, chamar provedor ou iniciar cobrança |
| [/comprador/compras/\[id\]](../../apps/web/app/comprador/compras/%5Bid%5D/page.tsx) | Comprador · Proxy; BUYER ou ADMIN da equipe; aviso legal | — | [RoleGate](../../apps/web/components/auth/RoleGate.tsx), [PremiumScope](../../apps/web/components/premium/PremiumScope.tsx) | — | verificado no recorte local / parcial / passou local · [47bb97c](../../apps/web/e2e-local/run-buyer-purchase-detail-premium.mjs): detalhe pago, pendente, reservado e expirado, títulos, links e isolamento; sem chamar checkout ou gateway |
| [/comprador/favoritos](../../apps/web/app/comprador/favoritos/page.tsx) | Comprador · Proxy; BUYER ou ADMIN da equipe; aviso legal | — | [RoleGate](../../apps/web/components/auth/RoleGate.tsx), [CampaignCard](../../apps/web/components/comprador/CampaignCard.tsx), [PremiumScope](../../apps/web/components/premium/PremiumScope.tsx) | — | verificado no recorte local / parcial / passou local · [638c3a2](../../apps/web/e2e/buyer-favorites-premium.spec.ts): campanhas públicas favoritas da conta, capas e recuperação; sem marcar nem remover |
| [/comprador/meus-numeros](../../apps/web/app/comprador/meus-numeros/page.tsx) | Comprador · Proxy; BUYER ou ADMIN da equipe; aviso legal | — | [RoleGate](../../apps/web/components/auth/RoleGate.tsx), [PremiumScope](../../apps/web/components/premium/PremiumScope.tsx) | — | verificado no recorte local / parcial / passou local · [94c43ac](../../apps/web/e2e-local/run-buyer-purchases-premium.mjs): compras, títulos emitidos e estados distintos, filtros, temas e isolamento; sem alterar pagamentos ou reservas |
| [/comprador/meus-premios](../../apps/web/app/comprador/meus-premios/page.tsx) | Comprador · Proxy; BUYER ou ADMIN da equipe; aviso legal | — | [BuyerPrizes](../../apps/web/components/comprador/BuyerPrizes.tsx) | — | verificado no recorte local / parcial / passou local · [a267178](../../apps/web/e2e-local/run-buyer-prizes-premium.mjs): sorteios e cotas premiadas autorizados, zeros, falha parcial e privacidade; sem resgate ou apuração |
| [/comprador/notificacoes](../../apps/web/app/comprador/notificacoes/page.tsx) | Comprador · Proxy; BUYER ou ADMIN da equipe; aviso legal | — | [PremiumScope](../../apps/web/components/premium/PremiumScope.tsx) | — | verificado no recorte local / parcial / passou local · [a09a4fd](../../apps/web/e2e/buyer-notifications-premium.spec.ts): caixa isolada por comprador, não lidas, carregamento e erro, foco no celular; sem marcar ou enviar |
| [/comprador/pagamento/sucesso/\[id\]](../../apps/web/app/comprador/pagamento/sucesso/%5Bid%5D/page.tsx) | Comprador · Proxy; BUYER ou ADMIN da equipe; aviso legal | — | [PostPaymentRewards](../../apps/web/components/draws/PostPaymentRewards.tsx), [Button](../../apps/web/components/ui/Button.tsx), [Card](../../apps/web/components/ui/Card.tsx) | — | ? / ? / não rodado |
| [/comprador](../../apps/web/app/comprador/page.tsx) | Comprador · Proxy; BUYER ou ADMIN da equipe; aviso legal | — | [RoleGate](../../apps/web/components/auth/RoleGate.tsx), [PremiumScope](../../apps/web/components/premium/PremiumScope.tsx) | — | verificado no recorte local / parcial / passou local · [1fc8fcf](../../apps/web/e2e-local/run-buyer-home-premium.mjs): home e capas da API, catálogo, estados e notificações por comprador; sem reservar ou comprar |
| [/comprador/participar](../../apps/web/app/comprador/participar/page.tsx) | Comprador · Proxy; BUYER ou ADMIN da equipe; aviso legal | redireciona → /comprador/sorteios?filter=LIVE | — | — | ? / ? / não rodado |
| [/comprador/perfil](../../apps/web/app/comprador/perfil/page.tsx) | Comprador · Proxy; BUYER ou ADMIN da equipe; aviso legal | — | [PremiumScope](../../apps/web/components/premium/PremiumScope.tsx) | [page](../../apps/web/app/comprador/perfil/page.tsx) | verificado no recorte local / parcial / passou local · [40de454](../../apps/web/e2e/buyer-profile-premium.spec.ts): perfil por conta, atalhos, temas e recuperação de erro; sem salvar nem encerrar sessão |
| [/comprador/resultados](../../apps/web/app/comprador/resultados/page.tsx) | Comprador · Proxy; BUYER ou ADMIN da equipe; aviso legal | — | [RoleGate](../../apps/web/components/auth/RoleGate.tsx), [PremiumScope](../../apps/web/components/premium/PremiumScope.tsx) | — | verificado no recorte local / parcial / passou local · [5db9481](../../apps/web/e2e-local/run-buyer-results-premium.mjs): resultados próprios e privacidade, zeros preservados, simulação identificada e erro; sem apuração |
| [/comprador/sorteios](../../apps/web/app/comprador/sorteios/page.tsx) | Comprador · Proxy; BUYER ou ADMIN da equipe; aviso legal | — | [RoleGate](../../apps/web/components/auth/RoleGate.tsx), [PremiumScope](../../apps/web/components/premium/PremiumScope.tsx) | — | verificado no recorte local / parcial / passou local · [7871901](../../apps/web/e2e-local/run-buyer-catalog-premium.mjs): catálogo, preços, capas, filtros e paginação de campanhas públicas; sem reservar ou comprar |
| [/comprador/suporte](../../apps/web/app/comprador/suporte/page.tsx) | Comprador · Proxy; BUYER ou ADMIN da equipe; aviso legal | — | [RoleGate](../../apps/web/components/auth/RoleGate.tsx), [PremiumScope](../../apps/web/components/premium/PremiumScope.tsx) | [page](../../apps/web/app/comprador/suporte/page.tsx) | verificado no recorte local / parcial / passou local · [51b80d1](../../apps/web/e2e-local/run-buyer-support-premium.mjs): histórico privado, rascunho, categorias, falha e recuperação por conta; sem abrir ou enviar chamado |
| [/contato](../../apps/web/app/contato/page.tsx) | Institucional/público a revisar · Sem gate por rota identificado; reavaliar regras em novos destinos | — | [AuthShell](../../apps/web/components/auth/AuthShell.tsx) | — | ? / ? / não rodado |
| [/criar](../../apps/web/app/criar/page.tsx) | Organizador · Proxy; redireciona para layout de ORGANIZER | redireciona → /dashboard/campanhas/nova | — | — | ? / ? / não rodado |
| [/dashboard/ads](../../apps/web/app/dashboard/ads/page.tsx) | Organizador · Proxy; ORGANIZER; onboarding, aprovação e aviso legal | — | [AdsCenter](../../apps/web/components/growth/AdsCenter.tsx) | [AdsCenter](../../apps/web/components/growth/AdsCenter.tsx), [AdsConfirmedSales](../../apps/web/components/growth/AdsConfirmedSales.tsx) | verificado no recorte local / parcial / passou local · [46dceef](../../apps/web/e2e-local/run-organizer-ads-premium.mjs): vendas internas, filtros, temas e origem; leitura Meta, Google e TikTok desativada, sem métricas não comprovadas |
| [/dashboard/afiliados](../../apps/web/app/dashboard/afiliados/page.tsx) | Organizador · Proxy; ORGANIZER; onboarding, aprovação e aviso legal | — | [AffiliatesCenter](../../apps/web/components/dashboard/affiliate/AffiliatesCenter.tsx) | [AffiliatesCenter](../../apps/web/components/dashboard/affiliate/AffiliatesCenter.tsx) | verificado no recorte local / parcial / passou local · [81b5571](../../apps/web/e2e-local/run-organizer-affiliates-premium.mjs): comissões e origens com dados fictícios, filtros, falha e isolamento; sem convite, repasse ou transferência |
| [/dashboard/campanhas/\[id\]/editar](../../apps/web/app/dashboard/campanhas/%5Bid%5D/editar/page.tsx) | Organizador · Proxy; ORGANIZER; onboarding, aprovação e aviso legal | — | [CampaignWizard](../../apps/web/components/campaigns/CampaignWizard.tsx) | [CampaignWizard](../../apps/web/components/campaigns/CampaignWizard.tsx) | verificado no recorte local / parcial / passou local · [2b47158](../../apps/web/e2e/campaign-wizard-premium.spec.ts): abertura de rascunho e campanha publicada próprios, acesso de outro organizador bloqueado; não testou salvar nem publicar |
| [/dashboard/campanhas/\[id\]/publicada](../../apps/web/app/dashboard/campanhas/%5Bid%5D/publicada/page.tsx) | Organizador · Proxy; ORGANIZER; onboarding, aprovação e aviso legal | — | [CampaignPublishedSuccess](../../apps/web/components/campaigns/CampaignPublishedSuccess.tsx) | — | ? / ? / não rodado |
| [/dashboard/campanhas/ganhadores](../../apps/web/app/dashboard/campanhas/ganhadores/page.tsx) | Organizador · Proxy; ORGANIZER; onboarding, aprovação e aviso legal | — | [WinnerLookupCenter](../../apps/web/components/campaigns/WinnerLookupCenter.tsx) | — | verificado no recorte local / parcial / passou local · [0190f04](../../apps/web/e2e/winner-center-premium.spec.ts): ganhadores próprios, histórico e prova sintética, zeros e troca segura de campanha; sem executar apuração |
| [/dashboard/campanhas/nova](../../apps/web/app/dashboard/campanhas/nova/page.tsx) | Organizador · Proxy; ORGANIZER; onboarding, aprovação e aviso legal | — | [CampaignWizard](../../apps/web/components/campaigns/CampaignWizard.tsx) | [CampaignWizard](../../apps/web/components/campaigns/CampaignWizard.tsx) | verificado no recorte local / parcial / passou local · [2b47158](../../apps/web/e2e/campaign-wizard-premium.spec.ts): abertura e primeira etapa do editor, validação sem salvar, temas e foco a 320 px; etapas seguintes não testadas |
| [/dashboard/campanhas](../../apps/web/app/dashboard/campanhas/page.tsx) | Organizador · Proxy; ORGANIZER; onboarding, aprovação e aviso legal | — | [CampaignDashboard](../../apps/web/components/campaigns/CampaignDashboard.tsx) | — | verificado no recorte local / parcial / passou local · [f14ad80](../../apps/web/e2e/campaign-list-premium.spec.ts): lista, filtros, capas reais no banco de teste, isolamento e recuperação; sem executar mutações |
| [/dashboard/comunicacao](../../apps/web/app/dashboard/comunicacao/page.tsx) | Organizador · Proxy; ORGANIZER; onboarding, aprovação e aviso legal | — | [SmartCommunicationTools](../../apps/web/components/communication/SmartCommunicationTools.tsx), [PremiumScope](../../apps/web/components/premium/PremiumScope.tsx) | [page](../../apps/web/app/dashboard/comunicacao/page.tsx), [SmartCommunicationTools](../../apps/web/components/communication/SmartCommunicationTools.tsx) | verificado no recorte local / parcial / passou local · [3374c43](../../apps/web/e2e/communication-premium.spec.ts): prévia pela API, modelos e validações, teclado e isolamento; sem envio nem configuração de canal |
| [/dashboard/configuracoes/juridico](../../apps/web/app/dashboard/configuracoes/juridico/page.tsx) | Organizador · Proxy; ORGANIZER; onboarding, aprovação e aviso legal | — | [LegalUserCenter](../../apps/web/components/legal/LegalUserCenter.tsx) | [LegalUserCenter](../../apps/web/components/legal/LegalUserCenter.tsx) | ? / ? / não rodado |
| [/dashboard/configuracoes](../../apps/web/app/dashboard/configuracoes/page.tsx) | Organizador · Proxy; ORGANIZER; onboarding, aprovação e aviso legal | — | [PremiumScope](../../apps/web/components/premium/PremiumScope.tsx) | — | verificado no recorte local / parcial / passou local · [29a57fc](../../apps/web/e2e/organizer-config-premium.spec.ts): seis destinos de configurações e acessos, temas e foco; sem editar configurações |
| [/dashboard/configuracoes/plano](../../apps/web/app/dashboard/configuracoes/plano/page.tsx) | Organizador · Proxy; ORGANIZER; onboarding, aprovação e aviso legal | — | [PlanSelector](../../apps/web/components/organizer-platform/PlanSelector.tsx) | — | verificado no recorte local / parcial / passou local · [4884bbf](../../apps/web/e2e/organizer-plan-premium.spec.ts): plano atual, teste, ofertas, estados e permissões; sem assinar, mudar plano ou cobrar |
| [/dashboard/crm/automacoes](../../apps/web/app/dashboard/crm/automacoes/page.tsx) | Organizador · Proxy; ORGANIZER; onboarding, aprovação e aviso legal | — | [AutomationShortcutLink](../../apps/web/components/crm/AutomationShortcutLink.tsx), [CrmNav](../../apps/web/components/crm/CrmNav.tsx) | [page](../../apps/web/app/dashboard/crm/automacoes/page.tsx) | ? / ? / não rodado |
| [/dashboard/crm/contatos/\[id\]](../../apps/web/app/dashboard/crm/contatos/%5Bid%5D/page.tsx) | Organizador · Proxy; ORGANIZER; onboarding, aprovação e aviso legal | — | [CrmNav](../../apps/web/components/crm/CrmNav.tsx) | [page](../../apps/web/app/dashboard/crm/contatos/%5Bid%5D/page.tsx) | ? / ? / não rodado |
| [/dashboard/crm/contatos](../../apps/web/app/dashboard/crm/contatos/page.tsx) | Organizador · Proxy; ORGANIZER; onboarding, aprovação e aviso legal | — | [CrmNav](../../apps/web/components/crm/CrmNav.tsx) | [page](../../apps/web/app/dashboard/crm/contatos/page.tsx) | ? / ? / não rodado |
| [/dashboard/crm/notificacoes](../../apps/web/app/dashboard/crm/notificacoes/page.tsx) | Organizador · Proxy; ORGANIZER; onboarding, aprovação e aviso legal | redireciona → /dashboard/crm | — | — | ? / ? / não rodado |
| [/dashboard/crm](../../apps/web/app/dashboard/crm/page.tsx) | Organizador · Proxy; ORGANIZER; onboarding, aprovação e aviso legal | — | [AutomationShortcutLink](../../apps/web/components/crm/AutomationShortcutLink.tsx), [CrmNav](../../apps/web/components/crm/CrmNav.tsx), [PremiumScope](../../apps/web/components/premium/PremiumScope.tsx) | — | verificado no recorte local / parcial / passou local · [37d36c5](../../apps/web/e2e/crm-overview-premium.spec.ts): visão geral, filtros e links, origem geográfica, teclado e separação por conta; não enviou comunicação |
| [/dashboard/crm/reservas-abandonadas](../../apps/web/app/dashboard/crm/reservas-abandonadas/page.tsx) | Organizador · Proxy; ORGANIZER; onboarding, aprovação e aviso legal | — | [AbandonedReservationsAnalysis](../../apps/web/components/crm/AbandonedReservationsAnalysis.tsx) | — | ? / ? / não rodado |
| [/dashboard/crm/segmentos](../../apps/web/app/dashboard/crm/segmentos/page.tsx) | Organizador · Proxy; ORGANIZER; onboarding, aprovação e aviso legal | — | [CrmNav](../../apps/web/components/crm/CrmNav.tsx) | [page](../../apps/web/app/dashboard/crm/segmentos/page.tsx) | ? / ? / não rodado |
| [/dashboard/crm/tarefas](../../apps/web/app/dashboard/crm/tarefas/page.tsx) | Organizador · Proxy; ORGANIZER; onboarding, aprovação e aviso legal | — | [CrmNav](../../apps/web/components/crm/CrmNav.tsx) | [page](../../apps/web/app/dashboard/crm/tarefas/page.tsx) | ? / ? / não rodado |
| [/dashboard/financeiro](../../apps/web/app/dashboard/financeiro/page.tsx) | Organizador · Proxy; ORGANIZER; onboarding, aprovação e aviso legal | — | [FinanceDashboard](../../apps/web/components/dashboard/finance/FinanceDashboard.tsx) | — | verificado no recorte local / parcial / passou local · [4e13760](../../apps/web/e2e/organizer-finance-premium.spec.ts): consulta de saldos, taxas, extrato, filtros, XLS e impressão; sem movimentação ou conciliação externa |
| [/dashboard/ganhadores](../../apps/web/app/dashboard/ganhadores/page.tsx) | Organizador · Proxy; ORGANIZER; onboarding, aprovação e aviso legal | — | [PrizeTicketsCenter](../../apps/web/components/prizes/PrizeTicketsCenter.tsx) | [PrizeTicketsCenter](../../apps/web/components/prizes/PrizeTicketsCenter.tsx) | verificado no recorte local / parcial / passou local · [a0abca0](../../apps/web/e2e/prize-tickets-premium.spec.ts): cotas premiadas, zeros, estados e restrições, editor sem gravar e isolamento; sem compra ou sorteio |
| [/dashboard/ia](../../apps/web/app/dashboard/ia/page.tsx) | Organizador · Proxy; ORGANIZER; onboarding, aprovação e aviso legal | — | [AbandonedReservationsAnalysis](../../apps/web/components/crm/AbandonedReservationsAnalysis.tsx), [AiSortexCenter](../../apps/web/components/growth/AiSortexCenter.tsx) | [AdvisorConversation](../../apps/web/components/growth/AdvisorConversation.tsx), [AiSortexCenter](../../apps/web/components/growth/AiSortexCenter.tsx) | verificado no recorte local / parcial / passou local · [fe7cc53](../../apps/web/e2e-local/run-organizer-advisor-premium.mjs): chat local, presets, simulação, rascunhos e isolamento; provedores reais desligados |
| [/dashboard/integracoes](../../apps/web/app/dashboard/integracoes/page.tsx) | Organizador · Proxy; ORGANIZER; onboarding, aprovação e aviso legal | — | [IntegrationsCenter](../../apps/web/components/organizer-platform/IntegrationsCenter.tsx) | [IntegrationsCenter](../../apps/web/components/organizer-platform/IntegrationsCenter.tsx) | verificado no recorte local / parcial / passou local · [94789b6](../../apps/web/e2e/organizer-integrations-premium.spec.ts): leitura por conta, canais indisponíveis e demonstração rotulada; sem OAuth, conexão ou credenciais |
| [/dashboard/mini-campanhas/\[id\]](../../apps/web/app/dashboard/mini-campanhas/%5Bid%5D/page.tsx) | Organizador · Proxy; ORGANIZER; onboarding, aprovação e aviso legal | — | — | [page](../../apps/web/app/dashboard/mini-campanhas/%5Bid%5D/page.tsx) | ? / ? / não rodado |
| [/dashboard/mini-campanhas](../../apps/web/app/dashboard/mini-campanhas/page.tsx) | Organizador · Proxy; ORGANIZER; onboarding, aprovação e aviso legal | — | [PremiumScope](../../apps/web/components/premium/PremiumScope.tsx) | [page](../../apps/web/app/dashboard/mini-campanhas/page.tsx) | verificado no recorte local / parcial / passou local · [b39e26a](../../apps/web/e2e-local/run-organizer-mini-campaigns-premium.mjs): lista e editor sem gravar, link público só quando publicado, recuperação e isolamento |
| [/dashboard](../../apps/web/app/dashboard/page.tsx) | Organizador · Proxy; ORGANIZER; onboarding, aprovação e aviso legal | — | [OrganizerDashboard](../../apps/web/components/dashboard/OrganizerDashboard.tsx), [PremiumScope](../../apps/web/components/premium/PremiumScope.tsx) | [DashboardPeriodMetrics](../../apps/web/components/dashboard/DashboardPeriodMetrics.tsx) | verificado no recorte local / parcial / passou local · [db136a8](../../apps/web/e2e-local/run-organizer-dashboard-premium.mjs): Dashboard e navegação, vendas por período, estado vazio e recuperação, temas e foco a 320 px |
| [/dashboard/pedidos/\[id\]](../../apps/web/app/dashboard/pedidos/%5Bid%5D/page.tsx) | Organizador · Proxy; ORGANIZER; onboarding, aprovação e aviso legal | — | [PremiumScope](../../apps/web/components/premium/PremiumScope.tsx) | — | verificado no recorte local / parcial / passou local · [092c77a](../../apps/web/e2e-local/run-organizer-order-detail-premium.mjs): detalhe pago e pendente, histórico e contagem de títulos, erro e isolamento; sem confirmar recebimento ou transação |
| [/dashboard/pedidos](../../apps/web/app/dashboard/pedidos/page.tsx) | Organizador · Proxy; ORGANIZER; onboarding, aprovação e aviso legal | — | [PremiumScope](../../apps/web/components/premium/PremiumScope.tsx) | [page](../../apps/web/app/dashboard/pedidos/page.tsx) | verificado no recorte local / parcial / passou local · [db9d50c](../../apps/web/e2e-local/run-organizer-orders-premium.mjs): lista, busca, filtros, CSV e diálogo de detalhes; não cobre a página de detalhes separada nem os demais formatos |
| [/dashboard/personalizacao/dominio](../../apps/web/app/dashboard/personalizacao/dominio/page.tsx) | Organizador · Proxy; ORGANIZER; onboarding, aprovação e aviso legal | — | [PersonalizationCenter](../../apps/web/components/organizer-platform/PersonalizationCenter.tsx) | [PersonalizationCenter](../../apps/web/components/organizer-platform/PersonalizationCenter.tsx) | ? / ? / não rodado |
| [/dashboard/personalizacao](../../apps/web/app/dashboard/personalizacao/page.tsx) | Organizador · Proxy; ORGANIZER; onboarding, aprovação e aviso legal | — | [PersonalizationCenter](../../apps/web/components/organizer-platform/PersonalizationCenter.tsx), [PremiumScope](../../apps/web/components/premium/PremiumScope.tsx) | [PersonalizationCenter](../../apps/web/components/organizer-platform/PersonalizationCenter.tsx) | verificado no recorte local / parcial / passou local · [5866324](../../apps/web/e2e/personalization-premium.spec.ts): editor de personalização, cores existentes independentes no iframe, descartar e isolar por conta; sem salvar, enviar arquivos ou configurar domínios |
| [/dashboard/personalizacao/preview](../../apps/web/app/dashboard/personalizacao/preview/page.tsx) | Organizador · Proxy; ORGANIZER; onboarding, aprovação e aviso legal | — | [PublicCampaignView](../../apps/web/components/campaigns/PublicCampaignView.tsx) | [CampaignPublicChrome](../../apps/web/components/campaigns/CampaignPublicChrome.tsx), [PublicCampaignView](../../apps/web/components/campaigns/PublicCampaignView.tsx), [PurchasePanel](../../apps/web/components/purchases/PurchasePanel.tsx) | ? / ? / não rodado |
| [/dashboard/personalizacao/redes-sociais](../../apps/web/app/dashboard/personalizacao/redes-sociais/page.tsx) | Organizador · Proxy; ORGANIZER; onboarding, aprovação e aviso legal | — | [PersonalizationCenter](../../apps/web/components/organizer-platform/PersonalizationCenter.tsx) | [PersonalizationCenter](../../apps/web/components/organizer-platform/PersonalizationCenter.tsx) | ? / ? / não rodado |
| [/dashboard/promocoes](../../apps/web/app/dashboard/promocoes/page.tsx) | Organizador · Proxy; ORGANIZER; onboarding, aprovação e aviso legal | — | [PromotionsCenter](../../apps/web/components/growth/PromotionsCenter.tsx), [PremiumScope](../../apps/web/components/premium/PremiumScope.tsx) | [PromotionsCenter](../../apps/web/components/growth/PromotionsCenter.tsx) | verificado no recorte local / parcial / passou local · [ff07d71](../../apps/web/e2e/promotions-premium.spec.ts): lista, filtros, editor e validação sem gravar, teclado e isolamento; sem criar ou ativar promoção |
| [/dashboard/sorteios](../../apps/web/app/dashboard/sorteios/page.tsx) | Organizador · Proxy; ORGANIZER; onboarding, aprovação e aviso legal | — | [DrawWorkspace](../../apps/web/components/draws/DrawWorkspace.tsx) | [DrawWorkspace](../../apps/web/components/draws/DrawWorkspace.tsx) | verificado no recorte local / parcial / passou local · [4532bfc](../../apps/web/e2e/organizer-apuracao-premium.spec.ts): interface de apuração do organizador e acesso; resultado fictício verificado via GET separado, sem importar ou apurar |
| [/escolha](../../apps/web/app/escolha/page.tsx) | Acesso · Sem proxy de página; validações próprias do fluxo | re-exporta ../cadastro/page | [page](../../apps/web/app/cadastro/page.tsx) | — | verificado no recorte local / parcial / passou local · [4f38406](../../apps/web/e2e/registration-choice-premium.spec.ts): atalho mantido e testado para mesma escolha, teclado e validação vazia; sem criar conta |
| [/esqueci-senha](../../apps/web/app/esqueci-senha/page.tsx) | Acesso · Sem proxy de página; validações próprias do fluxo | — | [PasswordRecoveryAccessScope](../../apps/web/app/recuperar-senha/PasswordRecoveryAccessScope.tsx), [AuthShell](../../apps/web/components/auth/AuthShell.tsx) | [page](../../apps/web/app/esqueci-senha/page.tsx) | verificado no recorte local / parcial / passou local · [691cb10](../../apps/web/e2e/password-recovery-premium.spec.ts): solicitação de recuperação e validação local; sem disparar e-mail |
| [/juridico](../../apps/web/app/juridico/page.tsx) | Conta · RoleGate local BUYER/ORGANIZER/ADMIN da equipe; fora do proxy | — | [RoleGate](../../apps/web/components/auth/RoleGate.tsx), [LegalUserCenter](../../apps/web/components/legal/LegalUserCenter.tsx) | [LegalUserCenter](../../apps/web/components/legal/LegalUserCenter.tsx) | ? / ? / não rodado |
| [/login](../../apps/web/app/login/page.tsx) | Acesso · Sem proxy de página; validações próprias do fluxo | — | [AuthShell](../../apps/web/components/auth/AuthShell.tsx), [SocialAccess](../../apps/web/components/auth/SocialAccess.tsx), [PremiumScope](../../apps/web/components/premium/PremiumScope.tsx) | [page](../../apps/web/app/login/page.tsx) | verificado no recorte local / parcial / passou local · [b8d871c](../../apps/web/e2e/login-premium.spec.ts): entrada por e-mail, erro, teclado e redirecionamentos seguros; não ativou provedor social |
| [/mini-campanhas/\[slug\]](../../apps/web/app/mini-campanhas/%5Bslug%5D/page.tsx) | Campanha e prova pública · Sem proxy de página; regras e visibilidade dependem da API | — | [MiniCampaignReserve](../../apps/web/components/organizer-platform/MiniCampaignReserve.tsx) | [MiniCampaignReserve](../../apps/web/components/organizer-platform/MiniCampaignReserve.tsx) | ? / ? / não rodado |
| [/o/\[organizerId\]](../../apps/web/app/o/%5BorganizerId%5D/page.tsx) | Campanha e prova pública · Sem proxy de página; regras e visibilidade dependem da API | — | [OrganizerPublicHub](../../apps/web/components/public/OrganizerPublicHub.tsx) | — | ? / ? / não rodado |
| [/organizador/escolher-plano](../../apps/web/app/organizador/escolher-plano/page.tsx) | Organizador · Proxy; ORGANIZER (gate adicional na página) | — | [RoleGate](../../apps/web/components/auth/RoleGate.tsx), [PlanSelector](../../apps/web/components/organizer-platform/PlanSelector.tsx) | — | ? / ? / não rodado |
| [/organizador/gateways/mercado-pago](../../apps/web/app/organizador/gateways/mercado-pago/page.tsx) | Organizador · Proxy; ORGANIZER ou ADMIN da equipe | — | — | — | ? / ? / não rodado |
| [/organizador/midias](../../apps/web/app/organizador/midias/page.tsx) | Organizador · Proxy; ORGANIZER ou ADMIN da equipe | — | [MediaEditor](../../apps/web/components/media/MediaEditor.tsx), [ShareCenter](../../apps/web/components/media/ShareCenter.tsx) | — | ? / ? / não rodado |
| [/organizador/verificacao](../../apps/web/app/organizador/verificacao/page.tsx) | Organizador · Proxy; ORGANIZER ou ADMIN da equipe | — | [OrganizerVerificationWizard](../../apps/web/components/organizador/OrganizerVerificationWizard.tsx) | — | ? / ? / não rodado |
| [/](../../apps/web/app/page.tsx) | Institucional/público a revisar · Sem gate por rota identificado; reavaliar regras em novos destinos | — | [ProductHome](../../apps/web/components/marketing/ProductHome.tsx) | — | verificado no recorte local / parcial / passou local · [e25ef37](../../apps/web/e2e-local/run-public-home-hero-premium.mjs): somente topo público e seus atalhos, temas, foco e metadados; restantes da página preservados |
| [/perfil](../../apps/web/app/perfil/page.tsx) | Conta · Proxy; página carrega a própria conta; sem RoleGate de layout | — | — | [page](../../apps/web/app/perfil/page.tsx) | ? / ? / não rodado |
| [/preview/campaign/\[campaignId\]](../../apps/web/app/preview/campaign/%5BcampaignId%5D/page.tsx) | Prévia · Sem proxy de página; payload local do editor/iframe | — | [PublicCampaignView](../../apps/web/components/campaigns/PublicCampaignView.tsx) | [CampaignPublicChrome](../../apps/web/components/campaigns/CampaignPublicChrome.tsx), [PublicCampaignView](../../apps/web/components/campaigns/PublicCampaignView.tsx), [PurchasePanel](../../apps/web/components/purchases/PurchasePanel.tsx) | ? / ? / não rodado |
| [/privacidade](../../apps/web/app/privacidade/page.tsx) | Institucional/público a revisar · Sem gate por rota identificado; reavaliar regras em novos destinos | — | [InstitutionalBackButton](../../apps/web/components/public/InstitutionalBackButton.tsx) | — | ? / ? / não rodado |
| [/recuperar-senha](../../apps/web/app/recuperar-senha/page.tsx) | Acesso · Sem proxy de página; validações próprias do fluxo | — | [PasswordRecoveryAccessScope](../../apps/web/app/recuperar-senha/PasswordRecoveryAccessScope.tsx), [AuthShell](../../apps/web/components/auth/AuthShell.tsx) | [page](../../apps/web/app/recuperar-senha/page.tsx) | verificado no recorte local / parcial / passou local · [691cb10](../../apps/web/e2e/password-recovery-premium.spec.ts): entrada de redefinição, teclado e rejeição local de dados ausentes ou divergentes; não alterou senha |
| [/suporte](../../apps/web/app/suporte/page.tsx) | Institucional/público a revisar · Sem gate por rota identificado; reavaliar regras em novos destinos | — | [PremiumScope](../../apps/web/components/premium/PremiumScope.tsx) | — | verificado no recorte local / parcial / passou local · [61fd435](../../apps/web/e2e-local/run-public-support-premium.mjs): suporte público, tema e links originais; sem enviar mensagem, área do comprador independente |
| [/termos](../../apps/web/app/termos/page.tsx) | Institucional/público a revisar · Sem gate por rota identificado; reavaliar regras em novos destinos | — | [InstitutionalBackButton](../../apps/web/components/public/InstitutionalBackButton.tsx) | — | ? / ? / não rodado |
| [/teste](../../apps/web/app/teste/page.tsx) | Diagnóstico · Página interativa sem gate; revisar destino/intenção | — | — | — | ? / ? / não rodado |
| [/verificar/\[verificationCode\]](../../apps/web/app/verificar/%5BverificationCode%5D/page.tsx) | Campanha e prova pública · Sem proxy de página; regras e visibilidade dependem da API | — | [public-proof](../../apps/web/app/verificar/%5BverificationCode%5D/public-proof.ts) | — | ? / ? / não rodado |

## Manipuladores HTTP

Métodos explicitamente exportados; o OPTIONS automático do Next não é listado. Chamadas estruturais indicam pistas de sessão/upstream, **não** garantem proteção, permissão ou ausência dela. O fallback e subcaminhos Nest estão fora da contagem; consultar auditoria manual. Os redirects GET /r e /s não são páginas de interface.

| Padrão e fonte | Exporta | Sinais de sessão/upstream na fonte | Teste nesta auditoria |
|---|---|---|---|
| [/api/admin/finance/\[...path\]](../../apps/web/app/api/admin/finance/%5B...path%5D/route.ts) | GET, POST | `authenticatedApiFetch` | não rodado |
| [/api/admin/invitations/\[token\]/accept](../../apps/web/app/api/admin/invitations/%5Btoken%5D/accept/route.ts) | POST | `apiFetch` | não rodado |
| [/api/admin/invitations/\[token\]](../../apps/web/app/api/admin/invitations/%5Btoken%5D/route.ts) | GET | `apiFetch` | não rodado |
| [/api/admin/organizers/\[userId\]/commercial-terms](../../apps/web/app/api/admin/organizers/%5BuserId%5D/commercial-terms/route.ts) | PATCH | `authenticatedApiFetch` | não rodado |
| [/api/admin/platform/\[...path\]](../../apps/web/app/api/admin/platform/%5B...path%5D/route.ts) | GET, POST, PATCH | `authenticatedApiFetch` | não rodado |
| [/api/affiliates/\[...path\]](../../apps/web/app/api/affiliates/%5B...path%5D/route.ts) | GET, POST, PATCH, DELETE | `authenticatedApiFetch` | não rodado |
| [/api/auth/admin-login](../../apps/web/app/api/auth/admin-login/route.ts) | GET, POST | `apiFetch`, `clearAuthCookies`, `cookies`, `setAuthCookies` | não rodado |
| [/api/auth/checkout/complete](../../apps/web/app/api/auth/checkout/complete/route.ts) | POST | `authenticatedApiFetch` | não rodado |
| [/api/auth/checkout/start](../../apps/web/app/api/auth/checkout/start/route.ts) | POST | `apiFetch`, `cookies`, `setAuthCookies` | não rodado |
| [/api/auth/forgot-password](../../apps/web/app/api/auth/forgot-password/route.ts) | POST | `apiFetch` | não rodado |
| [/api/auth/login](../../apps/web/app/api/auth/login/route.ts) | GET, POST | `apiFetch`, `cookies`, `setAuthCookies` | não rodado |
| [/api/auth/logout](../../apps/web/app/api/auth/logout/route.ts) | POST | `apiFetch`, `clearAuthCookies`, `cookies` | não rodado |
| [/api/auth/me](../../apps/web/app/api/auth/me/route.ts) | GET | `apiFetch`, `clearAuthCookies`, `cookies`, `renewAuthSession` | não rodado |
| [/api/auth/refresh](../../apps/web/app/api/auth/refresh/route.ts) | POST | `cookies`, `renewAuthSession` | não rodado |
| [/api/auth/register](../../apps/web/app/api/auth/register/route.ts) | POST | `apiFetch` | não rodado |
| [/api/auth/reset-password](../../apps/web/app/api/auth/reset-password/route.ts) | POST | `apiFetch` | não rodado |
| [/api/auth/social/\[provider\]/callback](../../apps/web/app/api/auth/social/%5Bprovider%5D/callback/route.ts) | GET, POST | `apiFetch`, `cookies`, `setAuthCookies` | não rodado |
| [/api/auth/social/\[provider\]/start](../../apps/web/app/api/auth/social/%5Bprovider%5D/start/route.ts) | GET | `apiFetch`, `cookies` | não rodado |
| [/api/auth/social/complete](../../apps/web/app/api/auth/social/complete/route.ts) | POST | — | não rodado |
| [/api/auth/social/link](../../apps/web/app/api/auth/social/link/route.ts) | POST | — | não rodado |
| [/api/auth/social/pending](../../apps/web/app/api/auth/social/pending/route.ts) | GET | — | não rodado |
| [/api/auth/social/providers](../../apps/web/app/api/auth/social/providers/route.ts) | GET | `apiFetch` | não rodado |
| [/api/brand-assets/\[organizerId\]/\[kind\]](../../apps/web/app/api/brand-assets/%5BorganizerId%5D/%5Bkind%5D/route.ts) | GET | `apiFetch` | não rodado |
| [/api/buyer/\[...path\]](../../apps/web/app/api/buyer/%5B...path%5D/route.ts) | GET, POST, PATCH, DELETE | `authenticatedApiFetch` | não rodado |
| [/api/buyer/prizes](../../apps/web/app/api/buyer/prizes/route.ts) | GET | `authenticatedApiFetch` | não rodado |
| [/api/campaigns/\[id\]/duplicate](../../apps/web/app/api/campaigns/%5Bid%5D/duplicate/route.ts) | POST | `authenticatedApiFetch` | não rodado |
| [/api/campaigns/\[id\]/finish](../../apps/web/app/api/campaigns/%5Bid%5D/finish/route.ts) | POST | `authenticatedApiFetch` | não rodado |
| [/api/campaigns/\[id\]/images/\[imageId\]](../../apps/web/app/api/campaigns/%5Bid%5D/images/%5BimageId%5D/route.ts) | DELETE | `authenticatedApiFetch` | não rodado |
| [/api/campaigns/\[id\]/images](../../apps/web/app/api/campaigns/%5Bid%5D/images/route.ts) | POST | `authenticatedApiFetch` | não rodado |
| [/api/campaigns/\[id\]/media/\[...path\]](../../apps/web/app/api/campaigns/%5Bid%5D/media/%5B...path%5D/route.ts) | GET | `authenticatedApiFetch` | não rodado |
| [/api/campaigns/\[id\]/pause](../../apps/web/app/api/campaigns/%5Bid%5D/pause/route.ts) | POST | `authenticatedApiFetch` | não rodado |
| [/api/campaigns/\[id\]/publish](../../apps/web/app/api/campaigns/%5Bid%5D/publish/route.ts) | POST | `authenticatedApiFetch` | não rodado |
| [/api/campaigns/\[id\]](../../apps/web/app/api/campaigns/%5Bid%5D/route.ts) | GET, PATCH, DELETE | `authenticatedApiFetch` | não rodado |
| [/api/campaigns/my](../../apps/web/app/api/campaigns/my/route.ts) | GET | `authenticatedApiFetch` | não rodado |
| [/api/campaigns](../../apps/web/app/api/campaigns/route.ts) | POST | `authenticatedApiFetch` | não rodado |
| [/api/crm/\[...path\]](../../apps/web/app/api/crm/%5B...path%5D/route.ts) | GET, POST, PATCH, DELETE | `authenticatedApiFetch` | não rodado |
| [/api/dashboard/period](../../apps/web/app/api/dashboard/period/route.ts) | GET | `authenticatedApiFetch` | não rodado |
| [/api/dashboard](../../apps/web/app/api/dashboard/route.ts) | GET | `authenticatedApiFetch` | não rodado |
| [/api/draw-rule-templates](../../apps/web/app/api/draw-rule-templates/route.ts) | GET, POST | `authenticatedApiFetch` | não rodado |
| [/api/draw-rule-templates/simulate](../../apps/web/app/api/draw-rule-templates/simulate/route.ts) | POST | `authenticatedApiFetch` | não rodado |
| [/api/draws/\[...path\]](../../apps/web/app/api/draws/%5B...path%5D/route.ts) | GET, POST, PATCH | — | não rodado |
| [/api/engagement/\[...path\]](../../apps/web/app/api/engagement/%5B...path%5D/route.ts) | GET, POST, PATCH, DELETE | `authenticatedApiFetch` | não rodado |
| [/api/finance/\[...path\]](../../apps/web/app/api/finance/%5B...path%5D/route.ts) | GET, POST | `authenticatedApiFetch` | não rodado |
| [/api/health/ready](../../apps/web/app/api/health/ready/route.ts) | GET | `apiFetch` | não rodado |
| [/api/legal/\[...path\]](../../apps/web/app/api/legal/%5B...path%5D/route.ts) | GET, POST, PUT, PATCH, DELETE | — | não rodado |
| [/api/location/cep/\[cep\]](../../apps/web/app/api/location/cep/%5Bcep%5D/route.ts) | GET | `apiFetch`, `fetch` | não rodado |
| [/api/location/states/\[uf\]/cities](../../apps/web/app/api/location/states/%5Buf%5D/cities/route.ts) | GET | `apiFetch` | não rodado |
| [/api/location/states](../../apps/web/app/api/location/states/route.ts) | GET | `apiFetch` | não rodado |
| [/api/media/\[...path\]](../../apps/web/app/api/media/%5B...path%5D/route.ts) | GET, POST, PATCH, DELETE | `authenticatedApiFetch` | não rodado |
| [/api/organizer/\[...path\]](../../apps/web/app/api/organizer/%5B...path%5D/route.ts) | GET, POST, PUT, PATCH, DELETE | `authenticatedApiFetch` | não rodado |
| [/api/organizer/account](../../apps/web/app/api/organizer/account/route.ts) | PATCH | `authenticatedApiFetch` | não rodado |
| [/api/organizer/documents/\[documentId\]/file](../../apps/web/app/api/organizer/documents/%5BdocumentId%5D/file/route.ts) | GET | `authenticatedApiFetch` | não rodado |
| [/api/organizer/documents](../../apps/web/app/api/organizer/documents/route.ts) | POST | `authenticatedApiFetch` | não rodado |
| [/api/organizer/logo/\[userId\]](../../apps/web/app/api/organizer/logo/%5BuserId%5D/route.ts) | GET | `apiFetch` | não rodado |
| [/api/organizer/logo](../../apps/web/app/api/organizer/logo/route.ts) | POST | `authenticatedApiFetch` | não rodado |
| [/api/organizer/profile](../../apps/web/app/api/organizer/profile/route.ts) | GET, PATCH | `authenticatedApiFetch` | não rodado |
| [/api/organizer/submit](../../apps/web/app/api/organizer/submit/route.ts) | POST | `authenticatedApiFetch` | não rodado |
| [/api/payments/\[id\]/cancel](../../apps/web/app/api/payments/%5Bid%5D/cancel/route.ts) | POST | `authenticatedApiFetch` | não rodado |
| [/api/payments/\[id\]/refresh](../../apps/web/app/api/payments/%5Bid%5D/refresh/route.ts) | POST | `authenticatedApiFetch` | não rodado |
| [/api/payments/\[id\]/refund-request](../../apps/web/app/api/payments/%5Bid%5D/refund-request/route.ts) | POST | `authenticatedApiFetch` | não rodado |
| [/api/payments/\[id\]](../../apps/web/app/api/payments/%5Bid%5D/route.ts) | GET | `authenticatedApiFetch` | não rodado |
| [/api/payments/card](../../apps/web/app/api/payments/card/route.ts) | POST | `authenticatedApiFetch` | não rodado |
| [/api/payments/config](../../apps/web/app/api/payments/config/route.ts) | GET | `authenticatedApiFetch` | não rodado |
| [/api/payments/my](../../apps/web/app/api/payments/my/route.ts) | GET | `authenticatedApiFetch` | não rodado |
| [/api/payments/organizer/summary](../../apps/web/app/api/payments/organizer/summary/route.ts) | GET | `authenticatedApiFetch` | não rodado |
| [/api/payments/pix](../../apps/web/app/api/payments/pix/route.ts) | POST | `authenticatedApiFetch` | não rodado |
| [/api/payments/purchase/\[purchaseId\]](../../apps/web/app/api/payments/purchase/%5BpurchaseId%5D/route.ts) | GET | `authenticatedApiFetch` | não rodado |
| [/api/plans/\[...path\]](../../apps/web/app/api/plans/%5B...path%5D/route.ts) | GET, POST, PATCH, DELETE | `authenticatedApiFetch` | não rodado |
| [/api/platform/\[...path\]](../../apps/web/app/api/platform/%5B...path%5D/route.ts) | GET, POST, PUT, PATCH, DELETE | `authenticatedApiFetch` | não rodado |
| [/api/platform/organizer/personalization/assets/\[kind\]](../../apps/web/app/api/platform/organizer/personalization/assets/%5Bkind%5D/route.ts) | POST | `authenticatedApiFetch` | não rodado |
| [/api/platform/sortex-ads/confirmed-sales](../../apps/web/app/api/platform/sortex-ads/confirmed-sales/route.ts) | GET | `authenticatedApiFetch` | não rodado |
| [/api/public/campaign-media/\[...path\]](../../apps/web/app/api/public/campaign-media/%5B...path%5D/route.ts) | GET | `apiFetch` | não rodado |
| [/api/public/campaigns/\[slug\]/availability](../../apps/web/app/api/public/campaigns/%5Bslug%5D/availability/route.ts) | GET | `apiFetch` | não rodado |
| [/api/public/campaigns/\[slug\]/numbers](../../apps/web/app/api/public/campaigns/%5Bslug%5D/numbers/route.ts) | GET | `apiFetch` | não rodado |
| [/api/public/campaigns/\[slug\]/promotions](../../apps/web/app/api/public/campaigns/%5Bslug%5D/promotions/route.ts) | GET | `apiFetch` | não rodado |
| [/api/public/campaigns/\[slug\]](../../apps/web/app/api/public/campaigns/%5Bslug%5D/route.ts) | GET | `apiFetch` | não rodado |
| [/api/public/campaigns](../../apps/web/app/api/public/campaigns/route.ts) | GET | `apiFetch` | não rodado |
| [/api/public/organizers/\[organizerId\]](../../apps/web/app/api/public/organizers/%5BorganizerId%5D/route.ts) | GET | `apiFetch` | não rodado |
| [/api/public/winners/verify/\[code\]](../../apps/web/app/api/public/winners/verify/%5Bcode%5D/route.ts) | GET | `apiFetch` | não rodado |
| [/api/purchases/\[id\]/cancel](../../apps/web/app/api/purchases/%5Bid%5D/cancel/route.ts) | POST | `authenticatedApiFetch` | não rodado |
| [/api/purchases/\[id\]](../../apps/web/app/api/purchases/%5Bid%5D/route.ts) | GET | `authenticatedApiFetch` | não rodado |
| [/api/purchases/\[id\]/tickets](../../apps/web/app/api/purchases/%5Bid%5D/tickets/route.ts) | GET | `authenticatedApiFetch` | não rodado |
| [/api/purchases/current](../../apps/web/app/api/purchases/current/route.ts) | GET | `authenticatedApiFetch` | não rodado |
| [/api/purchases/my](../../apps/web/app/api/purchases/my/route.ts) | GET | `authenticatedApiFetch` | não rodado |
| [/api/purchases/organizer/\[...path\]](../../apps/web/app/api/purchases/organizer/%5B...path%5D/route.ts) | GET, POST | `authenticatedApiFetch` | não rodado |
| [/api/purchases/organizer/summary](../../apps/web/app/api/purchases/organizer/summary/route.ts) | GET | `authenticatedApiFetch` | não rodado |
| [/api/purchases/reserve-manual](../../apps/web/app/api/purchases/reserve-manual/route.ts) | POST | `authenticatedApiFetch` | não rodado |
| [/api/purchases/reserve-random](../../apps/web/app/api/purchases/reserve-random/route.ts) | POST | `authenticatedApiFetch` | não rodado |
| [/r/\[slug\]](../../apps/web/app/r/%5Bslug%5D/route.ts) | GET | `NextResponse.redirect`, `fetch` | não rodado |
| [/s/\[code\]](../../apps/web/app/s/%5Bcode%5D/route.ts) | GET | `NextResponse.redirect`, `fetch` | não rodado |

## Layouts, estados e endpoints de metadados

| Tipo e escopo | Imports locais diretos | Teste nesta auditoria |
|---|---|---|
| [layout · /admin](../../apps/web/app/admin/layout.tsx) | [AdminShell](../../apps/web/components/admin/AdminShell.tsx), [RoleGate](../../apps/web/components/auth/RoleGate.tsx) | não rodado |
| [layout · /afiliado](../../apps/web/app/afiliado/layout.tsx) | — | não rodado |
| [layout · /cadastro](../../apps/web/app/cadastro/layout.tsx) | — | não rodado |
| [not-found · /campanha/\[slug\]](../../apps/web/app/campanha/%5Bslug%5D/not-found.tsx) | — | não rodado |
| [layout · /comprador](../../apps/web/app/comprador/layout.tsx) | [RoleGate](../../apps/web/components/auth/RoleGate.tsx), [LegalAcceptanceGate](../../apps/web/components/legal/LegalAcceptanceGate.tsx) | não rodado |
| [layout · /dashboard](../../apps/web/app/dashboard/layout.tsx) | [RoleGate](../../apps/web/components/auth/RoleGate.tsx), [Sidebar](../../apps/web/components/dashboard/Sidebar.tsx), [LegalAcceptanceGate](../../apps/web/components/legal/LegalAcceptanceGate.tsx), [OrganizerApprovalGate](../../apps/web/components/organizador/OrganizerApprovalGate.tsx), [OrganizerOnboardingGate](../../apps/web/components/organizer-platform/OrganizerOnboardingGate.tsx) | não rodado |
| [layout · /](../../apps/web/app/layout.tsx) | — | não rodado |
| [layout · /login](../../apps/web/app/login/layout.tsx) | — | não rodado |
| [not-found · /mini-campanhas/\[slug\]](../../apps/web/app/mini-campanhas/%5Bslug%5D/not-found.tsx) | — | não rodado |
| [layout · /organizador](../../apps/web/app/organizador/layout.tsx) | [RoleGate](../../apps/web/components/auth/RoleGate.tsx) | não rodado |
| [robots · /robots.txt](../../apps/web/app/robots.ts) | — | não rodado |
| [sitemap · /sitemap.xml](../../apps/web/app/sitemap.ts) | — | não rodado |
| [/favicon.ico · arquivo especial](../../apps/web/app/favicon.ico) | — | não rodado |

## Catálogo de superfície em fontes da Web

O grafo segue imports estáticos de valor e reexports locais de App Router e components, inclusive de componentes transitivos e layouts. Marcadores são tags JSX únicas por fonte (inclusive roles literais de tabela/diálogo); não significam que o controle aparece para todo usuário, recebe dados reais ou executa a ação. Alguns modais inline, imports dinâmicos, wrappers genéricos, conteúdo condicional/imperativo, elementos de libs e validação de campo exigem leitura da fonte e inspeção em navegador. As dependências comuns dos layouts são registradas separadamente; os componentes não alcançados por este grafo também permanecem no catálogo.

| Fonte | Alcançável no grafo | Formulários | Tabelas | Diálogos/sobreposições | Controles JSX |
|---|---|---|---|---|---|
| [app/admin/auditoria/page.tsx](../../apps/web/app/admin/auditoria/page.tsx) | fonte App Router | `form` | — | — | `button`, `input` |
| [app/admin/convite/\[token\]/page.tsx](../../apps/web/app/admin/convite/%5Btoken%5D/page.tsx) | fonte App Router | `form` | — | — | `button`, `input` |
| [app/admin/equipe/\[id\]/page.tsx](../../apps/web/app/admin/equipe/%5Bid%5D/page.tsx) | fonte App Router | — | — | — | `button`, `select` |
| [app/admin/login/page.tsx](../../apps/web/app/admin/login/page.tsx) | fonte App Router | `form` | — | — | `button`, `input` |
| [app/admin/organizadores/\[id\]/page.tsx](../../apps/web/app/admin/organizadores/%5Bid%5D/page.tsx) | fonte App Router | — | — | — | `Button`, `Input`, `Link`, `Textarea`, `a`, `button`, `input`, `select` |
| [app/admin/organizadores/page.tsx](../../apps/web/app/admin/organizadores/page.tsx) | fonte App Router | `form` | — | — | `Link`, `Select`, `button`, `input`, `select` |
| [app/afiliado/convite/AffiliateInvitation.tsx](../../apps/web/app/afiliado/convite/AffiliateInvitation.tsx) | fonte App Router | — | — | — | `Link`, `button` |
| [app/afiliado/page.tsx](../../apps/web/app/afiliado/page.tsx) | fonte App Router | — | — | — | `Link`, `button` |
| [app/cadastro/comprador/page.tsx](../../apps/web/app/cadastro/comprador/page.tsx) | fonte App Router | `RegistrationForm` | — | — | — |
| [app/cadastro/organizador/confirmacao/page.tsx](../../apps/web/app/cadastro/organizador/confirmacao/page.tsx) | fonte App Router | — | — | — | `button` |
| [app/cadastro/organizador/financeiro/page.tsx](../../apps/web/app/cadastro/organizador/financeiro/page.tsx) | fonte App Router | — | — | — | `Link` |
| [app/cadastro/organizador/page.tsx](../../apps/web/app/cadastro/organizador/page.tsx) | fonte App Router | `RegistrationForm` | — | — | — |
| [app/cadastro/page.tsx](../../apps/web/app/cadastro/page.tsx) | fonte App Router | — | — | — | `Link` |
| [app/cadastro/sucesso-comprador/page.tsx](../../apps/web/app/cadastro/sucesso-comprador/page.tsx) | fonte App Router | — | — | — | `Link` |
| [app/cadastro/sucesso-organizador/page.tsx](../../apps/web/app/cadastro/sucesso-organizador/page.tsx) | fonte App Router | — | — | — | `Link` |
| [app/cadastro/sucesso/page.tsx](../../apps/web/app/cadastro/sucesso/page.tsx) | fonte App Router | — | — | — | `Link` |
| [app/campanha/\[slug\]/not-found.tsx](../../apps/web/app/campanha/%5Bslug%5D/not-found.tsx) | fonte App Router | — | — | — | `Link` |
| [app/comprador/checkout/\[id\]/page.tsx](../../apps/web/app/comprador/checkout/%5Bid%5D/page.tsx) | fonte App Router | — | — | — | `Link`, `button`, `input` |
| [app/comprador/compras/\[id\]/page.tsx](../../apps/web/app/comprador/compras/%5Bid%5D/page.tsx) | fonte App Router | — | — | — | `Link`, `button` |
| [app/comprador/favoritos/page.tsx](../../apps/web/app/comprador/favoritos/page.tsx) | fonte App Router | — | — | — | `Link`, `button` |
| [app/comprador/layout.tsx](../../apps/web/app/comprador/layout.tsx) | fonte App Router | — | — | — | `Link` |
| [app/comprador/meus-numeros/page.tsx](../../apps/web/app/comprador/meus-numeros/page.tsx) | fonte App Router | — | — | — | `Link`, `button` |
| [app/comprador/notificacoes/page.tsx](../../apps/web/app/comprador/notificacoes/page.tsx) | fonte App Router | — | — | — | `button` |
| [app/comprador/pagamento/sucesso/\[id\]/page.tsx](../../apps/web/app/comprador/pagamento/sucesso/%5Bid%5D/page.tsx) | fonte App Router | — | — | — | `Button`, `Link`, `input`, `select` |
| [app/comprador/page.tsx](../../apps/web/app/comprador/page.tsx) | fonte App Router | — | — | — | `Link`, `button` |
| [app/comprador/perfil/page.tsx](../../apps/web/app/comprador/perfil/page.tsx) | fonte App Router | `form` | — | — | `Link`, `button`, `input` |
| [app/comprador/resultados/page.tsx](../../apps/web/app/comprador/resultados/page.tsx) | fonte App Router | — | — | — | `Link`, `button` |
| [app/comprador/sorteios/page.tsx](../../apps/web/app/comprador/sorteios/page.tsx) | fonte App Router | — | — | — | `Link`, `button`, `input`, `select` |
| [app/comprador/suporte/page.tsx](../../apps/web/app/comprador/suporte/page.tsx) | fonte App Router | `form` | — | — | `button`, `input`, `select`, `textarea` |
| [app/contato/page.tsx](../../apps/web/app/contato/page.tsx) | fonte App Router | — | — | — | `Link` |
| [app/dashboard/comunicacao/page.tsx](../../apps/web/app/dashboard/comunicacao/page.tsx) | fonte App Router | `form` | — | — | `a`, `button`, `input`, `select`, `textarea` |
| [app/dashboard/configuracoes/page.tsx](../../apps/web/app/dashboard/configuracoes/page.tsx) | fonte App Router | — | — | — | `Link` |
| [app/dashboard/crm/automacoes/page.tsx](../../apps/web/app/dashboard/crm/automacoes/page.tsx) | fonte App Router | `form` | — | — | `button`, `input`, `select`, `textarea` |
| [app/dashboard/crm/contatos/\[id\]/page.tsx](../../apps/web/app/dashboard/crm/contatos/%5Bid%5D/page.tsx) | fonte App Router | `form` | — | — | `Link`, `button`, `input`, `select`, `textarea` |
| [app/dashboard/crm/contatos/page.tsx](../../apps/web/app/dashboard/crm/contatos/page.tsx) | fonte App Router | — | `table` | — | `Link`, `button`, `input`, `select` |
| [app/dashboard/crm/page.tsx](../../apps/web/app/dashboard/crm/page.tsx) | fonte App Router | — | — | — | `Link`, `a`, `button` |
| [app/dashboard/crm/segmentos/page.tsx](../../apps/web/app/dashboard/crm/segmentos/page.tsx) | fonte App Router | `form` | — | `div` | `Link`, `button`, `input`, `select`, `textarea` |
| [app/dashboard/crm/tarefas/page.tsx](../../apps/web/app/dashboard/crm/tarefas/page.tsx) | fonte App Router | `form` | — | — | `button`, `input`, `select`, `textarea` |
| [app/dashboard/mini-campanhas/\[id\]/page.tsx](../../apps/web/app/dashboard/mini-campanhas/%5Bid%5D/page.tsx) | fonte App Router | `form` | — | — | `Link`, `button`, `input` |
| [app/dashboard/mini-campanhas/page.tsx](../../apps/web/app/dashboard/mini-campanhas/page.tsx) | fonte App Router | `form` | — | `dialog` | `Link`, `a`, `button`, `input`, `select`, `textarea` |
| [app/dashboard/pedidos/\[id\]/page.tsx](../../apps/web/app/dashboard/pedidos/%5Bid%5D/page.tsx) | fonte App Router | — | — | — | `Link`, `button` |
| [app/dashboard/pedidos/page.tsx](../../apps/web/app/dashboard/pedidos/page.tsx) | fonte App Router | — | `table` | `OrderDrawer`, `dialog` | `Link`, `button`, `input`, `select` |
| [app/esqueci-senha/page.tsx](../../apps/web/app/esqueci-senha/page.tsx) | fonte App Router | `form` | — | — | `button`, `input` |
| [app/login/page.tsx](../../apps/web/app/login/page.tsx) | fonte App Router | `LoginForm`, `form` | — | — | `Link`, `button`, `input` |
| [app/mini-campanhas/\[slug\]/not-found.tsx](../../apps/web/app/mini-campanhas/%5Bslug%5D/not-found.tsx) | fonte App Router | — | — | — | `Link` |
| [app/mini-campanhas/\[slug\]/page.tsx](../../apps/web/app/mini-campanhas/%5Bslug%5D/page.tsx) | fonte App Router | — | — | — | `Link` |
| [app/organizador/gateways/mercado-pago/page.tsx](../../apps/web/app/organizador/gateways/mercado-pago/page.tsx) | fonte App Router | — | — | — | `Link` |
| [app/organizador/midias/page.tsx](../../apps/web/app/organizador/midias/page.tsx) | fonte App Router | — | — | — | `button` |
| [app/perfil/page.tsx](../../apps/web/app/perfil/page.tsx) | fonte App Router | `form` | — | — | `a`, `button`, `input` |
| [app/recuperar-senha/page.tsx](../../apps/web/app/recuperar-senha/page.tsx) | fonte App Router | `ResetPasswordForm`, `form` | — | — | `Link`, `button`, `input` |
| [app/suporte/page.tsx](../../apps/web/app/suporte/page.tsx) | fonte App Router | — | — | — | `Link` |
| [app/teste/page.tsx](../../apps/web/app/teste/page.tsx) | fonte App Router | — | — | — | `button` |
| [app/verificar/\[verificationCode\]/page.tsx](../../apps/web/app/verificar/%5BverificationCode%5D/page.tsx) | fonte App Router | — | — | — | `Link`, `a`, `button`, `input` |
| [components/Features.tsx](../../apps/web/components/Features.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/Footer.tsx](../../apps/web/components/Footer.tsx) | não encontrado estaticamente | — | — | — | `Link`, `a` |
| [components/Header.tsx](../../apps/web/components/Header.tsx) | não encontrado estaticamente | — | — | — | `Link` |
| [components/Hero.tsx](../../apps/web/components/Hero.tsx) | não encontrado estaticamente | — | — | — | `button` |
| [components/NumbersGrid.tsx](../../apps/web/components/NumbersGrid.tsx) | não encontrado estaticamente | — | — | — | `button` |
| [components/Stats.tsx](../../apps/web/components/Stats.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/admin/AdminApprovalsCenter.tsx](../../apps/web/components/admin/AdminApprovalsCenter.tsx) | sim | `form` | — | — | `Link`, `Select`, `button`, `input`, `select` |
| [components/admin/AdminDashboard.tsx](../../apps/web/components/admin/AdminDashboard.tsx) | sim | — | — | — | `button`, `select` |
| [components/admin/AdminExistingModuleCenter.tsx](../../apps/web/components/admin/AdminExistingModuleCenter.tsx) | sim | — | `table` | — | `button`, `input` |
| [components/admin/AdminManagement.tsx](../../apps/web/components/admin/AdminManagement.tsx) | sim | `form` | — | — | `Link`, `button`, `input`, `select` |
| [components/admin/AdminOperationsCenter.tsx](../../apps/web/components/admin/AdminOperationsCenter.tsx) | sim | — | `table` | — | `button`, `input` |
| [components/admin/AdminResourcePage.tsx](../../apps/web/components/admin/AdminResourcePage.tsx) | sim | — | `ResourceTable`, `table` | `DetailDrawer`, `div` | `button`, `input`, `select` |
| [components/admin/AdminShell.tsx](../../apps/web/components/admin/AdminShell.tsx) | sim | — | — | — | `Link`, `button` |
| [components/admin/AdminTeamCenter.tsx](../../apps/web/components/admin/AdminTeamCenter.tsx) | sim | `form` | — | — | `Link`, `button`, `input`, `select`, `textarea` |
| [components/auth/AuthShell.tsx](../../apps/web/components/auth/AuthShell.tsx) | sim | — | — | — | `Link` |
| [components/auth/RegistrationForm.tsx](../../apps/web/components/auth/RegistrationForm.tsx) | sim | `form` | — | — | `Link`, `button`, `input` |
| [components/auth/RoleGate.tsx](../../apps/web/components/auth/RoleGate.tsx) | sim | — | — | — | `button` |
| [components/auth/SocialAccess.tsx](../../apps/web/components/auth/SocialAccess.tsx) | sim | — | — | — | `a`, `button` |
| [components/auth/SocialCompletion.tsx](../../apps/web/components/auth/SocialCompletion.tsx) | sim | `RegistrationForm` | — | — | `Link`, `button`, `input` |
| [components/campaign/countdow.tsx](../../apps/web/components/campaign/countdow.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/campaign/numbergrid.tsx](../../apps/web/components/campaign/numbergrid.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/campaign/prizecard.tsx](../../apps/web/components/campaign/prizecard.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/campaign/purchasesummary.tsx](../../apps/web/components/campaign/purchasesummary.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/campaign/rules.tsx](../../apps/web/components/campaign/rules.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/campaign/winnercard.tsx](../../apps/web/components/campaign/winnercard.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/campaigns/CampaignDashboard.tsx](../../apps/web/components/campaigns/CampaignDashboard.tsx) | sim | — | — | — | `Link`, `button`, `input` |
| [components/campaigns/CampaignPublicChrome.tsx](../../apps/web/components/campaigns/CampaignPublicChrome.tsx) | sim | — | — | `aside`, `section` | `Link`, `a`, `button` |
| [components/campaigns/CampaignPublicLink.tsx](../../apps/web/components/campaigns/CampaignPublicLink.tsx) | sim | — | — | — | `a`, `button`, `input` |
| [components/campaigns/CampaignPublishedSuccess.tsx](../../apps/web/components/campaigns/CampaignPublishedSuccess.tsx) | sim | — | — | — | `Link`, `a` |
| [components/campaigns/CampaignShare.tsx](../../apps/web/components/campaigns/CampaignShare.tsx) | sim | — | — | — | `a`, `button` |
| [components/campaigns/CampaignWizard.tsx](../../apps/web/components/campaigns/CampaignWizard.tsx) | sim | — | `table` | `div`, `section` | `Button`, `Input`, `Select`, `Textarea`, `button`, `input`, `select` |
| [components/campaigns/DrawRuleBuilder.tsx](../../apps/web/components/campaigns/DrawRuleBuilder.tsx) | sim | — | — | — | `Button`, `Input`, `select` |
| [components/campaigns/FinancialSimulator.tsx](../../apps/web/components/campaigns/FinancialSimulator.tsx) | sim | — | — | — | — |
| [components/campaigns/PublicCampaignView.tsx](../../apps/web/components/campaigns/PublicCampaignView.tsx) | sim | — | `table` | — | `Link`, `button` |
| [components/campaigns/WinnerLookupCenter.tsx](../../apps/web/components/campaigns/WinnerLookupCenter.tsx) | sim | — | — | — | `Link`, `button`, `input`, `select` |
| [components/communication/SmartCommunicationTools.tsx](../../apps/web/components/communication/SmartCommunicationTools.tsx) | sim | — | — | `div` | `button`, `input`, `select` |
| [components/comprador/BottomNavigation.tsx](../../apps/web/components/comprador/BottomNavigation.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/comprador/BuyerPrizes.tsx](../../apps/web/components/comprador/BuyerPrizes.tsx) | sim | — | — | — | `Link`, `button` |
| [components/comprador/CampaignCard.tsx](../../apps/web/components/comprador/CampaignCard.tsx) | sim | — | — | — | `Link` |
| [components/comprador/Favorites.tsx](../../apps/web/components/comprador/Favorites.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/comprador/Header.tsx](../../apps/web/components/comprador/Header.tsx) | não encontrado estaticamente | — | — | — | `Link`, `button` |
| [components/comprador/MyRaffles.tsx](../../apps/web/components/comprador/MyRaffles.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/comprador/PromotionCard.tsx](../../apps/web/components/comprador/PromotionCard.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/comprador/Promotions.tsx](../../apps/web/components/comprador/Promotions.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/comprador/QuickActions.tsx](../../apps/web/components/comprador/QuickActions.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/comprador/RaffleCard.tsx](../../apps/web/components/comprador/RaffleCard.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/comprador/RecommendationCard.tsx](../../apps/web/components/comprador/RecommendationCard.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/comprador/Recommendations.tsx](../../apps/web/components/comprador/Recommendations.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/comprador/Results.tsx](../../apps/web/components/comprador/Results.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/comprador/WalletCard.tsx](../../apps/web/components/comprador/WalletCard.tsx) | não encontrado estaticamente | — | — | — | `button` |
| [components/crm/AbandonedReservationsAnalysis.tsx](../../apps/web/components/crm/AbandonedReservationsAnalysis.tsx) | sim | — | — | — | `Link`, `button`, `input`, `select` |
| [components/crm/AutomationShortcutLink.tsx](../../apps/web/components/crm/AutomationShortcutLink.tsx) | sim | — | — | — | `Link`, `a` |
| [components/crm/CrmNav.tsx](../../apps/web/components/crm/CrmNav.tsx) | sim | — | — | — | `Link` |
| [components/dashboard/AIInsights.tsx](../../apps/web/components/dashboard/AIInsights.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/AIInsightsCard.tsx](../../apps/web/components/dashboard/AIInsightsCard.tsx) | não encontrado estaticamente | — | — | — | `button` |
| [components/dashboard/Ads.tsx](../../apps/web/components/dashboard/Ads.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/AdsCard.tsx](../../apps/web/components/dashboard/AdsCard.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/Affiliates.tsx](../../apps/web/components/dashboard/Affiliates.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/BottomCards.tsx](../../apps/web/components/dashboard/BottomCards.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/CRM.tsx](../../apps/web/components/dashboard/CRM.tsx) | não encontrado estaticamente | — | — | — | `button` |
| [components/dashboard/CRMCustomerTable.tsx](../../apps/web/components/dashboard/CRMCustomerTable.tsx) | não encontrado estaticamente | — | — | — | `button` |
| [components/dashboard/CRMInsights.tsx](../../apps/web/components/dashboard/CRMInsights.tsx) | não encontrado estaticamente | — | — | — | `button` |
| [components/dashboard/Calendar.tsx](../../apps/web/components/dashboard/Calendar.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/CommunicationCard.tsx](../../apps/web/components/dashboard/CommunicationCard.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/Communications.tsx](../../apps/web/components/dashboard/Communications.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/CrmCard.tsx](../../apps/web/components/dashboard/CrmCard.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/DashboardLayout.tsx](../../apps/web/components/dashboard/DashboardLayout.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/DashboardModulePage.tsx](../../apps/web/components/dashboard/DashboardModulePage.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/DashboardPeriodMetrics.tsx](../../apps/web/components/dashboard/DashboardPeriodMetrics.tsx) | sim | `form` | — | — | `button`, `input` |
| [components/dashboard/FinancialOverview.tsx](../../apps/web/components/dashboard/FinancialOverview.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/GrowthCenter.tsx](../../apps/web/components/dashboard/GrowthCenter.tsx) | não encontrado estaticamente | — | — | — | `button` |
| [components/dashboard/Header.tsx](../../apps/web/components/dashboard/Header.tsx) | não encontrado estaticamente | — | — | — | `button`, `input` |
| [components/dashboard/IntelligenceCard.tsx](../../apps/web/components/dashboard/IntelligenceCard.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/Notifications.tsx](../../apps/web/components/dashboard/Notifications.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/OrganizerDashboard.tsx](../../apps/web/components/dashboard/OrganizerDashboard.tsx) | sim | — | — | — | `Link` |
| [components/dashboard/RecentCampaigns.tsx](../../apps/web/components/dashboard/RecentCampaigns.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/RevenueCard.tsx](../../apps/web/components/dashboard/RevenueCard.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/Sidebar.tsx](../../apps/web/components/dashboard/Sidebar.tsx) | sim | — | — | `section` | `Link`, `button` |
| [components/dashboard/SorteXCopilot.tsx](../../apps/web/components/dashboard/SorteXCopilot.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/StatsCards.tsx](../../apps/web/components/dashboard/StatsCards.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/StatsGrid.tsx](../../apps/web/components/dashboard/StatsGrid.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/TurboCard.tsx](../../apps/web/components/dashboard/TurboCard.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/TurboMode.tsx](../../apps/web/components/dashboard/TurboMode.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/WalletCard.tsx](../../apps/web/components/dashboard/WalletCard.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/activityfeed.tsx](../../apps/web/components/dashboard/activityfeed.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/ads/AdsCampaign.tsx](../../apps/web/components/dashboard/ads/AdsCampaign.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/ads/AdsCenter.tsx](../../apps/web/components/dashboard/ads/AdsCenter.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/ads/AdsDashboard.tsx](../../apps/web/components/dashboard/ads/AdsDashboard.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/ads/AdsSuggestions.tsx](../../apps/web/components/dashboard/ads/AdsSuggestions.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/affiliate/AffiliateCommission.tsx](../../apps/web/components/dashboard/affiliate/AffiliateCommission.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/affiliate/AffiliateRanking.tsx](../../apps/web/components/dashboard/affiliate/AffiliateRanking.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/affiliate/AffiliatesCenter.tsx](../../apps/web/components/dashboard/affiliate/AffiliatesCenter.tsx) | sim | `form` | — | — | `button`, `input`, `select`, `textarea` |
| [components/dashboard/ai/AIActions.tsx](../../apps/web/components/dashboard/ai/AIActions.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/ai/AIChat.tsx](../../apps/web/components/dashboard/ai/AIChat.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/ai/AICopilot.tsx](../../apps/web/components/dashboard/ai/AICopilot.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/ai/AITimeline.tsx](../../apps/web/components/dashboard/ai/AITimeline.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/analytics/BusinessHealth.tsx](../../apps/web/components/dashboard/analytics/BusinessHealth.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/analytics/FunnelChart.tsx](../../apps/web/components/dashboard/analytics/FunnelChart.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/analytics/SalesForecast.tsx](../../apps/web/components/dashboard/analytics/SalesForecast.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/campaigns/CampaignGrid.tsx](../../apps/web/components/dashboard/campaigns/CampaignGrid.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/campaigns/CampaignRow.tsx](../../apps/web/components/dashboard/campaigns/CampaignRow.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/campaigns/CampaignStatus.tsx](../../apps/web/components/dashboard/campaigns/CampaignStatus.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/campaigns/CampaignTable.tsx](../../apps/web/components/dashboard/campaigns/CampaignTable.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/cards/statcard.tsx](../../apps/web/components/dashboard/cards/statcard.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/common/ActivityFeed.tsx](../../apps/web/components/dashboard/common/ActivityFeed.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/common/PageHeader.tsx](../../apps/web/components/dashboard/common/PageHeader.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/common/QuickActions.tsx](../../apps/web/components/dashboard/common/QuickActions.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/common/StatCard.tsx](../../apps/web/components/dashboard/common/StatCard.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/copilot/CopilotPanel.tsx](../../apps/web/components/dashboard/copilot/CopilotPanel.tsx) | não encontrado estaticamente | — | — | — | `button`, `textarea` |
| [components/dashboard/copilot/MissionCard.tsx](../../apps/web/components/dashboard/copilot/MissionCard.tsx) | não encontrado estaticamente | — | — | — | `button` |
| [components/dashboard/copilot/OpportunityCard.tsx](../../apps/web/components/dashboard/copilot/OpportunityCard.tsx) | não encontrado estaticamente | — | — | — | `button` |
| [components/dashboard/copilot/SalesInsights.tsx](../../apps/web/components/dashboard/copilot/SalesInsights.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/crm/CustomerJourney.tsx](../../apps/web/components/dashboard/crm/CustomerJourney.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/crm/CustomerList.tsx](../../apps/web/components/dashboard/crm/CustomerList.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/crm/CustomerProfile.tsx](../../apps/web/components/dashboard/crm/CustomerProfile.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/crm/CustomerSegments.tsx](../../apps/web/components/dashboard/crm/CustomerSegments.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/crm/RecoveryCenter.tsx](../../apps/web/components/dashboard/crm/RecoveryCenter.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/crm/RecoveryPanel.tsx](../../apps/web/components/dashboard/crm/RecoveryPanel.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/crm/VIPCustomers.tsx](../../apps/web/components/dashboard/crm/VIPCustomers.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/dashboardheader.tsx](../../apps/web/components/dashboard/dashboardheader.tsx) | não encontrado estaticamente | — | — | — | `Link`, `button`, `input` |
| [components/dashboard/finance/AdminFinanceDashboard.tsx](../../apps/web/components/dashboard/finance/AdminFinanceDashboard.tsx) | sim | — | `FinanceTable` | `div` | `button`, `input`, `select` |
| [components/dashboard/finance/FinanceDashboard.tsx](../../apps/web/components/dashboard/finance/FinanceDashboard.tsx) | sim | — | — | — | `button`, `input`, `select` |
| [components/dashboard/finance/KPICards.tsx](../../apps/web/components/dashboard/finance/KPICards.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/finance/RevenueChart.tsx](../../apps/web/components/dashboard/finance/RevenueChart.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/finance/RevenueGoal.tsx](../../apps/web/components/dashboard/finance/RevenueGoal.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/finance/RevenueHistory.tsx](../../apps/web/components/dashboard/finance/RevenueHistory.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/financialcard.tsx](../../apps/web/components/dashboard/financialcard.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/organizer-navigation.ts](../../apps/web/components/dashboard/organizer-navigation.ts) | sim | — | — | — | — |
| [components/dashboard/recentsales.tsx](../../apps/web/components/dashboard/recentsales.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/saleschart.tsx](../../apps/web/components/dashboard/saleschart.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/dashboard/statistics.tsx](../../apps/web/components/dashboard/statistics.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/draws/AdminLotteryHistory.tsx](../../apps/web/components/draws/AdminLotteryHistory.tsx) | sim | — | — | — | — |
| [components/draws/DrawWorkspace.tsx](../../apps/web/components/draws/DrawWorkspace.tsx) | sim | `CaixaImportForm`, `LotteryForm`, `ReviewLotteryForm`, `form` | — | — | `Button`, `button`, `input` |
| [components/draws/ExpiredInstantPrizeAlerts.tsx](../../apps/web/components/draws/ExpiredInstantPrizeAlerts.tsx) | não encontrado estaticamente | — | — | — | `Link`, `button` |
| [components/draws/PostPaymentRewards.tsx](../../apps/web/components/draws/PostPaymentRewards.tsx) | sim | — | — | — | `Button` |
| [components/growth/AdsCenter.tsx](../../apps/web/components/growth/AdsCenter.tsx) | sim | `form` | — | `ComingSoonModal`, `InfoModal`, `section` | `a`, `button`, `input`, `select`, `textarea` |
| [components/growth/AdsConfirmedSales.tsx](../../apps/web/components/growth/AdsConfirmedSales.tsx) | sim | `form` | `table` | — | `button`, `input`, `select` |
| [components/growth/AdvisorConfirmAction.tsx](../../apps/web/components/growth/AdvisorConfirmAction.tsx) | sim | — | — | — | `Link` |
| [components/growth/AdvisorConversation.tsx](../../apps/web/components/growth/AdvisorConversation.tsx) | sim | `form` | — | — | `button`, `input`, `textarea` |
| [components/growth/AiSortexCenter.tsx](../../apps/web/components/growth/AiSortexCenter.tsx) | sim | `form` | — | — | `Link`, `button`, `input`, `select`, `textarea` |
| [components/growth/PromotionsCenter.tsx](../../apps/web/components/growth/PromotionsCenter.tsx) | sim | `form` | — | `DetailDrawer`, `aside`, `section` | `Link`, `button`, `input`, `select` |
| [components/home/BottomNavigation.tsx](../../apps/web/components/home/BottomNavigation.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/home/CampaignCard.tsx](../../apps/web/components/home/CampaignCard.tsx) | não encontrado estaticamente | — | — | — | `Link` |
| [components/home/Categories.tsx](../../apps/web/components/home/Categories.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/home/EndingTodayCarousel.tsx](../../apps/web/components/home/EndingTodayCarousel.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/home/FeaturedCampaigns.tsx](../../apps/web/components/home/FeaturedCampaigns.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/home/HeroBanner.tsx](../../apps/web/components/home/HeroBanner.tsx) | não encontrado estaticamente | — | — | — | `Link` |
| [components/home/NewCampaignsCarousel.tsx](../../apps/web/components/home/NewCampaignsCarousel.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/home/PromotionBanner.tsx](../../apps/web/components/home/PromotionBanner.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/home/PromotionCarousel.tsx](../../apps/web/components/home/PromotionCarousel.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/home/SearchBar.tsx](../../apps/web/components/home/SearchBar.tsx) | não encontrado estaticamente | — | — | — | `input` |
| [components/home/SectionTitle.tsx](../../apps/web/components/home/SectionTitle.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/home/SponsoredCarousel.tsx](../../apps/web/components/home/SponsoredCarousel.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/layout/footer.tsx](../../apps/web/components/layout/footer.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/layout/mobilemenu.tsx](../../apps/web/components/layout/mobilemenu.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/layout/navbar.tsx](../../apps/web/components/layout/navbar.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/layout/sidebar.tsx](../../apps/web/components/layout/sidebar.tsx) | não encontrado estaticamente | — | — | — | `Link`, `button` |
| [components/legal/LegalAcceptanceGate.tsx](../../apps/web/components/legal/LegalAcceptanceGate.tsx) | sim | — | — | `section` | `Link`, `button` |
| [components/legal/LegalAdminCenter.tsx](../../apps/web/components/legal/LegalAdminCenter.tsx) | sim | — | — | — | `button`, `input`, `select`, `textarea` |
| [components/legal/LegalUserCenter.tsx](../../apps/web/components/legal/LegalUserCenter.tsx) | sim | — | — | `DocumentModal`, `section` | `button`, `input` |
| [components/marketing/ProductHome.tsx](../../apps/web/components/marketing/ProductHome.tsx) | sim | — | — | — | `Link`, `a` |
| [components/marketing/ProductIllustrations.tsx](../../apps/web/components/marketing/ProductIllustrations.tsx) | sim | — | — | — | — |
| [components/media/MediaEditor.tsx](../../apps/web/components/media/MediaEditor.tsx) | sim | — | — | — | `button`, `input`, `select` |
| [components/media/ShareCenter.tsx](../../apps/web/components/media/ShareCenter.tsx) | sim | — | — | — | `button` |
| [components/organizador/AddressFields.tsx](../../apps/web/components/organizador/AddressFields.tsx) | sim | — | — | — | `Input`, `button`, `input` |
| [components/organizador/ContinueButton.tsx](../../apps/web/components/organizador/ContinueButton.tsx) | não encontrado estaticamente | — | — | — | `button` |
| [components/organizador/FinancialSummary.tsx](../../apps/web/components/organizador/FinancialSummary.tsx) | sim | — | — | — | — |
| [components/organizador/GatewayCard.tsx](../../apps/web/components/organizador/GatewayCard.tsx) | sim | — | — | — | `Link`, `button` |
| [components/organizador/GatewayComparison.tsx](../../apps/web/components/organizador/GatewayComparison.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/organizador/GatewayStatus.tsx](../../apps/web/components/organizador/GatewayStatus.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/organizador/OrganizerApprovalGate.tsx](../../apps/web/components/organizador/OrganizerApprovalGate.tsx) | sim | — | — | — | `button` |
| [components/organizador/OrganizerVerificationWizard.tsx](../../apps/web/components/organizador/OrganizerVerificationWizard.tsx) | sim | — | — | — | `Button`, `Input`, `Link`, `input` |
| [components/organizador/PaymentMethodSelector.tsx](../../apps/web/components/organizador/PaymentMethodSelector.tsx) | não encontrado estaticamente | — | — | — | `button` |
| [components/organizador/ProgressSteps.tsx](../../apps/web/components/organizador/ProgressSteps.tsx) | sim | — | — | — | — |
| [components/organizador/VerificationStatusBadge.tsx](../../apps/web/components/organizador/VerificationStatusBadge.tsx) | sim | — | — | — | — |
| [components/organizer-platform/IntegrationsCenter.tsx](../../apps/web/components/organizer-platform/IntegrationsCenter.tsx) | sim | — | — | `ConnectionDrawer`, `DemoDialog`, `div` | `button` |
| [components/organizer-platform/MiniCampaignReserve.tsx](../../apps/web/components/organizer-platform/MiniCampaignReserve.tsx) | sim | `form` | — | — | `Link`, `button`, `input` |
| [components/organizer-platform/OrganizerOnboardingGate.tsx](../../apps/web/components/organizer-platform/OrganizerOnboardingGate.tsx) | sim | — | — | — | — |
| [components/organizer-platform/PersonalizationCenter.tsx](../../apps/web/components/organizer-platform/PersonalizationCenter.tsx) | sim | `form` | — | — | `a`, `button`, `input`, `select` |
| [components/organizer-platform/PersonalizationPreview.tsx](../../apps/web/components/organizer-platform/PersonalizationPreview.tsx) | sim | — | — | — | `button`, `select` |
| [components/organizer-platform/PlanSelector.tsx](../../apps/web/components/organizer-platform/PlanSelector.tsx) | sim | — | — | — | `button`, `select` |
| [components/payments/MercadoPagoCardBrick.tsx](../../apps/web/components/payments/MercadoPagoCardBrick.tsx) | sim | — | — | — | — |
| [components/payments/OrganizerPaymentStats.tsx](../../apps/web/components/payments/OrganizerPaymentStats.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/payments/PixPaymentView.tsx](../../apps/web/components/payments/PixPaymentView.tsx) | sim | — | — | — | `Button`, `a` |
| [components/premium/PremiumScope.tsx](../../apps/web/components/premium/PremiumScope.tsx) | sim | — | — | — | — |
| [components/prizes/PrizeTicketsCenter.tsx](../../apps/web/components/prizes/PrizeTicketsCenter.tsx) | sim | — | — | `Drawer`, `MaterialDrawer`, `aside`, `dialog` | `Link`, `Select`, `button`, `input`, `select`, `textarea` |
| [components/public/InstitutionalBackButton.tsx](../../apps/web/components/public/InstitutionalBackButton.tsx) | sim | — | — | — | `button` |
| [components/public/OrganizerPublicHub.tsx](../../apps/web/components/public/OrganizerPublicHub.tsx) | sim | — | — | — | `Link`, `a`, `button`, `input`, `select` |
| [components/purchases/OrganizerPurchaseStats.tsx](../../apps/web/components/purchases/OrganizerPurchaseStats.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/purchases/PurchasePanel.tsx](../../apps/web/components/purchases/PurchasePanel.tsx) | sim | — | — | `div` | `Button`, `button`, `input` |
| [components/purchases/ReservationCountdown.tsx](../../apps/web/components/purchases/ReservationCountdown.tsx) | sim | — | — | — | — |
| [components/ui/Avatar.tsx](../../apps/web/components/ui/Avatar.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/ui/Badge.tsx](../../apps/web/components/ui/Badge.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/ui/Button.tsx](../../apps/web/components/ui/Button.tsx) | sim | — | — | — | `button` |
| [components/ui/Card.tsx](../../apps/web/components/ui/Card.tsx) | sim | — | — | — | — |
| [components/ui/EmptyState.tsx](../../apps/web/components/ui/EmptyState.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/ui/Input.tsx](../../apps/web/components/ui/Input.tsx) | sim | — | — | — | — |
| [components/ui/PageHeader.tsx](../../apps/web/components/ui/PageHeader.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/ui/ProgressBar.tsx](../../apps/web/components/ui/ProgressBar.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/ui/SearchInput.tsx](../../apps/web/components/ui/SearchInput.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/ui/StatCard.tsx](../../apps/web/components/ui/StatCard.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/ui/dialog.tsx](../../apps/web/components/ui/dialog.tsx) | não encontrado estaticamente | — | — | — | `Button` |
| [components/ui/dropdown-menu.tsx](../../apps/web/components/ui/dropdown-menu.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/ui/loading.tsx](../../apps/web/components/ui/loading.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/ui/modal.tsx](../../apps/web/components/ui/modal.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/ui/progress.tsx](../../apps/web/components/ui/progress.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/ui/scroll-area.tsx](../../apps/web/components/ui/scroll-area.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/ui/select.tsx](../../apps/web/components/ui/select.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/ui/separator.tsx](../../apps/web/components/ui/separator.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/ui/sheet.tsx](../../apps/web/components/ui/sheet.tsx) | não encontrado estaticamente | — | — | — | `Button` |
| [components/ui/skeleton.tsx](../../apps/web/components/ui/skeleton.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/ui/sonner.tsx](../../apps/web/components/ui/sonner.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/ui/table.tsx](../../apps/web/components/ui/table.tsx) | não encontrado estaticamente | — | `table` | — | — |
| [components/ui/tabs.tsx](../../apps/web/components/ui/tabs.tsx) | não encontrado estaticamente | — | — | — | — |
| [components/ui/textarea.tsx](../../apps/web/components/ui/textarea.tsx) | sim | — | — | — | `textarea` |

## Fontes de testes e fixtures a consultar

Listado por arquivo, sem executar testes e sem inferir cobertura de uma rota pelo nome. Use os testes como candidatos para a nova rodada por revisão, papel, viewport e estado.

- [tests/admin-team-list-bff.test.mjs](../../apps/web/tests/admin-team-list-bff.test.mjs)
- [tests/ads-confirmed-sales.test.mjs](../../apps/web/tests/ads-confirmed-sales.test.mjs)
- [tests/affiliate-login-real.mjs](../../apps/web/tests/affiliate-login-real.mjs)
- [tests/auth-refresh-http.test.mjs](../../apps/web/tests/auth-refresh-http.test.mjs)
- [tests/dashboard-period-http.test.mjs](../../apps/web/tests/dashboard-period-http.test.mjs)
- [tests/dashboard-period.test.mjs](../../apps/web/tests/dashboard-period.test.mjs)
- [tests/premium-foundation.test.mjs](../../apps/web/tests/premium-foundation.test.mjs)
- [tests/public-instant-prize-bff.test.mjs](../../apps/web/tests/public-instant-prize-bff.test.mjs)
- [e2e/admin-audit-premium.spec.ts](../../apps/web/e2e/admin-audit-premium.spec.ts)
- [e2e/admin-authorization.spec.ts](../../apps/web/e2e/admin-authorization.spec.ts)
- [e2e/admin-campaigns-premium.spec.ts](../../apps/web/e2e/admin-campaigns-premium.spec.ts)
- [e2e/admin-critical-resources.spec.ts](../../apps/web/e2e/admin-critical-resources.spec.ts)
- [e2e/admin-finance-premium.spec.ts](../../apps/web/e2e/admin-finance-premium.spec.ts)
- [e2e/admin-finance.spec.ts](../../apps/web/e2e/admin-finance.spec.ts)
- [e2e/admin-gateways-premium.spec.ts](../../apps/web/e2e/admin-gateways-premium.spec.ts)
- [e2e/admin-loteria-premium.spec.ts](../../apps/web/e2e/admin-loteria-premium.spec.ts)
- [e2e/admin-organizers-premium.spec.ts](../../apps/web/e2e/admin-organizers-premium.spec.ts)
- [e2e/admin-organizers.spec.ts](../../apps/web/e2e/admin-organizers.spec.ts)
- [e2e/admin-overview-premium.spec.ts](../../apps/web/e2e/admin-overview-premium.spec.ts)
- [e2e/admin-payments-premium.spec.ts](../../apps/web/e2e/admin-payments-premium.spec.ts)
- [e2e/admin-phase6.spec.ts](../../apps/web/e2e/admin-phase6.spec.ts)
- [e2e/admin-plans-premium.spec.ts](../../apps/web/e2e/admin-plans-premium.spec.ts)
- [e2e/admin-users-premium.spec.ts](../../apps/web/e2e/admin-users-premium.spec.ts)
- [e2e/ai-advisor-full.spec.ts](../../apps/web/e2e/ai-advisor-full.spec.ts)
- [e2e/auth.setup.ts](../../apps/web/e2e/auth.setup.ts)
- [e2e/authenticated-modules.spec.ts](../../apps/web/e2e/authenticated-modules.spec.ts)
- [e2e/automations.spec.ts](../../apps/web/e2e/automations.spec.ts)
- [e2e/buyer-cover-media.spec.ts](../../apps/web/e2e/buyer-cover-media.spec.ts)
- [e2e/buyer-favorites-premium.spec.ts](../../apps/web/e2e/buyer-favorites-premium.spec.ts)
- [e2e/buyer-notifications-premium.spec.ts](../../apps/web/e2e/buyer-notifications-premium.spec.ts)
- [e2e/buyer-profile-premium.spec.ts](../../apps/web/e2e/buyer-profile-premium.spec.ts)
- [e2e/campaign-lifecycle.spec.ts](../../apps/web/e2e/campaign-lifecycle.spec.ts)
- [e2e/campaign-list-premium.spec.ts](../../apps/web/e2e/campaign-list-premium.spec.ts)
- [e2e/campaign-numeric-fields.spec.ts](../../apps/web/e2e/campaign-numeric-fields.spec.ts)
- [e2e/campaign-wizard-premium.spec.ts](../../apps/web/e2e/campaign-wizard-premium.spec.ts)
- [e2e/communication-full.spec.ts](../../apps/web/e2e/communication-full.spec.ts)
- [e2e/communication-premium.spec.ts](../../apps/web/e2e/communication-premium.spec.ts)
- [e2e/crm-automation-shortcuts.spec.ts](../../apps/web/e2e/crm-automation-shortcuts.spec.ts)
- [e2e/crm-overview-premium.spec.ts](../../apps/web/e2e/crm-overview-premium.spec.ts)
- [e2e/dashboard-campaigns-sync.spec.ts](../../apps/web/e2e/dashboard-campaigns-sync.spec.ts)
- [e2e/fixtures/synthetic-campaign.ts](../../apps/web/e2e/fixtures/synthetic-campaign.ts)
- [e2e/gateway-availability.spec.ts](../../apps/web/e2e/gateway-availability.spec.ts)
- [e2e/integrated-access-review.spec.ts](../../apps/web/e2e/integrated-access-review.spec.ts)
- [e2e/leads.spec.ts](../../apps/web/e2e/leads.spec.ts)
- [e2e/login-premium.spec.ts](../../apps/web/e2e/login-premium.spec.ts)
- [e2e/milestone-image.spec.ts](../../apps/web/e2e/milestone-image.spec.ts)
- [e2e/mini-affiliates.spec.ts](../../apps/web/e2e/mini-affiliates.spec.ts)
- [e2e/mvp-buyer-journey.spec.ts](../../apps/web/e2e/mvp-buyer-journey.spec.ts)
- [e2e/mvp-organizer-journey.spec.ts](../../apps/web/e2e/mvp-organizer-journey.spec.ts)
- [e2e/mvp-smoke.spec.ts](../../apps/web/e2e/mvp-smoke.spec.ts)
- [e2e/operational-final-auth.spec.ts](../../apps/web/e2e/operational-final-auth.spec.ts)
- [e2e/organizer-apuracao-premium.spec.ts](../../apps/web/e2e/organizer-apuracao-premium.spec.ts)
- [e2e/organizer-config-premium.spec.ts](../../apps/web/e2e/organizer-config-premium.spec.ts)
- [e2e/organizer-finance-premium.spec.ts](../../apps/web/e2e/organizer-finance-premium.spec.ts)
- [e2e/organizer-home-review.spec.ts](../../apps/web/e2e/organizer-home-review.spec.ts)
- [e2e/organizer-integrations-premium.spec.ts](../../apps/web/e2e/organizer-integrations-premium.spec.ts)
- [e2e/organizer-plan-premium.spec.ts](../../apps/web/e2e/organizer-plan-premium.spec.ts)
- [e2e/organizer-sidebar.spec.ts](../../apps/web/e2e/organizer-sidebar.spec.ts)
- [e2e/password-recovery-premium.spec.ts](../../apps/web/e2e/password-recovery-premium.spec.ts)
- [e2e/personalization-persistence.spec.ts](../../apps/web/e2e/personalization-persistence.spec.ts)
- [e2e/personalization-premium.spec.ts](../../apps/web/e2e/personalization-premium.spec.ts)
- [e2e/preview-phase1-global-setup.ts](../../apps/web/e2e/preview-phase1-global-setup.ts)
- [e2e/prize-tickets-full.spec.ts](../../apps/web/e2e/prize-tickets-full.spec.ts)
- [e2e/prize-tickets-premium.spec.ts](../../apps/web/e2e/prize-tickets-premium.spec.ts)
- [e2e/profile-settings-full.spec.ts](../../apps/web/e2e/profile-settings-full.spec.ts)
- [e2e/promotions-full.spec.ts](../../apps/web/e2e/promotions-full.spec.ts)
- [e2e/promotions-premium.spec.ts](../../apps/web/e2e/promotions-premium.spec.ts)
- [e2e/public-campaign-chrome.spec.ts](../../apps/web/e2e/public-campaign-chrome.spec.ts)
- [e2e/public-winner-proof.spec.ts](../../apps/web/e2e/public-winner-proof.spec.ts)
- [e2e/registration-choice-premium.spec.ts](../../apps/web/e2e/registration-choice-premium.spec.ts)
- [e2e/registration-forms-premium.spec.ts](../../apps/web/e2e/registration-forms-premium.spec.ts)
- [e2e/registration-phase1.spec.ts](../../apps/web/e2e/registration-phase1.spec.ts)
- [e2e/reward-order-persistence.spec.ts](../../apps/web/e2e/reward-order-persistence.spec.ts)
- [e2e/run-buyer-favorites-ui.mjs](../../apps/web/e2e/run-buyer-favorites-ui.mjs)
- [e2e/run-buyer-inbox-ui.mjs](../../apps/web/e2e/run-buyer-inbox-ui.mjs)
- [e2e/verification-image-roulette.spec.ts](../../apps/web/e2e/verification-image-roulette.spec.ts)
- [e2e/winner-center-premium.spec.ts](../../apps/web/e2e/winner-center-premium.spec.ts)
- [e2e-local/ads-confirmed-sales.spec.ts](../../apps/web/e2e-local/ads-confirmed-sales.spec.ts)
- [e2e-local/buyer-coupon-journey.spec.ts](../../apps/web/e2e-local/buyer-coupon-journey.spec.ts)
- [e2e-local/buyer-purchase-history.spec.ts](../../apps/web/e2e-local/buyer-purchase-history.spec.ts)
- [e2e-local/buyer-sales-window.spec.ts](../../apps/web/e2e-local/buyer-sales-window.spec.ts)
- [e2e-local/run-buyer-catalog-premium.mjs](../../apps/web/e2e-local/run-buyer-catalog-premium.mjs)
- [e2e-local/run-buyer-checkout-premium.mjs](../../apps/web/e2e-local/run-buyer-checkout-premium.mjs)
- [e2e-local/run-buyer-home-premium.mjs](../../apps/web/e2e-local/run-buyer-home-premium.mjs)
- [e2e-local/run-buyer-prizes-premium.mjs](../../apps/web/e2e-local/run-buyer-prizes-premium.mjs)
- [e2e-local/run-buyer-purchase-detail-premium.mjs](../../apps/web/e2e-local/run-buyer-purchase-detail-premium.mjs)
- [e2e-local/run-buyer-purchases-premium.mjs](../../apps/web/e2e-local/run-buyer-purchases-premium.mjs)
- [e2e-local/run-buyer-results-premium.mjs](../../apps/web/e2e-local/run-buyer-results-premium.mjs)
- [e2e-local/run-buyer-support-premium.mjs](../../apps/web/e2e-local/run-buyer-support-premium.mjs)
- [e2e-local/run-organizer-ads-premium.mjs](../../apps/web/e2e-local/run-organizer-ads-premium.mjs)
- [e2e-local/run-organizer-advisor-premium.mjs](../../apps/web/e2e-local/run-organizer-advisor-premium.mjs)
- [e2e-local/run-organizer-affiliates-premium.mjs](../../apps/web/e2e-local/run-organizer-affiliates-premium.mjs)
- [e2e-local/run-organizer-dashboard-premium.mjs](../../apps/web/e2e-local/run-organizer-dashboard-premium.mjs)
- [e2e-local/run-organizer-mini-campaigns-premium.mjs](../../apps/web/e2e-local/run-organizer-mini-campaigns-premium.mjs)
- [e2e-local/run-organizer-order-detail-premium.mjs](../../apps/web/e2e-local/run-organizer-order-detail-premium.mjs)
- [e2e-local/run-organizer-orders-premium.mjs](../../apps/web/e2e-local/run-organizer-orders-premium.mjs)
- [e2e-local/run-public-campaign-premium.mjs](../../apps/web/e2e-local/run-public-campaign-premium.mjs)
- [e2e-local/run-public-home-hero-premium.mjs](../../apps/web/e2e-local/run-public-home-hero-premium.mjs)
- [e2e-local/run-public-support-premium.mjs](../../apps/web/e2e-local/run-public-support-premium.mjs)
- [e2e-local/run-quick-quantity-contrast.mjs](../../apps/web/e2e-local/run-quick-quantity-contrast.mjs)
