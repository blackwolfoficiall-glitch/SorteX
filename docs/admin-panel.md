# Painel administrativo da SorteX

## Arquitetura e segurança

O Módulo 8 vive em `services/api/src/admin` e reutiliza autenticação, organizadores, sorteios e financeiro. Todas as rotas são protegidas por JWT, `RolesGuard` e `ADMIN`. `AdminPermissionGuard` adiciona permissões granulares; administradores antigos sem lista explícita continuam como superadministradores para compatibilidade. Ao configurar uma lista, todas as permissões exigidas precisam estar presentes.

Não existe exclusão física administrativa de usuários, pagamentos ou registros financeiros. Bloqueios usam status e revogação de sessões. Ações sensíveis exigem justificativa e criam `AuditLog`.

## Domínios

- `/admin/dashboard`: indicadores e séries operacionais reais.
- `/admin/users`: busca, perfil, bloqueio, suspensão, sessões e permissões.
- `/admin/organizers`: fluxo existente de documentos, revisão e condições comerciais.
- `/admin/campaigns`: moderação sem alteração silenciosa de regras publicadas.
- `/admin/reports`: denúncias e resolução.
- `/admin/payments`: consulta sanitizada e marcação para revisão; não aprova manualmente.
- `/admin/finance`: ledger, saldos, ajustes e repasses do Módulo 7.
- `/admin/lottery-draws` e `/admin/campaign-draws`: motor auditável do Módulo 6.
- `/admin/winners`: disputa, entrega e autorização de divulgação.
- `/admin/content`: banners, avisos e páginas.
- `/admin/settings`: configurações tipadas via `PlatformSettingsService`.
- `/admin/audit-logs`: consulta somente leitura.
- `/admin/support`: chamados, atribuição, status e mensagens.
- `/admin/health`: consultas internas de inconsistência.

## Moderação

Campanhas podem ser aprovadas, devolvidas para correção, pausadas, reativadas, canceladas, bloqueadas para compra/publicação ou destacadas. A regra do sorteio não é reescrita pelo painel. Campanhas com vendas preservam seus campos críticos.

Organizadores podem ser aprovados, rejeitados, suspensos ou bloqueados. Decisões registram estado anterior, novo estado, administrador, horário e justificativa. Condições comerciais continuam usando `CommercialTermsService` como fonte de cálculo.

## Conteúdo e configurações

`PlatformBanner`, `PlatformNotice`, `ContentPage` e `FeaturedCampaign` suportam ativação, ordem e períodos. `PlatformSetting` armazena JSON por chave e categoria; outros módulos devem consumir o serviço tipado, não consultar a tabela diretamente.

## Suporte, notificações e saúde

Chamados possuem categoria, prioridade, responsável, status e mensagens. Respostas administrativas criam notificação interna. Não há envio externo.

A saúde operacional deriva falhas de webhook, reservas vencidas, saldos negativos, campanhas sem regra, sorteios pendentes, documentos pendentes e repasses atrasados. Não substitui observabilidade externa.

## Limitações

- alterações Prisma ainda dependem de migração revisada;
- permissões granulares precisam ser atribuídas após a migração;
- planos dinâmicos estão preparados, mas a migração completa do cálculo comercial exige decisão futura;
- não há antifraude, análise automática de documentos, WhatsApp, push ou e-mail;
- não existe movimentação financeira real nem aprovação manual de pagamentos;
- produção exige revisão de segurança, privacidade e operação.
