# Contas de homologação

O seed deve usar somente `example.invalid` e senha fornecida por `TEST_SEED_PASSWORD`. Nenhuma senha é versionada.

- `admin@sortex.example.invalid` — ADMIN.
- `organizer1@sortex.example.invalid` e `organizer2@sortex.example.invalid` — ORGANIZER.
- `buyer1@sortex.example.invalid` até `buyer5@sortex.example.invalid` — BUYER.

Execução permitida apenas fora de produção, com `ALLOW_TEST_SEED=true`, banco contendo `staging`, `test` ou `dev`, e senha de teste com no mínimo 12 caracteres.

### Fixture de premiações públicas para Playwright

Em um PostgreSQL **local e descartável**, a seed de homologação aceita
`SEED_PUBLIC_BROWSER_REWARDS=true` além de `ALLOW_TEST_SEED=true` e das
variáveis locais habituais. Ela acrescenta uma campanha sintética separada do
piloto, com logo estático, dois prêmios por meta e um combo de roleta. Não
efetue compras ou giros nessa campanha. A seed recusa essa opção em banco
não loopback.

Use essa opção antes de rodar `e2e/public-campaign-chrome.spec.ts` com Next,
API e banco isolados. Isso exercita os três casos que, sem dados públicos
correspondentes, pulam por ausência de logo, metas ou roleta. O teste de
posições da marca e variações das metas usa também respostas controladas:
isso verifica a renderização, não um repasse, sorteio ou giro real.
