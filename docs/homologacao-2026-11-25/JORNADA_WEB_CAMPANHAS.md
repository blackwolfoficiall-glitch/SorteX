# Jornada web do organizador: campanhas

Esta preparação é só para um banco PostgreSQL **local e descartável**, com
Nest e Next no mesmo computador de teste. Não aponte para Neon, Northflank,
Netlify, produção ou qualquer base com dados de pessoas. Não use credenciais
reais. Os testes não criam pagamentos nem enviam mensagens.

## Preparar as contas

1. Crie um banco vazio em PostgreSQL escutando em loopback. Use um nome com
   `test` (por exemplo, `sortex_browser_test`). Configure `DATABASE_URL` no
   shell local para esse banco e aplique as migrações com
   `cd services/api && npx prisma migrate deploy` a partir da raiz.
2. No mesmo shell, habilite a seed e gere uma senha efêmera, sem imprimi-la:

   ```bash
   export NODE_ENV=development ALLOW_TEST_SEED=true
   export TEST_SEED_PASSWORD="$(openssl rand -hex 24)"
   export SEED_PUBLIC_BROWSER_REWARDS=true
   (cd services/api && npm run seed:staging)
   ```

   `SEED_PUBLIC_BROWSER_REWARDS=true` é necessário para a suíte
   **integral** também cobrir logo, metas e roleta pública. Não é necessário
   para o arquivo da jornada. As contas continuam sintéticas em ambos.

3. Exporte as credenciais sintéticas consumidas pelo Playwright:

   ```bash
   export E2E_ORGANIZER_EMAIL=organizer1@sortex.example.invalid
   export E2E_OTHER_ORGANIZER_EMAIL=organizer2@sortex.example.invalid
   export E2E_ADMIN_EMAIL=admin@sortex.example.invalid
   export E2E_BUYER_EMAIL=buyer1@sortex.example.invalid
   export E2E_ORGANIZER_PASSWORD="$TEST_SEED_PASSWORD"
   export E2E_OTHER_ORGANIZER_PASSWORD="$TEST_SEED_PASSWORD"
   export E2E_ADMIN_PASSWORD="$TEST_SEED_PASSWORD"
   export E2E_BUYER_PASSWORD="$TEST_SEED_PASSWORD"
   ```

   A primeira conta é a organizadora aprovada dona das campanhas do teste. A
   segunda é **outro** organizador aprovado: comprova isolamento em leitura,
   edição e transições. A conta administrativa sintética aplica um bloqueio
   de publicação pela API normal. A conta compradora é usada pelos outros
   arquivos da suíte integral.

## Rodar

Com a API local pronta, configure `PLAYWRIGHT_API_URL` e
`SORTEX_HOMOLOGATION_API_URL` para sua origem real em loopback. Rode o
arquivo dirigido em Chrome pelo config padrão, que inicia Next em
`127.0.0.1:3100` em desenvolvimento:

```bash
cd apps/web
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 \
  npx playwright test e2e/campaign-lifecycle.spec.ts --project desktop
```

Se usar `next start` em vez de desenvolvimento, entregue-o ao navegador por
**HTTPS local** e configure essa mesma origem em `PLAYWRIGHT_BASE_URL`,
`WEB_URL` e `APP_URL`; o cliente HTTP do Playwright respeita os cookies
`Secure` da build. Para reexecutar a suíte integral com WebKit, use o projeto
WebKit iPhone do runner local, separe o grupo visitante do autenticado e não
compartilhe o processo ou o banco com outros perfis simultâneos. Para incluir
o arquivo de cadastro na suíte integral, defina `SORTEX_PHASE1_E2E=1`.
Mantenha os limites da API ativos. Na API local, deixe `PAYMENT_ENV=test`,
`FEATURE_REAL_PAYMENTS=false`, `EMAIL_DELIVERY_MODE=disabled` e o storage
em um diretório também descartável.

O teste dirigido cobre edição e persistência de rascunho/pausada, publicação,
pausa, reativação e encerramento confirmados pela API, a indisponibilidade
do percurso público fora de `PUBLISHED`, recuperação de erro de checklist e
bloqueio administrativo. WebKit com viewport iPhone não substitui Safari em
iPhone físico, assinatura iOS, OAuth real ou aceite regulatório.
