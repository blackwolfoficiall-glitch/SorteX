# SorteX — auditoria das melhorias iniciais, Fase 0

Data: 13/11/2026. Escopo autorizado: auditoria e plano; implementação das Fases 1–3 depende de nova autorização.

## 1. Preservação e estado do Git

- Repositório original: https://github.com/blackwolfoficiall-glitch/SorteX.
- Checkout auditado: `/workspace/SorteX`. O Mac `/Users/valbert/Projetos/SorteX` não foi acessado.
- Branch inicial: `infra/netlify-northflank-neon`; HEAD `2ad37ea4658b075f485a48a147b89c1a45f3e10b`, documentação final da migração, posterior ao código publicado.
- `git status --short` inicial vazio: não havia alterações locais não commitadas neste checkout. Isso não comprova o estado do Mac.
- Criada **somente localmente** a branch `feat/cadastro-identidades-institucional`, a partir desse HEAD. O remoto da branch de migração também foi conferido em `2ad37ea`.
- `main` e a branch de migração foram preservadas. Não houve commit, push, merge, reset, migration, seed, cadastro, alteração de configuração ou deploy nesta auditoria.
- Este relatório é o único arquivo novo. Não substitui os documentos anteriores de continuidade e não altera código.

## 2. Arquitetura e infraestrutura verificadas

| Camada | Evidência | Situação |
| --- | --- | --- |
| Frontend | `apps/web/package.json` | Next.js 16.2.12, App Router, React 19, TypeScript; Tailwind, Framer Motion, Base UI e Lucide já presentes |
| Gateway do frontend | `apps/web/app/api/`, `apps/web/lib/auth/server.ts` | BFF do Next encaminha chamadas à API e mantém cookies de sessão HttpOnly/Secure |
| API | `services/api/package.json`, `src/auth/auth.module.ts` | NestJS 11, Node.js, Passport/JWT, class-validator/class-transformer |
| Persistência | `services/api/prisma/schema.prisma` | Prisma 6; 99 modelos, 107 enums, 16 migrations históricas |
| Frontend publicado | `netlify.toml`, integração Netlify | Netlify Free, base `apps/web`, build `npm run build`, publish `.next`, runtime oficial `@netlify/plugin-nextjs` |
| API publicada | workflow `deploy-neon-homologacao.yml`, integração Neon | Neon Functions, Node 24; função `sortexapi`, deployment completed |
| Banco | integração Neon, consultas de catálogo | PostgreSQL 18, projeto `sortex-homologacao` / `crimson-bread-73821703`, branch `homologacao` / `br-lingering-voice-bc92seow`, banco `sortex`, plano `free_v3` |
| Uploads | código de armazenamento e continuidade | Bucket privado Neon `sortex-private-uploads`; backend local preservado como alternativa |
| Northflank | busca no repositório e configuração efetiva acima | Não participa do deploy atual comprovado; não foram inventariadas contas externas Northflank |
| Render | `render.yaml`, continuidade | Configuração histórica preservada; não utilizada pelo fluxo gratuito atual nem alterada nesta fase |

Site: https://sortex-homologacao.netlify.app. API: https://br-lingering-voice-bc92seow-sortexapi.compute.c-16.us-east-1.aws.neon.tech.

Deploy Netlify atual conferido: `6af775bfbc4b537efbd7868f`, ready, framework Next, branch `infra/netlify-northflank-neon`, commit de código `8251afd9f5596b860a81049b65565e7ab8301889`. A rota pública `/api/health/ready` respondeu 200, `database=up` e `storage=up`.

O workflow de deploy da API está limitado à branch de migração. A CI atual roda em pull requests e em pushes de main/infra, não em todo push de uma nova branch de feature. Não alterei gatilhos nem criei PR/deploy. A Fase 1 deve usar testes isolados; a aplicação de migrations no ambiente publicado exige autorização específica.

## 3. Banco: representação e relacionamentos

Catálogo, constraints e contagens foram consultados somente com SELECT. Não foram extraídos nomes de usuários, emails, documentos, hashes, tokens ou segredos.

| Modelo | Representação atual e vínculos importantes |
| --- | --- |
| `User` | Identidade comum a comprador e organizador; `role` é BUYER, ORGANIZER ou ADMIN. Email e password obrigatórios; CPF/CNPJ opcionais no schema, com índices únicos individuais; cidade/UF opcionais. O cadastro público convencional exige CPF e telefone no DTO/serviço |
| Comprador | É `User.role=BUYER`; não existe BuyerProfile/BuyerAddress no schema atual. Compras, títulos, favoritos, preferências e outros registros referenciam o mesmo User.id. Não há endereço postal completo ou nascimento do comprador nesse modelo |
| `OrganizerProfile` | Relação opcional 1:1 a User por userId único; perfil criado sob demanda. Contém fullName/CPF/telefone, nascimento, organizationName, CNPJ e endereço completo, município IBGE, revisão, plano/onboarding e bloqueios. Não há discriminador explícito PF/PJ nem campos separados de razão social/representante |
| `OrganizerBrandProfile` | Relação 1:1 a User por organizerId; identidade pública, publicName, fantasyName, cores, imagens e `slogan String?` |
| `AuthSession` | N:1 a User; refreshTokenHash, validade e revogação; preservação das sessões existentes é requisito |
| `PasswordResetToken` | N:1 a User; hash do token, validade e uso |
| `ConsentRecord` | N:1 a User; tipo, versão, concessão/revogação; FK com ON DELETE RESTRICT |
| `OrganizerDocument` e revisão | Documentos e decisões vinculados a OrganizerProfile; não devem ser removidos ou perder vínculo ao introduzir PF/PJ |

As FKs de perfil, marca e sessões apontam ao User.id. Não recriar contas nem trocar IDs. Há dados repetidos em User e OrganizerProfile; atualizações precisam manter consistência e preservar a revisão cadastral. Não há modelo de vínculo de identidade Google/Apple encontrado.

Contagens conferidas: **4 usuários, 1 ativo, 2 perfis de organizador, 16 migrations concluídas; nenhum slogan preenchido nesse banco**. Essas contagens diferem do encerramento da migração anterior e devem ser preservadas. Ausência de slogan neste banco não autoriza remover o campo ou ignorar slogans de backups/contas de outros ambientes. Não acessei backups ou arquivos do Mac, nem atestei recuperação de dados históricos.

## 4. Fluxos atuais de cadastro e autenticação

### Cadastro convencional

1. `/cadastro` já oferece Comprador e Organizador.
2. `/cadastro/comprador` coleta nome, CPF, telefone, email, cidade/UF em texto livre, senha/confirmação e três aceites.
3. `/cadastro/organizador` tem responsável/CPF, CNPJ opcional, telefone/email, cidade/UF livres, slogan e logo opcionais, senha e aceites. **Não separa PF/PJ**.
4. Ambos enviam POST `/api/auth/register`; o BFF encaminha a `/auth/register` no NestJS.
5. `RegisterDto` e `AuthService.register` validam senha/aceites, CPF com dígitos verificadores e conflitos de email/CPF/CNPJ. O cadastro público de ADMIN é recusado. User e ConsentRecord são criados de forma aninhada.
6. Comprador segue para `/cadastro/sucesso-comprador`; organizador para `/cadastro/sucesso-organizador`.
7. Se há logo/slogan, o cadastro de organizador faz também login, upload e/ou atualização de marca em chamadas posteriores. Uma falha nessa etapa pode aparecer como falha de cadastro apesar de a conta já ter sido criada.

### Login e perfis

`/login` → BFF `/api/auth/login` → API `/auth/login`. O backend usa bcrypt, controle de tentativas, JWT e sessão persistida. O BFF valida a sessão e mantém cookies HttpOnly, Secure em produção e SameSite=Lax. A UI direciona comprador para `/comprador`, organizador para `/dashboard` ou onboarding, administrador para `/admin/dashboard`; o login administrativo também tem rota separada.

Refresh tem rotação e revogação; logout e redefinição de senha possuem fluxos próprios. Os guards usam sessão ativa e permissões/role. Autenticação social futura deve produzir a sessão SorteX pelo backend, preservando esses controles; não aceitar um token externo diretamente como autorização interna.

O organizador já possui `/perfil`, configurações e personalização. O slogan é editável em `/perfil` e na personalização, persistido no mesmo OrganizerBrandProfile. O menu `/dashboard/configuracoes` não oferece atualmente uma entrada explícita Perfil; pode apontar para a rota existente, sem duplicá-la.

### Fluxos que não podem ser quebrados

Além do cadastro completo, há `checkout/phone-lookup`, `checkout/mini-register`, `checkout/start` e `checkout/complete`. O checkout pode criar comprador temporário sem CPF/endereço completo e concluir dados posteriormente. Endereço/CPF novos não devem virar NOT NULL global em User nem bloquear retroativamente sessões/checkout. Esses fluxos precisam de testes de compatibilidade específicos.

## 5. Achados e riscos ligados à Fase 1

| Prioridade | Achado comprovado ou risco identificado | Evidência / consequência |
| --- | --- | --- |
| Alta | Não basta substituir inputs: localidades já falham na consulta atual | GET público de states e BA/cities retornou 503; consultas diretas equivalentes ao IBGE também retornaram 503 neste executor. Causa raiz/abrangência da indisponibilidade não foi estabelecida |
| Alta | Backend não valida município/UF/código IBGE como conjunto | RegisterDto aceita cidade String e UF por regex; DTOs de perfil aceitam município/código sem comprovar pertencimento. Uma requisição direta contorna o seletor |
| Alta | Buyer não tem campos de endereço completo | Necessária extensão aditiva antes de prometer persistência dos novos formulários |
| Alta | PF/PJ não é um tipo persistido explícito | CNPJ opcional não define sozinho a política de cadastro; não classificar ou regravar automaticamente todos os legados |
| Alta | CNPJ atual é somente numérico e sem validação matemática no cadastro | Frontend/backend removem não dígitos e o DTO exige 14 dígitos. A Receita já publica documentação de CNPJ alfanumérico; validar formato/DV atuais preservando os numéricos existentes. Validar documento não comprova identidade ou situação cadastral |
| Alta | CPF/CNPJ/email são únicos em User | Não relaxar índices ou fundir contas por conveniência. Um comprador já cadastrado/representante de mais de uma empresa demanda política explícita; não introduzir multirole ou promoção silenciosa |
| Alta | Há provável erro de mapeamento na atualização de conta de organizador | `organizers.service.ts:148` aplica verificationStatus/reviewedAt/reviewedById no update de User nos estados CORRECTION_REQUESTED/REJECTED; essas colunas pertencem a OrganizerProfile. Risco de rejeição Prisma nesse ramo. Conclusão por inspeção; não reproduzido no banco publicado |
| Média | Seletor pesquisável já existe, mas só no componente de endereço do organizador | `AddressFields.tsx` possui busca sem acentos, lista rolável e limpeza de cidade ao trocar UF. Faltam handlers completos de setas/Escape, associação de foco/listbox e teste de leitor de tela; loading/erro e foco precisam revisão |
| Média | Resposta de CEP pode sobrescrever edição mais recente | `AddressFields.tsx:46` reutiliza snapshot de value. Número/complemento/UF editados durante a consulta podem ser substituídos; consultedCep também impede repetir a mesma consulta após erro |
| Média | CEP tem dependência secundária acoplada ao IBGE | Erro no fetch opcional de municípios cai no catch da rota e pode descartar um endereço já obtido da BrasilAPI |
| Média | Cadastro e upload/marca não são uma única operação | Conta pode existir após falha de logo/slogan; evitar nova tentativa criar duplicidade ou mostrar mensagem enganosa |
| Média | Regras de revisão atuais não distinguem PF/PJ | missingRequirements exige nascimento, nome da organização, logo e documentos. A matriz PF/PJ deve alinhar formulário e revisão, sem conceder verificação automaticamente ou criar bloqueios impossíveis |

Fontes de localização já presentes: IBGE (`servicodados.ibge.gov.br`) e BrasilAPI CEP v2. Não são serviços pagos contratados; disponibilidade não é garantida. Cache e contingência devem ser explícitos. Não aceitar nomes arbitrários como municípios válidos quando o provedor falhar.

## 6. Plano proposto da Fase 1 — somente após autorização

1. **Fechar contrato e matriz de campos.** Preservar seleção comprador/organizador; organizador escolhe PF/PJ. Comprador sem campos de empresa; PF com dados pessoais; PJ com CNPJ/razão social e representante/CPF. Manter senha/aceites e mensagens claras. Nascimento apenas quando necessário, alinhado à verificação; não torná-lo obrigatório para todo comprador sem justificativa. Definir finalidade da coleta de endereço e minimizar dados.
2. **Localidades compartilhadas e acessíveis.** Reaproveitar o contrato de AddressFields e os endpoints atuais. Lista estável com 26 estados + DF, busca por nome/sigla; municípios oficiais filtrados por UF e identificados por código. Serviço Nest de validação com mesma referência do frontend, cache/versionamento do último catálogo validado e política de indisponibilidade; não realizar fetch lento dentro da transação de cadastro. Preservar URLs BFF. Completar teclado/foco/ARIA, estados de erro/retry, tratamento de CEP e cancelamento de respostas obsoletas. Base UI já está disponível e pode fornecer o primitivo acessível.
3. **Extensão mínima do banco.** Proposta: tipo PF/PJ opcional no OrganizerProfile e relação de endereço opcional para comprador, mantendo endereço do organizador no perfil atual. Reutilizar User.name/Profile.fullName para responsável, organizationName para razão social quando a semântica estiver definida e fantasyName da marca quando apropriado; não duplicar dados legais sem necessidade. Campos novos nullable para legados, sem backfill obrigatório, exclusão, troca de IDs ou alteração dos índices únicos existentes. O desenho final exige revisão antes de gerar SQL.
4. **Backend e cadastro atômico.** Centralizar validação/normalização de CPF/CNPJ, UF/município e campos condicionais. Rejeitar ADMIN e campos incompatíveis com o perfil. Persistir os dados necessários e aceites de forma transacional; preservar leitura/login de contas antigas e respostas compatíveis durante a transição. Tratar conflito de unicidade também no banco, inclusive concorrência. Ajustar os ramos de conta/perfil relacionados e cobri-los por testes.
5. **Formulários progressivos.** Usar as rotas existentes, etapas claras e responsivas: perfil/tipo, dados necessários, endereço e acesso/aceites. Máscaras sem destruir CNPJ alfanumérico, erros por campo, resumo final e proteção contra duplo envio. Não salvar dados sensíveis indiscriminadamente em localStorage. Logo opcional existente deve manter caminho de envio/retry sem fingir que a conta não foi criada.
6. **Slogan.** Retirar input e atualização de slogan do cadastro inicial. Adicionar Configurações → Perfil apontando para `/perfil`; slogan continua opcional/editável, com limite existente, sem limpar valores salvos nem criar nova tabela de slogans.
7. **Validar e parar.** Testar persistência, regressões e responsividade; apresentar resultados e pendências. Não começar Google/Apple ou o institucional junto. Não fazer deploy ou aplicar migration no banco publicado sem autorização posterior.

### Arquivos com impacto provável na Fase 1

| Grupo | Arquivos existentes a avaliar/alterar |
| --- | --- |
| Cadastro | `apps/web/app/cadastro/page.tsx`, `cadastro/comprador/page.tsx`, `cadastro/organizador/page.tsx`; ajustar telas de sucesso apenas se o contrato exigir |
| Endereço | `apps/web/components/organizador/AddressFields.tsx`; `app/api/location/states/route.ts`, `states/[uf]/cities/route.ts`, `cep/[cep]/route.ts` |
| Perfil e slogan | `apps/web/app/perfil/page.tsx`, `app/dashboard/configuracoes/page.tsx`; reaproveitar personalização/BrandProfile, sem apagar seus dados |
| Clientes/tipos BFF | `apps/web/lib/auth/types.ts`, `lib/organizers/types.ts`, `lib/organizers/client.ts`, `lib/buyer/types.ts`, `lib/buyer/client.ts`; rota `app/api/auth/register/route.ts` somente se necessário |
| Cadastro/API | `services/api/src/auth/dto/register.dto.ts`, `auth/auth.service.ts`, testes correspondentes; login/refresh não têm reformulação funcional planejada na Fase 1 |
| Perfis/API | `organizers/dto/update-organizer-profile.dto.ts`, `update-organizer-account.dto.ts`, `organizers.service.ts`; `buyer/dto/buyer-profile.dto.ts`, `buyer.service.ts` e testes |
| Persistência | `services/api/prisma/schema.prisma` e **nova** migration aditiva revisada; preservar as 16 antigas |
| Testes | testes de AuthService/OrganizersService e contratos HTTP; `apps/web/e2e/profile-settings-full.spec.ts` hoje usa fill em UF/cidade e precisará refletir combobox; acrescentar jornadas de cadastro/localidades |

Arquivos novos propostos, não criados: componente compartilhado `components/ui/SearchableSelect.tsx`; clientes/validações de documentos e localização; módulo Nest `src/locations/` e validadores comuns; testes de cadastro PF/PJ/localidades. Não há necessidade comprovada de mudar Netlify, Northflank, domínio, Docker, pagamentos, comissões, sorteios, uploads ou segredos para implementar o cadastro localmente.

## 7. Dependências da Fase 2 — Google/Apple, sem implementar agora

Não foram encontrados login Google/Apple, estratégias desses provedores ou tabela de identidades sociais no código/schema. A metadata da função não listou nomes de variáveis GOOGLE/APPLE/OIDC. Contas e Secrets externos não foram inventariados. OAuth Meta/WhatsApp existente é integração de negócio, não login social de usuários.

- **Google:** preparar projeto/client OAuth Web, consentimento/branding, scopes mínimos openid/email/profile e origens/callbacks HTTPS exatos. Usar o fluxo oficial Google Identity Services/OIDC com validação no Nest e a sessão SorteX existente; não substituir a autenticação por outro produto pago. Console e credenciais ainda precisam ser configurados/verificados na fase autorizada; não vincular billing/cartão.
- **Apple:** requer App ID primário habilitado, Services ID associado, domínio/subdomínio e return URL; chave privada .p8, Key ID e Team ID no backend. A Apple informa inscrição padrão de **US$ 99 por ano** no Developer Program; pode haver isenção para organizações elegíveis. Não foi conferida uma conta já habilitada do proprietário. Com orçamento R$0, a integração pode ficar bloqueada se não houver acesso existente ou isenção efetivamente aplicável. Não contratar, solicitar cartão ou prometer disponibilidade gratuita.
- **Segurança:** identidade única por provider + subject, com FK a User; validar assinatura/JWKS, issuer, audience, expiração e nonce; state de uso único, CSRF, PKCE quando suportado pelo fluxo escolhido e tratamento de callbacks. Não usar memória de um isolate Neon como único registro de desafios. Não vincular conta existente automaticamente apenas por coincidência de email; exigir prova de controle/autenticação adequada. Provedor não pode conceder ADMIN nem verificação comercial.
- **Compatibilidade:** User.password é obrigatório e login usa bcrypt.compare; estratégia de contas somente sociais precisa ser decidida e testada antes de alterar esse contrato. Contas e sessões antigas devem continuar válidas. Não atribuir BUYER silenciosamente antes de a pessoa escolher seu perfil.
- **Apple:** aceitar email relay sem tratá-lo como inválido; identificar pelo subject, solicitar nome ausente (a Apple pode entregá-lo só na primeira autorização) e mapear a escolha de perfil/dados faltantes com segurança. O callback form_post exige atenção aos cookies SameSite=Lax atuais e à correlação CSRF. Envio de mensagens para relay é configuração separada; não prometer email funcional enquanto a entrega estiver desabilitada.
- **Critério:** botões sem autenticação real não concluem a fase. Habilitar cada provedor somente com credenciais/callbacks reais e testes; validação Safari/iOS real não se resume a viewport Chromium.

## 8. Inventário da Fase 3 — institucional, sem implementar agora

Já existe home em `/`, Header/HeroBanner/Footer, FAQ, `/contato`, `/termos`, `/privacidade`, `layout.tsx`, `robots.ts` e `sitemap.ts`. Login/cadastro e áreas internas devem conservar seus caminhos. `/contato` ainda diz que o canal público será informado; não há contato comercial validado a publicar nessa página.

O banco possui os planos ativos Inicial, Profissional, Avançado e Empresarial. A existência de registros, seeds e defaults não comprova aprovação dos preços, benefícios e condições para publicidade. Não inventar promoções, preços ou benefícios; confirmar a fonte comercial aprovada antes da seção Planos. Recursos de campanha, participantes, relatórios e sorteios têm código, mas pagamentos/integrações reais não foram homologados nesta auditoria e não devem ser anunciados como operação financeira ativa.

Proposta futura: reformular a camada pública existente com identidade SorteX, componentes escopados e animações com respeito a reduced-motion, preservando dashboards/BFF. Avaliar `/` com seções e, se necessário, `/sobre`, `/funcionalidades` e `/planos`; manter rotas existentes e só definir domínio separado após avaliar custo/necessidade. A referência https://nexohaven.com.br/sobre respondeu HTTP 200; a análise visual detalhada fica para a Fase 3. Não copiar seu código, textos, imagens ou marca.

SEO já tem estrutura básica: metadata/OG/Twitter no layout; sitemap só com a home; robots restringe áreas privadas. Ampliar dados por página, canonical, imagem OG própria, sitemap e dados estruturados factuais. Rever noindex de login/cadastro e homologação antes de indexação do site oficial; robots não substitui autenticação. Não modificar agora indexação/domínios do ambiente publicado nem prometer ranking.

## 9. Testes, limites da auditoria e rollback

### Executado nesta Fase 0

- TypeScript API: `npm run typecheck -- --incremental false` — exit 0.
- TypeScript frontend: `npx tsc --noEmit --incremental false` — exit 0.
- Cinco suítes existentes isoladas: AuthService, AuthController, JwtStrategy, RolesGuard e OrganizersService — **32 testes aprovados**. Testes usam mocks; não se conectaram ao banco publicado.
- Leitura de schema/constraints/contagens no Neon e metadata de deploy; health público 200; localidades públicas/diretas 503 nesta consulta.
- Não executei E2E autenticado, POST de cadastro/login, seeds, migrations ou testes que editam perfis. Os Playwright existentes compartilham credenciais por variáveis de ambiente, fazem mutações e não são adequados ao banco publicado nesta fase. Perfis móveis atuais usam Chromium, não Safari/iOS nativo.
- Não repeti lint/build integrais por não haver mudança de implementação. A documentação da migração registra o baseline anterior aprovado; a implementação futura terá nova validação completa. Esta auditoria não certifica fluxos PF/PJ/OAuth ainda inexistentes.

### Estratégia após autorização

1. Banco PostgreSQL de teste isolado, preferencialmente local/descartável, sem reutilizar URLs/contas do Neon publicado. Gerar migration aditiva para revisão e aplicá-la primeiro em teste; nunca migrate reset, db push com perda de dados ou edição das migrations históricas.
2. Testes unitários de CPF/CNPJ, PF/PJ, perfil permitido, campos condicionais, conflito/concorrência, slogan preservado e correção do ramo de revisão identificado. Fixtures com município/UF/código coerentes e incoerentes, 27 UFs, busca por sigla/nome/acentos e exemplo BA + Fe.
3. Testes HTTP e persistência real em banco isolado para User/perfil/endereço/consentimentos; falha intermediária não pode criar conta parcial ou perder dados existentes. Simular indisponibilidade IBGE/BrasilAPI, cache e resposta obsoleta sem depender dos serviços externos na CI.
4. Playwright desktop/mobile com teclado, foco, rolagem, labels/ARIA, mudança de UF limpando cidade, CEP sem sobrescrever edição, PF/PJ alternando campos, duplo envio, erros e reload após gravar. Revalidar login/admin/refresh/logout, checkout simplificado, marca/slogan e upload quando houver impacto.
5. Rodar lint, TypeScript, build de frontend/API e pacote Neon, testes novos e regressões aplicáveis. Atualizar a documentação e apresentar diferenças/SQL/resultados. Deploy é etapa separada, mediante autorização.

### Rollback e preservação de dados

- O código anterior está identificado por commits; usar reversão rastreável de commits/deploy autorizados, sem reset/force push/merge em main.
- Schema expansivo e campos opcionais: manter novas colunas/tabelas e os dados inseridos ao reverter a interface; não executar DROP ou apagar cadastros para voltar uma versão.
- Validar compatibilidade de leitura/escrita antes de retornar a código antigo, especialmente com CNPJ alfanumérico e futuros usuários sociais. Não reativar código que remova letras ou descarte dados novos; preferir correção para frente se necessário.
- Antes de qualquer futura migration no ambiente publicado: backup/snapshot permitido pelo Free, destino conferido, SQL revisado, restauração ensaiada em ambiente isolado e autorização do proprietário. Não presumir que backups do Mac estejam disponíveis.
- Não trocar JWT/criptografia, nem excluir sessões, documentos, slogans, contas ou uploads nesta fase.

## 10. Fontes oficiais consultadas e próximo passo

- Google: https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
- Apple web: https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web/
- Apple inscrição/custo: https://developer.apple.com/programs/enroll/
- Receita Federal, documentação do DV de CNPJ alfanumérico: https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj (página 200, referências manual-dv-cnpj.pdf e codigos-cnpj.zip; algoritmo não implementado nesta fase).
- IBGE: endpoints atuais de localidades no código; indisponíveis nesta consulta, sem conclusão sobre duração ou causa raiz.

**Fase 0 concluída. Aguardar autorização para implementar somente a Fase 1.** Google/Apple e institucional permanecem para fases posteriores, com plano e validação próprios. O cadastro do administrador definitivo continua adiado conforme a decisão anterior; não faz parte desta melhoria nem foi solicitado novamente.
