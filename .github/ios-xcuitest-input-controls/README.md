# Controle de digitação no app iOS, sem autenticação

Experimento independente, não evidência de login, navegação ou iPhone
físico. Executa somente com um único commit deliberado na branch de QA,
registrando a marca `[xcui-input-control] ` **no começo** da mensagem.
Não usar `[xcui-full]` no mesmo commit. Alterar somente os arquivos deste
diretório/workflow opta pela execução independente, não dispara a jornada
com login. O repositório precisa permanecer público; não há dependência de
assinatura Apple, serviços externos ou planos pagos.

A imagem macOS 26 Arm64 anuncia iPhone 17, iOS 26.5 e Xcode 26.6 (17F113)
([tabela de runtimes e simuladores](https://github.com/actions/runner-images/blob/main/images/macos/macos-26-arm64-Readme.md)).
O script **verifica** essa combinação e cria um aparelho virtual novo pelo
[simctl do Xcode](https://developer.apple.com/documentation/xcode/xcode-command-line-tool-reference);
se algo faltar, para com `comparison=indeterminate`, sem baixar runtimes,
escolher outro aparelho ou reaproveitar um existente. Não configura
preferências globais do teclado. O mesmo dispositivo novo, modelo e runtime
são usados nos dois casos; cada caso termina e relança o processo, confirma
que o campo está vazio e usa somente o campo real do Release, via XCTest.

- `bulk`: uma chamada nativa `typeText`, seguida de igualdade exata.
- `paced`: chamadas nativas para blocos curtos, cada uma seguida por
  igualdade exata com o prefixo, e igualdade completa ao terminar.
- Nenhum caso repete digitação, acessa o valor da senha, submete o
  formulário, cria conta ou carrega sessão fictícia. Não há API/fixture;
  a configuração do Release aponta apenas para loopback sem listener.

O artefato `sortex-ios-input-control-<SHA>` contém apenas rótulos fixos.
`paced-only`/`bulk-only` significa que um método produziu igualdade
exata e o outro foi observado falhando na leitura; `neither-exact`
significa duas falhas de leitura. Falha antes da leitura, inventário
incompleto ou resultado não reconhecido são inconclusivos. A execução
continua falha quando o Xcode reporta falha, mesmo que o experimento
forneça uma comparação útil. Nenhum resultado prova uma causa física.
Não publicar Xcode bruto, capturas de entrada, relatórios ou hierarquias.

Sem captura neste controle. Uma futura captura de tela autenticada deve
ser produzida em outro teste, apenas depois de login real comprovado
contra API de teste, tela exata carregada, teclado e campos de login
ausentes e dados sintéticos verificados. Não publicar captura bruta antes
de revisar o conteúdo e identificar o SHA/aparelho como simulador.

No Linux, só é possível verificar as barreiras e o formato:

```sh
python3 -B -m unittest discover -s .github/ios-xcuitest-input-controls -p '*_test.py'
bash -n .github/ios-xcuitest-input-controls/run.sh
```
