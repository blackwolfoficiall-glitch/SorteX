# Teste nativo independente do Maestro (prévia, não homologação)

Este alvo Xcode de automação roda apenas no iPhone virtual de um job público,
sem build físico, conta Apple ou serviço pago. Ele abre a candidata Release
real pelo bundle `br.com.sortex.development`, sem Metro, deep link, atalho de
autenticação ou modificações no código do app. O target só automatiza as
interfaces nativas, inclusive `textFields` e `secureTextFields`.

O primeiro trabalho no macOS é compilar o target isolado e validar a jornada
com `mobile-native-xcuitest.yml`, preservando a execução Maestro original. O
disparo é um push opt-in dos arquivos deste teste à branch QA, apenas se o
repositório oficial for público. Não habilita deploy ou toca a branch main.
A compilação e execução do alvo XCTest **ainda não foram verificadas**; Linux
só pode verificar arquivos, sintaxe e barreiras. Não contar startup ou
aprovação local como login aprovado, simulador como iPhone físico, nem este
cenário como homologação de checkout.

O mesmo fixture verificado do Maestro fornece API Nest real em loopback e
PostgreSQL 18 temporário com migrações, uma conta descartável e uma campanha
sintética. Antes de testar, o lançador verifica a assinatura ad hoc local e
fecha ATS para tudo além do loopback do fixture. O alvo grava a senha gerada
somente no ambiente do runner através do xctestrun privado. O app recebe a
senha somente pelo teclado. Capturas, anexos, dados de caso e logs brutos não
são publicados; a subpasta temporária privada é removida em saída, erro ou
interrupção. Só se exige `xcresulttool` para aceitar **exatamente um caso
aprovado** e não confundir um teste vazio com sucesso. O relatório salvo só
contém strings fixas e SHA depois que PostgreSQL/API verificaram o único login
aceito com os dois valores exatos, leitura da campanha, renovação e saída em
ordem, revogação da única sessão e ausência total de pagamentos.

Verificação portátil:

```sh
bash -n .github/ios-xcuitest/run.sh .github/ios-xcuitest/finish.sh
python3 .github/ios-xcuitest/evidence_test.py
node --test .github/native-ui/fixture-guards.test.cjs .github/native-ui/startup-probe.test.cjs .github/native-ui/phase-evidence.test.cjs
```

Referências: [XCUIApplication por bundle](https://developer.apple.com/documentation/xcuiautomation/xcuiapplication/init%28bundleidentifier%3A%29), [Xcode e resultados de testes](https://help.apple.com/xcode/mac/current/en.lproj/devc38fc7392.html), [manual xctestrun do Xcode](https://keith.github.io/xcode-man-pages/xcodebuild.xctestrun.5.html).
