# SorteX Mobile — desenvolvimento isolado

**iPhone físico:** siga [o roteiro da candidata QA](../../docs/SORTEX_TESTE_IPHONE_FISICO.md). Em um clone limpo de `homologacao/web-ios-integrada`, `node .github/mobile/iphone.mjs prepare-release` prepara o workspace no Mac; `release --device IDENTIFIER_DO_IPHONE` compila e instala com Personal Team após confirmar que a API QA está pronta. Não depende de Metro após a instalação. O artefato de simulador não serve no iPhone físico.

Builds Android e iOS simulator disponíveis no commit `f4386949348aa42cce19f5ed4247804e55ad06b7`: [APK Android](https://github.com/blackwolfoficiall-glitch/SorteX/actions/runs/43704153974/artifacts/14157517257) · [Pacote iOS para simulador](https://github.com/blackwolfoficiall-glitch/SorteX/actions/runs/43704153974/artifacts/14158646604). Retenção de 1 dia; relatório completo e resultados no documento de continuidade ao final.

Aplicativo React Native + Expo 58 + TypeScript. Não é WebView. O site aprovado e a API publicada não são modificados. Esta primeira base integra os contratos existentes; autenticação social e validação nativa em aparelho continuam pendentes.

## Executar

Requisitos: Node 24.3+ (ou versão suportada pelo SDK 58), npm, aparelho com Expo Go compatível ou toolchain nativa existente.

```sh
git clone --branch feat/mobile-expo https://github.com/blackwolfoficiall-glitch/SorteX.git SorteX-mobile
cd SorteX-mobile/apps/mobile
npm ci
npm run typecheck
npm test
npm start
```

O clone cria uma pasta separada e preserva o checkout anterior. Não precisa preencher `.env`: o destino padrão é exclusivamente a API isolada `sortex-fase1-review`. O aplicativo recusa o ambiente principal e hosts arbitrários. Não coloque `DATABASE_URL`, client secrets, chaves administrativas ou senhas em `EXPO_PUBLIC_*`. Variáveis públicas são incluídas no binário.

- iPhone: priorize a Release QA no clone separado. Expo Go com SDK compatível continua opção de prévia de desenvolvimento com Metro, mas não comprova identidade nativa, abertura independente ou integração Web + iOS.
- Simulador iOS: em Mac com Xcode e runtime já instalados, `npm start` e tecla `i` para Expo Go, ou `npm run ios -- --device "NOME_DO_SIMULADOR"` para development build. Liste os nomes com `xcrun simctl list devices available`; selecione explicitamente um simulador. Este executor Linux não tem Xcode.
- Android: Expo Go e QR para teste inicial. Com Android Studio, SDK, Platform-Tools/adb, JDK compatível e licenças **já aceitas pelo proprietário**, `npm run android`. Não há aceite automático de licenças neste projeto.
- Development build: `npm run start:dev-client`. É necessário para integrações nativas e retorno OAuth confiável. Não assumir que Expo Go serve para todos os módulos.
- Web, apenas verificação auxiliar: `npm run web`. O serviço de teste pode rejeitar CORS de localhost; os testes Chromium registrados usaram proxy local de upstream fixo, sem modificar CORS ou autenticação do servidor. Sessão web somente em memória; SecureStore é usado em Android/iOS.

## APK e iOS

O APK de entrega é um build Release **assinado com chave de desenvolvimento**, com JavaScript empacotado e API fixa da prévia. Não depende de Metro para abrir; precisa de internet para consultar a API. É destinado a Android arm64 e não é versão de loja. Baixe o ZIP do artefato, extraia o APK e abra pelo gerenciador de arquivos do aparelho. Autorize essa instalação quando o Android solicitar. Não use credenciais ou documentos reais neste banco.

A geração local foi tentada: prebuild Android passou, execução parou em `Failed to resolve the Android SDK path` / `spawn adb ENOENT`. O build remoto posterior no GitHub Actions gerou APK; consulte o commit e os links de entrega no relatório abaixo. Após instalar/configurar toolchain e aceitar pessoalmente os termos cabíveis, gerar development build com `npm run android`. Para APK de depuração independente do Metro:

```sh
npx expo prebuild --platform android --no-install
cd android
./gradlew assembleDebug
```

Um APK de debug normalmente requer Metro (`npm run start:dev-client`); não é distribuição final autônoma. Caminho: `android/app/build/outputs/apk/debug/app-debug.apk`. Para APK com JS empacotado de teste, usar o perfil `development` do EAS (development client, também com Metro), ou criar perfil de distribuição interna sem `developmentClient` após revisar assinatura e configuração. Não instalar como produção.

`eas.json` prepara somente development APK e simulador iOS; não há perfil de submissão. Não foi iniciado EAS Build, não há sessão Expo autenticada neste executor, e nenhum contrato foi aceito. EAS oferece modalidade Free com cotas/fila; confirmar os limites atuais na conta antes de solicitar build. Não há promessa de build ilimitado ou crédito disponível.

Simulador iOS não exige associação Apple paga, mas requer Mac/Xcode para execução local. Aparelho real com development build exige assinatura/provisionamento; Personal Team gratuito, quando suportado pelo Xcode e pelas capacidades utilizadas, possui limitações e expiração. Capacidades como Sign in with Apple podem exigir associação elegível já existente; não contratar dentro deste escopo. Não foram usados TestFlight, App Store ou Google Play. O workflow compilou e abriu o simulador iOS em runner macOS padrão; isso não comprova autenticação nativa nem execução em iPhone físico. O resultado efetivo e o pacote de simulador, quando disponível, são registrados no relatório.

## Testes reproduzíveis

```sh
npm run typecheck
npm test
npm run export:test
```

Integração real com opt-in explícito (cria três contas **sintéticas** no banco isolado, não apaga fixtures):

```sh
SORTEX_TEST_WRITES=isolated-synthetic-only \
SORTEX_TEST_CREDENTIAL_FILE=/tmp/sortex-mobile-fixtures-private.json \
npm run test:api
```

Escolha um caminho privado novo a cada execução para preservar os arquivos anteriores. O arquivo privado contém credenciais sintéticas e deve ficar fora de Git, chat, logs e screenshots. Não inclui credenciais de produção. Uma nova execução cria novas fixtures para não sobrescrever contas. O script verifica cadastro comprador/PF/PJ, perfis, contratos, slogan, restauração/refresh, revogação e erro de município. Não executa migrations, pagamentos, apurações ou envio real.

Ver estado detalhado, pendências e fontes em [`../../docs/SORTEX_MOBILE_DESENVOLVIMENTO.md`](../../docs/SORTEX_MOBILE_DESENVOLVIMENTO.md).

## Estado das integrações sociais

O build inicial usa e-mail e senha. Google/Apple ainda exigem implementação do broker nativo e configuração externa; não são login funcional. O autolinking iOS exclui o módulo Apple não configurado para não solicitar uma capacidade dependente de assinatura elegível. SecureStore permanece incluído. Para habilitar Apple no futuro, concluir o fluxo, a configuração legítima e seus testes antes de incluir a capacidade. Não habilitar apenas mudando uma flag.

### Capa de rascunho no app nativo

Como organizador, salve o rascunho, abra os detalhes e toque em **Editar rascunho → Adicionar capa** (ou **Substituir capa**). O seletor do sistema usa um JPG, PNG ou WEBP de até 20 MB guardado em Arquivos. A confirmação aparece só após o servidor registrar e devolver a nova revisão. O app não muda capas de campanhas já publicadas ou pausadas; o envio não publica a campanha.

Este caminho requer a API candidata com a verificação de revisão de capa e um novo development build com `expo-document-picker` 58.0.5. O navegador auxiliar não abre o seletor nativo.

### Cotas premiadas de rascunho

Em **Campanhas → Detalhes → Gerenciar cotas premiadas**, o organizador pode incluir uma cota exata com os zeros à esquerda, editar nome, tipo e valor do prêmio e remover uma cota sem reserva ou resultado. O app usa o mesmo cadastro consultado no painel web. As ações não valem para campanhas já publicadas e não apuram nem pagam prêmios. Metas, roleta e geração em lote não fazem parte deste fluxo.
