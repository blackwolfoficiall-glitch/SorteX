# SorteX API

API oficial da SorteX, construída com NestJS, Prisma e PostgreSQL.

## Configuração

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate deploy
npm run start:dev
```

Configure segredos diferentes e aleatórios para `JWT_ACCESS_SECRET` e
`JWT_REFRESH_SECRET`. Em produção, a API não inicia sem esses valores.

## Autenticação

Rotas públicas:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /`

Rotas autenticadas:

- `GET /auth/me`
- `POST /auth/logout`

Rota exclusiva de administrador:

- `GET /auth/users`

Envie o access token nas rotas protegidas:

```text
Authorization: Bearer <accessToken>
```

O access token expira em 15 minutos por padrão. O refresh token expira em 30
dias, é armazenado apenas como hash, rotacionado a cada uso e vinculado a uma
sessão revogável. O logout invalida imediatamente a sessão correspondente.

O token de recuperação de senha expira em uma hora por padrão, é armazenado
somente como SHA-256, pode ser usado uma única vez e é enviado por SMTP. Ao
redefinir a senha, todas as sessões do usuário são revogadas. Configure as
variáveis `SMTP_*` e `WEB_URL` do `.env.example` antes de usar em produção.

## Controle de acesso

As rotas são protegidas por padrão. Use `@Public()` apenas quando a rota puder
ser acessada sem autenticação e `@Roles(UserRole.ADMIN)` (ou outro papel) para
restringir perfis. Os papéis disponíveis são:

- `BUYER`
- `ORGANIZER`
- `ADMIN`

## Validação

```bash
npx prisma validate
npm run lint
npm test -- --runInBand
npm run build
```

Os testes E2E exigem PostgreSQL disponível e a migração aplicada:

```bash
npm run test:e2e -- --runInBand
```
