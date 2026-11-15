# SorteX — primeira base mobile, 15/11/2026

## Auditoria e preservação

Repositório original: `blackwolfoficiall-glitch/SorteX`. Branch própria `feat/mobile-expo`, criada de `origin/infra/netlify-northflank-neon` no commit `f5993110bb27ed4125199d6b8c714cac69772c92`. Aplicação publicada conforme relatório anterior: `a6904fc0d5ecd3ada82bf35eb6f8982cc9f1f5eb`. Branch principal e worktrees anteriores preservados. O diretório não versionado `docs/review-assets/2026-11-15-publicacao/` do checkout anterior não foi movido, apagado ou incluído.

Foram lidos o relatório de publicação, os registros de cadastro/identidade, os guias sociais e a documentação comercial/CRM/IA. Não havia aplicativo mobile no repositório. Escolha: Expo 58.0.25, React Native 0.88.1, React 19.3, TypeScript, React Navigation, SecureStore. Versões conferidas na matriz oficial instalada do Expo e registry. Pacote em `apps/mobile`, contratos puros em `packages/contracts`; nenhum import de NestJS/Prisma no app. O backend NestJS/Prisma/PostgreSQL existente continua responsável por validação, autorização, unicidade e transações.

Não houve modificação de código/configuração do site, backend, workflows existentes, Netlify ou Neon principal. Foi adicionado somente workflow mobile restrito à branch própria. Não houve merge, deploy, migration, reset, cobranças, contratação ou publicação em lojas. Somente branch mobile autorizada. Sem novas migrations: contratos existentes atendem ao núcleo implementado.

## Isolamento

Único destino remoto aceito pelo app: `https://sortex-fase1-review.netlify.app/.netlify/functions/sortex-api`.

Banco exclusivamente de teste já existente: projeto Neon `rough-cherry-09901194`, branch `br-weathered-grass-bcisqlpm`, banco `sortex_preview`. Não utiliza o projeto principal `crimson-bread-73821703` nem seu banco `sortex`. Somente credenciais próprias de teste. O app não recebe conexão PostgreSQL, segredo JWT, chaves privadas ou credenciais administrativas.

Há opção explícita de proxy HTTP de desenvolvimento em porta 3338 em endereço privado/loopback, desativada por padrão. O teste local usa upstream fixo para a API isolada. Não é proxy público ou mecanismo de publicação. TLS/autorização do upstream permanecem ativos. Não é modo offline de operação financeira.

Dados: três contas novas sintéticas (BUYER, ORGANIZER PF, ORGANIZER PJ) com endereços IBGE coerentes; nomes `.invalid`, senhas aleatórias fora do Git. Para testar pedidos/títulos anteriores, foi ativada e recebeu senha aleatória **somente** a fixture `marketing-demo-v1-buyer-0`, conferindo ID, role e e-mail sintético dentro de transação no banco isolado. Nenhum comprador real foi ativado, documentos/IDs/vendas foram preservados. O organizador Aurora demonstrativo manteve R$48.750, 1.250 participantes, 3 campanhas ativas. Esses números são fictícios, não desempenho de clientes. Não houve processamento de pagamento ou sorteio. Dados antigos do Mac/Render continuam com o estado já documentado; esta tarefa não os restaurou.

## Escopo e contratos

| Solicitação | Implementação e limites |
|---|---|
| Abertura/restauração | Tela de espera, refresh rotativo, `/auth/me`, retry sem apagar sessão por indisponibilidade de rede. Armazenamento nativo SecureStore; web somente memória. |
| Login/logout | `/auth/login`, `/auth/logout`; fila de escrita, uma rotação simultânea, proteção contra resposta tardia após logout. ADMIN continua no site. Logout offline avisa que revogação remota não foi confirmada. |
| Recuperação | `/auth/forgot-password`, `/auth/reset-password`, token de uso único. Tela nativa pronta; entrega de e-mail está desativada na prévia. Link permitido: `sortex-dev://reset-password?token=TOKEN_SINTETICO_64_HEX`, sem aceitar origem arbitrária ou sessão em URL. |
| Cadastro | Três etapas com estado preservado e retorno. Comprador/organizador PF/PJ, representante/empresa condicionais, endereço completo, consents separados. Registro retorna usuário, seguido de login; não se presume que registro retorna tokens. |
| Documentos/localidades | Validadores puros iguais aos existentes, incluindo CNPJ alfanumérico e dígitos verificadores; backend permanece autoridade. Snapshot IBGE 2025, 27 UFs, pesquisa por nome/sigla e sem acentos; uso local se consulta indisponível. UF muda e limpa cidade/código. Validação conjunta preservada no backend. |
| Comprador | `/buyer/home`, `/buyer/campaigns`, `/public/campaigns/:slug`, `/purchases/my`, detalhe e títulos próprios. Consulta; compra/pagamento não fazem parte desta versão. Campanhas finalizadas podem não aceitar a rota pública de detalhe; erro/retry são exibidos, sem simular sucesso. |
| Resultados | Usa organizadores das campanhas dos pedidos e o contrato `/public/campaigns/organizers/:id/profile`; exibe somente apurações CONFIRMED e divulgações públicas autorizadas. Sem resultado inventado; foi criada fixture exclusiva com resultado confirmado sintético, número 000123 e ganhador sem autorização pública. A consulta positiva e a ocultação do nome passaram na interface; nenhuma apuração foi executada. |
| Organizador | `/dashboard`, `/campaigns/my`, detalhe de campanha, `/organizer/orders` com paginação e filtro, detalhe com participante. Contatos correspondem à página de pedidos, sem anunciar que a lista parcial é toda a base. API de detalhe não entrega todos os títulos ao organizador; ausência é informada. |
| Perfil | Nome/telefone, UF/cidade válidos, slogan opcional no organizador; preserva documentos e campos antigos ausentes. Mostra endereço cadastrado. Endereço completo do comprador é persistido no cadastro, mas sua edição exige ampliar endpoint de perfil; não foi inventado endpoint. Identidade/contas não são reclassificadas. |
| Estados e acessibilidade | Loading, erro de API/rede, retry, lista vazia, botões >=50dp, rótulos, seleção anunciada, áreas seguras, teclado iOS, rolagem e campos com autocomplete. Validação com VoiceOver/TalkBack e teclado nativo permanece pendente. |
| Ícone/permissões | Ícone provisório X roxo, paleta SorteX; favicon web existente não é arte vetorial apropriada para ícone nativo. Câmera, microfone, armazenamento externo e vibração bloqueados no config; sem notificações/contatos/localização. Permissões de ferramentas do development client devem ser conferidas no build final. |

## Google e Apple — não funcionais ainda

O backend contém fluxo OIDC web real (`auth/social`, validação JWT RS256/JWKS, issuer/audience/nonce/expiração, tentativas de uso único e conclusão transacional). Não vincula contas pela coincidência de e-mail. Provedores estão indisponíveis na prévia por configuração externa pendente. Redirecionamento web e cookies não equivalem a sessão mobile.

Preparados: scheme próprio `sortex-dev`, dependências AuthSession/WebBrowser/AppleAuthentication, adaptador Apple iOS com state/nonce (ainda não habilitado), contrato de broker nativo, validação estrita de desafio state/nonce/validade e parser de retorno de recuperação. **Não foi implementado o broker nativo no backend nem o fluxo completo Google/Apple no app.** Dependências instaladas não são prova de integração. Interface mostra indisponibilidade e mantém e-mail, sem botões decorativos operacionais. Não deve ser habilitado alterando apenas uma flag.

Trabalho técnico ainda necessário: adaptador nativo com challenge server-side e consumo atômico, audiências específicas por plataforma, SDK oficial Google para Android/iOS, Apple nativo no iOS e fluxo oficial web para Android, validação no servidor, retorno por código opaco de uso único, conclusão cadastral e vínculo explícito após reautenticação. Nenhum access/refresh/id token deve viajar em deep link. Reutilizar a política de identidade existente, incluindo Apple private relay e `sub`; não unir contas por e-mail. Testes negativos/replay/cancelamento e desenvolvimento com build nativo são obrigatórios antes de anunciar funcionamento.

Configuração externa posterior (somente sandbox):

1. Google Cloud Console → APIs & Services → OAuth consent screen e Credentials. Criar clientes próprios de teste para pacote Android `br.com.sortex.development` + SHA da assinatura de teste e bundle iOS `br.com.sortex.development`. IDs de cliente podem ser públicos; client secret, se necessário ao broker confidencial, somente no serviço de teste. Não reutilizar credenciais do ambiente principal.
2. Apple Developer → Certificates, Identifiers & Profiles, verificar associação elegível **já existente** e capacidade Sign in with Apple do identificador de teste. Não aderir a plano pago, aceitar contrato ou contratar. Na ausência de associação elegível, manter Apple explicitamente bloqueado no orçamento R$0. Chaves privadas jamais entram no app, chat ou Git.
3. Só depois da implementação/revisão do broker, cadastrar retornos HTTPS/scheme exatos; não cadastrar URLs presumidas deste documento como endpoints funcionais. Publicação em teste da adaptação de backend deve ocorrer separadamente, sem alterar o principal.

## Continuidade dos demais módulos

- **CRM:** contratos existentes em `services/api/src/crm/crm.controller.ts`: dashboard, contatos, tags, notas, segmentos, tarefas e reservas abandonadas. Pode integrar leitura e gestão em etapa futura, respeitando plano/permissões. Envios reais e automações continuam bloqueados; nenhuma tela vazia foi criada.
- **IA SorteX:** `services/api/src/growth/ai-advisor.service.ts`; snapshot, alertas, perguntas sobre indicadores, simulações aritméticas e rascunhos determinísticos em sandbox. Leitura/interação podem receber cliente mobile. Modelo externo depende de configuração/custo e não foi habilitado; não anunciar IA externa ativa.
- **Afiliados, financeiro, relatórios, personalização, regras/Loteria Federal:** backend existente deve ser auditado por fluxo antes de expor ações nativas. Não há execução de sorteio, envio, saque, cobrança ou comissão neste app. Resultados oficiais e regra escolhida pelo organizador continuam conceitos distintos.
- **Planos:** não ativar assinaturas pelo app nem inventar preços. A pendência comercial anterior permanece registrada nos relatórios da home.

## Verificações e limitações de distribuição

Ver registro final abaixo. Testes de Node e chamadas reais à API são distintos de renderização RN Web/Chromium e de execução nativa. Linux tem Node24/Java21; não tem Android SDK/adb ou Xcode. Prebuild Android passou; `expo run:android --no-install --no-bundler` falhou por SDK ausente/`spawn adb ENOENT`. O build local não gerou APK; a compilação remota posterior gerou os pacotes descritos na entrega final. Conta Expo não está autenticada (estado local contém só UUID); não se iniciou EAS, não foram aceitos contratos ou habilitadas cobranças. Android/iPhone físicos, escrita/restauração de sessão autenticada no dispositivo, retorno por scheme, VoiceOver/TalkBack e Safari **não validados**. A abertura nativa no simulador iOS foi validada posteriormente, conforme entrega final.

Execução e comandos: [`../apps/mobile/README.md`](../apps/mobile/README.md). A etapa nativa depende de toolchain já licenciada do proprietário, ou conta Expo gratuita autenticada com cotas verificadas antes de build. Usar Expo Go compatível para núcleo de e-mail; desenvolvimento OAuth exige development build. Apple signing para aparelho real tem requisitos distintos do simulador; não prometer instalação iPhone sem assinatura.

## Fontes oficiais consultadas

- https://docs.expo.dev/guides/authentication/ — fluxos OAuth, development builds/retornos.
- https://docs.expo.dev/guides/using-authentication/ — SDKs de provedores e limitações.
- https://docs.expo.dev/versions/latest/sdk/securestore/ — armazenamento nativo e limitações de Expo Go.
- https://docs.expo.dev/build/setup/ — EAS conta e modalidades; quotas devem ser verificadas na conta.
- https://docs.expo.dev/build-reference/apk/ — Android APK e development client.
- https://docs.expo.dev/build-reference/simulators/ — iOS simulator versus assinatura de aparelho.
- https://developer.apple.com/help/account/basics/about-your-developer-account — Personal Team e associação Apple.
- https://expo.dev/changelog/expo-go-57-login — autenticação Expo Go; conferir aplicativo compatível com SDK58.
- Snapshot IBGE e hash estão em `apps/mobile/assets/municipalities.json`, cópia do catálogo já versionado do servidor.

## Reversão

Sem migration ou deploy a reverter. Abandonar a branch restaura o estado publicado; não remover worktrees/backups. Reverter commits mobile com novo commit se necessário, sem reset/force push. Fixtures são exclusivamente de teste e foram mantidas para continuidade; não há script de exclusão automática. Em aparelho, logout revoga sessão quando há conexão e remove armazenamento local. Nunca apontar esse build para o banco principal para aproveitar dados.

## Registro inicial de testes

- 16 testes automatizados passaram: isolamento de destino; CPF/CNPJ numérico/alfanumérico; catálogo; payload condicional; refresh concorrente; restauração offline; token revogado; resposta tardia após logout; bloqueio ADMIN; link de recuperação; validade do challenge; falha de armazenamento; paridade de validações/catálogo com o servidor; requisição anterior não usa nova sessão; falha tardia de logout não encerra nova conta; perfil antigo não substitui usuário novo.
- TypeScript passou; `expo install --check`: dependências compatíveis; bundles Android/iOS/web gerados.
- API isolada: cadastro dos três perfis sintéticos, leitura e edição de perfil, slogan, rotação/restauração/revogação, município inválido; comprador sintético legado com campanhas/detalhe/pedido/títulos, dashboard demonstrativo consistente e pedidos/participantes; bloqueio de pedido de outra conta.
- Recuperação: token sintético somente para fixture de teste; reset real passou, segundo uso foi rejeitado e refresh anterior foi revogado. Envio/recebimento de e-mail não testado (desativado).
- RN Web + Chromium, viewports 390×844 e 412×915: seleção PF/PJ, validação inicial, login real, navegação comprador, pedido/títulos, dashboard, perfil/slogan e logout passaram. Evidências em `docs/mobile-evidence/2026-11-15/`. São capturas de RN Web, **não aparelhos nativos**. Não substituem Safari, simulador ou aparelho físico.
- Teste visual encontrou chamada de fetch incompatível com navegador; corrigida e fluxo repetido com sucesso. Testes unitários e TypeScript passaram após os ajustes de armazenamento/navegação.

## Compilação remota sem EAS

Repositório confirmado público pela integração GitHub. Fontes oficiais sobre runners padrão gratuitos: https://docs.github.com/en/actions/reference/runners/github-hosted-runners e https://docs.github.com/en/billing/concepts/product-billing/github-actions . Workflow `mobile-test-build.yml` usa somente `ubuntu-latest` e `macos-latest`, trava para branch `feat/mobile-expo` e repositório público, sem secrets, caches, deploy ou aceites de licença. Android tenta APK com **assinatura de desenvolvimento**, arquitetura arm64, JS empacotado e destino fixo da prévia. Não é release de loja nem assinatura de produção. Segundo job tenta build/abertura em simulador iOS sem cadastro Apple. Artefatos têm retenção de 1 dia e APK limitado a 150MB; consulta inicial encontrou aproximadamente 27MB de artefatos no repositório, abaixo da franquia mínima Free de 500MB compartilhada. Não se alterou orçamento/faturamento/plano. Execução ainda precisa ser acompanhada: workflow não comprova APK compilado ou simulador aberto.

### Validações adicionais

Cadastro PJ completo em RN Web/Chromium passou com consultas de localidades bloqueadas: catálogo local, pesquisa, retorno entre etapas, persistência de endereço, login automático e perfil. Automação precisou aguardar o fechamento do modal e selecionar o campo da tela ativa; depois os dados foram preservados. Uma quarta conta sintética exclusiva foi criada por esse fluxo.

Foi inserida em transação uma campanha própria `DEMO · Resultado sintético mobile`, com pedido/título e registro de resultado confirmado **fictícios**, para o comprador/organizador PF criados nesta tarefa. `drawBasis=MANUAL_RESULT`, snapshots identificados como fixture e ganhador sem autorização de divulgação. Nenhum endpoint de execução de sorteio/pagamento, aprovação de conta, envio, prêmio ou integração foi chamado. Consulta positiva no app exibiu 000123 e omitiu o nome do ganhador, como esperado. Campanhas e indicadores da demonstração Aurora não foram modificados.

A revisão de sessão adicionou trava de geração da sessão para impedir retry de uma requisição antiga sob outra conta, atualização tardia de perfil e mensagem tardia de logout. Foram removidas consultas duplicadas desnecessárias do perfil do comprador. TypeScript e 16 testes passaram. O APK anterior compilou no runner padrão; o artefato de entrega deve ser regenerado no commit que contém essas correções e conferido ao final. O manifesto do APK final será inspecionado para confirmar ausência das permissões bloqueadas.

### Capacidades do build inicial e publicação pela integração

O pacote Apple adicionava automaticamente `com.apple.developer.applesignin`, embora a integração estivesse pendente. Isso fez o Expo solicitar assinatura elegível mesmo no simulador. O build inicial de e-mail passou a excluir `expo-apple-authentication` do autolinking iOS e declarar `usesAppleSignIn=false`; o adaptador de preparação continua no código. A habilitação futura requer incluir o módulo, configurar a capacidade legitimamente e concluir o broker seguro, não apenas expor um botão. Nenhuma verificação de assinatura/JWT/CSRF foi desativada. Prebuild iOS novo gerou entitlements vazios; a conferência passou. Resolução real de módulos confirmou SecureStore presente e Apple não configurado ausente; 16 testes/TypeScript passaram.

A credencial temporária do terminal expirou. A integração GitHub já conectada publicou as mesmas árvores, com atualização não forçada e verificação do head esperado. Os commits locais originais foram mantidos nas branches locais `local/mobile-cache-22e12d3` e `local/mobile-apple-gating-d5d6519`; os respectivos commits publicados registram a origem. Nenhuma credencial nova foi solicitada ou acesso ampliado.

## Entrega final verificável

Código dos dois pacotes: `f4386949348aa42cce19f5ed4247804e55ad06b7`, branch `feat/mobile-expo`. Execução [43704153974](https://github.com/blackwolfoficiall-glitch/SorteX/actions/runs/43704153974): **Android e iOS simulator concluídos com sucesso**. Não houve publicação em loja, merge ou deploy no ambiente principal. O checkout anterior e seus arquivos não commitados continuam preservados; arquivos locais não versionados do Mac não estavam acessíveis neste executor e não foram alterados.

| Plataforma | Artefato | Resultado |
|---|---|---|
| Android | [APK em ZIP](https://github.com/blackwolfoficiall-glitch/SorteX/actions/runs/43704153974/artifacts/14157517257) | Release com assinatura de desenvolvimento verificada por `apksigner`; arm64; Android mínimo API24 (7.0), target API36. JS incluído, sem depender de Metro para abrir. |
| iOS | [Pacote de simulador e captura](https://github.com/blackwolfoficiall-glitch/SorteX/actions/runs/43704153974/artifacts/14158646604) | Release instalado e aberto no simulador, com captura nativa inspecionada. App universal x86_64/arm64 para simuladores Intel/Apple Silicon; iOS mínimo 16.4. Não é pacote de instalação em iPhone físico. |

APK: 26.732.743 bytes; SHA256 `6ca183b1fbf7dfe97952b3149a7b28a4106354b369da8d414dac09336b74cb05`. Assinatura de teste, certificado SHA1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`; identificador `br.com.sortex.development`. Esse certificado é de desenvolvimento, não uma chave de publicação em loja.

ZIP interno do app iOS: SHA256 `50d0c15ecc5200163da8df864ba11567c65eda24d762c4ff5fbe57a0b766578d`. Os ZIPs foram baixados, conferidos por CRC e inspecionados. O APK local confere com o SHA256 emitido pelo job. Arquivos locais, fora do Git: `apps/mobile/artifacts/SorteX-test-f438694.apk` e `apps/mobile/artifacts/SorteX-ios-simulator-f438694.app.zip`.

O APK final não declara câmera, microfone, arquivos externos, sobreposição, vibração ou biometria. `android.permission.INTERNET` é a permissão de sistema de acesso ao dispositivo restante; há declarações internas das dependências (`DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` e `BIND_GET_INSTALL_REFERRER_SERVICE`). O aplicativo não usa atribuição de instalação nem biometria. A descrição de Face ID também foi removida do Info.plist e conferida no pacote final. SecureStore e sua criptografia continuam presentes; `requireAuthentication` não é usado. Nenhuma verificação de assinatura ou autenticação foi desativada.

Os artefatos do GitHub têm retenção de **1 dia**: Android até 16/11/2026 10:35 UTC, iOS até 16/11/2026 10:55 UTC. Baixar e guardar localmente. Para regenerar o mesmo commit após expiração, usar a execução acima → **Re-run jobs**; isso usa novamente os runners padrão do repositório público. Não habilitar runners maiores, cobranças ou serviços adicionais.

### Executar e testar

Um clone separado preserva o projeto anterior:

```sh
git clone --branch feat/mobile-expo https://github.com/blackwolfoficiall-glitch/SorteX.git SorteX-mobile
cd SorteX-mobile/apps/mobile
npm ci
npm run typecheck
npm test
npm start
```

**Android:** extrair o ZIP, abrir `app-release.apk` no gerenciador de arquivos e seguir a autorização de instalação do Android. Entrar somente com conta sintética do banco de testes. Pode funcionar sem manter o Mac ligado, porque o JavaScript está no APK e a API é remota; precisa de internet para os dados. Instalação/uso em Android físico ainda não executados neste trabalho.

**Simulador iOS:** extrair o ZIP externo e depois `sortex-ios-simulator.zip`. Com Xcode/runtime já disponíveis, abrir o aplicativo Simulator e iniciar um iPhone com iOS>=16.4. No Mac:

```sh
xcrun simctl install booted /caminho/SorteXTeste.app
xcrun simctl launch booted br.com.sortex.development
```

**iPhone real:** instalar Expo Go compatível com SDK58; autenticar a mesma conta Expo gratuita no Expo Go e no computador que executa Metro (`npx expo login`, fluxo oficial no navegador). Executar `npm start` e ler o QR. Este caminho mantém o computador/ambiente de desenvolvimento ativo. O login no navegador da CLI retorna para localhost do computador que iniciou o comando; não há transferência automática de sessão do Mac para o celular ou para este executor. Um build próprio para aparelho requer assinatura/provisionamento elegíveis; isso não foi configurado nem contratado. Google/Apple exigem development build e conclusão dos fluxos/configurações, conforme pendências acima.

Para criar credenciais sintéticas sem colocá-las no chat, usar `npm run test:api` com o opt-in e um caminho privado **novo** em `/tmp`, conforme README. Ler o arquivo somente no próprio computador. Não reutilizar ou sobrescrever um arquivo de credenciais anterior; não usar contas/senhas/documentos reais.

### Matriz real de validação

| Verificação | Estado |
|---|---|
| TypeScript e 16 testes automatizados | Passaram localmente e no job Android. |
| Build Android, integridade e assinatura | Passaram; permissões conferidas no APK final. |
| Build iOS, instalação/abertura no simulador | Passaram; imagem nativa do login e Info.plist do pacote final conferidos. Restauração inicial sem sessão carregou a tela correta. |
| Cadastro comprador/PF/PJ, perfis, slogan e sessão contra API real | Passaram no cliente de integração com banco isolado e dados sintéticos. |
| Cadastro PJ completo, localidades indisponíveis, retorno entre etapas e endereço persistido | Passaram na interface RN Web/Chromium com a API real de teste. |
| Login, navegação, pedidos/títulos e perfil | Passaram em RN Web/Chromium; compradores/organizador sintéticos anteriores consultados. |
| Resultado confirmado e privacidade do ganhador | Passaram em RN Web/Chromium com fixture própria; nenhuma apuração real executada. |
| Recuperação | API com token sintético de uso único, replay rejeitado e sessão anterior revogada; entrega de e-mail está desativada. |
| Fluxos autenticados completos no simulador nativo e armazenamento após login | Ainda pendentes de teste nativo interativo; não confundir com os testes de Node/RN Web. |
| iPhone/Android físicos, VoiceOver/TalkBack e Safari real | Pendentes. Nenhuma validação física declarada. |
| Google/Apple | Preparação parcial; broker/adaptadores, credenciais e habilitação externa pendentes. Não funcionais. |
| Endereço completo do comprador após cadastro | Cadastro/persistência disponíveis; edição posterior depende de extensão do contrato de perfil. |
| CRM/IA, financeiro, afiliados, uploads e demais ações nativas | Mantidos no plano acima; nenhuma tela vazia foi apresentada como módulo concluído. |

### Continuidade

A primeira versão é executável e revisável; não é uma declaração de conclusão de todos os módulos. Priorizar teste físico do núcleo com dados sintéticos, concluir o broker social com as configurações legítimas e ampliar o perfil somente com contrato de API auditado. Não conectar este build ao banco principal ou habilitar cobranças/mensagens reais. Código/estilo do site aprovado permanecem intactos.

Em nova sessão: selecionar o repositório original e `feat/mobile-expo`, ler este documento e `apps/mobile/README.md`, verificar Git status/HEAD antes de comandos, preservar alterações locais, usar apenas a API e o Neon isolados aqui identificados. Não reconstruir, resetar, fazer merge/deploy principal, publicar em lojas ou contratar recursos pagos. Considerar Google/Apple e as validações físicas pendentes até evidências novas.
