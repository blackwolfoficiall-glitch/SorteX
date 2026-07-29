# Contas de homologação

O seed deve usar somente `example.invalid` e senha fornecida por `TEST_SEED_PASSWORD`. Nenhuma senha é versionada.

- `admin@sortex.example.invalid` — ADMIN.
- `organizer1@sortex.example.invalid` e `organizer2@sortex.example.invalid` — ORGANIZER.
- `buyer1@sortex.example.invalid` até `buyer5@sortex.example.invalid` — BUYER.

Execução permitida apenas fora de produção, com `ALLOW_TEST_SEED=true`, banco contendo `staging`, `test` ou `dev`, e senha de teste com no mínimo 12 caracteres.
