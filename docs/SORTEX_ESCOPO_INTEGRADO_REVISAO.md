# SorteX — escopo integrado e estado real da revisão

Data: 14/11/2026 (America/Bahia). Repositório original: https://github.com/blackwolfoficiall-glitch/SorteX.
Branch: `feat/cadastro-identidades-institucional`. Base da ampliação: `5ce6dda`.

**O conjunto não está concluído:** a apresentação e o cadastro foram ampliados e publicados, e o código de autenticação social foi implementado/testado com fixtures, mas Google e Apple ainda não estão configurados nem validados com contas reais. A entrega anterior da Fase 1 não equivale à conclusão deste escopo.

## Publicação verificada

- Inicial: https://sortex-fase1-review.netlify.app
- Login: https://sortex-fase1-review.netlify.app/login
- Escolha de cadastro: https://sortex-fase1-review.netlify.app/cadastro
- Organizador PF/PJ: https://sortex-fase1-review.netlify.app/cadastro/organizador
- Comprador: https://sortex-fase1-review.netlify.app/cadastro/comprador
- API: https://sortex-fase1-review.netlify.app/.netlify/functions/sortex-api
- Saúde com banco: https://sortex-fase1-review.netlify.app/.netlify/functions/sortex-api/health/ready
- **Código publicado:** `9ce8a2703bf820969c7c36c65b83d1d67c18d26c`.
- **Deploy validado:** `6af88be0c85d51f84bfdb797`.
- Metadado HTML `sortex:review-commit` e API `/health` confirmam o mesmo commit. O deploy da CLI não usa `commit_ref` como prova de autoria; a versão foi conferida nesses dois pontos e no checkout de build.
- Commits posteriores que adicionam somente evidências, documentação e testes não exigem nova publicação da aplicação.

O novo site Netlify é exclusivamente `af720ddb-9366-4e26-bcfe-d92ea8c27caf`. Seu Neon exclusivo é `rough-cherry-09901194`, branch `br-weathered-grass-bcisqlpm`, banco `sortex_preview`. Não foram reutilizados banco nem segredos de aplicação do ambiente existente.

## Lista de todas as solicitações

| Solicitação | Estado | Evidência ou pendência |
| --- | --- | --- |
| Preservar cadastro comprador/PF/PJ, documentos oficiais, endereço completo e transações | Implementada e testada | Regressão HTTP local e cadastros reais na prévia com dados sintéticos |
| UF/cidade pesquisáveis, teclado, validação IBGE conjunta e contingência | Implementada e testada | Busca BA/Fe, troca de UF, erro/retry, CEP tardio e catálogo local nos três projetos de navegador |
| Correção de organizadores rejeitados/em correção | Implementada e testada | REJECTED e CORRECTION_REQUESTED voltam a PENDING pela API publicada, mantendo ID, papel, sessão e motivo |
| Slogan fora do cadastro, editável em Configurações → Perfil | Implementada e testada | Salvar, recarregar e limpar, com persistência, em desktop e emulações mobile |
| Inicial institucional/comercial com identidade própria roxa | Implementada e testada | Novo layout em seções, caminhos dos dois perfis e capturas da publicação |
| Referência visual Nexo | Implementada e testada | Referência acessada e renderizada em 14/11/2026; organização visual examinada, sem copiar seus materiais |
| Demonstrações reais da interface | Implementada e testada | Capturas próprias de painel/campanhas, somente com conta sintética e legenda de demonstração; imagens otimizadas efetivamente carregadas |
| Recursos, como funciona, diferenciais e sobre | Implementada e testada | Seções próprias com recursos existentes e disponibilidade condicionada; sem estatísticas/depoimentos/certificações inventados |
| Estrutura de planos sem preços ou condições fictícias | Implementada e testada | Seção informativa sem contratação ou cobrança |
| Preços, benefícios e condições comerciais definitivos | Ainda pendente | Exigem definição/aprovação do proprietário; não foram inventados |
| FAQ, página de contato e links para políticas | Implementada e testada | Rotas e links reais preservados; FAQ expansível e contato com situação explícita |
| Conteúdo definitivo dos Termos e da Política de Privacidade | Ainda pendente | Páginas anteriores preservadas informam necessidade de revisão jurídica; não foram inventados textos aprovados |
| Canal público definitivo de contato | Ainda pendente | Nenhum telefone/e-mail oficial foi confirmado; a página informa essa ausência |
| SEO, títulos, descrições, Open Graph, sitemap, robots e dados estruturados | Implementada e testada | Estrutura adicionada e URLs da prévia conferidas. Prévia mantém noindex; não houve alteração de indexação do ambiente existente |
| Redesenho do login/cadastro, campos, PF/PJ, progresso, erros e carregamento | Implementada e testada | Identidade visual compartilhada; radio cards e etapas; testes de erro/loading e capturas desktop/mobile |
| Entradas Google/Apple no início da experiência | Implementada com configuração pendente | Botões apontam para o fluxo real quando configurados; estão desabilitados com explicação enquanto faltam credenciais |
| Google OIDC completo e sessão SorteX | Implementada com configuração pendente | Code + PKCE, nonce/state e verificação criptográfica testados. Cliente/consentimento/credenciais e teste com conta real ainda pendentes |
| Apple OIDC completo e Ocultar meu e-mail | Implementada com configuração pendente | Code/form_post, client secret ES256 e validação de ID token/relay testados. Acesso Developer, identificadores/chave e teste real ainda pendentes |
| Complementação depois do acesso social | Implementada com configuração pendente | Backend transacional testado para comprador/PF/PJ; nome pré-preenchido, e-mail verificado e ausência de pedido de senha cobertos. Percurso externo real pendente |
| Vínculo seguro sem fusão por coincidência de e-mail | Implementada com configuração pendente | Prova do provedor, sessão SorteX recente, identificação das duas contas e confirmação explícita; testes com fixtures aprovados, provedores reais pendentes |
| Preservar IDs, contas, permissões, sessões, unicidade e checkout simplificado | Implementada e testada | 20 cenários HTTP de regressão, 15 sociais, sessões antigas sintéticas funcionando na API publicada e checksums anteriores à migration preservados |
| Documentação oficial atual dos provedores | Implementada e testada | Documentos e discovery oficiais consultados; links e exigências no guia social |
| Testes TypeScript/lint/build e fluxos completos acessíveis | Implementada e testada | Resultados abaixo; não se confunde fixture OIDC com autenticação real do proprietário |
| Responsividade desktop e mobile emulado | Implementada e testada | Chromium desktop, iPhone 13 e Pixel 7 emulados, sem transbordamento horizontal nos cenários cobertos |
| Safari real, VoiceOver e Android físico | Ainda pendente | Não executados; emulação Chromium não substitui esses testes |
| Revisão visual/aceitação pelo proprietário | Ainda pendente | Capturas e links entregues para avaliação; a aparência não é declarada aprovada pelo usuário |
| Publicação só da prévia, sem merge/produção | Implementada e testada | Site/banco dedicados; site existente segue no deploy anterior |
| Orçamento R$ 0, sem cartão/cobrança | Implementada e testada | Netlify Free e Neon free_v3 conferidos; nenhuma compra/renovação/upgrade/recarga habilitada |
| Dados antigos e uploads do Mac | Ainda pendente | Não acessados/restaurados; esta base contém dados sintéticos. Uploads continuam desabilitados nesta prévia |

## Validação executada

- **272 testes unitários** da API aprovados (43 suítes), incluindo assinatura RS256, emissor, audience/azp, expiração, nonce, adulteração, algoritmo, cabeçalhos críticos e e-mail não verificado; geração do client secret Apple ES256.
- **15 cenários HTTP sociais** aprovados com PostgreSQL local real e tokens/provedores sintéticos restritos à suíte: cadastro comprador/PF/PJ, CNPJ alfanumérico, retorno à mesma conta, e-mail do provedor alterado, conta desativada, colisão de e-mail, vínculo explícito, sessão antiga, rollback, concorrência, replay, outro navegador e perfil obrigatório. Não há bypass de teste no runtime publicado.
- **20 cenários HTTP históricos da Fase 1** aprovados em outro banco local novo, com fixture anterior às migrations: cadastro, identidade, endereço, rollback, unicidade e checkout simplificado. Uma exceção de banco provocada deliberadamente no teste de rollback é esperada e não representa falha da publicação.
- **48 cenários Playwright no site publicado** aprovados, repetidos depois da correção de imagens: desktop + iPhone 13 Chromium + Pixel 7 Chromium. Incluem a renderização real de imagens otimizadas, cadastro e perfil passando pelo BFF/API/Neon. Os casos de complementação/vínculo identificados como “UI fixture only” testam apenas os estados da tela e não certificam autenticação externa.
- **9 testes de empacotamento/proteção da prévia** aprovados: 4 do adaptador, 3 do uploader opcional com mocks e 2 do empacotamento x64/compatibilidade de hash/arquivos seguros. A mensagem de upload do teste de uploader é de mock, não publicação real em Neon Functions.
- TypeScript frontend/API e builds Next.js/NestJS/Neon aprovados. Lint frontend: zero erros, 36 avisos; lint dos arquivos API alterados: zero erros, 100 avisos, principalmente tipagem de testes/código existente. O novo teste de imagens passou no lint sem avisos. Não foram desativadas regras de segurança, TypeScript, secret scanning ou TLS para aprovar builds.
- CI do backend (commit `8ec7d7c`, código API idêntico ao publicado em `9ce8a27`): https://github.com/blackwolfoficiall-glitch/SorteX/actions/runs/43612512245 — success. Inclui migrations somente no PostgreSQL efêmero do runner e os 15 testes HTTP sociais; não recebe credenciais da aplicação nem faz deploy.
- A API pública respondeu pronta com banco `up`; as sessões sintéticas de comprador/organizador criadas antes das migrations renovaram normalmente e mantiveram IDs/papéis. O perfil antigo manteve `personType = NULL`.
- Varreduras do diff e dos arquivos públicos não encontraram valores dos segredos reais de teste. Não foram publicados tokens, strings privadas de conexão, arquivos `.env` ou dados pessoais reais.

## Preservação do banco e do ambiente existente

Aplicada somente no novo PostgreSQL local e no Neon exclusivo da prévia a migration aditiva `20261114140000_social_identities`: cria `SocialIdentity` e `SocialAuthAttempt`, sem mudar User.password, IDs, papéis ou AuthSession. Comparação de contagens/checksums antes/depois no Neon confirmou User, AuthSession, OrganizerProfile, OrganizerBrandProfile, BuyerAddress, ConsentRecord, AuditLog e histórico das 18 migrations anteriores inalterados. A prévia possui agora 19 migrations concluídas.

A prova com sessões/dados antigos é de **fixtures sintéticas**, não restauração das contas reais do Mac. Nenhum banco foi resetado; não houve exclusão de backups/uploads nem remoção de recursos Render.

O site existente `sortex-homologacao` permaneceu no deploy `6af775bfbc4b537efbd7868f`. `main` e `infra/netlify-northflank-neon` não receberam estes commits. Não houve merge, migration no banco existente nem publicação nesse ambiente.

## Diagnóstico e correção da publicação de imagens

O deploy separado com `--no-build --dir .netlify/static` publicou PNG/JS/CSS, mas perdeu regras geradas em memória pelo adaptador para `/_next/image`, que respondeu 400. O teste antigo de HTTP 200 do PNG não detectava esse caso. O teste agora exige também imagens do DOM completas e com dimensão natural válida.

A correção preservou o adaptador oficial e a otimização: **build e deploy no mesmo processo**, a partir de `apps/web` do checkout isolado, com `NETLIFY_SITE_ID=af720ddb-9366-4e26-bcfe-d92ea8c27caf` e `netlify deploy --prod --context production`, sem forçar `--dir` antes do build. O adaptador v5 prepara seu próprio mapeamento de assets e redirects. `--prod` refere-se somente ao endereço principal **deste site de teste**, não ao ambiente existente. `/_next/image` e `/.netlify/images` responderam 200 depois da correção; capturas e testes foram repetidos. Não usar o comando antigo de deploy separado como procedimento para esta revisão ampliada.

A configuração temporária do checkout inclui build `npm run build`, publish `.next`, plugin `@netlify/plugin-nextjs`, funções em `netlify/functions`, runtime em `.sortex-preview-runtime/**` fora da publicação estática e header `X-Robots-Tag: noindex, nofollow, noarchive`. O `netlify.toml` do ambiente existente não foi modificado.

A checagem de SEO encontrou também que o header de não indexação da configuração não era aplicado à resposta SSR. A correção usa metadados Next.js condicionados a `APP_ENV=staging`; o HTML final publicou `robots=noindex, nofollow`, conferido por HTTP e Playwright. Não assumir o header como prova de não indexação de páginas SSR.

## Continuidade, configuração externa e reversão

- Configuração Google/Apple e exigências oficiais: [SORTEX_AUTENTICACAO_SOCIAL_CONFIGURACAO.md](SORTEX_AUTENTICACAO_SOCIAL_CONFIGURACAO.md). As variáveis ainda estão ausentes na prévia. Não enviar valores no chat/Git; não criar associação Apple paga. A associação padrão é US$ 99/ano; só avançar se já houver conta habilitada ou isenção aplicável, sem custo novo.
- Testes de navegador: `apps/web/playwright.integrated-review.config.ts` aceita somente `http://127.0.0.1:3108` ou a URL exata da prévia. A configuração remota exige API/banco/assets prontos antes de mutações e usa apenas dados sintéticos.
- Testes HTTP sociais exigem banco loopback com nome exato `sortex_social_review`; a suíte histórica exige banco novo `sortex_phase1_*` e snapshot sintético anterior. Não apontar nenhum teste para o banco do ambiente existente.
- Preparar runtime em checkout novo com `services/api/scripts/build-netlify-phase1-preview.cjs`, após o build API. O script recusa sobrescrita. Manter segredos próprios da prévia e estáveis entre deploys para preservar sessões; nunca copiar os do ambiente existente.
- Corrigir para frente na branch e publicar somente a prévia. Se for necessário reverter código, fazer revert seletivo revisado, sem reset/force push e sem apagar as tabelas/dados novos. Não reverter integralmente o suporte social depois que houver contas sociais novas: elas dependem desse fluxo ou de recuperação de senha devidamente configurada.
- Netlify Free e Neon Free têm cotas compartilhadas/por projeto e podem suspender serviço ao esgotá-las. Não foi habilitada recarga paga e não se promete disponibilidade ilimitada.
- Pagamentos/integrações continuam em sandbox, e-mails e uploads desabilitados nesta prévia. Dados/uploads antigos, planos comerciais, contato e textos jurídicos definitivos, validação externa dos provedores e Safari real permanecem abertos.
- Capturas e instruções de revisão: [review-assets/2026-11-14/README.md](review-assets/2026-11-14/README.md).
