# SorteX · smoke de interface iOS isolado

`Interface nativa iOS (PostgreSQL local)` roda somente em push próprio deste
repositório à branch `homologacao/web-ios-integrada` que altere o workflow
ou algum arquivo desta pasta. Introduzir os seletores de login com uma
revisão normal e esta pasta/workflow em um push separado permite iniciar
somente este build de teste iOS; o verificador HTTP do PR segue independente.
Para repetir a execução inicial, reexecute apenas o job que falhou. Não
altere a `main` para habilitar acionamento manual.

GitHub Actions prepara um simulador e compila o bundle Release que já é
usado no teste de abertura (sem Metro). Só este bundle descartável tem
uma exceção ATS para o loopback, sem carregamentos arbitrários. Não é
distribuído. Só o workflow de interface isolada usa a assinatura ad hoc
local do Xcode para conservar o acesso nativo ao Keychain. O job verifica a
integridade da assinatura e o identificador do bundle antes de instalar;
não usa certificado, perfil de dispositivo, time Apple ou modo alternativo
de armazenar a sessão. O teste usa o CLI Maestro local
[2.12.1](https://github.com/mobile-dev-inc/Maestro/releases/tag/cli-2.12.1),
verificado por SHA-256, sem Maestro Cloud, telemetria ou análise externa.

A API Nest real escuta exclusivamente em `127.0.0.1:3338`, com migrações
aplicadas a um cluster PostgreSQL 18 novo, local e descartável. A fixture
gera as credenciais locais e seus dois usuários sintéticos, sem acessar a
prévia, o Neon, nenhum gateway, a produção ou a App Store. A campanha já
publicada é dado de fixture, não evidência de publicação por organizador.

O fluxo pressiona a interface real: entrar com e-mail, abrir Campanhas,
ver prêmio e regulamento da campanha, encerrar o processo e relançar logado,
sair, encerrar novamente e relançar deslogado. A aprovação requer também
requisições reais ordenadas no Nest, exatamente uma sessão revogada no
PostgreSQL e zero pagamentos. O CI guarda somente o SHA, runtime, hash do
bundle, escopo e uma captura final sem sessão. Se a tela de entrada não
for verificada em 45 segundos, não é iniciada a etapa de login: o único
artefato de falha é o status e uma captura do simulador descartável
anterior à digitação de quaisquer credenciais. O job não exporta logs
brutos, hierarquia do Maestro, capturas durante o login ou o binário. Na
falha de inicialização, o resumo inclui somente uma categoria allowlisted
do Keychain, quando os logs do sistema correlacionam o erro a este app.
`not-observed` não comprova que o Keychain funcionou.

Para verificar só a infraestrutura e os mesmos contratos do cliente, sem
Xcode, instale as dependências já travadas dos dois projetos, gere o cliente
Prisma e compile o Nest. Aponte para os binários da instalação local do
PostgreSQL 18, em processo não-root:

```sh
export RUNNER_TEMP="$(mktemp -d)"
export SORTEX_IOS_UI_PG_BIN="/caminho/postgresql18/bin"
node --test .github/native-ui/fixture-guards.test.cjs
bash .github/native-ui/with-fixture.sh bash -c \
  'cd apps/mobile && node --import tsx ../../.github/native-ui/fixture-http-smoke.ts'
```

Essa execução HTTP usa um cofre em memória. Não verifica interface,
SecureStore real, instalação física, fluxo do organizador, capa com
imagem, Pix ou homologação integral das jornadas do placar. Mesmo com
a rodada do simulador verde, o aceite físico permanece separado.
