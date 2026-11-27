# Teste nativo independente do Maestro (prévia, não homologação)

Este alvo Xcode de automação roda apenas no iPhone virtual de um job público,
sem build físico, conta Apple ou serviço pago. Ele abre a candidata Release
real pelo bundle `br.com.sortex.development`, sem Metro, deep link, atalho de
autenticação ou modificações no código do app. O target só automatiza as
interfaces nativas, inclusive `textFields` e `secureTextFields`.

O workflow `mobile-native-xcuitest.yml` executa inicialmente **apenas a
pré-checagem do driver** no macOS. Sem inicializar o aparelho virtual,
instalar dependências, compilar o app ou iniciar a API, usa o mesmo
`build-for-testing` do cenário completo e inspeciona em modo somente leitura
o plist gerado pelo Xcode. O diagnóstico retido lista exclusivamente versão
validada do Xcode, formato v1/v2, cardinalidade de configurações/alvos,
categorias de caminhos (nunca valores), presença de variáveis/argumentos e
um código fixo do validador. Mesmo um relatório inconclusivo não executa o
cenário completo. A execução longa só pode ser habilitada em commit separado
depois de confirmar a saída real de macOS; a guarda atual fixa
`run_full=false`. A execução original do Maestro está preservada.

Não contar a pré-checagem, startup ou aprovação local como login aprovado,
o simulador como iPhone físico, nem este cenário como homologação de
checkout. O disparo é um push opt-in dos arquivos do teste à branch QA,
apenas se o repositório oficial for público. Não habilita deploy ou toca
a branch main.

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

Se o Xcode falhar durante a execução, o coletor usa o inventário e as
atividades daquele único caso por `xcresulttool`. Guarda somente categorias
fixas para resultado, última atividade reconhecida, eventual indício de
falha antes de iniciar, e as categorias de login já abstraídas pelo fixture.
O diagnóstico não confirma que a última atividade tenha terminado, não
configura uma nova tentativa e não substitui a evidência de sucesso. O log
local, os dados JSON brutos e o bundle de resultados não são publicados.

Campanhas separa a confirmação da tela inicial e do teclado, a localização
da aba pelo identificador nativo (independente da classe reportada pelo
iOS), sua disponibilidade para toque, o toque, a lista, a abertura, o
detalhe, o prêmio e o regulamento. Quando o caso falha, as leituras da tela
inicial e da campanha sintética recebem classificações independentes (sem
URL, parâmetros, contagem, corpo ou status exato). O diagnóstico nunca
altera a validação do cenário completo nem substitui a consulta no aplicativo.
