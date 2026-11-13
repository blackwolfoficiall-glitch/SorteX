# SorteX — estado atual verificado

> Registro da auditoria anterior, preservado. Este arquivo foi incorporado ao checkout da branch `infra/netlify-northflank-neon`; as afirmações abaixo sobre ausência de checkout e autorização somente documental descrevem aquela etapa. Para a migração autorizada depois, consulte `SORTEX_MIGRACAO_GRATUITA.md`. Nenhum estado do Mac foi conferido nesta sessão.

Data da auditoria: 13/11/2026 (UTC).

## Escopo e preservação

Este relatório resulta de leitura do GitHub e da inspeção do ambiente desta sessão. Não é uma auditoria do disco do Mac nem uma certificação de produção. Nenhum teste, build, migration, seed, commit, push, merge, deploy ou alteração de configuração foi executado pela auditoria.

Os quatro documentos de continuidade foram criados com autorização expressa do proprietário. Estão em `/workspace/sortex-continuity/docs/`, no ambiente de entrega em nuvem, fora de um checkout Git. Ainda não foram adicionados ao projeto original ou ao GitHub. Não constituem backup do código, bancos, uploads ou histórico local.

## Identidade e referências

- Repositório original: https://github.com/blackwolfoficiall-glitch/SorteX
- Projeto local informado pelo proprietário: `/Users/valbert/Projetos/SorteX` (inacessível nesta sessão).
- Branch padrão/remota consultada: `main`.
- Snapshot auditado: `2b8e8503eb33e73136cd076dbd322c78945c2ffe`, de 31/07/2026.
- A listagem remota consultada retornou apenas `main`, com `protected: false`. Não foram alteradas proteções.
- `infra/free-homologacao`: indicada pelo proprietário, não localizada no remoto. Pode existir apenas no Mac. Não recriar, apagar ou substituir antes da conferência local.

Os caminhos abaixo são relativos ao repositório nesse snapshot. A base para consultar evidências é:
https://github.com/blackwolfoficiall-glitch/SorteX/blob/2b8e8503eb33e73136cd076dbd322c78945c2ffe/

## Arquitetura

Monorepositório com frontend Next.js 16.2.12/React 19.2.4 em `apps/web`, backend NestJS 11 em `services/api` e PostgreSQL/Prisma 6. O frontend possui rotas intermediárias de comunicação com a API. O schema canônico é `services/api/prisma/schema.prisma`.

`docker-compose.yml` descreve PostgreSQL 17, API e frontend, com volumes para banco e uploads. `render.yaml` descreve homologação na Render. Os arquivos de configuração não comprovam serviços em execução.

Fontes: `apps/web/package.json`, `services/api/package.json`, `docker-compose.yml`, `services/api/src/main.ts`.

## Matriz de implementação

Implementado significa que há código identificado; não significa jornada integral aprovada. Aprovação do proprietário e execução bem-sucedida não foram presumidas.

| Área | Evidência no código | Limite de validação |
| --- | --- | --- |
| Administração | `services/api/src/admin/admin.service.ts`: usuários, campanhas, pagamentos, organizadores, documentos, equipe, convites, conteúdo, suporte, saúde e auditoria | Revisão ponta a ponta e operacional pendente |
| Organizador | `organizer-platform/organizer-platform.service.ts`: dashboard, planos, personalização, links, pedidos, templates e minicampanhas | Planos em teste; domínio não é ativado sem confirmação DNS real |
| Comprador | `auth/auth.service.ts`, domínio `buyer`, compras e títulos | Jornada com banco e navegador não executada nesta auditoria |
| Campanhas e reservas | Domínios `campaigns` e `purchases`, com testes presentes | Concorrência real e estado do banco não confirmados |
| Pagamentos | `payments/payments.service.ts` e `payments/gateways/mercado-pago.provider.ts` | Mercado Pago Orders, somente sandbox para criação de pagamentos; configuração externa desconhecida |
| Financeiro | `finance/commercial-terms.service.ts`, integração com ledger em `payments.service.ts`, documentação `docs/finance.md` | Saldos internos não comprovam saldo no gateway; repasse real não validado |
| Afiliados | `affiliates/affiliate-commission.service.ts` | Conversão/comissão e reversão presentes; saída automática de dinheiro não comprovada |
| Sorteios | `draws/draw-rule-engine.service.ts`, `draws/draws.service.ts` | Motor determinístico e confirmação separados; homologação completa pendente |
| CRM | `crm/crm.service.ts` e `crm/crm-sync.service.ts` | Contatos, segmentos, tarefas, comunicação e simulações; não presumir envio externo |
| Mídia | Domínio `media`, documentação anterior e testes presentes | Renderização externa e autorização operacional não verificadas |
| Jurídico | Schema e domínio `legal`, com testes presentes | Não equivale a aprovação jurídica |

Os caminhos de domínios da tabela pertencem a `services/api/src/`, salvo indicação diferente.

## Pagamentos, taxas e comissões

O provider do Mercado Pago rejeita criação de pagamentos fora de `PAYMENT_ENV=sandbox`. Webhook valida assinatura e timestamp; a tolerância de timestamp no código é de cinco minutos. O processamento confere valor/referência e usa transação serializável, eventos idempotentes e integração com ledger, afiliados e CRM.

`PaymentsService.refreshStatus` também consulta o gateway e chama o processamento de atualização. Portanto, a documentação antiga que descreve polling apenas local e confirmação exclusivamente por webhook não representa integralmente o snapshot atual.

`CommercialTermsService` contém taxas padrão BASIC 2,9%, PROFESSIONAL 2,4%, PREMIUM/ENTERPRISE 1,9%, condições de campanha/perfil e isenções. A tarifa estimada do gateway permanece separada. A primeira campanha gratuita é calculada pela ausência de campanhas anteriores; conferir a correspondência com o requisito documental de registrar a campanha consumidora.

Há código de comissões de afiliado e reversão. Não há comprovação de split, saque, repasse ou pagamento de prêmio efetivo. Documentação financeira descreve solicitações e conclusão administrativa sem transferência real.

## Apuração e regras

O motor deriva resultados de prêmios e regra versionada. Há normalização, política para número não vendido, snapshots e auditoria. `CUSTOM_PIPELINE` permanece reservado. Execução cria prévia; confirmação verifica título `SOLD`. Extrações `VERIFIED`/`LOCKED` são verificadas no fluxo de execução. Consulta automática/manual de ganhador não equivale à confirmação oficial.

O hash representa integridade interna; não comprova sozinho autenticidade de fonte externa. Não há confirmação de integração oficial em operação ou pagamento automático de prêmio.

## Autenticação e permissões

`auth/auth.service.ts` contém bcrypt, JWT, sessões, refresh com hash/rotação/revogação e recuperação de senha. `auth/guards/admin-permission.guard.ts` e `auth/policies/admin-authorization.policy.ts` aplicam permissões granulares: `SUPERADMIN` tem acesso específico; ausência de permissões não concede automaticamente acesso total.

Há código de validação de entrada, CORS e erros sanitizados em `main.ts`. Esses controles precisam de verificação no domínio e no ambiente reais.

## Integrações

- Mercado Pago: implementação concreta de Orders API e validação de webhooks; criação restrita a sandbox.
- SMTP: `auth/password-reset-mail.service.ts` usa Nodemailer quando configurado. Sem SMTP em desenvolvimento, registra link de recuperação no log; tratar logs como sensíveis.
- Meta/WhatsApp: `organizer-platform/integrations.service.ts` contém OAuth, chamadas Graph API, webhook e envio de template. Há modos de teste e caminho de envio real; não presumir integração ativa ou universalmente bloqueada.
- OpenAI: `growth/ai-advisor.service.ts` contém chamada à Responses API condicionada à configuração.
- Credenciais de integrações: há criptografia AES-256-GCM no serviço de integrações; valores/configuração não foram acessados.
- Cache/jobs: documentação descreve execução local e evolução futura para coordenação distribuída. Não comprova operação multi-instância.

## Banco, migrations e testes

O snapshot contém 99 modelos, 107 enums e 16 migrations SQL. A existência de migrations não comprova compatibilidade de todo o histórico, aplicação no banco local ou aplicação em homologação. Nenhum banco foi acessado.

Foram contados 38 arquivos `.spec.ts` em `services/api/src` e 24 em `apps/web/e2e`, além do teste E2E da API. As contagens não são contagens de casos nem de testes aprovados. Playwright configura desktop e perfis móveis; o perfil iPhone usa Chromium, sem comprovar teste no Safari/iOS real.

A CI do commit auditado falhou em `prisma validate`, após `npm ci` bem-sucedido. Testes, builds e verificações posteriores foram pulados. A causa específica não foi diagnosticada.
Evidência: https://github.com/blackwolfoficiall-glitch/SorteX/actions/runs/30623693093

## Infraestrutura e homologação

`render.yaml` configura web/API em Oregon, PostgreSQL `basic-256mb`, disco persistente, auto deploy desligado e `prisma migrate deploy` no pré-deploy. Não executar esse fluxo sem autorização. Não foram consultados painel da Render, faturas, DNS ou banco remoto.

Não foi encontrada configuração identificável da hospedagem gratuita substituta. O estado operacional da homologação e o histórico de saída da Render permanecem desconhecidos. Preparação da Render está comprovada; migração para fora dela não está.

## Documentação anterior preservada

Foram encontrados equivalentes parciais: `docs/project-inventory.md`, `docs/final-readiness-report.md`, `docs/database-migration-plan.md`, `docs/homologation-checklist.md`, `docs/production-readiness-checklist.md`, `docs/admin-panel.md`, `docs/payments.md`, `docs/render-homologation.md`, entre outros. Nenhum foi alterado.

Divergências: inventário antigo cita 72 modelos/quatro migrations; pagamento antigo limita confirmação ao webhook; texto administrativo antigo admite acesso amplo por compatibilidade. O código e as contagens atuais divergem dessas descrições. Relatos antigos de lint, vulnerabilidades e testes não foram repetidos e não devem ser apresentados como resultados atuais.

## O que depende do Mac

Branch ativa, remotos locais sanitizados, commits não enviados, alterações rastreadas, arquivos não rastreados/ignorados, branch `infra/free-homologacao`, stashes, bancos, volumes Docker, backups, uploads e configurações locais. O `.gitignore` exclui explicitamente configurações locais, backups, armazenamento e dumps; o GitHub não preserva automaticamente esses itens.

Não há evidência suficiente para afirmar preservação integral, prontidão de produção ou próxima funcionalidade previamente aprovada. A próxima etapa é a conferência local descrita em `SORTEX_PENDENCIAS.md`.
