# CRM, notificações e automações — Módulo 10A

## CRM e sincronização

O domínio `crm` usa `organizerId + userId` como chave única. Pagamentos aprovados criam ou atualizam o contato e registram uma interação idempotente pelo pagamento. Favoritos criam leads e interações. Falhas de sincronização são isoladas e registradas sem invalidar o pagamento.

## Segmentação

As regras JSON são interpretadas por uma lista fechada: status, cidade, estado, origem, gasto mínimo, compras mínimas e inatividade. Nenhum código armazenado é executado.

## Automações e mensagens

As ações internas suportadas são notificação, tags, status e tarefas. Mensagens de e-mail, WhatsApp ou SMS ficam `QUEUED`; a simulação muda para `SKIPPED` com a indicação de que não existe provider. Nunca são marcadas como enviadas.

## Notificações

O modelo existente foi ampliado com categoria e exclusão lógica. Preferências guardam canais futuros, mas somente `inAppEnabled` possui efeito nesta etapa.

## Marketing e privacidade

Campanhas internas geram público por segmento e criam apenas notificações da plataforma. Dados apresentados ao organizador são mascarados, contatos bloqueados são excluídos dos públicos e templates removem scripts e atributos de evento.

## Limitações

Não há WhatsApp, SMS, e-mail, push ou provider externo. A sincronização de suporte, prêmios, indicações e reservas expiradas está preparada pelo modelo de interações e gatilhos, mas requer conectar cada evento em uma etapa posterior. Todas as alterações Prisma dependem de migração futura não aplicada.
