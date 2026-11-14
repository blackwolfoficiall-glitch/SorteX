# SorteX — Fase 1: cadastro, documentos e localidades

Data: 14/11/2026. Branch: `feat/cadastro-identidades-institucional`.
Base preservada: `2ad37ea4658b075f485a48a147b89c1a45f3e10b`.
Repositório: https://github.com/blackwolfoficiall-glitch/SorteX.

## Escopo e preservação

Implementação local para revisão, conforme a autorização da Fase 1. Não houve push, merge, deploy, execução de migrations no Neon ou alteração de contas/configurações do ambiente publicado. Não foram implementados Google/Apple, aplicativo ou site institucional. Nenhum serviço/cartão/cobrança foi contratado ou habilitado.

A auditoria anterior `SORTEX_AUDITORIA_MELHORIAS_FASE_0_2026-11-13.md` foi preservada sem atualização automática. As informações deste relatório complementam aquela fotografia; não substituem decisões históricas. O Mac e seus arquivos privados não foram acessados nesta fase. Dados antigos e uploads não foram restaurados: todos os dados usados na validação são sintéticos e estão em PostgreSQL local exclusivo de testes.

## Implementação

- `apps/web/components/auth/RegistrationForm.tsx`: formulário compartilhado pelos caminhos de comprador/organizador, organizado em identificação, endereço e acesso. Seleção de organizador PF/PJ controla quais campos aparecem e são enviados. PF usa nome/CPF; PJ usa representante/CPF, CNPJ, razão social e nome fantasia opcional. Telefone e documentos têm máscaras; CNPJ aceita letras. O cadastro continua usando os aceites e o login de e-mail existentes.
- `components/organizador/AddressFields.tsx`: componente existente reaproveitado e revisto. UF e cidade pesquisáveis por nome/sigla, sem diferenciar acentos/maiúsculas, lista rolável, labels, combobox/listbox, foco no campo, setas, Home/End, Enter, Escape e Tab. Trocar UF limpa cidade/código. Digitação livre não vira seleção válida. Há carregamento, erros e tentativa novamente. CEP não sobrescreve campos editados durante uma consulta, e consultas antigas são canceladas.
- `services/api/src/locations/`: API pública de UFs/municípios e validação conjunta do nome, UF e código de sete dígitos. O backend grava o nome canônico do catálogo. Alterações cadastrais também validam localidades modificadas; valores legados inalterados não impedem uma edição não relacionada.
- O catálogo embarcado evita depender da disponibilidade do IBGE em cada cadastro. O frontend consulta a API e usa o arquivo estático como contingência. Se ambos falharem, mostra erro/tentativa novamente e não aceita município inventado. CEP indisponível permite preencher os demais campos manualmente e escolher um município válido.
- `auth.service.ts` e `RegisterDto`: validação de endereço completo e PF/PJ, CPF/CNPJ, consentimentos e senha. Uma escrita aninhada do Prisma grava usuário, endereço/perfil, marca PJ quando aplicável e os três consentimentos atomicamente. Conflitos concorrentes retornam 409. A resposta não contém hash de senha.
- Comprador recebe `BuyerAddress` ligado ao mesmo `User.id`; organizador usa os campos existentes em `OrganizerProfile`. Nome/CPF do representante reutilizam os campos existentes. Endereço é retornado apenas no perfil autenticado do comprador; editar cidade/UF sincroniza também o endereço já existente na mesma transação. Não cria endereço obrigatório para comprador antigo.
- Perfis antigos mantêm `personType = NULL`; nenhuma inferência ou reclassificação automática por CPF/CNPJ. A revisão de PF deixa de exigir nome de empresa; PJ exige razão social/CNPJ e mantém verificações/documentos existentes. Data de nascimento não é solicitada no cadastro inicial; continua no fluxo de verificação quando necessário, com tratamento condicional de PJ.
- `organizers.service.ts`: confirmado o erro que enviava `verificationStatus`, `reviewedAt` e `reviewedById` ao `User`. Esses campos agora são atualizados em `OrganizerProfile`; `User.verified` fica falso quando o perfil rejeitado/em correção volta a pendente. As duas escritas e o registro de auditoria permanecem na mesma transação. O motivo de rejeição anterior é preservado nessa correção. Nenhum status de aprovação é concedido automaticamente.
- Slogan removido do cadastro. `Configurações → Perfil` aponta para `/perfil`, onde o editor existente permite editar ou limpar o slogan opcional de até 60 caracteres. Não houve migração/regravação dos slogans anteriores. A personalização existente continua disponível. A logo opcional do cadastro foi preservada; se o envio posterior à criação falhar, a interface informa que a conta já existe e orienta a repetir o upload pelo painel.
- A análise de risco administrativa passa a aceitar o CNPJ alfanumérico válido. A edição de perfil preserva suas letras. Essas mudanças são necessárias para não rejeitar/desfigurar documentos aceitos pelo novo cadastro.

## Fontes oficiais e limites da validação

CNPJ: manual Receita Federal/Serpro, consultado em 13/11/2026:
https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/cnpj/manual-dv-cnpj.pdf/@@download/file

São 12 caracteres ASCII `A–Z/0–9` e dois dígitos numéricos; valores para cálculo = ASCII menos 48, pesos 2–9, módulo 11. Exemplo oficial validado em teste: `12.ABC.345/01DE-35`. CNPJs numéricos continuam aceitos. CPF continua com 11 dígitos e seus dois verificadores; sequências numéricas repetidas são rejeitadas. Só a formatação é removida; letras de CNPJ são preservadas/convertidas para maiúsculas. Os campos existentes são strings e não precisaram de conversão de tipo.

A validação é de formato/dígitos, não consulta de situação fiscal, titularidade ou identidade. Não integra serviços pagos. A compatibilidade de CNPJ alfanumérico com cada futuro provedor externo deverá ser conferida antes de transmitir dados a ele; pagamentos reais não foram executados.

Municípios: Divisão Territorial Brasileira 2025, referência 31/12/2025, obtida em 13/11/2026:
https://geoftp.ibge.gov.br/organizacao_do_territorio/estrutura_territorial/divisao_territorial/2025/DTB_2025.zip

Era o último ano listado no diretório oficial consultado. Arquivo utilizado: `RELATORIO_DTB_BRASIL_2025_MUNICIPIOS.xls`. São 27 UFs e 5.571 municípios, incluindo Boa Esperança do Norte/MT. SHA-256 do ZIP: `d077a0e48c36cf18bcc96268b4a436200c014c6b8522c1a62d894acaf39dad27`.

Os snapshots em `services/api/src/locations/data/municipalities.json` e `apps/web/public/data/municipalities.json` são idênticos (219.553 bytes cada), com fonte/data/hash registrados. O teste detecta divergência entre cópias. Atualizações territoriais futuras exigem conferir a publicação oficial, converter as colunas UF/Nome_UF/Código Município Completo/Nome_Município, preservar códigos como strings de sete dígitos e revisar as duas cópias e os testes na mesma alteração. Não há promessa de atualização automática ou consulta contínua ao IBGE.

## Migrations propostas

1. `services/api/prisma/migrations/20261113230000_registration_identities/migration.sql`: cria enum PF/PJ, adiciona `OrganizerProfile.personType` nullable sem default/backfill e cria `BuyerAddress` com relação 1:1 ao usuário. Não altera IDs, sessões, senhas, compras ou histórico; não exige endereço de usuários antigos.
2. `services/api/prisma/migrations/20261113231000_canonical_identity_uniqueness/migration.sql`: adiciona índices únicos por e-mail sem diferença de caixa/espaços externos e por CPF/CNPJ sem formatação, preservando os índices únicos existentes. Impede duplicar um documento legado formatado ou e-mail legado em caixa diferente. Não altera os valores salvos. A migration aborta atomicamente se encontrar duplicidades canônicas; nunca une contas nem escolhe automaticamente qual excluir/alterar.

Os índices por expressão são SQL explícito, não representáveis no schema do Prisma 6. Há comentário no modelo User; futuras migrations devem preservá-los. A comparação do banco isolado com o schema final resultou em migration vazia.

As 16 migrations históricas foram preservadas. As duas novas foram aplicadas somente em bancos locais de teste. A fixture anterior e posterior foi comparada integralmente: ID, senha, perfil, sessão e slogan mantidos; novo tipo nulo e nenhum endereço adicionado ao usuário antigo.

Antes de qualquer aplicação futura no ambiente publicado: autorização própria, identificação positiva do destino, backup/snapshot validado e conferência de duplicidades canônicas. A criação dos índices pode bloquear escritas enquanto executa e deve ser planejada conforme o volume real. Se o preflight encontrar duplicidades, parar e pedir decisão sobre aquelas contas, sem limpeza automática. Nenhuma dessas conferências de produção foi executada nesta fase.

## Validação executada

- API unitária: 42 suítes, **258 testes aprovados**, incluindo os 229 testes anteriores.
- API HTTP/PostgreSQL: 2 suítes, **21 testes aprovados**, em bancos isolados, com reprodução em banco novo. Cadastro buyer/PF/PJ, endereço/consentimentos, login/refresh, CPF/CNPJ, campos condicionais, UF/cidade/IBGE inconsistentes, ausência de usuário parcial, concorrência, duplicidade legada, revisão de rejeitado/em correção e checkout simplificado sem CPF/endereço.
- Falha real de PostgreSQL foi injetada em um consentimento sintético: a conta/endereço não ficaram gravados. O erro deliberado no log é esperado pelo teste.
- Teste de preflight com duplicidades em schema isolado: a transação abortou sem deixar schema/índices/registros parciais.
- Playwright: **14 testes aprovados**, sete cenários em desktop e viewport iPhone 13/Chromium. Cadastro real via frontend/BFF/API/banco, busca BA + Fe, teclado, limpeza de cidade ao trocar UF, indisponibilidade/retry de catálogo, CEP tardio e edição/limpeza persistente do slogan via Configurações → Perfil.
- TypeScript frontend/API: aprovado. Lint frontend/API: zero erros; 36 e 731 avisos, respectivamente, incluindo avisos do projeto, tipagem de mocks/testes e sincronização de estado dos efeitos de endereço. Não há afirmação de lint sem avisos.
- Build Next.js: aprovado. Build NestJS e pacote Neon: aprovados. Pacote verificado: 2.001 arquivos, aproximadamente 14,17 MB descompactados e 4,31 MB ZIP, dentro dos limites já usados pelo projeto. Nenhum upload/deploy foi executado.
- Validação Prisma e verificações de segurança de deploy/bootstrap existentes: aprovadas (4 + 4 testes de scripts, com mocks).
- `git diff --check`: aprovado.

O lint local inicialmente incluía artefatos gerados em `.netlify`/`.playwright`, resultando em erros de código gerado e configuração de plugin. `apps/web/eslint.config.mjs` agora ignora esses artefatos e limita os overrides TypeScript aos seus arquivos. Os arquivos fonte continuam sendo verificados. Não houve alteração de configurações de hospedagem, ambiente ou credenciais.

Não executei toda a coleção histórica de Playwright que compartilha contas de homologação. Safari/iOS nativo, VoiceOver e uma revisão visual pelo responsável continuam recomendados; o viewport de iPhone em Chromium não certifica esses ambientes. Os testes executados não encontraram regressões nos fluxos cobertos.

## Como reproduzir sem acessar produção

1. Criar um PostgreSQL local **novo**, versão 18 usada na validação, com banco `sortex_phase1_<sufixo>`. Não reutilizar banco do Mac/Neon nem executar reset. Disponibilizar sua URL apenas pelo ambiente local seguro, em `SORTEX_PHASE1_DATABASE_URL`; o script recusa host não loopback ou nome fora desse prefixo.
2. Em `services/api`, com dependências/Prisma Client instalados: `node scripts/prepare-phase1-test-db.cjs`. O script lê a base Git `2ad37ea`, aplica as 16 migrations históricas, insere somente fixture sintética, salva snapshot privado em diretório temporário e aplica as duas migrations aditivas. Não sobrescreve um banco com contas existentes. Pode retomar somente o schema histórico validado e sem usuários após interrupção do preparo.
3. Usar o caminho impresso pelo script em `SORTEX_PHASE1_BEFORE_PATH`. Executar `npm run test:e2e -- --runInBand`, mantendo `SORTEX_PHASE1_DATABASE_URL`. Sem essa URL a suíte real fica explicitamente ignorada; a suíte existente com mock continua executável. O snapshot nunca deve ser versionado.
4. Para navegador, iniciar a API local com o mesmo banco isolado, segredos JWT temporários próprios, integrações em sandbox e porta 3336. Definir `PLAYWRIGHT_API_URL=http://127.0.0.1:3336`. Em `apps/web`, instalar Chromium com Playwright e executar `npx playwright test --config playwright.phase1.config.ts`. Essa configuração inicia frontend local em 3101 e recusa API não local. Não usar a URL publicada. A suíte cria contas sintéticas; não realiza compras/cobranças.
5. Executar `npm run lint`, `npm run typecheck`, `npm run build` em ambos os projetos, `npm test -- --runInBand` e `npm run build:neon` na API. Logs e conexões de teste ficam fora do Git. O helper não inicia nem encerra recursos pagos ou ambientes publicados.

## Reversão

- Esta entrega fica em commit local da branch de trabalho. Para desfazer código depois de revisão, usar `git revert <commit-da-fase-1>` em branch própria, sem reset/force push/merge na main. Preservar as alterações locais de quem estiver trabalhando.
- Não executar migration reversa destrutiva. Manter BuyerAddress, personType, índices e seus dados, mesmo se a interface for revertida. Se uma migration ainda não foi publicada, simplesmente não aplicá-la ao destino até nova autorização.
- Antes de voltar ao código anterior, verificar compatibilidade: ele removia letras do CNPJ em cadastro/edição e tinha o erro de revisão. Com novos CNPJs alfanuméricos cadastrados, preferir correção para frente ou um revert seletivo revisado, mantendo validação/normalização e proteção de identidade. Não prometer que um revert completo será seguro para esses registros.
- Nenhum recurso da Render foi excluído, nem banco/backup/upload privado removido. Os bancos locais e snapshots sintéticos foram preservados para revisão; a conexão temporária não está no repositório.

## Próximo ponto de decisão

Revisar esta Fase 1 e os dois SQLs. Antes de disponibilizar no GitHub/celular ou no ambiente publicado, autorizar separadamente o envio/publicação e conferir o destino. As fases de login social e site institucional continuam fora deste trabalho. A existência e a restauração dos dados privados antigos do Mac continuam dependendo de conferência no Mac/backup acessível, sem confundir estas fixtures com recuperação de dados reais.
