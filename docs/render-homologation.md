# Homologação permanente na Render

Este documento descreve a infraestrutura preparada em `render.yaml`. A criação
dos recursos continua sendo uma ação manual no painel da Render; o blueprint
mantém o auto deploy desativado.

## Recursos

| Recurso | Diretório | Build | Start/Pre-deploy |
| --- | --- | --- | --- |
| Frontend Next.js | `apps/web` | `npm ci && npm run build` | `npm start -- --hostname 0.0.0.0 --port $PORT` |
| API NestJS | `services/api` | `npm ci && npx prisma generate && npm run build` | `npm run start:prod` |
| PostgreSQL | Render Postgres | — | `npx prisma migrate deploy` antes da API |

A API usa `/health` como health check. Frontend e API ficam na mesma região do
PostgreSQL. O banco bloqueia acesso público por padrão e a API recebe sua
connection string privada pelo blueprint.

## Variáveis do frontend

| Variável | Visibilidade | Obrigatória | Origem |
| --- | --- | --- | --- |
| `API_INTERNAL_URL` | Privada | Sim | URL HTTP privada da API Render |
| `API_URL` | Privada | Sim | URL HTTPS pública da API |
| `NEXT_PUBLIC_API_URL` | Pública | Opcional | URL HTTPS pública da API |
| `NEXT_PUBLIC_APP_URL` | Pública | Sim | URL HTTPS do frontend |
| `NEXT_PUBLIC_INSTAGRAM_URL` | Pública | Opcional | Perfil institucional |
| `NODE_ENV` | Pública operacional | Sim | Definida como `production` |

O navegador usa rotas de mesma origem em `/api`. `API_INTERNAL_URL` é usada
somente pelo servidor Next.js e deve apontar para a API na rede privada.

## Variáveis da API

| Grupo | Variáveis | Classificação |
| --- | --- | --- |
| Banco | `DATABASE_URL` | Privada, obrigatória, fornecida pelo Render Postgres |
| Sessão | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Privadas, obrigatórias, geradas pela Render |
| URLs | `WEB_URL`, `APP_URL`, `WEB_APP_URL`, `PUBLIC_WEB_URL`, `API_URL` | Obrigatórias em produção |
| CORS | `CORS_ALLOWED_ORIGINS` | Privada operacional, obrigatória |
| Runtime | `NODE_ENV`, `APP_ENV`, `APP_VERSION`, `PORT` | Operacionais; `PORT` é fornecida pela Render |
| Upload | `ORGANIZER_UPLOAD_DIR` | Obrigatória; usa o disco persistente da API |
| Criptografia | `INTEGRATION_ENCRYPTION_KEY` | Privada, obrigatória para credenciais integradas |
| E-mail | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Privadas; necessárias para e-mails reais |
| Pagamentos | `PAYMENT_ENV` e variáveis `MERCADO_PAGO_*` | Sandbox nesta fase; credenciais externas continuam não configuradas |
| Meta | variáveis `META_*` | Opcionais até a integração oficial |
| IA | `OPENAI_API_KEY`, `OPENAI_MODEL` | Opcionais até a integração oficial |
| Limites | variáveis `RATE_LIMIT_*`, `AUTH_*`, `MAX_*`, `RESERVATION_*` | Opcionais, com padrões seguros no código |

Nenhum valor privado deve ser versionado. Variáveis marcadas com `sync: false`
devem ser preenchidas no primeiro sync do blueprint.

## Banco de homologação

### Opção A — recomendada

Criar um banco vazio, executar `npx prisma migrate deploy` e depois executar o
seed protegido:

```sh
ALLOW_TEST_SEED=true TEST_SEED_PASSWORD='<definida fora do Git>' npm run seed:staging
```

O seed aceita apenas bancos cujo nome contenha `staging`, `test` ou `dev`, usa
contas `example.invalid` e se recusa a executar com `NODE_ENV=production`.
Para usá-lo na Render, execute-o em uma sessão controlada com `NODE_ENV=staging`
e remova `ALLOW_TEST_SEED` e `TEST_SEED_PASSWORD` ao terminar.

### Opção B — somente com autorização

Exportar o banco local, sanitizar dados pessoais, invalidar hashes de senha,
tokens, sessões e credenciais externas, validar o dump sanitizado em banco
descartável e somente então restaurá-lo na homologação. Dumps nunca devem ser
incluídos no Git.

## Checklist antes de criar os serviços

1. Importar `render.yaml` como Blueprint.
2. Revisar custos do plano do PostgreSQL e do disco persistente.
3. Preencher todas as variáveis `sync: false`.
4. Confirmar URLs finais e CORS.
5. Criar os recursos com auto deploy ainda desativado.
6. Executar migrations e o seed seguro.
7. Validar `/health`, login e jornadas autenticadas.
8. Habilitar auto deploy somente após a homologação inicial.
