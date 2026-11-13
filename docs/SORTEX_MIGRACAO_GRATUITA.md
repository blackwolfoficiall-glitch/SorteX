# SorteX — migração gratuita sem Render

Preparação em 13/11/2026 (UTC). Repositório original: https://github.com/blackwolfoficiall-glitch/SorteX

## Preservação e autorização

O proprietário autorizou código, commits, publicação em uma branch de migração e deploy exclusivamente em serviços gratuitos, sem cartão, cobrança ou reativação de serviços pagos. Não autorizou force push ou merge na principal. Recursos Render, migrations históricas e documentação anterior devem ser preservados.

Checkout desta sessão: `/workspace/SorteX`. Base: `main` em `2b8e8503eb33e73136cd076dbd322c78945c2ffe`. Branch de preparação: `infra/netlify-northflank-neon`. O checkout estava limpo ao ser clonado. Isso não descreve alterações do Mac.

`infra/free-homologacao` não está entre as branches remotas recuperadas; sua eventual existência e trabalho exclusivo no Mac permanecem sem acesso. Não foi recriada. Os quatro documentos de continuidade foram recuperados de `/workspace/sortex-continuity/docs/` e incorporados sem sobrescrever arquivos do original; receberam nota que distingue a auditoria anterior desta etapa.

## Situação da publicação

- Netlify: equipe conectada `blackwolfoficiall-glitch`, plano Free confirmado. Projeto novo `sortex-homologacao`, ID `a3040361-02c8-4222-8110-36f043eeb5e1`.
- Painel do projeto: https://app.netlify.com/projects/sortex-homologacao
- Endereço reservado: https://sortex-homologacao.netlify.app — não declarar funcional sem deploy verificado.
- Neon: conexão de conta solicitada; banco remoto ainda não criado nem acessado nesta etapa de preparação.
- Northflank: acesso e confirmação do Sandbox sem cartão solicitados; API remota ainda não publicada.
- A integração Netlify disponível gerencia projetos/variáveis, mas não oferece uma operação de envio do código. Publicação por CLI depende de autenticação segura, solicitada ao proprietário, ou importação do repositório pelo painel. A tentativa de definir a variável pública NEXT_PUBLIC_APP_URL pela integração retornou HTTP 403; não foi confirmada a gravação de nenhuma variável no serviço.

Nenhum token deve ser enviado no chat. Credenciais solicitadas, quando necessárias, devem ser vinculadas ao ambiente por configuração segura. Não imprimir valores em logs nem versionar arquivos locais de autenticação.

## Planos consultados em fontes oficiais

| Serviço | Condição publicada | Limite/decisão |
| --- | --- | --- |
| Netlify Free | US$ 0, 300 créditos/mês; equipe conectada Free | Deploy de produção custa 15 créditos, além de compute/tráfego/requisições. Ao esgotar a cota Free, os sites podem pausar; não habilitar recarga ou upgrade |
| Neon Free | Sem cartão; 100 projetos, 100 CU-h/mês por projeto, 1 GB PostgreSQL/projeto, 5 GB de transferência pública/projeto | Suspensão após inatividade; capacidade finita, sem garantia de produção. Não usar AI Gateway, que exige créditos/cartão |
| Northflank Sandbox | Preços anunciam sem cartão, dois serviços, dois jobs, um banco e até US$ 20/mês de recursos | Documentação de billing ainda exige cartão de todos. Só provisionar se o painel confirmar Sandbox sem cartão e recursos dentro da franquia, sem cobrança por excedente |
| Back4app Containers Free (alternativa) | Sem cartão; Docker/GitHub, 0,25 CPU, 256 MB RAM, 100 GB de transferência | Alternativa se Northflank exigir cartão. Preserva o Docker/NestJS, mas RAM limitada e armazenamento durável ainda precisam de validação |

Não prometer gratuidade irrestrita ou disponibilidade contínua. Northflank: um perfil anunciado de 0,5 CPU/1 GB custa US$ 12/mês nas taxas de referência, abaixo da franquia anunciada, mas volume, tráfego, build e demais recursos também precisam de conferência na conta. Não selecionar esse perfil automaticamente sem verificar elegibilidade no Sandbox.

Fontes (13/11/2026):

- https://www.netlify.com/pricing/
- https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/billing-faq-for-credit-based-plans/
- https://neon.com/pricing
- https://northflank.com/pricing
- https://northflank.com/docs/v1/application/billing/pricing-on-northflank
- https://www.back4app.com/pricing/container-as-a-service

Koyeb exige cartão segundo seu FAQ; Hugging Face exige plano pago para novos Docker Spaces segundo os documentos consultados. Não foram selecionados.

## Dependências Render e alterações de preparação

O código não depende de domínio Render fixo encontrado na busca; a dependência principal era a configuração de URLs/segredos, banco e volume `/var/data/sortex` no blueprint. `render.yaml` foi preservado sem uso. Não importar esse blueprint, pois descreve recursos pagos e migration automática no pré-deploy.

- `netlify.toml`: frontend em `apps/web`, build `npm run build`, publicação `.next`, Node 22. Adaptador Next/OpenNext automático, sem exportar o site como estático e sem catch-all de SPA.
- `apps/web/next.config.ts`: fallback de API também considera `API_URL`, mantendo `API_INTERNAL_URL` e rotas BFF existentes.
- `services/api/Dockerfile`: conserva Prisma Client/engine gerados no build, adiciona OpenSSL, remove dependências de desenvolvimento e mantém execução como usuário `node`.
- `main.ts`: porta TCP numérica, `0.0.0.0` preservado, shutdown hooks.
- Recuperação de senha: `EMAIL_DELIVERY_MODE=disabled` permitido apenas com `APP_ENV=staging`, sem exigir SMTP pago nem registrar e-mail/token no log. Recuperação por e-mail não estará disponível nesse modo.
- `INTEGRATIONS_MODE=sandbox`: impede OAuth externo, simula WhatsApp/anúncios e mantém resposta determinística do Advisor. Protege também contra integrações previamente marcadas como conectadas em dados restaurados. Pagamentos continuam com `PAYMENT_ENV=sandbox`; não configurar credenciais de produção.
- `UPLOADS_DISABLED=true`: recusa novos uploads até armazenamento persistente comprovado. Não altera nem apaga uploads existentes.
- `.gitignore`: ignora `.netlify/` para não enviar vínculo/autenticação local ao Git.
- CI: fornece URL fictícia apenas para validação/geração do schema, sem conexão real, e inclui a branch de migração nos gatilhos.
- Dependências de execução atualizadas dentro das faixas compatíveis existentes para reduzir alertas conhecidos; não foi executado `audit fix --force` nem mudança de framework.

## Frontend Netlify

Importar exclusivamente o repositório original e selecionar a branch de migração. O `netlify.toml` define base `apps/web` e publish `.next`. Não apontar a publicação para `out/`: há SSR, API routes e autenticação que precisam de funções.

Configurar no painel com escopos Builds e Functions:

| Variável | Uso |
| --- | --- |
| `API_INTERNAL_URL` | URL HTTPS pública da API nova; a rede privada Render não existe entre provedores |
| `API_URL` | Mesma API HTTPS para chamadas do servidor |
| `NEXT_PUBLIC_APP_URL` | URL HTTPS final Netlify |

Não enviar `DATABASE_URL`, JWTs ou credenciais de integração ao frontend. Não usar prefixo `NEXT_PUBLIC_` em segredo. Mudança de variáveis exige novo build/deploy. Rotas BFF e cookies HttpOnly/Secure permanecem no mesmo domínio do frontend.

Ao publicar um deploy manual em site com Git CD, o próximo push à branch de publicação poderá substituí-lo. Usar uma estratégia única e revisar qual branch dispara deploy.

## API NestJS

Build Docker: contexto `services/api`, Dockerfile desse diretório. Alternativamente, build Node: `npm ci --include=dev`, `npx prisma generate`, `npm run build`. Start: `node dist/src/main.js`. Não executar migrations ou seeds no start.

Expor HTTP em `PORT=3333` (ou a porta atribuída pela hospedagem), TLS no proxy do provedor, uma réplica e autoscaling desligado. Liveness: `/health/live`. `/health/ready` consulta PostgreSQL; usar verificação menos frequente/manual para evitar manter Neon acordado e consumir compute à toa.

Variáveis públicas operacionais: `NODE_ENV=production`, `APP_ENV=staging`, `PORT`, `PAYMENT_ENV=sandbox`, `INTEGRATIONS_MODE=sandbox`, `EMAIL_DELIVERY_MODE=disabled`, `UPLOADS_DISABLED=true`. Manter as flags de recursos reais desativadas. `NODE_ENV=production` é necessário para cookies/headers seguros, mesmo sendo homologação.

URLs: `WEB_URL`, `APP_URL`, `WEB_APP_URL` e `PUBLIC_WEB_URL` apontam para o frontend novo; `API_URL` aponta para a API nova. `CORS_ALLOWED_ORIGINS` contém somente a origem HTTPS exata do frontend, sem wildcard. Não liberar todos os previews automaticamente.

Segredos no serviço: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `INTEGRATION_ENCRYPTION_KEY`. Gerar valores novos para uma homologação nova. Restaurar integrações criptografadas exigirá a chave original, tratada de forma privada; não afirmar que chaves novas recuperam credenciais antigas.

## Neon e migrations sem reset

Criar um projeto Free e um banco novo identificado como homologação. Não usar um destino com dados sem revisão. Preferir runtime com URL pooled, TLS obrigatório e limite conservador de conexões; usar URL direta somente para migrations. Dimensionamento e limites finais precisam ser conferidos na conta.

As 16 migrations históricas foram preservadas. O script `services/api/scripts/migrate-staging.cjs` verifica ambiente staging, liberação explícita, host e nome esperados, TLS remoto, identidade retornada pelo PostgreSQL e schema `public` vazio antes de `prisma migrate deploy`. Recusa banco com objetos e não executa reset, restore ou seed. Não é ferramenta para atualizar automaticamente um banco já populado.

Executar a partir de `services/api`, com dependências de desenvolvimento instaladas e valores definidos privadamente:

```sh
node scripts/migrate-staging.cjs
```

Variáveis da operação: `APP_ENV=staging`, `ALLOW_STAGING_MIGRATIONS=true`, `DIRECT_DATABASE_URL` (ou `DATABASE_URL`), `EXPECTED_DATABASE_HOST`, `EXPECTED_DATABASE_NAME`. Desabilitar a permissão da operação depois. Não colocar URLs privadas no histórico do terminal.

O seed existente usa dados fictícios e pode alterar contas se reutilizado. Nesta sessão foi executado somente no PostgreSQL isolado de teste. Não executar seed em banco restaurado. Uma conta nova de homologação não significa recuperação de conta antiga; fornecer acesso ao proprietário de forma privada.

## Dados antigos, backups e uploads

Sem acesso ao Mac, ao banco/volume Render ou a backup validado. Nada disso foi apagado, exportado, restaurado ou sobrescrito. O banco de validação desta sessão é novo, contém somente dados fictícios e não deve ser apresentado como recuperação do sistema anterior.

Antes de restore, obter backup acessível, verificar formato/integridade/versão, tamanho compatível com Neon Free, restaurar em destino separado autorizado e conferir contagens e relações sem expor dados. Nunca restaurar sobre o destino com dados sem autorização específica.

Uploads hoje usam filesystem e chaves relativas persistidas no banco. Um container efêmero perderia os arquivos novos em redeploy. Até volume ou object storage gratuito ser verificado, manter uploads desativados. Se Northflank confirmar volume dentro da franquia sem cobrança, montar armazenamento durável, conferir UID/permissões do usuário `node`, gravar/ler arquivo de teste e verificar sobrevivência a restart/redeploy antes de habilitar uploads.

Neon PostgreSQL não preserva automaticamente os arquivos do Mac/Render. Object Storage anunciado pelo Neon é produto separado e exigiria adaptar a camada de armazenamento; não foi configurado nesta etapa. Restaurar arquivos exige manter as chaves e a correspondência com os registros do banco.

## Continuidade pelo iPhone

Depois do envio da branch, abrir uma sessão Codex Cloud vinculada ao repositório original e à branch `infra/netlify-northflank-neon`; ler este documento primeiro e os quatro documentos históricos depois. Confirmar SHA, estado Git e acessos antes de agir. O Mac só deixa de ser necessário para execução quando código, banco e arquivos necessários estiverem acessíveis fora dele.

As autorizações da etapa documental eram mais restritas e estão preservadas como histórico. A autorização atual permite migração/deploy gratuitos na branch, mas mantém proibidos cartão, cobranças, force push, merge na principal e remoção de recursos Render.

## Validação realizada nesta sessão

- Build da API e build Next.js: aprovados. Next compilou, verificou tipos e gerou as rotas SSR/estáticas existentes.
- API: 40 suítes/223 testes unitários aprovados, incluindo os novos bloqueios de integração externa, e um teste E2E aprovado.
- Lint: API sem erros, com 708 avisos na execução anterior aos três novos casos sandbox; frontend sem erros, com 34 avisos.
- PostgreSQL 17 novo/isolado: 16 migrations aplicadas; `prisma migrate diff` sem diferença para o schema. Banco fictício medido em 14 MB; isso não informa o tamanho dos dados antigos.
- Script de migration: recusou banco populado e identidade divergente, sem escrita nesses casos.
- Browser Chromium com viewport móvel, frontend/API reais e HTTPS local: seis verificações aprovadas (login de organizador, campanha gravada/relida, campanhas/comunicação, login/dashboard administrativo, negação de acesso administrativo ao organizador e campanha pública fictícia). Não foi teste no Safari do iPhone nem no site publicado.
- Health/readiness: HTTP 200 no ambiente local; CORS entrega a origem permitida e recusa origem não permitida sem cabeçalho de autorização.
- Auditoria de dependências de execução após atualizações: seis alertas (um baixo, um moderado, quatro altos), nenhum crítico. Persistem alertas envolvendo Prisma/config/deepmerge e Nodemailer; não foi aplicada troca de major do Prisma. E-mail e chamadas externas permanecem desativados na homologação.

As credenciais de teste são aleatórias, ficam fora do Git e não foram exibidas. Resultados de teste local não comprovam disponibilidade dos provedores nem recuperação de dados. Docker final, publicação e testes remotos precisam ser conferidos no estado de entrega final.
