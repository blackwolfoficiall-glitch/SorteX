# Relatório de carga controlada

O script `scripts/load-smoke.mjs` foi validado sintaticamente, mas a carga não foi executada porque não havia instância de homologação explicitamente autorizada em execução.

## Cenários preparados

- health/live;
- listagem pública de campanhas;
- abertura de campanha configurável;
- concorrência e total limitados por variáveis.

## Comando futuro

```bash
LOAD_BASE_URL=http://localhost:3333 LOAD_CONCURRENCY=5 LOAD_ITERATIONS=20 node scripts/load-smoke.mjs
```

Reserva, webhook, dashboard, CRM e admin exigem fixtures/autenticação no banco staging. Nunca apontar o script para gateway externo ou produção.

Classificação: **depende de ambiente de homologação**.
