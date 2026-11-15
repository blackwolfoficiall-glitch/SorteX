# SorteX Mobile — desenvolvimento isolado

Aplicativo React Native + Expo 58 + TypeScript. Não é WebView. O site aprovado e a API publicada não são modificados. Esta primeira base integra os contratos existentes; autenticação social e validação nativa em aparelho continuam pendentes.

## Executar

Requisitos: Node 24.3+ (ou versão suportada pelo SDK 58), npm, aparelho com Expo Go compatível ou toolchain nativa existente.

```sh
git switch feat/mobile-expo
cd apps/mobile
npm ci
npm run typecheck
npm test
npm start
```

Não precisa preencher `.env`: o destino padrão é exclusivamente a API isolada `sortex-fase1-review`. O aplicativo recusa o ambiente principal e hosts arbitrários. Não coloque `DATABASE_URL`, client secrets, chaves administrativas ou senhas em `EXPO_PUBLIC_*`. Variáveis públicas são incluídas no binário.

- iPhone: instalar Expo Go oficial compatível com SDK 58, autenticar uma conta Expo pelo aplicativo e por `npx expo login` no computador, se solicitado; ler o QR pelo iPhone. Usar a mesma rede. Isso executa os fluxos de e-mail; não habilita OAuth nativo. Não informar senha/token ao assistente.
- Simulador iOS: em Mac com Xcode e runtime já instalados, `npm start` e tecla `i` para Expo Go, ou `npm run ios` para development build. Este executor Linux não tem Xcode.
- Android: Expo Go e QR para teste inicial. Com Android Studio, SDK, Platform-Tools/adb, JDK compatível e licenças **já aceitas pelo proprietário**, `npm run android`. Não há aceite automático de licenças neste projeto.
- Development build: `npm run start:dev-client`. É necessário para integrações nativas e retorno OAuth confiável. Não assumir que Expo Go serve para todos os módulos.
- Web, apenas verificação auxiliar: `npm run web`. O serviço de teste pode rejeitar CORS de localhost; os testes Chromium registrados usaram proxy local de upstream fixo, sem modificar CORS ou autenticação do servidor. Sessão web somente em memória; SecureStore é usado em Android/iOS.

## APK e iOS

A geração local foi tentada: prebuild Android passou, execução parou em `Failed to resolve the Android SDK path` / `spawn adb ENOENT`. **Nenhum APK foi gerado.** Após instalar/configurar toolchain e aceitar pessoalmente os termos cabíveis, gerar development build com `npm run android`. Para APK de depuração independente do Metro:

```sh
npx expo prebuild --platform android --no-install
cd android
./gradlew assembleDebug
```

Um APK de debug normalmente requer Metro (`npm run start:dev-client`); não é distribuição final autônoma. Caminho: `android/app/build/outputs/apk/debug/app-debug.apk`. Para APK com JS empacotado de teste, usar o perfil `development` do EAS (development client, também com Metro), ou criar perfil de distribuição interna sem `developmentClient` após revisar assinatura e configuração. Não instalar como produção.

`eas.json` prepara somente development APK e simulador iOS; não há perfil de submissão. Não foi iniciado EAS Build, não há sessão Expo autenticada neste executor, e nenhum contrato foi aceito. EAS oferece modalidade Free com cotas/fila; confirmar os limites atuais na conta antes de solicitar build. Não há promessa de build ilimitado ou crédito disponível.

Simulador iOS não exige associação Apple paga, mas requer Mac/Xcode para execução local. Aparelho real com development build exige assinatura/provisionamento; Personal Team gratuito, quando suportado pelo Xcode e pelas capacidades utilizadas, possui limitações e expiração. Capacidades como Sign in with Apple podem exigir associação elegível já existente; não contratar dentro deste escopo. Não foram usados TestFlight, App Store ou Google Play.

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

O arquivo privado contém credenciais sintéticas e deve ficar fora de Git, chat, logs e screenshots. Não inclui credenciais de produção. Uma nova execução cria novas fixtures para não sobrescrever contas. O script verifica cadastro comprador/PF/PJ, perfis, contratos, slogan, restauração/refresh, revogação e erro de município. Não executa migrations, pagamentos, apurações ou envio real.

Ver estado detalhado, pendências e fontes em [`../../docs/SORTEX_MOBILE_DESENVOLVIMENTO.md`](../../docs/SORTEX_MOBILE_DESENVOLVIMENTO.md).
