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
APPROVED -> REFUNDED | CHARGEBACK (estrutura preparada)
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

## Limitações

- migração Prisma ainda precisa ser revisada e aplicada manualmente;
- credenciais e webhook precisam ser configurados no painel do Mercado Pago;
- taxa do gateway é estimada até haver dados de tarifa na resposta/conciliação;
- refund-request apenas registra solicitação para análise;
- não há saque, split, repasse, chargeback completo ou conciliação;
- ativação de produção exige revisão jurídica, financeira, segurança e testes de
  homologação independentes.
