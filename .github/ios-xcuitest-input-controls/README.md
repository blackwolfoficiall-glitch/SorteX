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
preferências globais do teclado. As quatro observações usam o mesmo
dispositivo novo, modelo e runtime. Cada caso termina e relança o processo,
confirma que o campo está vazio e usa somente o campo real do Release via
XCTest, sem presumir que a ordem dos casos seja fixa no Xcode.

- `chunks-a` e `chunks-b`: a sequência anterior de cinco blocos curtos.
- `characters-a` e `characters-b`: a mesma digitação nativa
  `typeText`, chamada uma vez para cada caractere, sem usar posições da
  tela nem presumir rótulos de teclas ou alterar preenchimento automático.
- Ambos exigem igualdade exata, passiva, após cada ação e mais uma vez ao
  final. Nenhum caso repete a digitação, acessa o valor da senha, submete o
  formulário, cria conta ou carrega sessão fictícia. O Release aponta
  apenas para loopback sem listener; não há API ou fixture de login.

A última rodada integral [46075226454](https://github.com/blackwolfoficiall-glitch/SorteX/actions/runs/46075226454) (`c17575e`) falhou na
conferência de prefixo antes da senha ou de qualquer pedido HTTP. Um único
`paced-only` anterior não representa repetibilidade. O novo artefato
`sortex-ios-input-control-<SHA>` usa `characters-repeatable` ou
`chunks-repeatable` quando só esse método acertou nas duas observações;
`both-repeatable` indica que ambos acertaram nas duas. `neither-repeatable`
significa que nenhum acertou nas duas, não que todos os casos falharam.
Falha antes da leitura, inventário incompleto ou resultado desconhecido
tornam a comparação `indeterminate`. A execução continua falha quando o
Xcode reporta falha, mesmo que forneça uma comparação útil. Uma observação
repetível ainda não comprova login: a jornada com API/PG, Campanhas,
reabertura e saída continua necessária. Não publicar valores, contagens,
índices da digitação, dados brutos do Xcode, capturas ou hierarquias.

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
