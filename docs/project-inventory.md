# Inventário do projeto SorteX

Levantamento do Módulo 12. Nenhum arquivo foi removido durante o inventário.

## Arquitetura confirmada

- Um único repositório Git na raiz.
- Frontend oficial: `apps/web` (Next.js 16, React 19).
- Backend oficial: `services/api` (NestJS 11).
- Banco oficial: `services/api/prisma/schema.prisma` (PostgreSQL/Prisma 6).
- Operação: `docker-compose.yml`, `scripts`, `.github/workflows` e `docs`.
- `packages` e `docker` existem, mas ainda não possuem pacotes compartilhados relevantes.

## Dimensão atual

| Área | Quantidade |
|---|---:|
| Arquivos frontend | 349 |
| Arquivos backend | 169 |
| Módulos Nest | 15 |
| Controllers | 25 |
| Handlers HTTP | 226 |
| Services Nest | 31 |
| Modelos Prisma | 72 |
| Enums Prisma | 75 |
| Índices/uniques explícitos | 127 |
| Páginas Next | 65 |
| Route handlers/proxies Next | 61 |
| Componentes React | 167 |
| Suítes unitárias/e2e | 28 |

## Domínios backend

`admin`, `affiliates`, `auth`, `buyer`, `campaigns`, `crm`, `draws`, `finance`, `infrastructure`, `media`, `organizers`, `payments`, `prisma` e `purchases`.

## Integrações e jobs

- Mercado Pago em sandbox/provider abstrato; nenhuma credencial está no código.
- SMTP apenas como abstração/configuração, sem envio real obrigatório.
- Armazenamento local abstrato para desenvolvimento.
- Jobs técnicos locais para reservas, saldos, mídia, CRM e filas; Redis/worker distribuído continua futuro.
- Cache em memória preparado para Redis.

## Pendências comprovadas

- O schema possui 72 modelos e somente quatro migrações históricas; falta migração incremental consolidada.
- Após a padronização Prettier, a API possui 466 ocorrências de lint (417 erros e 49 avisos) e o frontend 39 (35 erros e 4 avisos); predominam mocks tipados como `any`, acessos Prisma dinâmicos e hooks em código dos módulos anteriores.
- O frontend contém duas advertências de `<img>` onde `next/image` deve ser avaliado.
- Docker CLI não está instalado nesta máquina; Compose ainda precisa ser validado em CI/homologação.
- `npm audit` encontrou duas vulnerabilidades moderadas no PostCSS empacotado pelo Next 16.2.10.
- Não existe ambiente explicitamente identificado como staging; o banco local não foi alterado.
- E2E atual cobre apenas smoke test da API; fluxos multiusuário exigem banco isolado e navegador.

## Duplicações e código provisório

- Basenames repetidos em domínios diferentes não comprovam duplicação funcional.
- Não foram encontrados `TODO`, `FIXME` ou mocks ativos fora de testes.
- Há um `console.log` técnico a revisar; logs estruturados são o padrão.
- Rotas Next em `apps/web/app/api` são BFF/proxy, não uma segunda API de domínio.
- Nenhum arquivo será removido sem rastreamento de imports, teste e revisão manual.

## Classificação inicial

- Compilação e testes unitários: prontos.
- Homologação com banco novo: pronta com ressalvas, após migração e seed.
- Pagamento/sorteio/repasse real: bloqueados por configuração.
- Produção: bloqueada por migração, lint, segurança externa, jurídico e testes manuais.
