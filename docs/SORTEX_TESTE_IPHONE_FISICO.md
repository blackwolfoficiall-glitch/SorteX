# SorteX — candidata Web + iOS no iPhone físico

O caminho de homologação do aparelho é um **build local Release**, assinado para desenvolvimento com Xcode e o Personal Team do proprietário. O JavaScript é embutido durante a compilação. Para **abrir** o app não é necessário manter Metro, QR, túnel, Mac ligado ou a mesma rede Wi-Fi; chamadas da API precisam de internet. Release aqui é uma configuração de compilação, não uma submissão à App Store ou ao TestFlight.

A candidata é a branch `homologacao/web-ios-integrada`, não `feat/mobile-expo` ou `infra/netlify-northflank-neon`. O checkout legado da Fase 1 e outras prévias não são substitutos da API QA. Não publique, não ative serviços pagos e não use dados ou meios de pagamento reais.

## 1. Preparar no Mac, mesmo antes de a API estar pronta

Requisitos: Node 22.13+, 24.3+ ou outra linha par suportada pelo iniciador; Xcode completo 26.4+ selecionado em **Xcode → Settings → Locations → Command Line Tools**; CocoaPods já instalado; iPhone com iOS 16.4+ e versão reconhecida pelo Xcode. Se o Xcode pedir instalação de componentes, login ou aceite de licença, o proprietário decide e faz isso diretamente. O iniciador não providencia credenciais, não aceita contratos e não compra nada.

Depois que o commit com `prepare-release` estiver na branch remota, no **Terminal do Mac**:

```sh
git clone --branch homologacao/web-ios-integrada https://github.com/blackwolfoficiall-glitch/SorteX.git SorteX-iPhone-QA
cd SorteX-iPhone-QA
git status --short
git rev-parse HEAD
npm --prefix apps/mobile ci
node .github/mobile/iphone.mjs prepare-release
```

Se a pasta de destino já existir, dê outro nome à cópia. Não mude branches, limpe arquivos ou faça reset no projeto existente do Mac. Confirme que o hash em `git rev-parse HEAD` é o candidato informado no PR. Se a candidata mudar, use outro clone limpo para preservar a pasta `ios` anterior. O iniciador não reaproveita um projeto nativo de outro commit e não executa `prebuild --clean` nem `pod update`.

1. Conecte o iPhone por cabo, desbloqueie e confirme **Confiar neste computador**. Prossiga com **Modo de Desenvolvedor** se o Xcode/iOS pedir; é uma decisão do proprietário no aparelho.
2. No Xcode, autentique a Apple Account em **Settings → Accounts**, se necessário. Não envie senha, código ou chave.
3. O iniciador abre `SorteXTeste.xcworkspace`. No target **SorteXTeste → Signing & Capabilities**, selecione **Automatically manage signing** e seu **Personal Team** gratuito. Não use certificado, identificador ou equipe de distribuição. O bundle ID de teste é `br.com.sortex.development`; se o Xcode disser que não pertence à equipe, pare e registre o erro. Não renomeie o identificador nem regenere às cegas para contornar a assinatura.
4. No Xcode, localize **Devices and Simulators** / **Device Hub**, abra os detalhes do iPhone físico e copie o **Identifier** para usar apenas no Terminal. Não aperte Run, não inicie Metro e não publique pelo Xcode.

## 2. Compilar e instalar quando a QA estiver pronta

A API permitida é [SorteX QA](https://br-weathered-forest-bccwn49d-sortexqa.compute.c-16.us-east-1.aws.neon.tech/health/ready). Quando o endpoint retornar HTTP 200 com `status: ready` e `database: up`, no mesmo clone e com o iPhone conectado:

```sh
node .github/mobile/iphone.mjs check
node .github/mobile/iphone.mjs release --device IDENTIFIER_DO_IPHONE
```

Substitua `IDENTIFIER_DO_IPHONE` pelo valor mostrado no Xcode, sem colchetes. O comando verifica o dispositivo físico, a revisão da pasta nativa, a API QA e a disponibilidade do banco antes de chamar Expo CLI com configuração Release e `--no-bundler`. O build exclui configurações locais conflitantes, não usa outro servidor como fallback e desativa reserva e Pix na primeira validação do aparelho. Se a prontidão falhar, preserve o clone preparado e não aponte o app para outro ambiente. O Personal Team gratuito tem limite de dispositivos e expiração de perfis em sete dias; para continuar depois, pode ser necessário reconstruir e reinstalar.

## 3. Evidência que separa instalação de integração

1. Registre o hash do Git, versão iOS, hora e resultado da compilação. Não inclua UDID, credenciais ou dados pessoais em prints.
2. Feche o app, desconecte o cabo e abra pelo ícone, sem Metro. Registre o que abriu. Em seguida verifique login e restauração da sessão com conta sintética quando houver rede. A abertura off-line da interface não implica login off-line.
3. Quando web e iOS apontarem para a mesma API QA, use a **mesma conta sintética** nas duas interfaces e confronte perfil e uma campanha de teste. Não valide compra ou Pix neste build inicial. Não confunda navegação no iPhone com homologação financeira.
4. Registre erros de assinatura, inicialização, rede ou sessão separadamente. O binário de simulador e a exportação de JS não instalam nem comprovam execução em iPhone físico. O build mantém Apple/Google e capacidades não configuradas fora desse caminho de aceitação.

## 4. Checkout sandbox (perfil separado, somente após habilitação verificada)

O comando da etapa 2 usa o perfil **Core**. Ele continua sem reserva de teste e
sem Pix, mesmo se o Terminal tiver essas variáveis ativadas. Não é necessário
configurar o Mercado Pago para instalar ou validar cadastro, login, sessão e
rascunhos no Core.

Só depois de confirmar a ativação isolada descrita no
[roteiro de pagamentos](payments.md#pix-nativo-isolado-desativado-por-padrão),
instale um build separado para o teste de checkout:

```sh
node .github/mobile/iphone.mjs release --device IDENTIFIER_DO_IPHONE --profile checkout-sandbox
```

O perfil não contém segredos. Continua fixado à mesma API HTTPS QA e exige um
comprador autenticado e autorização de teste retornada pela API. Não usa a
Fase 1, a API principal, endereço de rede local ou fallback. Use apenas
campanha/reserva sintética nesta etapa. Não escaneie nenhum QR Code e não
faça Pix por um banco. Registre o perfil instalado com o SHA e volte ao
perfil Core ao encerrar o teste.

### Reserva sem iniciar pagamento

Se o iPhone e uma campanha sintética publicada na QA estiverem disponíveis antes das credenciais Mercado Pago Teste, use o perfil opcional `reservations-sandbox` em vez de fazer dois builds no mesmo dia. Ele deixa o Pix desligado. Se credenciais e aparelho estiverem disponíveis juntos, use o perfil Checkout Sandbox e faça primeiro uma reserva sem abrir o pagamento.

```sh
node .github/mobile/iphone.mjs release --device IDENTIFIER_DO_IPHONE --profile reservations-sandbox
```

- No início da primeira prévia privada, use dois compradores sintéticos. Reserve pelo iPhone com um deles, sem criar cobrança, e confirme que o outro não consegue reservar a mesma cota no site enquanto ela está retida. Anote o número, os IDs sintéticos e o vencimento retornado pelo servidor; a reserva normal usa 15 minutos por padrão. Depois do vencimento, reserve **a mesma cota** com o segundo comprador no site. Verifique que o primeiro não ganhou título nem lançamento financeiro.
- No Checkout Sandbox, não reaproveite essa reserva. Use um pedido separado para aprovação e reentrega do webhook; e outro para testar pagamento pendente até vencer. Iniciar pagamento estende a retenção por pelo menos 30 minutos. Não use uma cobrança com aprovação automática para medir a expiração de cobrança pendente.
- A prévia com PIN dura 30 minutos. Para o teste pendente, anote o vencimento real e abra outra [prévia privada](homologacao-2026-11-25/PREVIA_PRIVADA_MAC.md) perto dele, mantendo os mesmos SHAs Web/API e o mesmo banco QA. O link muda e o login web precisa ser refeito; o iPhone permanece na mesma API. Nunca antecipe o relógio ou libere a cota manualmente para produzir evidência.
- Não há movimentação real. Este teste de reserva não comprova Pix, recebimento do webhook, conciliação ou emissão de títulos.

## Expo Go é opcional para prévia, não atende a este roteiro

A [listagem brasileira da App Store](https://apps.apple.com/br/app/expo-go/id982107779) mostra que o Expo Go **58.0.5** acrescentou suporte ao SDK 58; instalações antigas, como 57.0.9, não atendem esta versão. Mesmo atualizado, Expo Go depende de Metro e não substitui o aplicativo SorteX com identidade nativa própria. Não se requer Expo Go, conta Expo, EAS Build, TestFlight ou plano pago para o caminho acima.

Referências: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/), [Expo CLI e build Release](https://docs.expo.dev/more/expo-cli/), [Apple Personal Team](https://developer.apple.com/help/account/basics/about-your-developer-account/) e [Modo de Desenvolvedor](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device).
