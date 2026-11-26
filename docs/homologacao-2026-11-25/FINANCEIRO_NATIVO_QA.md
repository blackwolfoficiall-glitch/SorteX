# Financeiro do organizador no iOS · consulta interna

O painel do organizador ganhou **Consultar financeiro e extrato**. Exibe
saldo disponível, pendente e bloqueado do livro interno, receita bruta e
líquida acumuladas, taxas SorteX e taxas de gateway separadas, e o extrato
paginado por lançamentos. As taxas registradas podem incluir estimativas.
Não são prova de liquidação, repasse/split, conciliação de gateway ou saque
bancário. Não há botão de saque, pagamento, transferência ou alteração.

O aplicativo usa exclusivamente GET `/finance/balance/snapshot` e
`/finance/statement/snapshot`, ambas protegidas para o organizador autenticado
e sem cache. São rotas distintas para permitir deploy gradual: uma API antiga
devolve 404 e a tela informa indisponibilidade, sem tentar rotas antigas que
abrem contas ou liberam saldo vencido. As rotas legadas não mudaram de
comportamento. As novas consultas não abrem conta, não liberam valores vencidos
e não modificam o extrato, nem acessam provedor. O valor monetário chega como
string decimal em BRL com duas casas decimais, sem arredondamento por ponto
flutuante. Quando não existe conta ou lançamento, a tela informa isso, sem
confundir falha de API com saldo zero. Sessão trocada/encerrada invalida
respostas em voo mesmo se for a mesma conta que entrou de novo.

## Evidência reproduzível, não aceite

- Unitário/typecheck móvel: `cd apps/mobile && npm run typecheck && npm test`.
- Integração local Nest + cliente HTTP móvel (Node/memória, não SecureStore):
  configure `SORTEX_FINANCE_E2E_DATABASE_URL` para um PostgreSQL descartável,
  IPv4 loopback e recém-migrado chamado `sortex_finance_*`. Em `services/api`:
  `npm run test:e2e -- --runInBand --runTestsByPath test/organizer-finance-snapshot.e2e-spec.ts`.
  Usa contas sintéticas distintas, extrato paginado e verificação de que
  leitura não criou conta nem soltou saldo pendente vencido.
- Comparação opcional do BFF Next: suba o site em IPv4 loopback com as
  variáveis de API apontando para o Nest local do teste. Defina no teste
  `SORTEX_FINANCE_E2E_WEB_URL` (URL local do Next) e
  `SORTEX_FINANCE_E2E_API_PORT` (porta fixa desse Nest). Antes do login
  sintético, a suíte confirma que o BFF aponta para a instância descartável.

Rodada local de 26/11/2026: **52/52** testes do app e TypeScript aprovados;
**1/1** Nest HTTP + PostgreSQL 18.7 descartável, incluindo comparação pelo
BFF compilado do Next. BFF e cliente móvel retornaram os mesmos valores e
16 lançamentos em duas páginas, com cache desabilitado. Sessão ausente
recebeu 401, comprador recebeu 403, outro organizador viu apenas os próprios
dados. A consulta não alterou lançamento pendente nem abriu conta. Essa
comparação não executou nenhuma das interfaces em dispositivo.

**Classificação:** a jornada de **painel/financeiro do organizador** continua
**parcial**. Além do aceite no aparelho, ainda falta validar a interface nativa
em execução e a jornada maior de conciliação e operações do provedor Teste.
Verificar consistência de valores internos por HTTP não prova interface ou
homologação de pagamento. Nenhuma chamada externa ou movimentação real.
