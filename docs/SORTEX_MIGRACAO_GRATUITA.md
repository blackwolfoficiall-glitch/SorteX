# SorteX — migração gratuita sem Render

Preparação em 13/11/2026 (UTC). Repositório original: https://github.com/blackwolfoficiall-glitch/SorteX

## Preservação e autorização

O proprietário autorizou código, commits, publicação em uma branch de migração e deploy exclusivamente em serviços gratuitos, sem cartão, cobrança ou reativação de serviços pagos. Não autorizou force push ou merge na principal. Recursos Render, migrations históricas e documentação anterior devem ser preservados.

Checkout desta sessão: `/workspace/SorteX`. Base: `main` em `2b8e8503eb33e73136cd076dbd322c78945c2ffe`. Branch de preparação: `infra/netlify-northflank-neon`. O checkout estava limpo ao ser clonado. Isso não descreve alterações do Mac.

`infra/free-homologacao` não está entre as branches remotas recuperadas; sua eventual existência e trabalho exclusivo no Mac permanecem sem acesso. Não foi recriada. Os quatro documentos de continuidade foram recuperados de `/workspace/sortex-continuity/docs/` e incorporados sem sobrescrever arquivos do original; receberam nota que distingue a auditoria anterior desta etapa.

## Situação da publicação

- Netlify: equipe conectada `blackwolfoficiall-glitch`, plano Free confirmado. Projeto novo `sortex-homologacao`, ID `a3040361-02c8-4222-8110-36f043eeb5e1`.
- Painel do projeto: https://app.netlify.com/projects/sortex-homologacao
- Frontend publicado: https://sortex-homologacao.netlify.app — home/login/admin-login testados com HTTP 200 após ativar o runtime oficial Next.js. A integração BFF com a API é validada no próximo deploy com as URLs configuradas.
- Neon: conta conectada. Projeto existente `sortex-homologacao` (`crimson-bread-73821703`), branch `homologacao` (`br-lingering-voice-bc92seow`), banco novo `sortex`, PostgreSQL 18, plano `free_v3` confirmado. As 16 migrations existentes foram aplicadas e seus checksums conferidos; dados antigos não restaurados.
- API publicada em Neon Functions Free: https://br-lingering-voice-bc92seow-sortexapi.compute.c-16.us-east-1.aws.neon.tech. Prontidão do banco, login, permissões, painel e consulta de campanhas testados na API. Northflank não foi utilizado; Back4app permanece apenas alternativa histórica.
- A integração Netlify disponível gerencia projetos/variáveis, mas não oferece uma operação de envio do código. Publicação por CLI dependeria de autenticação adicional, mas a rota preferida é vincular o repositório existente pelo painel, sem compartilhar token. O 403 de escrita de variável foi corrigido pela própria integração: a operação de upsert de NEXT_PUBLIC_APP_URL confirmou sucesso usando newVarScopes=[all] e newVarContext=all. A leitura ampla das variáveis ainda retornou erro; não houve leitura nem exposição de segredos. Não pedir token para corrigir esse 403 de escrita.

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

No plano Free, configurar no projeto usando o padrão de todos os escopos, que inclui Builds e Functions. Não selecionar escopos específicos: essa limitação é recurso Pro/Enterprise e causou o 403 observado. Isso não autoriza colocar segredos em variáveis NEXT_PUBLIC_.

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

## Resultado adicional da imagem e preservação no GitHub

A implementação foi publicada na branch de migração no commit `781c07cfec0892ae74e352b7f1e06542feeef8db`, sem force push nem merge. O envio usou a integração GitHub porque o CLI não tinha autenticação funcional. A `main` permaneceu em `2b8e8503eb33e73136cd076dbd322c78945c2ffe`.

O build Docker final com lock atualizado passou. A imagem Node 22 iniciou como usuário `node`, levou o Prisma Client gerado, respondeu `/health/ready` com HTTP 200 e acessou o PostgreSQL fictício. Login e leitura da campanha criada pelo BFF passaram; a campanha também permaneceu disponível após restart do PostgreSQL de teste.

A execução foi configurada com 256 MB/0,25 CPU, mas os cgroups observados eram os do ambiente superior (16 GB/4 CPU). Não houve comprovação de imposição desses limites. RSS inicial do processo Node medido em 137980 kB, pico 165988 kB; isso não equivale a teste de carga nem certifica capacidade do Back4app Free.

Os arquivos de migration SQL e `render.yaml` foram comparados e permaneceram inalterados. Nenhum dado antigo foi acessado ou recuperado. As instâncias Docker locais são recursos de teste desta sessão e não são endpoints públicos de hospedagem.

CI da implementação aprovada: https://github.com/blackwolfoficiall-glitch/SorteX/actions/runs/43453742385 . API e frontend passaram no GitHub. Revalidar o estado da revisão que será publicada; não confundir a CI antiga com a desta branch.

## Desbloqueio de acessos — continuação

Nenhum upgrade, cartão, cobrança ou alteração Render foi realizado. A correção de escopos foi feita no projeto Netlify existente; não foi criado outro projeto.

### Etapa atual: conectar Neon

No ChatGPT: Configurações → Plugins (ou Apps, conforme a interface) → buscar Neon → Instalar → Conectar → entrar na conta Neon Free e autorizar na página oficial. Não fornecer senha, token ou connection string no chat. A integração Neon foi localizada, mas ainda não está instalada/conectada nesta sessão. Aguardar confirmação e verificar ferramentas disponíveis antes de afirmar conexão.

Depois da conexão, verificar conta/plano, criar projeto/banco novo de homologação, confirmar destino vazio e aplicar as migrations preservadas. Não restaurar dados antigos sem backup acessível e validado. O banco local já testado não é o Neon e não contém dados recuperados.

### Etapa seguinte: Back4app Containers Free

A seleção decorre da contradição da Northflank: https://northflank.com/pricing anuncia sem cartão, enquanto https://northflank.com/docs/v1/application/billing/pricing-on-northflank exige meio de pagamento. Não foi possível confirmar uma conta Sandbox sem cartão.

O Back4app declara Docker/GitHub gratuito sem cartão: https://www.back4app.com/pricing/container-as-a-service . Limites anunciados: 0,25 CPU, 256 MB RAM, 100 GB de transferência e região EUA. Não confundir Containers/Web Deployment com um backend Parse ou produto de agentes. Não contratar Shared/Dedicated.

Configuração preparada para o painel, depois de concluir Neon: repositório blackwolfoficiall-glitch/SorteX; branch infra/netlify-northflank-neon; Root services/api; Dockerfile presente nesse diretório; auto deployment inicialmente desligado; variáveis conforme services/api/.env.free-homologacao.example, inseridas privadamente no serviço. Não criar aplicação com segredos faltantes apenas para gerar uma URL. Autenticação/conta Back4app ainda dependem do proprietário; isso será conduzido depois da ação atual.

Manter UPLOADS_DISABLED=true até volume/object storage durável verificado. Disco de container não é backup. A medição local de memória não certifica capacidade sob carga no plano Free.

### Etapa posterior: vincular GitHub à Netlify sem token no chat

Abrir o projeto existente em https://app.netlify.com/projects/sortex-homologacao → Project configuration → Developer settings → Continuous deployment → Repository → Link repository/Link to repository. Selecionar GitHub, autorizar somente SorteX se necessário e usar infra/netlify-northflank-neon como branch de publicação. O netlify.toml do repositório já define base apps/web, build npm run build e publish .next. Não criar novo repositório nem selecionar main.

A conexão Git pode depender de ação interativa do proprietário; a integração atual não expõe operação de vincular repositório ou publicar código. Evitar pedir PAT quando a vinculação Git pelo painel resolver. A API deve ter URL real antes de configurar API_INTERNAL_URL e API_URL e avaliar o site como funcional.

Fontes oficiais adicionais: https://docs.netlify.com/build/environment-variables/overview/ ; https://docs.netlify.com/build/git-workflows/repo-permissions-linking/ ; https://www.back4app.com/docs-containers/prepare-your-deployment ; https://help.openai.com/en/articles/20001494-connecting-and-managing-app-accounts-in-chatgpt .


## Atualização verificada — Neon existente e pacote da API (13/11/2026, UTC)

### Banco e preservação

- Destino solicitado pelo proprietário: projeto `crimson-bread-73821703`, branch `br-lingering-voice-bc92seow` (`homologacao`), banco `sortex`, proprietário `sortex_owner`, região `aws-us-east-1`, PostgreSQL 18. Nenhum projeto, branch ou banco adicional foi criado.
- Antes das migrations, o schema público estava vazio. O script protegido `services/api/scripts/migrate-staging.cjs` confirmou a identidade do destino; foram executadas exatamente as 16 migrations históricas. Não houve reset, seed, restauração ou alteração dos arquivos SQL.
- Verificação posterior: 16 migrations concluídas, nenhuma incompleta, 16 checksums SHA-256 iguais aos arquivos locais. `prisma migrate diff` entre banco e datamodel retornou `No difference detected` (exit 0).
- Contagens posteriores: zero usuários e zero campanhas. Não existe administrador inicial nesse banco. Isso não representa recuperação dos dados antigos.
- A conexão foi obtida pela integração e mantida em arquivo privado temporário fora do Git. O executor não tem TCP direto ao PostgreSQL; usou transporte loopback → WebSocket remoto com TLS verificado. O SSL desativado apenas no loopback temporário não deve ser reproduzido nas variáveis de hospedagem; a conexão remota usa TLS.
- Mac, backups antigos, uploads, eventual branch local `infra/free-homologacao`, banco Render e chaves antigas de criptografia continuam inacessíveis/não recuperados. Recursos Render foram preservados.

### API existente no Neon Functions

A documentação oficial atual inclui Functions no Free, na região AWS us-east-1 do projeto: 10 active Capacity-Hours, 400 waiting Capacity-Hours e 1 milhão de invocações por projeto/mês; egress de 5 GB é compartilhado com outros produtos do projeto. Runtime Node 24, linux-arm64 glibc, memória fixa de 2048 MiB, ZIP até 10 MiB, conteúdo até 64 MiB/4096 arquivos. Há suspensão/evicção e limites de franquia; não equivale a disponibilidade contínua ou capacidade ilimitada. Não foi habilitado upgrade, cartão, AI Gateway ou cobrança.

Fontes: https://neon.com/docs/introduction/plans e https://neon.com/docs/compute/functions/reference/runtime-limits e https://neon.com/docs/compute/functions/deploy (consultadas em 13/11/2026).

- `src/application.ts` apenas extrai a inicialização compartilhada do Nest; `main.ts` continua sendo a entrada Docker/Node tradicional.
- `src/neon-handler.ts` adapta Request/Response para o mesmo Nest em loopback. Controllers, validação, CORS, guards, JWT e serviços foram preservados.
- `scripts/build-neon.cjs` gera uma cópia temporária do Prisma Client com `engineType=client`, sem alterar o schema canônico; usa `@prisma/adapter-pg` 6.19.3 somente quando `PRISMA_USE_PG_ADAPTER=true`. PostgreSQL e Prisma 6 permanecem. Pool máximo de 5 conexões; bcrypt ARM64 glibc incluído. Docker mantém sua geração/engine tradicional.
- Comando: em `services/api`, `npm ci`, `npx prisma generate`, `npm run build:neon`. O ZIP ignorado pelo Git fica em `dist/neon/sortex-api.zip` (~3,94 MB, 1907 arquivos, ~12,54 MB descompactado). A CI também gera esse pacote, sem deploy nem acesso ao banco real.
- O pacote não contém `.env`, senhas, tokens, backups ou uploads. Variáveis privadas foram geradas fora do Git; sua persistência não deve ser presumida após o fim deste executor.
- Tentativa de publicação pela integração **falhou antes de criar a função**: o conector apresentou `Transport closed` no ZIP maior e `Pattern match timed out` na validação base64 do ZIP reduzido. Isso é um bloqueio do envio pelo conector; não comprova falha do runtime Neon. Slug planejado: `sortexapi`, ainda sem URL pública verificada.
- `scripts/deploy-neon.cjs` prepara o mesmo upload pelo multipart oficial, sem migrations nem criação de projeto. Exige `NEON_API_KEY` no ambiente seguro e o caminho de um JSON privado com as variáveis; verifica projeto Free, branch e banco antes do envio. Falha fechada se não conseguir comprovar o Free. Não fornece nem registra chaves. Exemplo sem valores privados: `npm run deploy:neon -- /caminho/privado/ambiente.json`. Em executor com proxy, Node 24 pode precisar de `NODE_USE_ENV_PROXY=1`. A integração conectada não fornece uma API key de gestão reutilizável pelo shell; este ambiente não tem esse segredo configurado.
- Variáveis de homologação: `APP_ENV=staging`, `NODE_ENV=production`, `PAYMENT_ENV=sandbox`, `INTEGRATIONS_MODE=sandbox`, `EMAIL_DELIVERY_MODE=disabled`, `UPLOADS_DISABLED=true`, `PRISMA_USE_PG_ADAPTER=true`, URLs Web/APP/CORS do Netlify e segredos JWT/criptografia fortes. Não sobrescrever `DATABASE_URL` gerenciada pelo Neon. Ajustar `API_URL` à URL efetivamente retornada pelo serviço após publicar.

### Verificações e limites

- API: build passou; 40 suítes/223 testes unitários passaram; E2E existente passou (1 teste); lint sem erros (708 avisos anteriores).
- Cópia do ZIP testada em Node 24 local com bcrypt x64 apenas na cópia de teste, contra o banco Neon real via transporte TLS: `SELECT 1` passou; `/health/ready` 200, `/public/campaigns` 200 e `[]`, `/auth/me` sem sessão 401, login inválido 400, preflight CORS 204. Nenhum dado foi inserido.
- Isso não valida execução ARM64 no runtime hospedado nem login administrativo completo: ambos dependem do deploy e da configuração segura do primeiro usuário no banco novo. Não apresentar o site/API como online.
- Uploads permanecem desabilitados e nenhum arquivo antigo foi recuperado. `/tmp` de Functions é efêmero; não usá-lo como armazenamento durável. Persistência de uploads exige integração de armazenamento e migração separadas. Cache e rate limit em memória não são coordenados entre isolates; jobs não devem depender de processo permanentemente ligado.

### Próxima etapa, uma ação por vez

1. Vincular o GitHub ao projeto Netlify existente: https://app.netlify.com/projects/sortex-homologacao → Project configuration → Developer settings → Continuous deployment → Repository → Link repository/Link to repository → GitHub → `blackwolfoficiall-glitch/SorteX` → `infra/netlify-northflank-neon`. Autorizar apenas o repositório necessário e manter Free. `netlify.toml` já define o build.
2. Resolver o upload da API pela API oficial caso o conector permaneça com erro. A chave deve ser adicionada a um campo de segredo do executor, nunca colada na conversa, no código ou em variável pública do frontend. Se não existir campo de segredo disponível, orientar uma alternativa segura específica antes de prosseguir.
3. Após deploy `completed`, verificar URL retornada e `/health/ready`, configurar `API_INTERNAL_URL` e `API_URL` no Netlify com escopos `all`/contexto `all` (evita o 403 por escopos restritos no Free). Nenhuma URL provisória deve ser inventada.
4. Configurar primeiro administrador com o comando existente `admin:create` em homologação e senha privada, sem promover/substituir conta existente automaticamente; testar login, painel, campanhas e persistência no site publicado.
5. Recuperar backups/uploads do Mac com validação de origem e destino antes de restaurar; preservar dados eventualmente criados no novo banco. Não apagar recursos Render.


## Continuidade — deploy automático e credencial protegida (13/11/2026)

O proprietário confirmou a alteração da Production branch Netlify para `infra/netlify-northflank-neon`. A consulta posterior ainda listava apenas o deploy antigo da `main`, ID `6af76619aaad391c9fc991eb`, commit `2b8e8503eb33e73136cd076dbd322c78945c2ffe`. Não havia build ativo. O bloqueio de login Netlify passou a valer somente para deploys não produtivos; o endereço público da produção respondeu 404. Isso não comprova publicação do frontend Next.js preparado.

A CI de `6c0a1704314716f531960d5e589e4c02a3dc5a36` passou integralmente: https://github.com/blackwolfoficiall-glitch/SorteX/actions/runs/43492946770. Incluiu build da API, pacote Neon, testes e build/lint/types do frontend.

Foi avaliado Netlify Functions para evitar credencial extra de hospedagem: o empacotador oficial gerou pacote NestJS de 11,6 MB. A marcação de variáveis como segredo retornou 422 com escopo all e 403 com builds/functions; a revisão automática rejeitou gravar JWT_ACCESS_SECRET sem essa marcação. Nenhum segredo da API/banco foi salvo na Netlify e nenhuma API foi publicada por essa rota. O candidato está preservado somente no executor em `/workspace/sortex-validation/netlify-candidate`; `netlify.toml` e o frontend conservam a configuração anterior. Não contratar plano pago para contornar esses erros.

Para contornar o limite do conector Neon sem expor credenciais, foi preparado `.github/workflows/deploy-neon-homologacao.yml`. Ele roda exclusivamente na branch de migração. Sem o repository secret `NEON_API_KEY`, registra que o deploy não foi executado e pula as etapas de publicação. Esse resultado não deve ser confundido com API online.

Com a chave protegida disponível, o workflow gera o pacote e chama o multipart oficial através de `deploy-neon.cjs --bootstrap-or-preserve`. O script comprova o plano Free, os IDs fixos do projeto e da branch e a presença do banco `sortex` antes de escrever; não cria projeto, branch ou banco e não executa migrations. No primeiro deploy, cria chaves JWT/criptografia fortes em memória e as envia diretamente ao ambiente privado da função; mantém sandbox, e-mail desabilitado e uploads bloqueados. Nos deploys seguintes, omite o mapa de ambiente, preservando chaves/configuração. Aguarda a URL efetiva, corrige `API_URL` do primeiro ambiente e verifica `/health/ready`. Quatro testes de segurança de publicação passaram: plano pago, destino incorreto, bootstrap seguro e preservação das chaves; rodam na CI sem rede real.

Ação segura para quando chegar a etapa da API (sem valores no chat): no Neon, organização → Settings → API keys → criar chave limitada ao projeto `sortex-homologacao`, se a interface oferecer esse escopo. Guardar a chave em GitHub → repositório original → Settings → Secrets and variables → Actions → New repository secret → nome `NEON_API_KEY`. Depois executar o workflow na branch de migração ou fazer novo push autorizado. Não adicionar a chave ao código, arquivo público ou variável NEXT_PUBLIC. Fonte dos caminhos: https://neon.com/docs/manage/api-keys.

Ainda não há URL funcional de API comprovada. Banco novo mantém 16 migrations concluídas e nenhuma incompleta; dados antigos, administrador inicial e uploads continuam pendentes. Concluir primeiro o build Netlify da branch correta; depois configurar a credencial protegida de deploy da API e testar o conjunto publicado. Mac e Render permanecem preservados.


### Correção do runtime Next.js na Netlify

O push de `dfae001eadab807a87307bd20e3791c8bdca924b` disparou o primeiro build Netlify da branch de migração em produção, deploy `6af76c6a14d27e658c133317`. A branch e o commit foram confirmados. O deploy ficou ready e detectou framework next, porém informou zero Functions, zero regras de redirect e plugin_state none; publicou arquivos internos de `.next/server/app` como conteúdo estático. Home, login e admin/login responderam 404 em HTTP e em Chromium desktop/mobile. Portanto ready não foi tratado como site funcional.

Foi adicionada a declaração explícita `[[plugins]] package = "@netlify/plugin-nextjs"` ao `netlify.toml`, mantendo base/build/publish e permitindo a versão atual do adaptador oficial, sem fixar versão legada nem exportar o frontend como estático. Verificar no próximo deploy se foram geradas as funções SSR/route handlers e testar as rotas reais antes de declarar publicação concluída. Isso não publica a API NestJS: o workflow da API ainda depende do repository secret NEON_API_KEY.

Validação local da correção: CLI Netlify com build offline e proxy do executor, Runtime oficial 5.16.6, build Next.js e TypeScript aprovados, função `___netlify-server-handler` e Edge middleware empacotados; `Netlify Build Complete`, exit 0. A primeira tentativa local falhou apenas no download do bundler Edge sem o proxy; a repetição com `NODE_USE_ENV_PROXY=1` passou. Não foi desativada a verificação TLS. A versão do adaptador continua gerenciada pela Netlify.


## Publicação verificada e uploads privados — 13/11/2026

- Frontend: https://sortex-homologacao.netlify.app. Deploy `6af76e93b3135201569be1b1`, branch `infra/netlify-northflank-neon`, commit `3c0bb141262f64b098db4fc2adb1ccccfc4653c4`, plugin oficial 5.16.6 com uma função SSR e um middleware Edge. Home/login/admin-login 200; Chromium desktop e viewport 390x844 sem erros de JS/overflow horizontal. Isso não é teste no Safari/iPhone físico.
- API: https://br-lingering-voice-bc92seow-sortexapi.compute.c-16.us-east-1.aws.neon.tech. O workflow reexecutado usou o repository secret NEON_API_KEY, sem ler/imprimir a chave no chat. `/health` e `/health/ready` 200, banco up, campanhas públicas inicialmente `[]`, acesso anônimo protegido 401.
- `API_INTERNAL_URL` e `API_URL` foram configuradas na Netlify como URLs públicas não confidenciais, no contexto production e escopo all. Nenhuma credencial de banco/JWT foi colocada no frontend. É necessário novo build para o BFF receber esses valores.
- Com contas técnicas novas e sem dados pessoais reais, a API publicada passou em login administrativo/comprador/organizador, `/auth/me` com identidade persistida, `/admin/dashboard`, `/admin/campaigns`, `/health/metrics`, `/campaigns/my`, além de negar `/admin/dashboard` ao comprador (403). Contas técnicas serão desativadas após o teste do site; não são contas antigas recuperadas nem acesso administrativo entregue ao proprietário.

### Persistência de uploads

O Object Storage já estava disponível na branch Neon existente. Foi criado somente o bucket privado `sortex-private-uploads`, sem projeto/banco/branch extra e sem upgrade. O plano Free foi reconferido: 5 GB de Object Storage e egress de 5 GB/projeto compartilhado com os demais produtos. Não exige conta AWS separada. Acesso anônimo retornou 403; upload condicional retornou 200, tentativa de sobrescrita 412 e leitura assinada devolveu os mesmos 61 bytes. O pequeno objeto de diagnóstico foi preservado no prefixo `homologacao-validation/`.

`STORAGE_DRIVER=neon-s3` permite ao serviço de arquivos existente usar o SDK S3 oficial com credenciais AWS_* privadas gerenciadas pelo Neon. O backend local permanece como padrão para computador/Docker. Foram preservados validação de MIME/assinatura/tamanho, UUIDs, chaves relativas no banco e controles de acesso das rotas de organizador, campanhas, mídia e jurídico. Upload remoto usa If-None-Match para recusar sobrescrita; download passa pelas rotas existentes. O bucket não é público e documentos não recebem URLs públicas permanentes. A prontidão faz HeadBucket quando o driver remoto estiver configurado.

A ativação remota deve ocorrer somente depois do novo código publicado e dos testes reais de upload/download: STORAGE_DRIVER=neon-s3, STORAGE_BUCKET=sortex-private-uploads e UPLOADS_DISABLED=false. Preservar o mapa privado de variáveis e as chaves existentes ao atualizar esses três valores. Não usar /tmp como fonte durável e não ativar o driver em deploy anterior que não o implementa.

Build e pacote da API passaram com o novo SDK: aproximadamente 4,25 MB ZIP, 1997 arquivos, 13,89 MB descompactados, dentro do limite do Neon. São 40 suítes/229 testes unitários, E2E existente (1), quatro testes de proteção de deploy e quatro do bootstrap administrativo. Não houve mudança no schema, migrations ou Render.

### Primeiro administrador do proprietário, com senha fora do chat

O workflow aceita os repository secrets opcionais `SORTEX_ADMIN_EMAIL` e `SORTEX_ADMIN_PASSWORD`. A senha deve conter pelo menos 12 caracteres, maiúscula, minúscula, número e símbolo. O passo `bootstrap-admin-ci.cjs` obtém a conexão pela API oficial com a chave já protegida, exige o host da homologação/banco sortex e TLS verify-full, e chama o comando existente `prisma/create-superadmin.ts` apenas quando não há Superadministrador ativo. Não promove conta existente, não troca senha/permissões de administrador ativo e não imprime email, senha ou conexão. Segredos de gestão/cadastro ficam restritos aos passos que precisam deles, sem disponibilizá-los aos passos npm/build.

Não configurar o administrador real enquanto a conta administrativa técnica de validação estiver ativa; desativar a conta técnica e revogar suas sessões antes. Depois, o usuário pode adicionar os dois segredos pelo painel GitHub → Settings → Secrets and variables → Actions e a sessão reexecuta o job na branch de migração. Não pedir senha no chat. Sem esses segredos, o passo informa que a configuração administrativa foi pulada.

Os dados antigos e uploads históricos permanecem NÃO restaurados. Há somente schema, registros técnicos de validação e eventual configuração padrão criada pelos serviços consultados. Recuperar/validar backups e arquivos do Mac separadamente antes de restaurar, preservando os dados já criados no novo banco. Render permanece intacta.
