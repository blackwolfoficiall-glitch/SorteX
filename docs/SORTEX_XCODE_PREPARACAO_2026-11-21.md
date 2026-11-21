# SorteX — preparação para iPhone físico, 21/11/2026

Branch de trabalho: `feat/mobile-expo`. Base desta revisão: `7fcf436fc1858a16e061fb77518064c9678b9559`. Projeto existente em `apps/mobile`, Expo SDK 58, React Native 0.88.1 e React 19.3.0. Não foi criado outro aplicativo, alterado seu identificador ou reconstruída a plataforma.

## Acesso e preservação

O executor acessível é Linux, em `/workspace/SorteX-mobile`, sem Xcode/CocoaPods. Não há ferramenta de acesso remoto ao Mac. A instalação Xcode 27.3 beta 2 foi informada pelo proprietário, mas a seleção das ferramentas, Node, CocoaPods, assinatura e instalação física no Mac ainda não foram verificadas. Não declarar o workspace aberto no Mac ou os Pods instalados a partir de testes Linux.

O checkout mobile estava limpo. O checkout web anterior e seus arquivos não commitados foram preservados. O diretório `apps/mobile/ios` existente no executor é ignorado pelo Git; não será enviado como se fosse um projeto nativo já preparado para o Mac. O iniciador preserva uma pasta iOS existente e só gera o projeto nativo quando ela não existe, a partir do código mobile já desenvolvido. Não usa `--clean`.

## Compatibilidade e ajustes

- A documentação do SDK 58 informa Xcode mínimo 26.4, iOS mínimo 16.4 e Node 22.13+ na linha 22, 24.3+ na linha 24 ou 26+; linhas ímpares não são suportadas. Xcode 27.3 beta 2 atende ao mínimo de versão, mas a compilação nessa beta precisa ser testada. Não houve troca de Xcode nem aceite de licença.
- A verificação atual encontrou quatro versões recomendadas mais recentes. Foram alinhados `expo ~58.0.26`, `expo-auth-session ~58.0.19`, `expo-web-browser ~58.1.0` e `expo-dev-client ~58.0.21`, com atualização do lockfile. React/React Native permanecem iguais.
- O instalador Expo solicitou registrar `expo-web-browser` no config dinâmico. O plugin foi inspecionado e incluído sem opções experimentais: seu comportamento padrão não adiciona a atividade Android experimental nem habilita autenticação social. O erro inicial do instalador por não editar automaticamente `app.config.ts` foi resolvido explicitamente.
- O iniciador `.github/mobile/iphone.mjs` agora aceita as linhas oficiais de Node, verifica `xcode-select`, mostra o `xcodebuild` efetivamente resolvido por `xcrun` e confere a versão mínima antes de executar etapas nativas. Se o diretório selecionado for apenas Command Line Tools, orienta selecionar o Xcode completo em Settings → Locations.
- O modo `xcode` verifica a configuração inicial sem aceitar termos, exige CocoaPods disponível e executa `pod install` mesmo se houver workspace antigo, necessário após atualizar dependências. Não usa `pod update`. Abre exclusivamente `apps/mobile/ios/SorteXTeste.xcworkspace`, em vez de escolher um workspace arbitrário ou o `.xcodeproj`.
- Identificador preservado: `br.com.sortex.development`; esquema `sortex-dev`. Sign in with Apple e sua capacidade não configurada continuam desativados. SecureStore permanece incluído, sem exigir Face ID.

## Ambiente permitido

Somente a API isolada `https://sortex-fase1-review.netlify.app/.netlify/functions/sortex-api` e seus dados sintéticos. O iniciador recusa outra API e o cliente mantém a allowlist. Nenhum segredo de servidor ou conexão PostgreSQL foi incluído no aplicativo. Não foram executados migrations, pagamentos, mensagens, apurações ou alterações no ambiente principal.

## Testes desta revisão

- Antes e depois do ajuste: TypeScript e os 16 testes automatizados passaram.
- Depois: `expo install --check` passou, assim como o endpoint `/health` da API isolada por HTTPS.
- Exportação JS/Hermes iOS e Android passou. Isso não é um binário para aparelho nem comprova compilação no Xcode beta.
- Capacidades do projeto iOS existente passaram na verificação local. A geração nativa atualizada também passou em cópia temporária isolada, sem substituir a pasta iOS existente; SecureStore permaneceu incluído e não foram adicionadas capacidades sociais não configuradas ou Face ID.
- `pod install`, build/assinatura no Mac, instalação no aparelho e restauração real de Keychain permanecem pendentes de execução no Mac/iPhone do proprietário.

## Próxima etapa no Mac

Primeiro, verificar as ferramentas e localizar o checkout sem modificar arquivos:

```sh
xcode-select -p
xcrun --find xcodebuild
xcodebuild -version
node --version
pod --version
git -C /Users/valbert/Projetos/SorteX status --short --branch
```

Se necessário, Xcode → Settings → Locations → Command Line Tools → Xcode 27.3 beta 2. A versão aberta na interface não prova qual Xcode o Terminal usa; `DEVELOPER_DIR` também pode alterar a resolução. Não executar `sudo xcode-select` nem instalar ferramentas antes de analisar o resultado. Senha do Mac e autenticação Apple ficam com o proprietário.

Após conferir o checkout correto e as ferramentas, instalar as dependências bloqueadas pelo lockfile com `npm ci` em `apps/mobile` num clone/worktree de teste, preservando o checkout original e suas alterações. Não trocar branch, sobrescrever um diretório existente ou fazer pull em checkout sujo automaticamente. Se CocoaPods estiver ausente, escolher a instalação após verificar Ruby/Homebrew do Mac; não sugerir `sudo gem install` sem esse diagnóstico.

Na raiz do checkout da branch mobile com dependências disponíveis:

```sh
node .github/mobile/iphone.mjs xcode
```

O guia detalhado de cabo, confiança no computador, modo de desenvolvedor, Personal Team gratuito, limite de sete dias e servidor Metro está em [`SORTEX_TESTE_IPHONE_FISICO.md`](SORTEX_TESTE_IPHONE_FISICO.md). A etapa de assinatura vem depois da abertura do workspace; não escolher simulador, Archive, App Store ou TestFlight. Nenhuma conta paga, cobrança, inscrição ou contrato foi habilitado.

Google, Apple e recuperação de senha completa continuam pendentes até funcionarem de ponta a ponta. O ajuste de dependências não conclui essas integrações.

## Fontes oficiais

- [Referência SDK 58: versões e mínimos](https://docs.expo.dev/versions/v58.0.0/).
- [SDK 58: Node e Xcode 27](https://expo.dev/changelog/sdk-58).
- [Apple: requisitos do Xcode](https://developer.apple.com/xcode/system-requirements/).
- [Apple: conta e Personal Team](https://developer.apple.com/help/account/basics/about-your-developer-account).
