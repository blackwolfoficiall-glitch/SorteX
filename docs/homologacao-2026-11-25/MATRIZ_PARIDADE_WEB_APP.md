# Matriz de paridade SorteX • atualizada em 26/11/2026

Portal indica link para o site dentro do aplicativo. Restrito indica exclusão intencional da administração no app. As fontes de Banco são modelos Prisma. Cada teste citado por nome pode cobrir apenas parte da linha. A tabela distingue caminhos presentes e evidência executada; veja a seção de aceite para as verificações mais recentes. A classificação é da jornada integrada; a classificação por cliente consta nas colunas Site e App. A existência de rota ou de um botão não certifica sua execução.

| Módulo | Site | App | Backend | Banco | Testes | Problemas | Prioridade | Estimativa | Classificação integrada |
|---|---|---|---|---|---|---|---|---|---|
| Login por senha | login | Login | auth | User/AuthSession | HTTP no Neon QA | Login por senha passou por HTTP; confirmar no iPhone | P0 | 1–2 d de teste | PARCIALMENTE FUNCIONAL |
| Cadastro comprador, endereço e CPF | cadastro/comprador | Register | auth,locations | BuyerAddress/ConsentRecord | PG + navegador | Repetir no aparelho | P0 | 1–2 d de teste | PARCIALMENTE FUNCIONAL |
| Cadastro organizador PF/PJ e CPF/CNPJ | cadastro/organizador | Register | auth,organizers | OrganizerProfile | PG, navegador e HTTP no Neon QA | Cadastro PF passou por HTTP nos dois sentidos; repetir PF/PJ no iPhone | P0 | 1–2 d de teste | PARCIALMENTE FUNCIONAL |
| Apple e Google | login | Indisponíveis | social-auth | SocialIdentity | 15 OIDC | Provedores simulados; callbacks reais pendentes | P1 | 0,5–1 d de teste | PARCIALMENTE FUNCIONAL |
| Recuperação de senha | esqueci-senha, recuperar-senha | Forgot, Reset | auth | PasswordResetToken | password-reset-mail | Entrega e abertura do link no celular | P1 | 0,5–1 d de teste | PARCIALMENTE FUNCIONAL |
| Sessões e permissões | login, admin/login | Main, SecureStore | auth/guards | AuthSession | Rotação HTTP no Neon QA; 27 mobile | Persistência em SecureStore ainda não exercitada no iPhone; portal abre sessão distinta | P0 | 1–2 d de teste | PARCIALMENTE FUNCIONAL |
| Dashboard | dashboard | Home | dashboard | Campaign/Payment | dashboard.spec | Comparar totais por ID e período | P0 | 1–2 d de teste | PARCIALMENTE FUNCIONAL |
| Criar campanhas | dashboard/campanhas/nova | Criar rascunho nativo; portal para edição avançada | campaigns | Campaign | BFF↔cliente no Neon QA | Mesmo ID de rascunho por HTTP; interface e publicação ainda não verificadas no iPhone | P0 | 1–2 d de teste | PARCIALMENTE FUNCIONAL |
| Editar campanhas | dashboard/campanhas/[id]/editar | Rascunho nativo; edição limitada de título/resumo/descrição de publicada ou pausada; portal para edição avançada | campaigns | Campaign | BFF↔cliente no Neon QA para rascunhos; jornada HTTP/PG e Chromium local para publicada | Repetir na interface física | P0 | 1–2 d de teste | PARCIALMENTE FUNCIONAL |
| Gerenciar campanhas e publicações | dashboard/campanhas | Campaigns, Campaign; portal | campaigns | Campaign | campaigns.spec | Publicação e bloqueios no dispositivo | P0 | 1–2 d de teste | PARCIALMENTE FUNCIONAL |
| Prêmios e fotos | editor de campanha | Portal | campaigns, media | CampaignImage | media, DTO | Upload e releitura no telefone | P1 | 0,5–1 d de teste | PARCIALMENTE FUNCIONAL |
| Promoções e cupons | dashboard/promocoes | Portal | campaigns,purchases | CampaignPromotion | purchases, DTO | Aplicar desconto no checkout móvel | P1 | 0,5–1 d de teste | PARCIALMENTE FUNCIONAL |
| Cotas premiadas e marcos | editor de campanha | Portal | campaigns,draws | CampaignInstantPrize/CampaignMilestonePrize | milestones | Comparar atribuição dos prêmios | P1 | 0,5–1 d de teste | PARCIALMENTE FUNCIONAL |
| Ganhadores e sorteios | dashboard/sorteios, dashboard/ganhadores; prova pública legível e código copiável | Portal de gestão; consulta nativa da prova por código em Resultados | draws | Winner/CampaignDraw | Prova igual no Next e cliente móvel via HTTP/PG local | Repetir a leitura física; cotas premiadas são uma jornada separada | P0 | 1–2 d de teste | PARCIALMENTE FUNCIONAL |
| Afiliados | dashboard/afiliados | Portal | affiliates | AffiliateCommission | affiliate-commission | Conversão e repasse pendentes | P1 | 0,5–1 d de teste | PARCIALMENTE FUNCIONAL |
| Financeiro organizador | dashboard/financeiro | Portal | finance | FinancialAccount/LedgerEntry | finance, ledger | Conciliar o mesmo pagamento | P0 | 1–2 d de teste | PARCIALMENTE FUNCIONAL |
| CRM: contatos, segmentos, tarefas, automações e abandonos | dashboard/crm e subrotas | Crm resumo; portal | crm | CrmContact/Segment/Automation | crm, crm-sync | Operações completas no iPhone pendentes | P1 | 0,5–1 d de teste | PARCIALMENTE FUNCIONAL |
| IA SorteX | dashboard/ia | Advisor resumo; portal | growth | AiRecommendation | ai-advisor-full web | Ver falhas e precondições no diagnóstico | P1 | 0,5–1 d de teste | PARCIALMENTE FUNCIONAL |
| SorteX Live (streaming e chat) | Sem rota localizada | Ausente | Sem módulo identificado | — | — | Sala de apuração não transmite vídeo | P3 | fora da janela | NÃO IMPLEMENTADO |
| Configurações e marca | dashboard/configuracoes, perfil | Profile; portal | organizers,personalization | OrganizerBrandProfile | navegador: slogan | Edição de endereço completo pendente | P1 | 0,5–1 d de teste | PARCIALMENTE FUNCIONAL |
| Mini-campanhas | dashboard/mini-campanhas | Portal | mini-campaigns | MiniCampaign | mini-affiliates web | Ciclo de compra no iPhone pendente | P1 | 0,5–1 d de teste | PARCIALMENTE FUNCIONAL |
| Comunicação e notificações CRM | dashboard/comunicacao | Portal | crm,growth | OutboundMessage | communication-full web | Confirmar entrega em cada canal | P1 | 0,5–1 d de teste | PARCIALMENTE FUNCIONAL |
| Ads e Modo Turbo | dashboard/ads, painel-mobile.html#turbo | Portal | growth, CRM | SortexAdCampaign | inspeção | Ads sandbox; Turbo é agrupador de atalhos | P2 | 0,5–1 d de teste | SOMENTE INTERFACE (atalhos Turbo); Ads simulado |
| Domínio, redes e prévia | dashboard/personalizacao | Portal | personalization | OrganizerDomain | personalization-persistence web | Publicação do domínio pendente | P1 | 0,5–1 d de teste | PARCIALMENTE FUNCIONAL |
| Mídias e documentos | organizador/midias e organizador/verificacao | Portal | media,organizers | MediaAsset/OrganizerDocument | media, organizer-storage | Storage local exercitado; desabilitado na API de homologação | P1 | 0,5–1 d de teste | PARCIALMENTE FUNCIONAL |
| Planos e jurídico | dashboard/configuracoes/plano, juridico | Portal | plans,legal | Subscription/LegalAcceptance | legal | Validar aceite e plano correto no portal | P1 | 0,5–1 d de teste | PARCIALMENTE FUNCIONAL |
| Comprador: visualizar campanhas | campanha/[slug] | Campaigns, Campaign | buyer,public-campaigns | Campaign | public-campaigns | Conferir campanha publicada no dispositivo | P0 | 1–2 d de teste | PARCIALMENTE FUNCIONAL |
| Selecionar e reservar cotas | campanha/[slug] | Reserva manual/aleatória sob flag de teste; desligada no Release Core | purchases/reserve-manual, reserve-random | Ticket/Purchase | HTTP/PG local, inclusive expiração e concorrência | Checkout sandbox no aparelho pendente | P0 | 1–2 d de teste | PARCIALMENTE FUNCIONAL |
| Compra e checkout | comprador/checkout/[id] | Pix nativo sob flag; Core só consulta | auth/checkout,purchases,payments | Purchase/Payment | HTTP/PG local com provedor controlado | Perfil checkout-sandbox preparado localmente, sem deploy ou aceite | P0 | 2–4 d de ligação ao fluxo existente | PARCIALMENTE FUNCIONAL |
| Pix e confirmação para comprador | comprador/checkout/[id], pagamento/sucesso | Order consulta; Pix protegido por flag | payments,webhooks | Payment/PaymentEvent | HTTP/PG local com provedor controlado | Falta ordem Teste, webhook do provedor e iPhone | P0 | 1–2 d de teste | PARCIALMENTE FUNCIONAL |
| Meus títulos e histórico | comprador/meus-numeros, compras/[id] | Orders, Order | purchases/my, tickets | Purchase/Ticket | purchases | Comparar números após confirmação | P0 | 1–2 d de teste | PARCIALMENTE FUNCIONAL |
| Cotas premiadas e meus prêmios | comprador/meus-premios | Results parcial | buyer,draws | InstantPrizeResult/Winner | draws | Releitura do prêmio pelo comprador | P1 | 0,5–1 d de teste | PARCIALMENTE FUNCIONAL |
| Resultados e ganhadores | comprador/sorteios | DrawRoom, Results | draws,public-campaigns | CampaignDraw/Winner | draws | Reproduzir extração publicada | P0 | 1–2 d de teste | PARCIALMENTE FUNCIONAL |
| Perfil do comprador | comprador/perfil | Profile | buyer/profile | User/BuyerAddress | HTTP/PG | Releitura nos dois canais | P1 | 0,5–1 d de teste | PARCIALMENTE FUNCIONAL |
| Notificações do comprador | comprador/notificacoes | Ausente | buyer | Notification | inventário | Sem central ou push nativo comprovado | P1 | 0,5–1 d de teste | PARCIALMENTE FUNCIONAL |
| Favoritos e suporte | comprador/favoritos, comprador/suporte | Ausente | buyer | BuyerFavorite/SupportTicket | inventário | Sem rotas nativas dedicadas | P2 | 0,5–1 d de teste | PARCIALMENTE FUNCIONAL |
| Admin: usuários e equipe | admin/usuarios, admin/equipe | Restrito | admin,auth | User/AdminTeamInvitation | admin, guards, web | Repetir com contas de teste | P0 | 1–2 d de teste | PARCIALMENTE FUNCIONAL |
| Admin: organizadores, aprovar e rejeitar | admin/organizadores, admin/aprovacoes | Restrito | admin-organizers | OrganizerReviewDecision | organizers, admin web | Validar autor e motivo da decisão | P0 | 1–2 d de teste | PARCIALMENTE FUNCIONAL |
| Admin: campanhas e ganhadores | admin/campanhas, admin/ganhadores | Restrito | admin,draws | Campaign/Winner | admin.spec, admin web | Releitura e auditoria da moderação | P1 | 0,5–1 d de teste | PARCIALMENTE FUNCIONAL |
| Admin: financeiro e taxas | admin/financeiro, admin/pagamentos | Restrito | finance,admin | FinancialAccount/LedgerEntry | finance, admin web | Conciliação pendente | P0 | 1–2 d de teste | PARCIALMENTE FUNCIONAL |
| Admin: auditoria, logs e permissões | admin/auditoria, admin/equipe | Restrito | admin,auth | AuditLog/User | admin-authorization,guards | Validar autorização no servidor e retenção | P0 | 1–2 d de teste | PARCIALMENTE FUNCIONAL |
| Admin: antifraude | admin/denuncias, organizadores | Restrito | admin,organizers | Report/OrganizerProfile | inspeção | Revisão de risco presente; eficácia operacional sem evidência | P1 | 0,5–1 d de teste | PARCIALMENTE FUNCIONAL |
| Admin: configurações da plataforma | admin/configuracoes | Restrito | admin | PlatformSetting | admin-phase6 web | Releitura autorizada após alteração | P1 | 0,5–1 d de teste | PARCIALMENTE FUNCIONAL |
| Mercado Pago | organizador/gateways/mercado-pago | Portal | mercado-pago.provider | Payment | provider, payments | Evento sandbox do provedor pendente | P0 | 1–2 d de teste | BLOQUEADO POR DEPENDÊNCIA EXTERNA |
| Stone | admin/gateways catálogo | Ausente | Sem adaptador | AdminGatewayConfig | despacho inspecionado | Integração transacional ausente | P3 | fora da janela | NÃO IMPLEMENTADO |
| PagBank | admin/gateways catálogo | Ausente | Sem adaptador | AdminGatewayConfig | despacho inspecionado | Integração transacional ausente | P3 | fora da janela | NÃO IMPLEMENTADO |
| Pagar.me | admin/gateways catálogo | Ausente | Sem adaptador | AdminGatewayConfig | despacho inspecionado | Integração transacional ausente | P3 | fora da janela | NÃO IMPLEMENTADO |
| Webhooks e conciliação | admin/pagamentos | Order consulta | payments,finance | PaymentEvent/LedgerEntry | payments,finance | Reenvio sandbox do mesmo evento | P0 | 1–2 d de teste | PARCIALMENTE FUNCIONAL |
| Split de pagamentos | financeiro | Ausente | Ledger interno | LedgerEntry | fee, ledger | Liquidação dividida pelo provedor sem evidência | P1 | 0,5–1 d de teste | PARCIALMENTE FUNCIONAL |
| Saques | dashboard/financeiro | Portal | finance/payouts | PayoutRequest | finance | Solicitação e saldo internos; repasse externo pendente | P1 | 0,5–1 d de teste | PARCIALMENTE FUNCIONAL |
| Loteria Federal automática | admin/loteria | DrawRoom consulta | ManualLotteryResultsProvider | LotteryDraw | draws | Consulta automática desativada | P1 | fora da janela | NÃO IMPLEMENTADO |
| Builder de regras e apuração | editor, dashboard/sorteios | Portal; DrawRoom consulta | draw-rule-templates,draws | DrawRuleTemplate/CampaignDraw | draw-rule-engine e auditoria HTTP/PG | Prova recalculável e bloqueio de divergência testados; replay no aparelho pendente | P0 | 1–2 d de teste | PARCIALMENTE FUNCIONAL |
| Notificações externas | dashboard/comunicacao | Sem push nativo | crm/fila | OutboundMessage | crm | Entrega externa pendente | P1 | 0,5–1 d de teste | BLOQUEADO POR DEPENDÊNCIA EXTERNA |

## Evidências dos nove cenários • 26/11/2026

**Aceite formal: 0/9.** O [teste HTTP hospedado da revisão `8f1c947`](https://github.com/blackwolfoficiall-glitch/SorteX/actions/runs/45847861349) exercitou o Next no executor e o cliente HTTP do app no mesmo Neon, com as mesmas 21 migrações. O [teste de mídia após ativar o bucket privado](https://github.com/blackwolfoficiall-glitch/SorteX/actions/runs/45849233750) confirmou o PNG sintético do rascunho com bytes idênticos no BFF e na API, sem cache e com acesso negado a anônimos e a outro organizador. Não publicou a campanha. A [CI compilou e abriu o aplicativo Release no simulador](https://github.com/blackwolfoficiall-glitch/SorteX/actions/runs/45814383189), não em um iPhone. A [prévia com PIN](PREVIA_PRIVADA_MAC.md) e a instalação física não foram verificadas.

| # | Cenário obrigatório | Evidência atual | Falta para aceitar |
|---|---|---|---|
| 1 | Criar na web, ver no iPhone | Mesmo ID de rascunho no Next e cliente móvel por HTTP no Neon QA | Site privado e interface física; distinguir rascunho de publicação |
| 2 | Editar no iPhone, ver na web | Rascunho editado e relido no Neon QA; resumo de campanha publicada editado no cliente móvel e exibido no Chromium em ensaio local | Edição pela interface física e releitura visual |
| 3 | Cadastro web e login no app | IDs, papéis, login e rotação conferidos por HTTP no Neon QA | Acesso no iPhone e sessão preservada após reabrir |
| 4 | Reservar e comprar cotas de teste | Reserva e reaproveitamento de cota exercitados com PostgreSQL isolado | Compra sintética em ambiente Teste do provedor e interface física |
| 5 | Confirmação via webhook | Teste local confirma reentrega assinada após vínculo tardio do pedido, sem duplicar título ou crédito; provedor simulado | Ordem rastreada no Mercado Pago Teste e webhook assinado entregue pelo provedor |
| 6 | Títulos, ganhadores e saldo | Prova Federal idêntica no Next e cliente móvel HTTP, de `000091` original a `19000` vencedor, com regra e hash; invalidação retira a prova sem apagar o histórico. Emissão e estorno só em testes locais | Os três resultados na mesma jornada QA por web e iOS |
| 7 | Impedir duplicidade de cotas | Corrida em PostgreSQL isolado: uma reserva vencedora; a outra recebe conflito | Corrida web/iOS e reentrega do webhook sem novo título ou lançamento |
| 8 | Isolamento dos organizadores | Isolamento de leitura/alteração passou no Neon QA por HTTP | Conferir com duas identidades na web privada e iPhone |
| 9 | Permissões administrativas | 12 casos HTTP/PG locais: seis perfis, convite único de analista, negação a compradores/organizadores, revogação e auditoria | Matriz de papéis no QA, ações permitidas/bloqueadas no site e o app sem acesso administrativo |

Seguimento: quando houver acesso ao Mac, testar login e campanhas no Release Core com pagamentos desligados. A prévia Next e o app devem confirmar a mesma revisão de API; o site precisa negar acesso anônimo antes de compartilhar seu link. Para a etapa financeira, usar somente credenciais atestadas na aba Teste do provedor, campanha e identidades sintéticas; uma confirmação local ou simulada não conta como entrega do webhook. Produção e App Store fora desta rodada.

## Inventário por arquivo

Os caminhos de páginas e manipuladores são derivados do roteador de arquivos. Em rotas catch-all, um único manipulador pode encaminhar vários endpoints. A API abaixo lista métodos declarados no código, inclusive internos. As páginas web são Next.js, salvo o portal estático.

### Páginas Next.js

- /admin/afiliados
- /admin/aprovacoes
- /admin/auditoria
- /admin/campanhas
- /admin/configuracoes
- /admin/conteudo
- /admin/convite/[token]
- /admin/crm
- /admin/dashboard
- /admin/denuncias
- /admin/equipe/[id]
- /admin/equipe
- /admin/financeiro
- /admin/ganhadores
- /admin/gateways
- /admin/juridico
- /admin/login
- /admin/loteria
- /admin/midia
- /admin/organizadores/[id]
- /admin/organizadores
- /admin/pagamentos
- /admin
- /admin/planos
- /admin/saude
- /admin/suporte
- /admin/taxas
- /admin/usuarios
- /afiliado/convite/[code]
- /afiliado
- /cadastro/completar
- /cadastro/comprador
- /cadastro/organizador/confirmacao
- /cadastro/organizador/financeiro
- /cadastro/organizador
- /cadastro
- /cadastro/sucesso
- /cadastro/sucesso-comprador
- /cadastro/sucesso-organizador
- /campanha/[slug]
- /comprador/checkout/[id]
- /comprador/compras/[id]
- /comprador/favoritos
- /comprador/meus-numeros
- /comprador/meus-premios
- /comprador/notificacoes
- /comprador/pagamento/sucesso/[id]
- /comprador
- /comprador/participar
- /comprador/perfil
- /comprador/sorteios
- /comprador/suporte
- /contato
- /criar
- /dashboard/ads
- /dashboard/afiliados
- /dashboard/campanhas/[id]/editar
- /dashboard/campanhas/[id]/publicada
- /dashboard/campanhas/ganhadores
- /dashboard/campanhas/nova
- /dashboard/campanhas
- /dashboard/comunicacao
- /dashboard/configuracoes/juridico
- /dashboard/configuracoes
- /dashboard/configuracoes/plano
- /dashboard/crm/automacoes
- /dashboard/crm/contatos/[id]
- /dashboard/crm/contatos
- /dashboard/crm/notificacoes
- /dashboard/crm
- /dashboard/crm/reservas-abandonadas
- /dashboard/crm/segmentos
- /dashboard/crm/tarefas
- /dashboard/financeiro
- /dashboard/ganhadores
- /dashboard/ia
- /dashboard/integracoes
- /dashboard/mini-campanhas/[id]
- /dashboard/mini-campanhas
- /dashboard
- /dashboard/pedidos/[id]
- /dashboard/pedidos
- /dashboard/personalizacao/dominio
- /dashboard/personalizacao
- /dashboard/personalizacao/preview
- /dashboard/personalizacao/redes-sociais
- /dashboard/promocoes
- /dashboard/sorteios
- /escolha
- /esqueci-senha
- /juridico
- /login
- /mini-campanhas/[slug]
- /o/[organizerId]
- /organizador/escolher-plano
- /organizador/gateways/mercado-pago
- /organizador/midias
- /organizador/verificacao
- /
- /perfil
- /preview/campaign/[campaignId]
- /privacidade
- /recuperar-senha
- /suporte
- /termos
- /teste
- /verificar/[verificationCode]

### Manipuladores Next.js

| Caminho | Métodos |
|---|---|
| /api/admin/finance/[...path] | GET, POST |
| /api/admin/invitations/[token]/accept | POST |
| /api/admin/invitations/[token] | GET |
| /api/admin/organizers/[userId]/commercial-terms | PATCH |
| /api/admin/platform/[...path] | GET, POST, PATCH |
| /api/affiliates/[...path] | GET, POST, PATCH, DELETE |
| /api/auth/admin-login | GET, POST |
| /api/auth/checkout/complete | POST |
| /api/auth/checkout/start | POST |
| /api/auth/forgot-password | POST |
| /api/auth/login | GET, POST |
| /api/auth/logout | POST |
| /api/auth/me | GET |
| /api/auth/refresh | POST |
| /api/auth/register | POST |
| /api/auth/reset-password | POST |
| /api/auth/social/[provider]/callback | GET, POST |
| /api/auth/social/[provider]/start | GET |
| /api/auth/social/complete | POST |
| /api/auth/social/link | POST |
| /api/auth/social/pending | GET |
| /api/auth/social/providers | GET |
| /api/brand-assets/[organizerId]/[kind] | GET |
| /api/buyer/[...path] | GET, POST, PATCH, DELETE |
| /api/campaigns/[id]/duplicate | POST |
| /api/campaigns/[id]/finish | POST |
| /api/campaigns/[id]/images/[imageId] | DELETE |
| /api/campaigns/[id]/images | POST |
| /api/campaigns/[id]/media/[...path] | GET |
| /api/campaigns/[id]/pause | POST |
| /api/campaigns/[id]/publish | POST |
| /api/campaigns/[id] | GET, PATCH, DELETE |
| /api/campaigns/my | GET |
| /api/campaigns | POST |
| /api/crm/[...path] | GET, POST, PATCH, DELETE |
| /api/dashboard | GET |
| /api/draw-rule-templates | GET, POST |
| /api/draw-rule-templates/simulate | POST |
| /api/draws/[...path] | GET, POST, PATCH |
| /api/engagement/[...path] | GET, POST, PATCH, DELETE |
| /api/finance/[...path] | GET, POST |
| /api/health/ready | GET |
| /api/legal/[...path] | GET, POST, PUT, PATCH, DELETE |
| /api/location/cep/[cep] | GET |
| /api/location/states/[uf]/cities | GET |
| /api/location/states | GET |
| /api/media/[...path] | GET, POST, PATCH, DELETE |
| /api/organizer/[...path] | GET, POST, PATCH, PUT, DELETE |
| /api/organizer/account | PATCH |
| /api/organizer/documents/[documentId]/file | GET |
| /api/organizer/documents | POST |
| /api/organizer/logo/[userId] | GET |
| /api/organizer/logo | POST |
| /api/organizer/profile | GET, PATCH |
| /api/organizer/submit | POST |
| /api/payments/[id]/cancel | POST |
| /api/payments/[id]/refresh | POST |
| /api/payments/[id]/refund-request | POST |
| /api/payments/[id] | GET |
| /api/payments/card | POST |
| /api/payments/config | GET |
| /api/payments/my | GET |
| /api/payments/organizer/summary | GET |
| /api/payments/pix | POST |
| /api/payments/purchase/[purchaseId] | GET |
| /api/plans/[...path] | GET, POST, PATCH, DELETE |
| /api/platform/[...path] | GET, POST, PUT, PATCH, DELETE |
| /api/platform/organizer/personalization/assets/[kind] | POST |
| /api/public/campaign-media/[...path] | GET |
| /api/public/campaigns/[slug]/availability | GET |
| /api/public/campaigns/[slug]/numbers | GET |
| /api/public/campaigns/[slug]/promotions | GET |
| /api/public/campaigns/[slug] | GET |
| /api/public/campaigns | GET |
| /api/public/organizers/[organizerId] | GET |
| /api/public/winners/verify/[code] | GET |
| /api/purchases/[id]/cancel | POST |
| /api/purchases/[id] | GET |
| /api/purchases/[id]/tickets | GET |
| /api/purchases/current | GET |
| /api/purchases/my | GET |
| /api/purchases/organizer/[...path] | GET, POST |
| /api/purchases/organizer/summary | GET |
| /api/purchases/reserve-manual | POST |
| /api/purchases/reserve-random | POST |
| /r/[slug] | GET |
| /s/[code] | GET |

### API NestJS

| Método | Caminho declarado | Fonte |
|---|---|---|
| GET | /admin/invitations/:token | admin/admin-invitation.controller.ts |
| POST | /admin/invitations/:token/accept | admin/admin-invitation.controller.ts |
| GET | /admin/dashboard | admin/admin.controller.ts |
| GET | /admin/approvals | admin/admin.controller.ts |
| GET | /admin/organizers | admin/admin.controller.ts |
| GET | /admin/organizers/:id/backoffice | admin/admin.controller.ts |
| POST | /admin/organizers/:id/decision | admin/admin.controller.ts |
| POST | /admin/organizers/:id/risk-analysis | admin/admin.controller.ts |
| PATCH | /admin/organizers/:id/checklist | admin/admin.controller.ts |
| POST | /admin/organizer-documents/:id/decision | admin/admin.controller.ts |
| POST | /admin/organizers/:id/internal-notes | admin/admin.controller.ts |
| POST | /admin/organizers/:id/fee | admin/admin.controller.ts |
| GET | /admin/gateways | admin/admin.controller.ts |
| POST | /admin/gateways | admin/admin.controller.ts |
| GET | /admin/team | admin/admin.controller.ts |
| POST | /admin/team/invite | admin/admin.controller.ts |
| POST | /admin/team/:id/action | admin/admin.controller.ts |
| POST | /admin/team/invitations/:id/cancel | admin/admin.controller.ts |
| POST | /admin/team/invitations/:id/regenerate | admin/admin.controller.ts |
| GET | /admin/search | admin/admin.controller.ts |
| GET | /admin/users | admin/admin.controller.ts |
| GET | /admin/users/:id | admin/admin.controller.ts |
| POST | /admin/users/:id/action | admin/admin.controller.ts |
| PATCH | /admin/users/:id/permissions | admin/admin.controller.ts |
| GET | /admin/campaigns | admin/admin.controller.ts |
| GET | /admin/campaigns/:id | admin/admin.controller.ts |
| POST | /admin/campaigns/:id/action | admin/admin.controller.ts |
| GET | /admin/reports | admin/admin.controller.ts |
| GET | /admin/reports/:id | admin/admin.controller.ts |
| POST | /admin/reports/:id/resolve | admin/admin.controller.ts |
| GET | /admin/payments | admin/admin.controller.ts |
| GET | /admin/payments/:id | admin/admin.controller.ts |
| POST | /admin/payments/:id/review | admin/admin.controller.ts |
| GET | /admin/winners | admin/admin.controller.ts |
| GET | /admin/winners/:id | admin/admin.controller.ts |
| POST | /admin/winners/:id/action | admin/admin.controller.ts |
| GET | /admin/content | admin/admin.controller.ts |
| POST | /admin/content/banners | admin/admin.controller.ts |
| PATCH | /admin/content/banners/:id | admin/admin.controller.ts |
| POST | /admin/content/notices | admin/admin.controller.ts |
| PATCH | /admin/content/notices/:id | admin/admin.controller.ts |
| POST | /admin/content/pages | admin/admin.controller.ts |
| GET | /admin/settings | admin/admin.controller.ts |
| POST | /admin/settings/:key | admin/admin.controller.ts |
| GET | /admin/audit-logs | admin/admin.controller.ts |
| GET | /admin/health | admin/admin.controller.ts |
| GET | /admin/support | admin/admin.controller.ts |
| GET | /admin/support/:id | admin/admin.controller.ts |
| POST | /admin/support/:id/action | admin/admin.controller.ts |
| POST | /admin/support/:id/messages | admin/admin.controller.ts |
| GET | /admin/plans | admin/admin.controller.ts |
| POST | /admin/plans | admin/admin.controller.ts |
| GET | /admin/affiliates | affiliates/affiliate-admin.controller.ts |
| GET | /admin/affiliate-conversions | affiliates/affiliate-admin.controller.ts |
| GET | /admin/affiliate-payouts | affiliates/affiliate-admin.controller.ts |
| POST | /admin/affiliates/:id/suspend | affiliates/affiliate-admin.controller.ts |
| POST | /admin/affiliate-conversions/:id/cancel | affiliates/affiliate-admin.controller.ts |
| POST | /admin/affiliate-payouts/:id/review | affiliates/affiliate-admin.controller.ts |
| POST | /affiliate-programs | affiliates/affiliates.controller.ts |
| GET | /affiliate-programs/my | affiliates/affiliates.controller.ts |
| PATCH | /affiliate-programs/:id | affiliates/affiliates.controller.ts |
| POST | /affiliate-programs/:id/activate | affiliates/affiliates.controller.ts |
| POST | /affiliate-programs/:id/pause | affiliates/affiliates.controller.ts |
| GET | /affiliate-programs/:id/ranking | affiliates/affiliates.controller.ts |
| GET | /affiliates/organizer/dashboard | affiliates/affiliates.controller.ts |
| GET | /affiliates/organizer/conversions | affiliates/affiliates.controller.ts |
| GET | /affiliates/organizer/commissions | affiliates/affiliates.controller.ts |
| POST | /affiliates/organizer/commissions/:id/release | affiliates/affiliates.controller.ts |
| POST | /affiliates/organizer/commissions/:id/pay | affiliates/affiliates.controller.ts |
| POST | /affiliates/invite | affiliates/affiliates.controller.ts |
| GET | /affiliates/my | affiliates/affiliates.controller.ts |
| POST | /affiliates/:id/approve | affiliates/affiliates.controller.ts |
| POST | /affiliates/:id/suspend | affiliates/affiliates.controller.ts |
| POST | /affiliates/:id/cancel | affiliates/affiliates.controller.ts |
| POST | /affiliates/:id/resend | affiliates/affiliates.controller.ts |
| POST | /affiliates/invite/:code/accept | affiliates/affiliates.controller.ts |
| POST | /affiliate-links | affiliates/affiliates.controller.ts |
| POST | /affiliate-links/track | affiliates/affiliates.controller.ts |
| GET | /affiliate/dashboard | affiliates/affiliates.controller.ts |
| GET | /affiliate/links | affiliates/affiliates.controller.ts |
| GET | /affiliate/conversions | affiliates/affiliates.controller.ts |
| GET | /affiliate/commissions | affiliates/affiliates.controller.ts |
| POST | /affiliate/payouts | affiliates/affiliates.controller.ts |
| GET | /affiliate-materials | affiliates/affiliates.controller.ts |
| POST | /affiliate-materials | affiliates/affiliates.controller.ts |
| GET | /affiliate-coupons | affiliates/affiliates.controller.ts |
| POST | /affiliate-coupons | affiliates/affiliates.controller.ts |
| GET | /referrals/my-code | affiliates/affiliates.controller.ts |
| POST | /referrals/apply/:code | affiliates/affiliates.controller.ts |
| GET | / | app.controller.ts |
| GET | /auth/users | auth/auth.controller.ts |
| POST | /auth/register | auth/auth.controller.ts |
| POST | /auth/checkout/phone-lookup | auth/auth.controller.ts |
| POST | /auth/checkout/mini-register | auth/auth.controller.ts |
| POST | /auth/checkout/start | auth/auth.controller.ts |
| POST | /auth/checkout/complete | auth/auth.controller.ts |
| POST | /auth/login | auth/auth.controller.ts |
| POST | /auth/admin-login | auth/auth.controller.ts |
| POST | /auth/refresh | auth/auth.controller.ts |
| POST | /auth/forgot-password | auth/auth.controller.ts |
| POST | /auth/reset-password | auth/auth.controller.ts |
| GET | /auth/me | auth/auth.controller.ts |
| POST | /auth/logout | auth/auth.controller.ts |
| POST | /auth/logout-all | auth/auth.controller.ts |
| GET | /auth/sessions | auth/auth.controller.ts |
| DELETE | /auth/sessions/:id | auth/auth.controller.ts |
| GET | /auth/social/providers | auth/social/social-auth.controller.ts |
| POST | /auth/social/pending | auth/social/social-auth.controller.ts |
| POST | /auth/social/complete | auth/social/social-auth.controller.ts |
| POST | /auth/social/link | auth/social/social-auth.controller.ts |
| POST | /auth/social/:provider/start | auth/social/social-auth.controller.ts |
| POST | /auth/social/:provider/callback | auth/social/social-auth.controller.ts |
| GET | /buyer/home | buyer/buyer.controller.ts |
| GET | /buyer/campaigns | buyer/buyer.controller.ts |
| GET | /buyer/profile | buyer/buyer.controller.ts |
| PATCH | /buyer/profile | buyer/buyer.controller.ts |
| GET | /buyer/favorites | buyer/buyer.controller.ts |
| POST | /buyer/favorites/:campaignId | buyer/buyer.controller.ts |
| DELETE | /buyer/favorites/:campaignId | buyer/buyer.controller.ts |
| GET | /buyer/notifications | buyer/buyer.controller.ts |
| POST | /buyer/notifications/read-all | buyer/buyer.controller.ts |
| POST | /buyer/notifications/:id/read | buyer/buyer.controller.ts |
| GET | /buyer/support | buyer/buyer.controller.ts |
| POST | /buyer/support | buyer/buyer.controller.ts |
| GET | /buyer/support/:id | buyer/buyer.controller.ts |
| POST | /buyer/support/:id/messages | buyer/buyer.controller.ts |
| POST | /buyer/support/:id/close | buyer/buyer.controller.ts |
| POST | /campaigns | campaigns/campaigns.controller.ts |
| GET | /campaigns/my | campaigns/campaigns.controller.ts |
| GET | /campaigns/:id | campaigns/campaigns.controller.ts |
| GET | /campaigns/:id/media/:kind/:mediaId | campaigns/campaigns.controller.ts |
| GET | /campaigns/:id/media/:kind | campaigns/campaigns.controller.ts |
| PATCH | /campaigns/:id | campaigns/campaigns.controller.ts |
| DELETE | /campaigns/:id | campaigns/campaigns.controller.ts |
| POST | /campaigns/:id/publish | campaigns/campaigns.controller.ts |
| POST | /campaigns/:id/pause | campaigns/campaigns.controller.ts |
| POST | /campaigns/:id/finish | campaigns/campaigns.controller.ts |
| POST | /campaigns/:id/duplicate | campaigns/campaigns.controller.ts |
| GET | /campaigns/:id/milestones | campaigns/campaigns.controller.ts |
| PATCH | /campaigns/:id/milestones | campaigns/campaigns.controller.ts |
| POST | /campaigns/:id/milestones/evaluate | campaigns/campaigns.controller.ts |
| POST | /campaigns/:campaignId/milestones/:milestoneId/draw | campaigns/campaigns.controller.ts |
| POST | /campaigns/:id/images | campaigns/campaigns.controller.ts |
| DELETE | /campaigns/:id/images/:imageId | campaigns/campaigns.controller.ts |
| PATCH | /campaigns/:id/images/:imageId | campaigns/campaigns.controller.ts |
| GET | /draw-rule-templates | campaigns/draw-rule-templates.controller.ts |
| POST | /draw-rule-templates | campaigns/draw-rule-templates.controller.ts |
| POST | /draw-rule-templates/simulate | campaigns/draw-rule-templates.controller.ts |
| GET | /public/campaigns | campaigns/public-campaigns.controller.ts |
| GET | /public/campaigns/organizers/:organizerId/profile | campaigns/public-campaigns.controller.ts |
| GET | /public/campaigns/media/:campaignId/:kind/:mediaId | campaigns/public-campaigns.controller.ts |
| GET | /public/campaigns/media/:campaignId/:kind | campaigns/public-campaigns.controller.ts |
| GET | /public/campaigns/:slug/milestones | campaigns/public-campaigns.controller.ts |
| GET | /public/campaigns/:slug | campaigns/public-campaigns.controller.ts |
| GET | /admin/crm/overview | crm/crm-admin.controller.ts |
| GET | /admin/crm/failures | crm/crm-admin.controller.ts |
| GET | /crm/dashboard | crm/crm.controller.ts |
| GET | /crm/contacts | crm/crm.controller.ts |
| GET | /crm/contacts/:id | crm/crm.controller.ts |
| PATCH | /crm/contacts/:id/status | crm/crm.controller.ts |
| POST | /crm/contacts/:id/tags/:tagId | crm/crm.controller.ts |
| DELETE | /crm/contacts/:id/tags/:tagId | crm/crm.controller.ts |
| POST | /crm/contacts/:id/notes | crm/crm.controller.ts |
| GET | /crm/tags | crm/crm.controller.ts |
| POST | /crm/tags | crm/crm.controller.ts |
| PATCH | /crm/tags/:id | crm/crm.controller.ts |
| DELETE | /crm/tags/:id | crm/crm.controller.ts |
| GET | /crm/segments | crm/crm.controller.ts |
| POST | /crm/segments | crm/crm.controller.ts |
| POST | /crm/segments/preview | crm/crm.controller.ts |
| POST | /crm/segments/:id/calculate | crm/crm.controller.ts |
| PATCH | /crm/segments/:id | crm/crm.controller.ts |
| DELETE | /crm/segments/:id | crm/crm.controller.ts |
| GET | /crm/abandoned-reservations | crm/crm.controller.ts |
| GET | /crm/tasks | crm/crm.controller.ts |
| POST | /crm/tasks | crm/crm.controller.ts |
| POST | /crm/tasks/:id/complete | crm/crm.controller.ts |
| PATCH | /crm/tasks/:id/status | crm/crm.controller.ts |
| GET | /automations | crm/crm.controller.ts |
| POST | /automations | crm/crm.controller.ts |
| POST | /automations/:id/test | crm/crm.controller.ts |
| POST | /automations/:id/:status | crm/crm.controller.ts |
| GET | /message-templates | crm/crm.controller.ts |
| POST | /message-templates | crm/crm.controller.ts |
| PATCH | /message-templates/:id | crm/crm.controller.ts |
| POST | /message-templates/:id/duplicate | crm/crm.controller.ts |
| DELETE | /message-templates/:id | crm/crm.controller.ts |
| POST | /message-templates/:id/preview | crm/crm.controller.ts |
| GET | /outbound-messages | crm/crm.controller.ts |
| POST | /outbound-messages/:id/simulate | crm/crm.controller.ts |
| GET | /communications | crm/crm.controller.ts |
| POST | /communications/preview | crm/crm.controller.ts |
| POST | /communications | crm/crm.controller.ts |
| POST | /communications/:id/execute | crm/crm.controller.ts |
| POST | /communications/:id/cancel | crm/crm.controller.ts |
| GET | /marketing-campaigns | crm/crm.controller.ts |
| POST | /marketing-campaigns | crm/crm.controller.ts |
| POST | /marketing-campaigns/:id/simulate | crm/crm.controller.ts |
| GET | /notifications | crm/crm.controller.ts |
| POST | /notifications/read-all | crm/crm.controller.ts |
| POST | /notifications/:id/read | crm/crm.controller.ts |
| DELETE | /notifications/:id | crm/crm.controller.ts |
| GET | /notification-preferences | crm/crm.controller.ts |
| PATCH | /notification-preferences/:category | crm/crm.controller.ts |
| GET | /crm/export/:format | crm/crm.controller.ts |
| POST | /draw-rules/simulate | draws/draws.controller.ts |
| POST | /campaigns/:id/draw/simulate | draws/draws.controller.ts |
| POST | /campaigns/:id/draw/execute | draws/draws.controller.ts |
| POST | /campaigns/:id/draw/confirm | draws/draws.controller.ts |
| GET | /campaigns/:id/draw | draws/draws.controller.ts |
| GET | /campaigns/:id/draw/audit | draws/draws.controller.ts |
| POST | /campaigns/:id/winner-lookup/automatic | draws/draws.controller.ts |
| POST | /campaigns/:id/winner-lookup/manual | draws/draws.controller.ts |
| GET | /campaigns/:id/winner-lookup/history | draws/draws.controller.ts |
| GET | /campaigns/:id/instant-prizes/results | draws/draws.controller.ts |
| GET | /organizer/prize-tickets | draws/draws.controller.ts |
| GET | /organizer/prize-tickets/summary | draws/draws.controller.ts |
| POST | /organizer/prize-tickets | draws/draws.controller.ts |
| PATCH | /organizer/prize-tickets/:id | draws/draws.controller.ts |
| POST | /organizer/prize-tickets/:id/:action | draws/draws.controller.ts |
| GET | /organizer/prize-tickets/:id/history | draws/draws.controller.ts |
| GET | /winners/organizer | draws/draws.controller.ts |
| PATCH | /winners/:id/status | draws/draws.controller.ts |
| GET | /winners/my | draws/draws.controller.ts |
| POST | /winners/:id/confirm-receipt | draws/draws.controller.ts |
| GET | /winners/my-instant-prizes | draws/draws.controller.ts |
| GET | /public/campaigns/:slug/instant-prizes | draws/draws.controller.ts |
| GET | /roulette/campaigns/:id/status | draws/draws.controller.ts |
| POST | /roulette/campaigns/:id/spin | draws/draws.controller.ts |
| GET | /roulette/organizer/campaigns/:id | draws/draws.controller.ts |
| GET | /public/winners/verify/:code | draws/draws.controller.ts |
| POST | /admin/lottery-draws | draws/draws.controller.ts |
| GET | /admin/lottery-draws | draws/draws.controller.ts |
| GET | /admin/lottery-draws/:id | draws/draws.controller.ts |
| PATCH | /admin/lottery-draws/:id | draws/draws.controller.ts |
| POST | /admin/lottery-draws/:id/verify | draws/draws.controller.ts |
| POST | /admin/lottery-draws/:id/reject | draws/draws.controller.ts |
| POST | /admin/lottery-draws/:id/lock | draws/draws.controller.ts |
| GET | /admin/campaign-draws | draws/draws.controller.ts |
| GET | /admin/campaign-draws/:id | draws/draws.controller.ts |
| POST | /admin/campaign-draws/:id/invalidate | draws/draws.controller.ts |
| GET | /finance/overview | finance/finance.controller.ts |
| GET | /finance/balance | finance/finance.controller.ts |
| GET | /finance/statement | finance/finance.controller.ts |
| GET | /finance/campaigns | finance/finance.controller.ts |
| GET | /finance/campaigns/:campaignId | finance/finance.controller.ts |
| GET | /finance/fees | finance/finance.controller.ts |
| GET | /finance/payouts | finance/finance.controller.ts |
| GET | /finance/payouts/:id | finance/finance.controller.ts |
| POST | /finance/payouts | finance/finance.controller.ts |
| POST | /finance/payouts/:id/cancel | finance/finance.controller.ts |
| GET | /finance/reports | finance/finance.controller.ts |
| GET | /admin/finance/overview | finance/finance.controller.ts |
| GET | /admin/finance/revenue | finance/finance.controller.ts |
| GET | /admin/finance/organizers | finance/finance.controller.ts |
| GET | /admin/finance/campaigns | finance/finance.controller.ts |
| GET | /admin/finance/ledger | finance/finance.controller.ts |
| GET | /admin/finance/ledger/:id | finance/finance.controller.ts |
| GET | /admin/finance/accounts | finance/finance.controller.ts |
| GET | /admin/finance/accounts/:id | finance/finance.controller.ts |
| POST | /admin/finance/accounts/:id/block | finance/finance.controller.ts |
| POST | /admin/finance/accounts/:id/unblock | finance/finance.controller.ts |
| GET | /admin/finance/payouts | finance/finance.controller.ts |
| GET | /admin/finance/payouts/:id | finance/finance.controller.ts |
| POST | /admin/finance/payouts/:id/approve | finance/finance.controller.ts |
| POST | /admin/finance/payouts/:id/reject | finance/finance.controller.ts |
| POST | /admin/finance/payouts/:id/mark-processing | finance/finance.controller.ts |
| POST | /admin/finance/payouts/:id/mark-completed | finance/finance.controller.ts |
| POST | /admin/finance/adjustments | finance/finance.controller.ts |
| GET | /admin/finance/adjustments | finance/finance.controller.ts |
| GET | /admin/finance/adjustments/:id | finance/finance.controller.ts |
| GET | /admin/finance/subscriptions | finance/finance.controller.ts |
| GET | /admin/finance/subscriptions/:id | finance/finance.controller.ts |
| GET | /admin/finance/reconciliation | finance/finance.controller.ts |
| GET | /admin/finance/export/:resource | finance/finance.controller.ts |
| GET | /promotions/dashboard | growth/growth.controller.ts |
| GET | /promotions | growth/growth.controller.ts |
| GET | /promotions/:id/report | growth/growth.controller.ts |
| GET | /promotions/:id/history | growth/growth.controller.ts |
| POST | /promotions | growth/growth.controller.ts |
| PATCH | /promotions/:id | growth/growth.controller.ts |
| POST | /promotions/:id/activate | growth/growth.controller.ts |
| POST | /promotions/:id/pause | growth/growth.controller.ts |
| POST | /promotions/:id/end | growth/growth.controller.ts |
| POST | /promotions/:id/duplicate | growth/growth.controller.ts |
| DELETE | /promotions/:id | growth/growth.controller.ts |
| POST | /promotion-quote | growth/growth.controller.ts |
| GET | /sortex-ads/integration/status | growth/growth.controller.ts |
| POST | /sortex-ads/integration/assets | growth/growth.controller.ts |
| GET | /sortex-ads/dashboard | growth/growth.controller.ts |
| GET | /sortex-ads | growth/growth.controller.ts |
| POST | /sortex-ads | growth/growth.controller.ts |
| PATCH | /sortex-ads/:id | growth/growth.controller.ts |
| POST | /sortex-ads/:id/activate | growth/growth.controller.ts |
| POST | /sortex-ads/:id/pause | growth/growth.controller.ts |
| POST | /sortex-ads/:id/end | growth/growth.controller.ts |
| POST | /sortex-ads/:id/duplicate | growth/growth.controller.ts |
| POST | /sortex-ads/:id/publish | growth/growth.controller.ts |
| POST | /sortex-ads/:id/sync | growth/growth.controller.ts |
| DELETE | /sortex-ads/:id | growth/growth.controller.ts |
| POST | /track/ads/:code | growth/growth.controller.ts |
| GET | /ai-sortex/advisor | growth/growth.controller.ts |
| POST | /ai-sortex/advisor/chat | growth/growth.controller.ts |
| POST | /ai-sortex/advisor/simulate | growth/growth.controller.ts |
| POST | /ai-sortex/advisor/message | growth/growth.controller.ts |
| POST | /ai-sortex/advisor/ad-strategy | growth/growth.controller.ts |
| GET | /ai-sortex | growth/growth.controller.ts |
| POST | /ai-sortex/generate | growth/growth.controller.ts |
| PATCH | /ai-sortex/:id/feedback | growth/growth.controller.ts |
| GET | /health | infrastructure/health.controller.ts |
| GET | /health/live | infrastructure/health.controller.ts |
| GET | /health/ready | infrastructure/health.controller.ts |
| GET | /health/metrics | infrastructure/health.controller.ts |
| GET | /legal/public | legal/legal.controller.ts |
| GET | /legal/public/:slug | legal/legal.controller.ts |
| GET | /legal/acceptances/me | legal/legal.controller.ts |
| GET | /legal/pending | legal/legal.controller.ts |
| POST | /legal/:slug/accept | legal/legal.controller.ts |
| GET | /legal/data-requests/me | legal/legal.controller.ts |
| POST | /legal/data-requests | legal/legal.controller.ts |
| GET | /admin/legal | legal/legal.controller.ts |
| POST | /admin/legal | legal/legal.controller.ts |
| GET | /admin/legal/:id | legal/legal.controller.ts |
| PUT | /admin/legal/:id | legal/legal.controller.ts |
| DELETE | /admin/legal/:id | legal/legal.controller.ts |
| POST | /admin/legal/:id/duplicate | legal/legal.controller.ts |
| POST | /admin/legal/:id/publish | legal/legal.controller.ts |
| POST | /admin/legal/:id/archive | legal/legal.controller.ts |
| GET | /admin/legal/:id/history | legal/legal.controller.ts |
| POST | /admin/legal/:id/restore | legal/legal.controller.ts |
| GET | /admin/legal/:id/acceptances | legal/legal.controller.ts |
| GET | /admin/legal/:id/pending-users | legal/legal.controller.ts |
| GET | /admin/legal/:id/pdf | legal/legal.controller.ts |
| POST | /admin/legal/assets | legal/legal.controller.ts |
| GET | /admin/legal/assets/file/:token | legal/legal.controller.ts |
| GET | /admin/media/overview | media/media-admin.controller.ts |
| POST | /admin/media/templates | media/media-admin.controller.ts |
| POST | /admin/media/templates/:id/deactivate | media/media-admin.controller.ts |
| GET | /admin/media/failures | media/media-admin.controller.ts |
| GET | /media/templates | media/media.controller.ts |
| POST | /media/templates | media/media.controller.ts |
| GET | /media/brand-profile | media/media.controller.ts |
| PATCH | /media/brand-profile | media/media.controller.ts |
| POST | /media/generated | media/media.controller.ts |
| GET | /media/generated/my | media/media.controller.ts |
| GET | /media/generated/:id | media/media.controller.ts |
| PATCH | /media/generated/:id | media/media.controller.ts |
| POST | /media/generated/:id/preview | media/media.controller.ts |
| POST | /media/generated/:id/render | media/media.controller.ts |
| POST | /media/generated/:id/duplicate | media/media.controller.ts |
| POST | /media/generated/:id/share-link | media/media.controller.ts |
| DELETE | /media/generated/:id | media/media.controller.ts |
| POST | /media/render-jobs/:id/process | media/media.controller.ts |
| GET | /media/generated/:id/file/:kind | media/media.controller.ts |
| POST | /media/winner-content/:winnerId | media/media.controller.ts |
| POST | /media/campaign-content/:campaignId | media/media.controller.ts |
| GET | /share/:code | media/media.controller.ts |
| GET | /dashboard | organizer-platform/dashboard.controller.ts |
| GET | /organizer/integrations | organizer-platform/integrations.controller.ts |
| PUT | /organizer/integrations | organizer-platform/integrations.controller.ts |
| POST | /organizer/integrations/interests | organizer-platform/integrations.controller.ts |
| POST | /organizer/integrations/:id/connect | organizer-platform/integrations.controller.ts |
| POST | /organizer/integrations/:id/test | organizer-platform/integrations.controller.ts |
| POST | /organizer/integrations/:id/sync | organizer-platform/integrations.controller.ts |
| POST | /organizer/integrations/:id/disconnect | organizer-platform/integrations.controller.ts |
| GET | /organizer/integrations/:id/logs | organizer-platform/integrations.controller.ts |
| POST | /organizer/integrations/:id/whatsapp/templates | organizer-platform/integrations.controller.ts |
| GET | /organizer/integrations/oauth/meta/start | organizer-platform/integrations.controller.ts |
| GET | /integrations/meta/callback | organizer-platform/integrations.controller.ts |
| GET | /integrations/meta/webhook | organizer-platform/integrations.controller.ts |
| POST | /integrations/meta/webhook | organizer-platform/integrations.controller.ts |
| GET | /mini-campaigns | organizer-platform/mini-campaigns.controller.ts |
| GET | /mini-campaigns/:id | organizer-platform/mini-campaigns.controller.ts |
| POST | /mini-campaigns | organizer-platform/mini-campaigns.controller.ts |
| PATCH | /mini-campaigns/:id | organizer-platform/mini-campaigns.controller.ts |
| POST | /mini-campaigns/:id/publish | organizer-platform/mini-campaigns.controller.ts |
| POST | /mini-campaigns/:id/pause | organizer-platform/mini-campaigns.controller.ts |
| POST | /mini-campaigns/:id/finish | organizer-platform/mini-campaigns.controller.ts |
| POST | /mini-campaigns/:id/duplicate | organizer-platform/mini-campaigns.controller.ts |
| POST | /mini-campaigns/:id/result | organizer-platform/mini-campaigns.controller.ts |
| DELETE | /mini-campaigns/:id | organizer-platform/mini-campaigns.controller.ts |
| GET | /public/mini-campaigns/:slug | organizer-platform/mini-campaigns.controller.ts |
| POST | /public/mini-campaigns/:slug/reserve | organizer-platform/mini-campaigns.controller.ts |
| GET | /organizer/orders | organizer-platform/orders.controller.ts |
| GET | /organizer/orders/:id | organizer-platform/orders.controller.ts |
| GET | /organizer/personalization | organizer-platform/personalization.controller.ts |
| PATCH | /organizer/personalization/brand | organizer-platform/personalization.controller.ts |
| POST | /organizer/personalization/assets/:kind | organizer-platform/personalization.controller.ts |
| DELETE | /organizer/personalization/assets/:kind | organizer-platform/personalization.controller.ts |
| POST | /organizer/personalization/reset | organizer-platform/personalization.controller.ts |
| POST | /organizer/personalization/social-links | organizer-platform/personalization.controller.ts |
| PATCH | /organizer/personalization/social-links/:id | organizer-platform/personalization.controller.ts |
| DELETE | /organizer/personalization/social-links/:id | organizer-platform/personalization.controller.ts |
| POST | /organizer/personalization/communities | organizer-platform/personalization.controller.ts |
| PATCH | /organizer/personalization/communities/:id | organizer-platform/personalization.controller.ts |
| DELETE | /organizer/personalization/communities/:id | organizer-platform/personalization.controller.ts |
| POST | /organizer/personalization/domains | organizer-platform/personalization.controller.ts |
| POST | /organizer/personalization/domains/:id/verify | organizer-platform/personalization.controller.ts |
| DELETE | /organizer/personalization/domains/:id | organizer-platform/personalization.controller.ts |
| POST | /organizer/personalization/templates | organizer-platform/personalization.controller.ts |
| DELETE | /organizer/personalization/templates/:id | organizer-platform/personalization.controller.ts |
| GET | /organizers/:organizerId/brand-assets/:kind | organizer-platform/personalization.controller.ts |
| GET | /plans | organizer-platform/plans.controller.ts |
| GET | /plans/me | organizer-platform/plans.controller.ts |
| POST | /plans/select | organizer-platform/plans.controller.ts |
| POST | /plans/cancel | organizer-platform/plans.controller.ts |
| POST | /plans/reactivate | organizer-platform/plans.controller.ts |
| POST | /plans/onboarding/complete | organizer-platform/plans.controller.ts |
| PATCH | /admin/organizers/:userId/commercial-terms | organizers/admin-organizers.controller.ts |
| GET | /organizers/me/profile | organizers/organizers.controller.ts |
| PATCH | /organizers/me/profile | organizers/organizers.controller.ts |
| PATCH | /organizers/me/account | organizers/organizers.controller.ts |
| POST | /organizers/me/logo | organizers/organizers.controller.ts |
| POST | /organizers/me/documents | organizers/organizers.controller.ts |
| POST | /organizers/me/submit | organizers/organizers.controller.ts |
| GET | /organizers/documents/:documentId/file | organizers/organizers.controller.ts |
| GET | /organizers/:userId/logo | organizers/organizers.controller.ts |
| GET | /payments/organizer/summary | payments/organizer-payments.controller.ts |
| POST | /webhooks/payments/mercado-pago | payments/payment-webhooks.controller.ts |
| POST | /payments/pix | payments/payments.controller.ts |
| POST | /payments/card | payments/payments.controller.ts |
| GET | /payments/config | payments/payments.controller.ts |
| GET | /payments/my | payments/payments.controller.ts |
| GET | /payments/purchase/:purchaseId | payments/payments.controller.ts |
| POST | /payments/:id/cancel | payments/payments.controller.ts |
| POST | /payments/:id/refresh | payments/payments.controller.ts |
| POST | /payments/:id/refund-request | payments/payments.controller.ts |
| GET | /payments/:id | payments/payments.controller.ts |
| POST | /purchases/internal/expire | purchases/internal-purchases.controller.ts |
| GET | /purchases/organizer/summary | purchases/organizer-purchases.controller.ts |
| GET | /purchases/organizer/expired-instant-prizes | purchases/organizer-purchases.controller.ts |
| POST | /purchases/organizer/expired-instant-prizes/:id/viewed | purchases/organizer-purchases.controller.ts |
| GET | /purchases/organizer/instant-prize-summary | purchases/organizer-purchases.controller.ts |
| GET | /public/campaigns/:slug/availability | purchases/public-availability.controller.ts |
| GET | /public/campaigns/:slug/numbers | purchases/public-availability.controller.ts |
| GET | /public/campaigns/:slug/promotions | purchases/public-availability.controller.ts |
| POST | /purchases/reserve-random | purchases/purchases.controller.ts |
| POST | /purchases/reserve-manual | purchases/purchases.controller.ts |
| GET | /purchases/current | purchases/purchases.controller.ts |
| GET | /purchases/my | purchases/purchases.controller.ts |
| GET | /purchases/:id/tickets | purchases/purchases.controller.ts |
| POST | /purchases/:id/cancel | purchases/purchases.controller.ts |
| GET | /purchases/:id | purchases/purchases.controller.ts |

### App nativo

Advisor, Campaign, CampaignOrders, Campaigns, Crm, DrawRoom, Forgot, Home, Login, Main, Order, Orders, Profile, Register, Reset, Results

### Destinos do portal

- #turbo
- /dashboard
- /dashboard/ads
- /dashboard/ads?action=create
- /dashboard/afiliados
- /dashboard/campanhas
- /dashboard/campanhas/ganhadores
- /dashboard/campanhas/nova
- /dashboard/comunicacao
- /dashboard/comunicacao?tab=new
- /dashboard/comunicacao?tab=new&audience=ABANDONED&ai=1
- /dashboard/comunicacao?tab=schedules
- /dashboard/configuracoes
- /dashboard/configuracoes/juridico
- /dashboard/configuracoes/plano
- /dashboard/crm
- /dashboard/crm/automacoes
- /dashboard/crm/contatos
- /dashboard/crm/notificacoes
- /dashboard/crm/reservas-abandonadas
- /dashboard/crm/segmentos
- /dashboard/crm/tarefas
- /dashboard/financeiro
- /dashboard/ganhadores
- /dashboard/ia
- /dashboard/integracoes
- /dashboard/mini-campanhas
- /dashboard/pedidos
- /dashboard/personalizacao
- /dashboard/promocoes
- /dashboard/sorteios
- /organizador/gateways/mercado-pago
- /organizador/midias
- /organizador/verificacao
- /perfil

### Testes Playwright encontrados

- admin-authorization.spec.ts
- admin-critical-resources.spec.ts
- admin-finance.spec.ts
- admin-organizers.spec.ts
- admin-phase6.spec.ts
- ai-advisor-full.spec.ts
- authenticated-modules.spec.ts
- automations.spec.ts
- campaign-numeric-fields.spec.ts
- communication-full.spec.ts
- dashboard-campaigns-sync.spec.ts
- integrated-access-review.spec.ts
- leads.spec.ts
- milestone-image.spec.ts
- mini-affiliates.spec.ts
- mvp-buyer-journey.spec.ts
- mvp-organizer-journey.spec.ts
- mvp-smoke.spec.ts
- operational-final-auth.spec.ts
- organizer-home-review.spec.ts
- personalization-persistence.spec.ts
- prize-tickets-full.spec.ts
- profile-settings-full.spec.ts
- promotions-full.spec.ts
- public-campaign-chrome.spec.ts
- registration-phase1.spec.ts
- verification-image-roulette.spec.ts

## Atualização de evidência · 25/11

| Fluxo | Evidência nova | Situação para aceite |
|---|---|---|
| Cadastro e login cruzados de organizadores | Mesmo ID de usuário/perfil/papel, HTTP real com Next, Nest e PostgreSQL local | Parcial: requer candidata hospedada, aparelho e SecureStore |
| Criar e editar rascunho | Mesmo ID, novo título persistido de cliente móvel HTTP → web | Parcial: requer telas nativas no aparelho |
| Isolamento | Segundo organizador não listou nem alterou o rascunho | Parcial: repetir em candidata hospedada e após trocar conta no portal |
