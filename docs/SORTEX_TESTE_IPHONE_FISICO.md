# SorteX — teste em iPhone físico

Verificação em 15/11/2026, branch `feat/mobile-expo`. Complementa, sem substituir, `SORTEX_MOBILE_DESENVOLVIMENTO.md`. Site, banco principal e configurações de publicação não foram alterados.

## O que executar

| Opção | Serve no iPhone físico? | Requisitos e limites |
| --- | --- | --- |
| Expo Go oficial, SDK 58 | Sim, para os fluxos atuais por e-mail | Conta Expo igual no CLI e no telefone; Metro disponível. Não instala um aplicativo independente. |
| `.app` do artefato iOS anterior | Não | Compilado exclusivamente para simulador; não é um IPA para aparelho. |
| Development build via Xcode | Sim, após assinatura legítima | Mac, Xcode compatível, iPhone, Apple Account/Personal Team e provisionamento. Debug utiliza Metro. |

Não foi gerado IPA para aparelho nesta etapa. Não há publicação nas lojas/TestFlight, EAS Build, contratação ou cartão.

## Caminho recomendado sem chave: Expo Go no Mac + iPhone

No **Terminal do Mac**, crie um clone separado. Se `SorteX-iphone` já existir, escolha outro nome; não sobrescreva seu projeto anterior.

```sh
git clone --branch feat/mobile-expo https://github.com/blackwolfoficiall-glitch/SorteX.git SorteX-iphone
cd SorteX-iphone/apps/mobile
npm ci
cd ../..
node .github/mobile/iphone.mjs check
node .github/mobile/iphone.mjs go
```

Requer Node 24.3+ compatível com SDK 58. O iniciador verifica a branch, o commit, versões Expo e saúde HTTPS da API isolada. Preserva alterações locais. Não altera Git, banco nem infraestrutura; o CLI pode criar seus caches ignorados. Caso uma consulta falhe, apresenta o erro sem mostrar credenciais ou conteúdo HTTP privado.

1. Instale **Expo Go**, publicado por Expo, pela App Store do iPhone. Use a versão compatível com SDK 58. O mínimo do aplicativo nativo gerado é iOS 16.4; confira também os requisitos da versão do Expo Go disponível na loja. Se ela não suportar SDK 58, não ignore o aviso: use o caminho Xcode abaixo.
2. O iniciador abre o login oficial do Expo no navegador **do Mac**, se necessário. Autentique-se diretamente ali. Não envie senha, código ou token ao chat. O callback local do navegador é necessário; abrir esse login apenas no iPhone não autentica o CLI remoto.
3. No Expo Go, toque no ícone da conta e entre com **a mesma conta Expo**. Não é uma conta SorteX nem uma conta Apple Developer.
4. Mantenha o terminal aberto até aparecer o QR. Leia com a **Câmera do iPhone** e toque em abrir no Expo Go. O terminal também mostra o endereço `exp://…`; para repetir o acesso use o projeto recente no Expo Go. Um QR visto no próprio iPhone precisa ser aberto pelo link correspondente ou exibido em outro aparelho.
5. O padrão usa `--tunnel`: Mac e iPhone precisam de internet, mas podem estar em redes diferentes. O túnel é temporário, pode ser mais lento e depende da disponibilidade do serviço Expo. Não é hospedagem permanente. Não habilite nenhum serviço pago se houver uma solicitação comercial.
6. Se o túnel não estiver disponível, ambos na mesma rede Wi-Fi: encerre com Ctrl+C e execute `node .github/mobile/iphone.mjs go --lan`. Autorize acesso à rede local no macOS/iOS se solicitado. Não desative firewall nem validação TLS; uma rede corporativa com isolamento entre clientes pode impedir LAN.
7. O Mac precisa permanecer ligado, conectado e sem suspensão, com Metro aberto. Ctrl+C, suspensão ou mudança de rede pode invalidar o QR. Gere outro iniciando novamente. A API de testes é remota e independente de Metro.

O Expo Go/CLI é o caminho gratuito de desenvolvimento; não usa cotas de compilação EAS. Não foi contratado armazenamento, build, plano ou túnel pago. No executor desta conversa a tentativa real `expo start --go --tunnel --port 8082` terminou em `Couldn't create a signed tunnel URL … You're not logged in to your Expo account`. Não há sessão Expo autenticada nem ferramentas de navegador/transferência de controle disponíveis aqui. **Não existe um QR hospedado ativo para entregar desta sessão.** Snack também não foi usado: a versão oficial do SDK consultada não declara suporte ao SDK 58 deste projeto; não houve downgrade nem desativação das verificações.

## Alternativa: aplicativo próprio assinado pelo Mac/Xcode

Esta opção não é necessária para testar login por e-mail no Expo Go. É necessária para validar identidade nativa própria, capacidades e retorno ao esquema `sortex-dev://`.

1. No Mac, use Xcode e runtime compatíveis com o iPhone e com React Native/Expo do projeto. Xcode e CocoaPods devem estar instalados. O iniciador apenas **verifica** a configuração/licença; não aceita contratos e não instala ferramentas do sistema automaticamente. Se houver termos ou pagamento, pare e decida pessoalmente; esta tarefa não autoriza aceite nem contratação.
2. Conecte o iPhone por cabo, desbloqueie e confirme **Confiar neste computador** no aparelho. Quando solicitado, habilite **Ajustes → Privacidade e Segurança → Modo de Desenvolvedor**, reinicie e confirme. A opção pode aparecer somente após conectar ao Xcode.
3. No Xcode, abra **Settings → Accounts → + → Apple Account** e autentique-se diretamente na Apple. Use a conta gratuita/Personal Team quando elegível; não selecione inscrição paga.
4. A partir da raiz do clone separado:

```sh
node .github/mobile/iphone.mjs xcode
```

O comando verifica Xcode/CocoaPods, gera `apps/mobile/ios` **somente se a pasta não existir**, verifica capacidades e instala Pods se ainda não houver workspace. Um projeto nativo existente é preservado; se estiver incompatível, revise-o antes de qualquer regeneração. Abre o `.xcworkspace`, não o `.xcodeproj`.

5. Selecione o target **SorteXTeste → Signing & Capabilities**. Ative **Automatically manage signing** e selecione seu **Personal Team**. O identificador atual é `br.com.sortex.development`. Se a Apple indicar que ele pertence a outra equipe, escolha um sufixo próprio somente nesse clone de teste e mantenha `app.config.ts` coerente antes da próxima geração. Não reutilize identidade/certificados de produção. O Xcode pode registrar o dispositivo e criar um perfil gratuito; nenhum perfil foi criado por este executor.
6. Na barra de destino, escolha **seu iPhone físico**, não “Any iOS Simulator Device”. Em outro terminal:

```sh
cd SorteX-iphone/apps/mobile
npm run start:dev-client -- --lan --port 8082
```

Mac e iPhone precisam se alcançar pela rede local. No Xcode, **Product → Run** compila, assina e instala. Se solicitado, confie no desenvolvedor em **Ajustes → Geral → VPN e Gerenciamento de Dispositivo**. A localização e necessidade desse ajuste variam conforme iOS/perfil. Não use Archive/Upload/TestFlight.

7. O Personal Team gratuito tem restrições oficiais: até 10 App IDs e 3 dispositivos registrados, com expiração de 7 dias; até 3 aplicativos por dispositivo; o perfil também expira em 7 dias. Depois será necessário reconstruir/reinstalar. Não é distribuição permanente. Este caminho depende da elegibilidade e do Xcode do usuário; não foi executado em um Mac físico nesta sessão.

## API, sessão, permissões e autenticação

- API fixa: `https://sortex-fase1-review.netlify.app/.netlify/functions/sortex-api`. Banco exclusivo de teste, dados sintéticos. O iniciador e o cliente recusam o ambiente principal. Não há conexão PostgreSQL ou segredo de servidor no aplicativo. O navegador do iPhone pode verificar `/health`; isso comprova HTTPS naquele aparelho, não substitui o login nativo.
- Use somente contas e documentos de teste. Cadastro comprador/organizador PF/PJ e validação conjunta de localidade continuam no backend. Aprovação de organizador permanece real no ambiente isolado: uma nova conta pode ficar em análise. Isso não significa falha do aplicativo.
- Tokens no iOS: `expo-secure-store`, Keychain, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, sem autenticação biométrica. É suportado no Expo Go; a persistência real e a restauração no seu aparelho ainda precisam ser verificadas. Não é armazenamento compartilhado com o site. Expo Go e o aplicativo próprio possuem instalações/escopos distintos: faça login novamente ao trocar de opção.
- O app não solicita câmera, microfone, localização, fotos, notificações ou Face ID. A Câmera que lê o QR e permissões do contêiner Expo Go pertencem ao iOS/Expo Go, não a uma nova função SorteX. Rede local pode ser necessária ao Metro.
- Google/Apple continuam **não funcionais**: falta concluir broker mobile, credenciais e retorno seguro por plataforma, com state/nonce e troca no backend. Não houve união automática por e-mail nem habilitação de Sign in with Apple. O módulo/capacidade Apple não configurado permanece excluído do build próprio.
- Recuperação: há tela/endpoint e parser restrito de token para `sortex-dev://reset-password`, mas o ambiente isolado não envia e-mail. Expo Go não registra o esquema próprio `sortex-dev://`; **não valida o retorno de recuperação nem OAuth desse aplicativo**. Não abra tokens de sessão em URLs. Recuperação completa com entrega e retorno ao aparelho segue pendente; testes anteriores usaram token sintético de uso único na API.
- Ícone/splash próprios são verificáveis no aplicativo compilado; no Expo Go pertencem ao contêiner. Não confundir essas limitações com telas não implementadas.

## Roteiro no aparelho e evidências

1. Abra `/health` da API de teste no Safari, confira `status: ok`; abra o QR no Expo Go.
2. Entre com uma conta **sintética** existente ou cadastre comprador, organizador PF e PJ com dados de teste válidos. Confira etapas, voltar, teclado, UF/cidade e erros. Não use CPF/CNPJ reais. As regras do backend são as mesmas do teste anterior.
3. Comprador: campanhas → detalhe → pedidos → títulos/resultados quando houver fixtures. Organizador: dashboard → campanhas → pedidos/participantes. Uma conta nova sem pedidos pode mostrar estado vazio; não realize pagamentos ou sorteios para preenchê-la.
4. Edite perfil/slogan conforme o perfil. Feche o aplicativo completamente e reabra o mesmo projeto: confira restauração da sessão. Faça logout e reabra: deve continuar desconectado.
5. Com o projeto já carregado, desligue a internet, tente atualizar uma lista, confira erro e “tentar novamente”; religue e repita. Reiniciar o Expo Go sem Metro/rede não é teste de instalação offline independente.
6. Confira áreas seguras, rolagem com teclado, tamanho de fonte, VoiceOver, contraste e botões em seu modelo de iPhone. Não envie senha/token/documentos nas evidências.

As evidências anteriores de simulador e Chromium estão em `docs/mobile-evidence/2026-11-15/`. **Não comprovam teste físico.** Leitura do QR, execução, Keychain/restauração, rede móvel e retorno em iPhone físico permanecem pendentes até serem realmente executados. Nenhum novo pacote de simulador será anunciado como solução para aparelho.

Reverificação executada nesta etapa, em Linux, sem alterar o runtime do app:

| Verificação | Resultado efetivo |
| --- | --- |
| `node --check .github/mobile/iphone.mjs` e `git diff --check` | Passaram. |
| `node .github/mobile/iphone.mjs check` | Passou: API `/health` por HTTPS e `expo install --check`, dependências compatíveis. |
| `npm run typecheck` e `npm test`, em `apps/mobile` | Passaram; 16 testes de contratos, validação, sessões, concorrência e retornos inválidos. Vault de testes não comprova Keychain físico. |
| `npm run export:test` | Passou para iOS (865 módulos) e Android (860 módulos). São bundles JS/Hermes, não novos binários assinados. |
| `npm run test:api` com opt-in isolado | Passou: três novas contas sintéticas comprador/PF/PJ, cadastro, contratos, perfil, slogan, refresh/restauração via cliente Node, logout e rejeição de município incompatível. Credenciais somente em arquivo privado fora do repositório. |
| Contas sintéticas anteriores, chamadas HTTPS reais | Passaram: comprador com campanhas, detalhes, pedidos/títulos; organizador com dashboard coerente e pedidos/participantes; autorização contra acesso a pedido de outra conta; logout. |
| Túnel Expo Go neste executor | Bloqueado concretamente por falta de sessão Expo autenticada; nenhuma URL/QR ativo foi anunciado. |
| Xcode/Personal Team, instalação no iPhone, VoiceOver e sessão física | Não executados; exigem Mac e aparelho do proprietário. |

Não foram executados migrations, deploy, alterações no ambiente principal, pagamentos, sorteios, mensagens reais ou novos builds nativos. O launcher e o guia são entregues na branch de trabalho; o caminho interativo de login/Xcode precisa ser exercitado no Mac do proprietário.

## Fontes oficiais consultadas

- [Expo: iniciar desenvolvimento, conta igual e conexão](https://docs.expo.dev/get-started/start-developing/).
- [Expo Go: requisito de login desde SDK 57 no iPhone](https://expo.dev/changelog/expo-go-57-login).
- [Expo CLI: `--go`, LAN e túnel](https://docs.expo.dev/more/expo-cli/).
- [SecureStore: suporte Expo Go e limitações de biometria](https://docs.expo.dev/versions/latest/sdk/securestore/).
- [Apple: conta, Personal Team e limites de provisionamento gratuito](https://developer.apple.com/help/account/basics/about-your-developer-account).
- [Apple: executar em simulador ou dispositivo](https://developer.apple.com/documentation/xcode/running-your-app-on-simulated-or-physical-devices).
