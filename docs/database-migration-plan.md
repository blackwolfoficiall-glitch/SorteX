# Plano de migração do banco de homologação

O schema oficial possui 72 modelos e quatro migrações históricas, insuficientes para reproduzir o estado atual. A URL local encontrada não possui marcador de ambiente; nenhuma migração foi criada contra ou aplicada nesse banco.

## Ordem segura

1. Provisionar PostgreSQL vazio e exclusivo `sortex_staging`.
2. Definir `NODE_ENV=staging` e confirmar host/porta/banco mascarados.
3. Criar e validar backup.
4. Aplicar migrações históricas em banco descartável.
5. Gerar incremental com `npx prisma migrate dev --name module12_consolidated --create-only`.
6. Revisar SQL: drops, casts, enums, uniques, FKs e defaults.
7. Aplicar em segundo banco limpo com `npx prisma migrate deploy`.
8. Rodar seed somente com `ALLOW_TEST_SEED=true`.
9. Validar órfãos, valores financeiros, hashes e contagens.

## Backfills previstos

- Status/permissões de usuários e perfis de organizador.
- Condições comerciais e snapshots de regras publicadas.
- Contas financeiras, resumos e idempotência.
- Consentimentos não devem ser presumidos para dados históricos.

## Riscos e rollback

- Uniques com duplicados, casts monetários, enums antigos e FKs órfãs.
- Nunca usar `migrate reset` em banco relevante.
- Preservar backup e SQL revisado; preferir correção forward-only.
- Reverter aplicação/API antes de restaurar banco incompatível.

## Comandos futuros

```bash
cd services/api
NODE_ENV=staging npx prisma migrate dev --name module12_consolidated --create-only
npx prisma migrate deploy
ALLOW_TEST_SEED=true NODE_ENV=staging npm run seed:staging
```

Não executados: não há banco explicitamente identificado como homologação.
