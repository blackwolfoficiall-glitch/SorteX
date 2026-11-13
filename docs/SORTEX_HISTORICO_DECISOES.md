# SorteX — histórico verificável e decisões

> Registro da auditoria anterior, preservado. Este arquivo foi incorporado ao checkout da branch `infra/netlify-northflank-neon`; as afirmações abaixo sobre ausência de checkout e autorização somente documental descrevem aquela etapa. Para a migração autorizada depois, consulte `SORTEX_MIGRACAO_GRATUITA.md`. Nenhum estado do Mac foi conferido nesta sessão.

Auditoria em 13/11/2026. Repositório: https://github.com/blackwolfoficiall-glitch/SorteX
Snapshot: `main` em `2b8e8503eb33e73136cd076dbd322c78945c2ffe`.

## Limites das fontes

Fontes: commits remotos, documentos anteriores, código e instruções do proprietário nesta sessão. A conversa original SorteX e o disco do Mac não estavam acessíveis. Não foram recuperadas decisões ausentes dessas fontes. Mensagem de commit comprova alteração registrada, não aprovação do proprietário, homologação ou resolução definitiva de um problema.

Este arquivo está no pacote de entrega `/workspace/sortex-continuity/docs/`; ainda não foi inserido no repositório original. Os documentos existentes foram preservados.

## Objetivo da plataforma

O código e a documentação descrevem uma plataforma para organizadores gerenciarem campanhas, comercialização/reserva de títulos, pagamentos, apuração, ganhadores e operação administrativa, com financeiro, afiliados, CRM e mídia. Esta é uma síntese do produto encontrado; a formulação original e o escopo aprovado na conversa de desenvolvimento não puderam ser recuperados.

## Linha do tempo de commits

| Data UTC | Commit abreviado | Alteração registrada |
| --- | --- | --- |
| 10/07/2026 | `9732017` | Primeiro commit |
| 10/07/2026 | `ee91ef5` | Consolidação do monorepositório/API |
| 29/07/2026 | `dd24878` | Consolidação beta e Render staging |
| 30/07/2026 | `1b4dfd9` | Estabilização dos builds de homologação Render |
| 30/07/2026 | `86fce00` | Provisionamento de acesso administrativo no seed staging |
| 30/07/2026 | `3687ebe` | PIX sandbox com polling |
| 30/07/2026 | `a928f12`, `c664e90` | Ajustes de Orders sandbox e referência do gateway |
| 31/07/2026 | `d5b23bc` | Auditoria de idempotência dos eventos do gateway |
| 31/07/2026 | `23e2de1`, `f537355` | Timestamp e normalização de identificador na assinatura |
| 31/07/2026 | `677b4e8`, `827c2dc` | Resposta HTTP 200 e diagnóstico de assinatura |
| 31/07/2026 | `84440c2`, `8f8a600` | Eventos assinados desconhecidos e ambientes Orders |
| 31/07/2026 | `0c3c7fb`, `2b8e850` | Diagnósticos sanitizados e refinamento da assinatura |

Histórico de referência: https://github.com/blackwolfoficiall-glitch/SorteX/commits/2b8e8503eb33e73136cd076dbd322c78945c2ffe

Não classificar todos esses problemas como resolvidos: a CI do snapshot falhou e a homologação operacional não foi acessada.

## Decisões representadas em código/documentação

| Tema | Decisão ou regra encontrada | Fonte |
| --- | --- | --- |
| Organização | Monorepositório, frontend em `apps/web`, API canônica em `services/api` | Packages e `docs/project-inventory.md` |
| Persistência | PostgreSQL/Prisma com schema canônico e migrations | `services/api/prisma/` |
| Pagamentos | Provider isolado; criação Mercado Pago limitada a sandbox | `payments/gateways/mercado-pago.provider.ts` |
| Confirmação | Backend consulta gateway, confere valor/referência e processa transação idempotente | `payments/payments.service.ts` |
| Comercial | Taxas/isencões da plataforma separadas da estimativa do gateway | `finance/commercial-terms.service.ts` |
| Afiliados | Comissão ligada à aprovação, com reversão | `affiliates/affiliate-commission.service.ts` |
| Sorteio | Motor determinístico, regra publicada, prévia e confirmação separados | Domínio `draws` e `docs/draw-engine.md` |
| Administração | Roles, permissões granulares e tratamento explícito de SUPERADMIN | Guard e policy em `auth` |
| Operação | Homologação e piloto controlado antes de produção | `docs/final-readiness-report.md` e checklists |
| Preservação | Não remover artefatos relevantes nem executar operações sem autorização | Instruções expressas do proprietário nesta sessão |

Os caminhos de código abreviados são relativos a `services/api/src/`. Documentação anterior pode conter decisões ainda não implementadas; conferir correspondência com o código.

## Regras e divergências que precisam permanecer visíveis

- A documentação antiga de pagamentos fala em confirmação apenas por webhook; o código atual também consulta e processa status por polling.
- O texto antigo de permissões administrativas descreve compatibilidade com acesso amplo; o guard atual nega ausência de permissões, salvo tratamento específico de SUPERADMIN.
- Relatórios antigos citam 72 modelos e quatro migrations; a árvore atual contém 99 modelos e 16 migrations SQL.
- Documentos antigos tratam integrações como abstrações; SMTP, Meta/WhatsApp e OpenAI já possuem caminhos concretos de chamada externa. Configuração e sucesso real não foram confirmados.
- O requisito documental de registrar o consumo da primeira campanha gratuita precisa ser comparado com o cálculo atual baseado em campanhas anteriores.

Nenhuma dessas divergências foi corrigida no sistema durante a auditoria.

## Render, hospedagem gratuita e homologação

Preparação da Render é verificável em commits, `render.yaml` e `docs/render-homologation.md`. O blueprint inclui disco, PostgreSQL `basic-256mb`, auto deploy desligado e migration no pré-deploy.

O proprietário mencionou migração da Render e planejamento gratuito. Não houve acesso à conversa que tratou disso; a branch `infra/free-homologacao` não apareceu no remoto consultado. Não há evidência suficiente para declarar provedor substituto, recursos criados, cancelamento de serviços, migração de dados ou custos atuais.

Estado operacional atual da homologação: não confirmado. O checklist versionado possui itens abertos. A CI do snapshot falhou em `prisma validate`; isso não determina sozinho o estado do serviço implantado.

## Aprovações e autorização nesta sessão

1. Auditoria inicial somente leitura, preservando sistema e histórico.
2. Criação autorizada exclusivamente dos quatro documentos de continuidade, após busca de equivalentes, sem sobrescrever existentes.
3. Continuam sem autorização: commit, push, merge, deploy, migrations, seeds, modificações de configuração/infraestrutura, operações destrutivas ou contratação/reativação de serviços.

Não foi recuperada uma lista de funcionalidades anteriormente aprovadas. Implementação encontrada não deve ser apresentada como aprovação histórica.

## Complementação futura

Depois da conferência autorizada no Mac, registrar branch/SHA locais, diferenças e datas; verificar a branch gratuita e eventuais documentos locais equivalentes. Se o proprietário fornecer trechos da conversa original, registrar fonte e distinguir decisão, proposta e execução. Não copiar segredos, dados pessoais, dumps ou logs sensíveis.
