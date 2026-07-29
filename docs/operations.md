# Operações

Endpoints: `/health`, `/health/live`, `/health/ready` e `/health/metrics` (métricas exige autenticação). Readiness verifica PostgreSQL e informa o estado do armazenamento sem revelar caminhos.

Logs estruturados contêm horário, requestId, método, rota, usuário, status e duração. AuditLog continua sendo a trilha de negócio. Jobs locais usam chave idempotente, claim atômico, retry exponencial, `maxAttempts` e estado `FAILED`.

Antes de homologação, configure alertas para erros 5xx, readiness, webhooks falhos, jobs parados, saldos inconsistentes e armazenamento. Não execute ações destrutivas automaticamente.
