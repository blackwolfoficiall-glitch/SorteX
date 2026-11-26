# Pagamentos da SorteX

## Escopo atual

O Módulo 5 integra o Checkout Transparente via **Orders API** do Mercado Pago
somente em `PAYMENT_ENV=sandbox`. Nenhum saque, split, repasse ou operação em
produção está habilitado. O backend usa o SDK oficial `mercadopago`; o cartão é
tokenizado no navegador pelo Card Payment Brick do `MercadoPago.js`.

Referências oficiais:

- [SDK Node.js](https://github.com/mercadopago/sdk-nodejs)
- [Modelo de integração da Orders API](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/integration-model)
- [PIX via Orders](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/pix)
- [Cartões via Orders](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-integration/cards)
- [Webhooks](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks)

## Arquitetura de providers

```text
PaymentsService
  -> PaymentGatewayService
       -> PaymentGatewayProvider
            -> MercadoPagoGatewayProvider
```

O domínio conhece somente `PaymentGatewayProvider`. Código de request,
normalização de status, assinatura e respostas do Mercado Pago fica isolado no
provider. Para adicionar outro gateway:

1. implementar `PaymentGatewayProvider`;
2. mapear status e métodos para os enums internos;
3. registrar o provider no `PaymentsModule`;
4. adicionar a seleção no `PaymentGatewayService`;
5. criar testes de contrato sem acesso à internet.

## Variáveis de ambiente

```dotenv
PAYMENT_ENV="sandbox"
MERCADO_PAGO_ACCESS_TOKEN=""
MERCADO_PAGO_PUBLIC_KEY=""
MERCADO_PAGO_WEBHOOK_SECRET=""
MERCADO_PAGO_ESTIMATED_FEE_PERCENT="0"
PAYMENT_RESERVATION_TTL_SECONDS="1800"
MAX_CARD_INSTALLMENTS="12"
APP_URL="http://localhost:3000"
API_URL="http://localhost:3333"
```

- `ACCESS_TOKEN` é privado e só pode existir no backend.
- `PUBLIC_KEY` é entregue ao comprador autenticado para inicializar o Brick.
- `WEBHOOK_SECRET` valida `x-signature` com o validador oficial do SDK.
- o projeto recusa providers reais quando `PAYMENT_ENV` não é `sandbox`.
- nunca versionar `.env` ou imprimir credenciais em logs.

## Fluxo PIX

1. O comprador possui uma `Purchase` em `AWAITING_PAYMENT`.
2. O backend busca a compra, revalida quantidade, promoção e valor.
3. O serviço de tarifas calcula separadamente SorteX, gateway e líquido.
4. A reserva é estendida para no mínimo 30 minutos, compatível com a janela
   mínima documentada para PIX no Mercado Pago.
5. O provider cria uma order com `X-Idempotency-Key` e `external_reference`.
6. QR Code e copia-e-cola são armazenados no `Payment` e exibidos no checkout.
7. Polling consulta somente o estado local; ele não confirma a venda.
8. O webhook validado busca novamente a order no provider e confirma a venda.

## Fluxo de cartão

1. O Card Payment Brick captura os dados no navegador.
2. O MercadoPago.js devolve um token descartável.
3. Apenas token, bandeira identificada e parcelas chegam ao backend.
4. Número completo e CVV nunca são enviados ou armazenados pela SorteX.
5. A order pode retornar pendente ou rejeitada; mesmo uma resposta imediata de
   aprovação fica `PROCESSING` até a confirmação definitiva pelo webhook.

Use exclusivamente cartões e usuários de teste fornecidos no painel e na
documentação do Mercado Pago. Nunca use cartão real durante desenvolvimento.

## Webhook

Endpoint:

```text
POST {API_URL}/webhooks/payments/mercado-pago
```

No painel **Suas integrações > Webhooks**, cadastre uma URL HTTPS pública de
teste apontando para esse endpoint, habilite os eventos de **Orders** usados
pelo Checkout Transparente via Orders e copie a assinatura secreta para
`MERCADO_PAGO_WEBHOOK_SECRET`.

Processamento:

1. validar `x-signature`, `x-request-id` e `data.id`;
2. persistir o evento com chave única provider+evento;
3. consultar a order real no Mercado Pago;
4. validar `external_reference` e valor;
5. executar uma transação serializável;
6. atualizar `Payment`, `Purchase`, `Ticket`, `Campaign` e `PaymentEvent`;
7. repetir eventos já processados sem duplicar títulos ou faturamento.

Eventos com valor divergente, referência inválida, reserva encerrada ou
quantidade de títulos inconsistente não aprovam a compra e ficam registrados
para análise.

## Máquina de estados

```text
CREATED -> PENDING | PROCESSING
PENDING | PROCESSING -> APPROVED | REJECTED | CANCELLED | EXPIRED
APPROVED -> REFUNDED | CHARGEBACK (só após confirmação pelo provedor)
```

Na aprovação:

```text
Payment  -> APPROVED
Purchase -> PAID
Ticket   -> SOLD (reservedUntil = null)
Campaign -> reservados diminuem, vendidos e receita aumentam
```

Rejeição libera a trava para nova tentativa, mas mantém a reserva até seu prazo.
Cancelamento e expiração liberam os títulos. Títulos `SOLD` nunca retornam para
`AVAILABLE` automaticamente.

O estorno confirmado pelo provedor gera um único débito no extrato interno do
organizador e reverte a comissão, sem revender os mesmos títulos. Uma atualização
tardia de aprovação não reabre o pagamento estornado. O estorno solicitado pelo
usuário continua sendo apenas pedido para análise, sem chamar o provedor.
Estorno parcial, reversão sem aprovação local e devolução de contestação ao
vendedor exigem conciliação manual e não geram débito integral automático.

Os estados são interpretados conforme a
[referência de transações da Orders API](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/payment-management/status/transaction-status).
`processed` sozinho não comprova crédito: é necessário o detalhe `accredited`.

## Tarifas

O cálculo usa as condições de `OrganizerProfile` e a isenção da campanha:

- Básico: 2,9%;
- Profissional: 2,4%;
- Premium: 1,9%;
- taxa personalizada prevalece;
- isenção do perfil ou campanha zera apenas a SorteX;
- primeira campanha gratuita zera apenas a SorteX;
- taxa estimada do gateway continua registrada separadamente.

Não existe split ou repasse real nesta versão. `netAmount` é apenas estimativo.

## Testes

Os testes mockam o provider e não acessam a internet. Eles cobrem tarifas,
primeira campanha, taxa personalizada, criação PIX/cartão, assinatura, webhook
duplicado, divergência de valor/referência, transição para `PAID`/`SOLD`,
expiração, cancelamento, permissão, rollback e sanitização.

### Regressão com banco descartável

A suíte `services/api/test/payments-postgres.e2e-spec.ts` roda com
`SORTEX_PAYMENTS_TEST_DATABASE_URL` apontando para um PostgreSQL local e
descartável em `127.0.0.1`, banco `sortex_payments_test_*` já migrado.
Na pasta `services/api`:

```sh
npm run test:e2e -- --runInBand payments-postgres
```

O teste exerce HTTP, validação HMAC do SDK, transações Prisma e persistência
de pagamento, títulos e lançamentos. Só a consulta de order ao SDK recebe
respostas de teste. Isso **não** comprova entrega de webhook, processamento
de PIX, expiração ou estorno no ambiente externo do Mercado Pago.

### Aceite externo pendente

- Selecionar **Teste** no painel da integração e configurar a chave pública,
  o token e o segredo de webhook **exclusivamente** nos segredos do ambiente
  isolado. O [guia oficial de credenciais de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/resources/credentials)
  informa que o token de teste de Orders usa prefixo `APP_USR`; o prefixo
  não confirma o ambiente. Nunca copiar credenciais de produção.
- Com o [roteiro oficial de PIX de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/integration-test/pix),
  confirmar no ambiente de teste a criação da cobrança, entrega autenticada,
  reentrega, expiração/cancelamento/estorno e conciliação. Não pagar QR Code
  como cliente real. Validar o mesmo pedido no web e no iPhone.
- Manter separado saldo interno, pendente e disponível; nenhum desses
  valores comprova split efetivamente liquidado ou saque executado.

### Gateways adicionais, ainda sem adaptadores de cobrança

| Gateway | Pré-requisitos antes de implementar e habilitar |
| --- | --- |
| Stone | Definir o produto com a Stone. [Stone Online](https://online.stone.com.br/docs/o-que-e-o-stone-online) é a API transacional que pressupõe serviços complementares já existentes; [Connect Stone](https://connect-stone.stone.com.br/docs/processo-de-integra%C3%A7%C3%A3o) atende terminal/PDV e exige o programa de parcerias. Não são substitutos diretos para um checkout web/iOS. |
| PagBank | Usar conta/token de sandbox e a [API de Pedidos](https://developer.pagbank.com.br/reference/criar-pedido); validar [Pix e sua notificação](https://developer.pagbank.com.br/reference/criar-pedido-com-qr-code-pix-v2), estados e reentregas no [ambiente separado](https://developer.pagbank.com.br/docs/ambientes-disponiveis). |
| Pagar.me | Usar conta e chaves de teste da [Core API v5](https://docs.pagar.me/docs/quickstart-pagarme), verificar o [contrato de autenticação](https://docs.pagar.me/reference/autentica%C3%A7%C3%A3o-2) do produto escolhido e validar webhooks, cancelamento e estorno antes de expor no checkout. Split exige validação separada de recebedores e liquidação. |

## Limitações

- migração Prisma ainda precisa ser revisada e aplicada manualmente;
- credenciais e webhook precisam ser configurados no painel do Mercado Pago;
- taxa do gateway é estimada até haver dados de tarifa na resposta/conciliação;
- refund-request apenas registra solicitação para análise;
- não há saque, split, repasse, tratamento completo de contestação ou conciliação externa;
- ativação de produção exige revisão jurídica, financeira, segurança e testes de
  homologação independentes.

## Pix nativo isolado (desativado por padrão)

O pedido nativo pode mostrar o estado gravado pela API e solicitar uma
cobrança de **teste**, sem apresentar código pagável por banco, QR ou links
externos. O app consulta apenas a API, sem iniciar uma consulta ao Mercado
Pago a cada atualização de tela. O fluxo reutiliza a mesma reserva, valor
calculado pela API, chave idempotente, webhook e extrato do checkout web.
Não retoma pedidos de outro comprador ou tentativas já iniciadas no checkout web.

- O build **Core** não habilita reservas nem Pix. No
  [roteiro para iPhone](SORTEX_TESTE_IPHONE_FISICO.md), o perfil explícito
  `checkout-sandbox` liga apenas as duas flags públicas do teste. Ambos os
  perfis são fixados à função HTTPS **sortexqa** no projeto Neon
  **sortex-web-ios-qa**. A integração recusa a Fase 1, produção e HTTP local.
- O backend exige o `NEON_BRANCH_ID` automático da branch QA e o `API_URL`
  canônico da função QA, além de `ENABLE_NATIVE_SANDBOX_PIX=1`,
  `APP_ENV=staging`, `PAYMENT_ENV=sandbox`, pagamentos/saques reais
  desligados e somente `MERCADO_PAGO_WEBHOOK_SECRET_TEST`
  (sem segredo genérico nem de produção).
- Uma pessoa com acesso ao [painel do Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/resources/credentials)
  precisa selecionar **Teste** na aplicação Checkout Transparente (Orders) e
  confirmar que o token é dessa tela. O prefixo `APP_USR` não prova a origem.
  Configurar o evento **Order (Mercado Pago)** no [webhook de Teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/notifications),
  no endpoint HTTPS da função QA com o caminho
  `/webhooks/payments/mercado-pago`, sem alterar a aba Produção.
- No Neon, atualizar apenas a função QA, sem reinicializar o bootstrap.
  Usar [atualização incremental das variáveis](https://neon.com/docs/compute/functions/environment-variables#user-defined-variables)
  para preservar JWT, chave de criptografia, CORS e toda configuração
  existente. Não reenviar um env completo nem sobrescrever `DATABASE_URL`
  ou `NEON_BRANCH_ID`, que o Neon injeta. Na configuração protegida do GitHub,
  usar apenas os secrets do
  ambiente `sortex-web-ios-qa` restrito à branch de integração:
  `SORTEX_QA_MP_TEST_ACCESS_TOKEN` e `SORTEX_QA_MP_TEST_WEBHOOK_SECRET`.
  A implantação autorizada mapeia esses valores para
  `MERCADO_PAGO_ACCESS_TOKEN` e `MERCADO_PAGO_WEBHOOK_SECRET_TEST`
  no backend QA e calcula `MERCADO_PAGO_VERIFIED_TEST_TOKEN_SHA256`
  a partir do token de Teste atestado pelo operador, nunca do token já
  presente no servidor. Não envie valores por chat, commit ou log.
  Esses secrets não ativam nada sozinhos. Ativar a flag do backend só
  após conferir a revisão, a prontidão e a origem dos segredos. As rotas
  web legadas também conseguem usar um token instalado no backend,
  então mantenha todos os dados/campanhas sintéticos e configure o token
  apenas na janela autorizada. Ao encerrar, desative a flag e retire
  as credenciais de Teste por atualização incremental; use o perfil Core.
- A API revalida esses requisitos antes da criação no SDK e exige o ticket
  sandbox documentado, a referência e o valor esperado. Não mostra QR Code,
  código Pix ou link bancário. Use exclusivamente o
  [roteiro oficial de Pix de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/integration-test/pix):
  a aprovação de teste é automática, sem fazer Pix de verdade. Acompanhe a
  order e o evento recebido no painel de Teste, confira o mesmo ID/estado
  nas duas superfícies e valide que a reentrega não duplica títulos.
- Configurar uma conta SorteX no ambiente isolado ou validar login e
  rascunhos não exige acesso ao Mercado Pago. Só a configuração e o aceite
  financeiro requerem um operador autorizado na aplicação de **Teste**.
  Os testes locais não contatam o Mercado Pago e não comprovam entrega de
  webhook externo nem execução no iPhone.
