# SorteX — publicação da versão aprovada

Data: 15/11/2026 (UTC).

**Endereço principal:** https://sortex-homologacao.netlify.app

**Commit publicado:** `a6904fc0d5ecd3ada82bf35eb6f8982cc9f1f5eb`, branch `infra/netlify-northflank-neon`.
**Deploy Netlify:** `6af9294b7155863f0c1bcfe9`.

## Aprovação, comparação e preservação

O endereço da prévia entregue e aprovado exibia `c71e243a253fd8e7fe9e5144fa395ebd2ef0c600`. O commit posterior `0860940` acrescentava somente evidências/documentação, sem alteração do aplicativo. Na conferência inicial, o principal exibia `8251afd9f5596b860a81049b65565e7ab8301889`, deploy `6af775bfbc4b537efbd7868f`; a branch de publicação estava em `2ad37ea`.

O merge `83e42188756fc566a5510915fcddb74df43b477c` preservou os dois históricos, sem conflitos, reset, force push ou descarte de alterações. Nesse merge, o diretório inteiro `apps/web` era idêntico ao aprovado (tree `3cd7f0c7db208a44efe4705c12dd0baeccb9bba3`).

A verificação pública revelou um problema específico de transporte: respostas de localidades originadas na API Neon eram decodificadas pelo Fetch, mas os dois route handlers as devolviam com o cabeçalho `Content-Encoding: br` original. O leitor tentava descomprimir novamente e falhava. O commit final `a6904fc` reserializa esse JSON com os helpers existentes, mantendo status e validações. São as únicas diferenças de código frontend em relação ao aprovado:

- `apps/web/app/api/location/states/route.ts`;
- `apps/web/app/api/location/states/[uf]/cities/route.ts`.

Componentes, CSS, inicial, ilustrações comerciais, planos e telas de login/cadastro foram comparados e permanecem idênticos ao aprovado. Cinco testes específicos de transporte/erros passaram. Não foi necessário desativar compressão, verificações de segurança, TLS ou controles de acesso.

A branch `main` permanece em `2b8e8503eb33e73136cd076dbd322c78945c2ffe`. A prévia continua no seu site e banco próprios; nenhum dado ou segredo dela foi copiado para o principal.

## Destino e configuração conferidos

- Netlify original `sortex-homologacao`, ID `a3040361-02c8-4222-8110-36f043eeb5e1`, plano Free; branch de produção `infra/netlify-northflank-neon`. Nenhum domínio personalizado foi encontrado; o endereço oficial atual é o já existente acima.
- API principal NestJS/Node/Prisma: https://br-lingering-voice-bc92seow-sortexapi.compute.c-16.us-east-1.aws.neon.tech — Neon Functions existente.
- PostgreSQL principal: projeto `crimson-bread-73821703`, branch `br-lingering-voice-bc92seow` (`homologacao`), banco `sortex`. Plano `free_v3` reconfirmado.
- `API_URL`, `API_INTERNAL_URL` e `NEXT_PUBLIC_APP_URL` da Netlify foram conferidos e preservados. Acrescentado apenas o identificador público de versão do frontend. Nenhuma credencial de aplicação da prévia foi reutilizada.
- A API continuou com suas próprias chaves JWT/criptografia, URLs, origem/CORS e armazenamento. O deploy preservou variáveis existentes; a atualização parcial informou somente `APP_VERSION`. Não houve alteração de `NEON_API_KEY` nem extração de repository secrets.
- Uploads privados permanecem em `sortex-private-uploads`, driver `neon-s3`; prontidão de storage confirmou `up`. Não foram removidos ou recriados uploads/buckets.
- Não habilitados pagamentos reais, cobranças, cartões, planos pagos ou recursos Render. Os recursos pagos da Render não foram reativados nem excluídos.

## Banco, backup e migrations

O principal tinha 16 migrations concluídas. Não havia duplicidades canônicas de email/CPF/CNPJ. Antes de aplicar mudanças:

1. Criada a branch de recuperação persistente Neon `preserve-before-c71e243-20261115`, ID `br-billowing-feather-bctll6b3`, filha da branch principal, sem compute adicional. Ela preserva o ponto anterior às migrations.
2. Criado dump privado PostgreSQL 18, formato custom, com hash SHA-256, no diretório restrito `/workspace/sortex-private-backups/2026-11-15-before-c71e243/`, fora do Git. O dump tem 359.327 bytes e permissões 600; o diretório tem acesso restrito. O hash foi reconferido.
3. Restaurado o dump em banco local novo `sortex_release_restore_20261115`. Aplicadas ali as três migrations pendentes e comparadas as 99 tabelas existentes, incluindo todas as colunas originais: nenhuma linha ou valor anterior foi alterado. O novo campo nullable foi comparado separadamente para não confundir mudança de schema com alteração de dados.
4. Conferidos os checksums das 16 migrations históricas e a identidade do destino. Somente então foi usado `prisma migrate deploy` no principal.

Migrations aplicadas:

- `20261113230000_registration_identities`: campo nullable `OrganizerProfile.personType` e tabela `BuyerAddress`;
- `20261113231000_canonical_identity_uniqueness`: índices únicos canônicos com preflight que aborta se encontrar duplicidades; sem normalização ou fusão de contas;
- `20261114140000_social_identities`: tabelas `SocialIdentity` e `SocialAuthAttempt`.

A comparação no principal imediatamente antes/depois confirmou todas as linhas e colunas originais das 99 tabelas inalteradas. São agora **19 migrations concluídas**. Não houve reset, seed, recriação, importação do banco demonstrativo ou restauração sobre o banco principal.

Contagem final: **4 contas, 1 ativa, 0 campanhas e 0 compras**. Nenhum usuário `marketing-demo-*` importado. As três contas técnicas antigas inativas foram preservadas, não reativadas. Valores das ilustrações comerciais são exemplos no código e não registros de vendas no banco.

O dump local depende da preservação desta VM; a branch de recuperação no Neon é o ponto persistente separado. Não apagar automaticamente esses backups. Eventual recuperação do principal exige nova conferência e autorização, pois atividades legítimas posteriores — como o login confirmado pelo proprietário — não devem ser sobrescritas.

## Publicação e verificações

A publicação automática da Netlify foi temporariamente bloqueada **no deploy que já estava publicado**, mantendo-o no ar durante a preparação. Banco e API foram conferidos antes da liberação do frontend. As URLs de deploys ainda não publicados exigiram login Netlify; essa proteção foi mantida. O bloqueio temporário de publicação foi removido e a versão final foi publicada pelo Git CD na branch correta.

- **CI completo aprovado no commit final:** https://github.com/blackwolfoficiall-glitch/SorteX/actions/runs/43673302120 — Prisma, lint, testes unitários/E2E, TypeScript e builds de API/frontend.
- **Deploy API aprovado:** https://github.com/blackwolfoficiall-glitch/SorteX/actions/runs/43673302140.
- 275 testes unitários da API também foram executados localmente nesta promoção; cinco testes adicionais reproduziram respostas já decodificadas com cabeçalho de compressão e verificaram o transporte corrigido, incluindo erros e UF inválida.
- Fluxos completos com gravação de cadastro PF/PJ e slogan já haviam passado nos 63 cenários públicos do ambiente isolado aprovado. No principal, foram testados formulários, PF/PJ, links, municípios e rejeição de requisições vazias antes de criar conta/sessão. **Nenhuma conta ou compra fictícia foi criada no principal para os testes.**
- Endereço oficial conferido em desktop Chromium e emulações iPhone 13/Pixel 7: inicial/ilustrações, Recursos/Como funciona/Planos, FAQ, login, cadastro comprador/organizador PF/PJ, ausência de slogan no cadastro e ausência de erros JavaScript observados.
- `/api/location/states/BA/cities` HTTP200 com JSON legível e Feira de Santana; `/api/public/campaigns` HTTP200; login/cadastro vazios HTTP400; sessão anônima HTTP401. O endpoint público de prontidão é `/api/health/ready`; o gateway `/api/platform/health/ready` continua exigindo sessão (401), sem relaxamento da proteção.
- API e BFF de prontidão confirmaram `database=up` e `storage=up`. Metadado HTML, commit do deploy Netlify e versão pública `/health` da API conferem `a6904fc`.
- O proprietário confirmou por resposta nesta conversa: **“Login funcionou e o painel abriu”** ao testar no iPhone. É confirmação humana de sessão real; navegador/versão não identificado expressamente. Homologação completa de Safari/VoiceOver e Android físico permanece pendente.
- [Capturas e resultados públicos](review-assets/2026-11-15-publicacao/README.md).

## Pendências separadas

**Google e Apple não estão funcionais no ambiente principal.** O endpoint real retorna ambos `enabled=false`, motivo configuração externa pendente; os botões continuam desabilitados com explicação. Não foram anunciados como autenticação concluída.

Para uma configuração futura do principal, usar cliente próprio e callbacks:

- Google: `https://sortex-homologacao.netlify.app/api/auth/social/google/callback`;
- Apple: `https://sortex-homologacao.netlify.app/api/auth/social/apple/callback`.

Os segredos devem ficar somente no ambiente da função principal `sortexapi` do Neon, sem `NEXT_PUBLIC`, Git ou chat. Não copiar segredos da prévia. Google exige cliente OAuth Web/consentimento; Apple depende de conta Developer já habilitada ou isenção aplicável. Não contratar associação paga dentro do orçamento R$0. O [guia anterior](SORTEX_AUTENTICACAO_SOCIAL_CONFIGURACAO.md) descreve a **prévia**: não usar seu destino Netlify/branch de teste para configurar o principal.

Planos mantidos exatamente como aprovados: quatro cards com preços “A confirmar”; não houve nova tabela comercial confirmada. Contato oficial e textos jurídicos definitivos também seguem pendentes. Dados e uploads antigos do Mac/Render não foram recuperados nesta publicação; o banco principal existente foi preservado.

## Continuidade

Continuar pela branch `infra/netlify-northflank-neon`, verificando ambiente e documentação antes de comandos. Publicações futuras precisam atualizar o identificador público do commit e conferir o código efetivamente servido. Não confiar apenas no término do build ou na prontidão genérica da API.

O commit posterior que registra somente este relatório/capturas usa `[skip ci] [skip netlify]` para evitar nova publicação sem mudança de aplicação. O código realmente publicado continua sendo `a6904fc`. Correções de aplicação futuras devem ser commits novos, com testes e publicação revisada; não usar reset/force push nem apagar histórico ou restaurar dados automaticamente.
