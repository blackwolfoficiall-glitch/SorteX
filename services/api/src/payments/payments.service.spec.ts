/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  GatewayProvider,
  NumberSelectionMode,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  PurchaseStatus,
  TicketStatus,
  UserRole,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import { PaymentsService } from './payments.service';

const buyer = {
  id: 'buyer-1',
  name: 'Maria Compradora',
  email: 'maria@sortex.test',
  phone: null,
  cpf: '12345678900',
  cnpj: null,
  role: UserRole.BUYER,
  city: null,
  state: null,
  isActive: true,
  verified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  sessionId: 'session-1',
};

function payment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'payment-1',
    purchaseId: 'purchase-1',
    buyerId: buyer.id,
    campaignId: 'campaign-1',
    organizerId: 'organizer-1',
    provider: GatewayProvider.MERCADO_PAGO,
    providerPaymentId: 'order-1',
    externalReference: 'sortex:purchase-1:payment-1',
    activePurchaseKey: 'purchase-1',
    method: PaymentMethod.PIX,
    status: PaymentStatus.PENDING,
    amount: new Prisma.Decimal(10),
    platformFee: new Prisma.Decimal(0.29),
    platformFeeRate: new Prisma.Decimal(2.9),
    gatewayFee: new Prisma.Decimal(0.1),
    gatewayFeeRate: new Prisma.Decimal(1),
    netAmount: new Prisma.Decimal(9.61),
    currency: 'BRL',
    pixQrCode: 'qr-code',
    pixQrCodeBase64: 'base64',
    pixCopyPaste: 'copy-paste',
    boletoUrl: null,
    cardLastFour: null,
    cardBrand: null,
    installments: null,
    expiresAt: new Date(Date.now() + 1800000),
    approvedAt: null,
    rejectedAt: null,
    cancelledAt: null,
    refundedAt: null,
    failureReason: null,
    metadata: { providerStatus: 'pending' },
    createdAt: new Date(),
    updatedAt: new Date(),
    purchase: {
      id: 'purchase-1',
      buyerId: buyer.id,
      campaignId: 'campaign-1',
      promotionId: null,
      status: PurchaseStatus.AWAITING_PAYMENT,
      selectionMode: NumberSelectionMode.RANDOM,
      quantity: 2,
      unitPrice: new Prisma.Decimal(5),
      subtotal: new Prisma.Decimal(10),
      discount: new Prisma.Decimal(0),
      total: new Prisma.Decimal(10),
      expiresAt: new Date(Date.now() + 1800000),
      confirmedAt: null,
      cancelledAt: null,
      idempotencyKey: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      campaign: {
        id: 'campaign-1',
        slug: 'corolla',
        title: 'Corolla',
        coverImage: null,
        organizerId: 'organizer-1',
      },
      tickets: [
        { number: 10, status: TicketStatus.RESERVED },
        { number: 20, status: TicketStatus.RESERVED },
      ],
    },
    ...overrides,
  };
}

const gatewayResult = (overrides: Record<string, unknown> = {}) => ({
  providerPaymentId: 'order-1',
  externalReference: 'sortex:purchase-1:payment-1',
  status: PaymentStatus.PENDING,
  method: PaymentMethod.PIX,
  amount: '10.00',
  pixQrCode: 'qr-code',
  pixQrCodeBase64: 'base64',
  pixCopyPaste: 'copy-paste',
  rawStatus: 'action_required:waiting_transfer',
  ...overrides,
});

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: any;
  let provider: any;
  let ledger: { recordApprovedPayment: jest.Mock; recordReversal: jest.Mock };
  let commissions: {
    recordApprovedPayment: jest.Mock;
    reversePayment: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      payment: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
      },
      paymentEvent: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      auditLog: { create: jest.fn() },
      purchase: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      ticket: { updateMany: jest.fn(), deleteMany: jest.fn() },
      campaign: { update: jest.fn(), count: jest.fn() },
      $transaction: jest.fn((callback: any) => callback(prisma)),
    };
    provider = {
      createPixPayment: jest.fn(),
      createCardPayment: jest.fn(),
      getPaymentStatus: jest.fn(),
      cancelPayment: jest.fn(),
      refundPayment: jest.fn(),
      validateWebhook: jest.fn(),
      parseWebhookEvent: jest.fn(),
      normalizeStatus: jest.fn(),
    };
    ledger = { recordApprovedPayment: jest.fn(), recordReversal: jest.fn() };
    commissions = {
      recordApprovedPayment: jest.fn(),
      reversePayment: jest.fn(),
    };
    service = new PaymentsService(
      prisma,
      { get: jest.fn().mockReturnValue(provider) } as any,
      { calculate: jest.fn() } as any,
      { detectForPurchase: jest.fn() } as any,
      ledger as any,
      commissions as any,
      { syncApprovedPayment: jest.fn() } as any,
      { evaluateReached: jest.fn() } as any,
    );
  });

  it('cria PIX usando somente valor preparado no backend', async () => {
    (service as any).preparePayment = jest.fn().mockResolvedValue({
      payment: payment({ providerPaymentId: null }),
      existing: false,
    });
    provider.createPixPayment.mockResolvedValue(gatewayResult());
    prisma.payment.update.mockResolvedValue(payment());
    const result = await service.createPix(buyer, {
      purchaseId: 'purchase-1',
      acceptedTerms: true,
    });
    expect(provider.createPixPayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: '10.00' }),
    );
    expect(result.pixCopyPaste).toBe('copy-paste');
  });

  describe('Pix nativo sandbox', () => {
    const data = { purchaseId: 'purchase-1', acceptedTerms: true };
    const originalEnv = process.env;
    beforeEach(() => {
      const token = 'APP_USR-test-fixture-not-a-credential';
      process.env = {
        ...originalEnv,
        ENABLE_NATIVE_SANDBOX_PIX: '1',
        APP_ENV: 'staging',
        NEON_BRANCH_ID: 'br-weathered-forest-bccwn49d',
        API_URL:
          'https://br-weathered-forest-bccwn49d-sortexqa.compute.c-16.us-east-1.aws.neon.tech',
        PAYMENT_ENV: 'sandbox',
        FEATURE_REAL_PAYMENTS: 'false',
        FEATURE_PAYOUTS: 'false',
        MERCADO_PAGO_ACCESS_TOKEN: token,
        MERCADO_PAGO_VERIFIED_TEST_TOKEN_SHA256: createHash('sha256')
          .update(token)
          .digest('hex'),
        MERCADO_PAGO_WEBHOOK_SECRET_TEST: 'local-fixture',
        MERCADO_PAGO_WEBHOOK_SECRET: '',
        MERCADO_PAGO_WEBHOOK_SECRET_PRODUCTION: '',
      };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('recusa criação sem prova ou consentimento, antes de consultar a compra', async () => {
      await expect(
        service.createNativeSandboxPix(buyer, {
          ...data,
          acceptedTerms: false,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      delete process.env.MERCADO_PAGO_VERIFIED_TEST_TOKEN_SHA256;
      expect(service.nativeSandboxPixConfig()).toMatchObject({
        enabled: false,
      });
      await expect(
        service.createNativeSandboxPix(buyer, data),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(prisma.payment.findUnique).not.toHaveBeenCalled();
      expect(provider.createPixPayment).not.toHaveBeenCalled();
    });

    it('não adota pagamento já iniciado pelo checkout web', async () => {
      prisma.payment.findUnique.mockResolvedValue(payment());
      await expect(
        service.createNativeSandboxPix(buyer, data),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(provider.createPixPayment).not.toHaveBeenCalled();
    });

    it('revalida o token antes de chamar o provedor', async () => {
      (service as any).preparePayment = jest
        .fn()
        .mockImplementation(async () => {
          process.env.MERCADO_PAGO_ACCESS_TOKEN = 'different-fixture';
          return {
            payment: payment({
              providerPaymentId: null,
              metadata: { nativeSandboxPix: true },
            }),
            existing: false,
          };
        });
      await expect(
        service.createNativeSandboxPix(buyer, data),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(provider.createPixPayment).not.toHaveBeenCalled();
    });

    it('não registra resposta sem ticket de teste e não fornece QR ou código bancário', async () => {
      const attempt = payment({
        providerPaymentId: null,
        metadata: { nativeSandboxPix: true },
      });
      (service as any).preparePayment = jest
        .fn()
        .mockResolvedValue({ payment: attempt, existing: false });
      provider.createPixPayment.mockResolvedValueOnce(
        gatewayResult({
          boletoUrl: 'https://www.mercadopago.com.br/payments/12345/ticket',
        }),
      );
      await expect(
        service.createNativeSandboxPix(buyer, data),
      ).rejects.toBeInstanceOf(BadGatewayException);
      expect(prisma.payment.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            providerPaymentId: expect.anything(),
          }),
        }),
      );

      provider.createPixPayment.mockResolvedValueOnce(
        gatewayResult({
          boletoUrl:
            'https://www.mercadopago.com.br/sandbox/payments/12345/ticket',
          status: PaymentStatus.APPROVED,
        }),
      );
      prisma.payment.update.mockResolvedValue(
        payment({ status: PaymentStatus.PROCESSING }),
      );
      const result = await service.createNativeSandboxPix(buyer, data);
      expect(result).toMatchObject({
        purchaseId: data.purchaseId,
        environment: 'sandbox',
        status: PaymentStatus.PROCESSING,
      });
      for (const field of [
        'pixQrCode',
        'pixCopyPaste',
        'boletoUrl',
        'providerPaymentId',
      ])
        expect(result).not.toHaveProperty(field);
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: PaymentStatus.PROCESSING,
            pixQrCode: null,
            pixCopyPaste: null,
            boletoUrl: null,
            metadata: expect.objectContaining({ nativeSandboxPix: true }),
          }),
        }),
      );
    });

    it('consulta somente o estado persistido da tentativa nativa do comprador', async () => {
      prisma.payment.findFirst.mockResolvedValue(null);
      await expect(
        service.nativeSandboxPixStatus(data.purchaseId, buyer),
      ).resolves.toBeNull();
      expect(prisma.payment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            buyerId: buyer.id,
            purchaseId: data.purchaseId,
            metadata: { path: ['nativeSandboxPix'], equals: true },
          }),
        }),
      );
      expect(provider.getPaymentStatus).not.toHaveBeenCalled();
    });
  });

  it('cria cartão apenas com token seguro e sem persistir CVV', async () => {
    (service as any).preparePayment = jest.fn().mockResolvedValue({
      payment: payment({
        method: PaymentMethod.CREDIT_CARD,
        providerPaymentId: null,
      }),
      existing: false,
    });
    provider.createCardPayment.mockResolvedValue(
      gatewayResult({ method: PaymentMethod.CREDIT_CARD, cardBrand: 'master' }),
    );
    prisma.payment.update.mockResolvedValue(
      payment({ method: PaymentMethod.CREDIT_CARD, cardBrand: 'master' }),
    );
    await service.createCard(buyer, {
      purchaseId: 'purchase-1',
      acceptedTerms: true,
      cardToken: 'secure-token-123456',
      paymentMethodId: 'master',
      installments: 2,
    });
    expect(provider.createCardPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        cardToken: 'secure-token-123456',
        installments: 2,
      }),
    );
    expect(prisma.payment.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ cardToken: expect.anything() }),
      }),
    );
  });

  it('mantém aprovação imediata como PROCESSING até o webhook', async () => {
    (service as any).preparePayment = jest
      .fn()
      .mockResolvedValue({ payment: payment(), existing: false });
    provider.createPixPayment.mockResolvedValue(
      gatewayResult({ status: PaymentStatus.APPROVED }),
    );
    prisma.payment.update.mockResolvedValue(
      payment({ status: PaymentStatus.PROCESSING }),
    );
    await service.createPix(buyer, {
      purchaseId: 'purchase-1',
      acceptedTerms: true,
    });
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PaymentStatus.PROCESSING }),
      }),
    );
  });

  it('não cria um segundo pagamento quando já existe tentativa ativa', async () => {
    (service as any).preparePayment = jest
      .fn()
      .mockResolvedValue({ payment: payment(), existing: true });
    const result = await service.createPix(buyer, {
      purchaseId: 'purchase-1',
      acceptedTerms: true,
    });
    expect(provider.createPixPayment).not.toHaveBeenCalled();
    expect(result.id).toBe('payment-1');
  });

  it('repete a mesma tentativa idempotente quando houve timeout antes da resposta', async () => {
    (service as any).preparePayment = jest.fn().mockResolvedValue({
      payment: payment({ providerPaymentId: null }),
      existing: true,
    });
    provider.createPixPayment.mockResolvedValue(gatewayResult());
    prisma.payment.update.mockResolvedValue(payment());

    await service.createPix(buyer, {
      purchaseId: 'purchase-1',
      acceptedTerms: true,
    });

    expect(provider.createPixPayment).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: 'payment-1' }),
    );
  });

  it('mantém a trava e a mesma tentativa quando o provider fica indisponível', async () => {
    (service as any).preparePayment = jest.fn().mockResolvedValue({
      payment: payment({ providerPaymentId: null }),
      existing: false,
    });
    provider.createPixPayment.mockRejectedValue(new Error('timeout'));

    await expect(
      service.createPix(buyer, {
        purchaseId: 'purchase-1',
        acceptedTerms: true,
      }),
    ).rejects.toThrow('timeout');

    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
      data: { failureReason: 'timeout' },
    });
  });

  it('registra cartão rejeitado e libera a trava para nova tentativa', async () => {
    (service as any).preparePayment = jest
      .fn()
      .mockResolvedValue({ payment: payment(), existing: false });
    provider.createPixPayment.mockResolvedValue(
      gatewayResult({
        status: PaymentStatus.REJECTED,
        failureReason: 'rejected',
      }),
    );
    prisma.payment.update.mockResolvedValue(
      payment({ status: PaymentStatus.REJECTED }),
    );
    await service.createPix(buyer, {
      purchaseId: 'purchase-1',
      acceptedTerms: true,
    });
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ activePurchaseKey: null }),
      }),
    );
  });

  it('ignora webhook duplicado já processado', async () => {
    prisma.paymentEvent.findUnique.mockResolvedValue({
      id: 'event-1',
      processed: true,
    });
    provider.parseWebhookEvent.mockReturnValue({ providerEventId: 'event-1' });
    const result = await service.handleMercadoPagoWebhook({ body: {} });
    expect(result).toEqual({ received: true, duplicate: true });
    expect(provider.getPaymentStatus).not.toHaveBeenCalled();
  });

  it('confirma recebimento assinado de recurso não rastreado sem consultar provider', async () => {
    provider.parseWebhookEvent.mockReturnValue({
      providerEventId: 'event-simulator-1',
      eventType: 'order.updated',
      resourceId: '123456',
      payload: {
        data: {
          id: '123456',
          external_reference: 'sortex-00000000-0000-4000-8000-000000000000',
        },
      },
    });
    prisma.paymentEvent.findUnique.mockResolvedValue(null);
    prisma.paymentEvent.create.mockResolvedValue({
      id: 'event-simulator-1',
      processed: false,
    });
    prisma.payment.findFirst.mockResolvedValue(null);

    const result = await service.handleMercadoPagoWebhook({ body: {} });

    expect(result).toEqual({
      received: true,
      duplicate: false,
      ignored: true,
    });
    expect(provider.getPaymentStatus).not.toHaveBeenCalled();
    expect(prisma.payment.findUnique).not.toHaveBeenCalled();
    expect(prisma.paymentEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          processed: true,
          errorMessage: 'RESOURCE_NOT_TRACKED',
        }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'PAYMENT_WEBHOOK_IGNORED',
        }),
      }),
    );
  });

  it('consulta o provider pelo ID interno e atualiza o status pendente', async () => {
    prisma.payment.findFirst
      .mockResolvedValueOnce(payment())
      .mockResolvedValueOnce({
        ...payment(),
        campaign: { id: 'campaign-1', reservedNumbers: 2 },
      })
      .mockResolvedValueOnce(payment());
    prisma.paymentEvent.findUnique.mockResolvedValue(null);
    prisma.paymentEvent.create.mockResolvedValue({ id: 'poll-event-1' });
    prisma.payment.findUniqueOrThrow.mockResolvedValue(payment());
    provider.getPaymentStatus.mockResolvedValue(gatewayResult());

    const result = await service.refreshStatus('payment-1', buyer);

    expect(provider.getPaymentStatus).toHaveBeenCalledWith('order-1');
    expect(result.status).toBe(PaymentStatus.PENDING);
    expect(prisma.paymentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentId: 'payment-1',
          eventType: 'PAYMENT_STATUS_POLLED',
        }),
      }),
    );
  });

  it('confirma pagamento, compra e títulos em uma transação', async () => {
    prisma.payment.findFirst.mockResolvedValue({
      ...payment(),
      status: PaymentStatus.PROCESSING,
      campaign: { id: 'campaign-1', reservedNumbers: 2 },
    });
    prisma.ticket.updateMany.mockResolvedValue({ count: 2 });
    prisma.payment.findUniqueOrThrow.mockResolvedValue(
      payment({ status: PaymentStatus.APPROVED }),
    );
    const result = await (service as any).processGatewayUpdate(
      'event-1',
      gatewayResult({ status: PaymentStatus.APPROVED }),
    );
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PaymentStatus.APPROVED }),
      }),
    );
    expect(prisma.purchase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PurchaseStatus.PAID }),
      }),
    );
    expect(prisma.ticket.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: TicketStatus.SOLD, reservedUntil: null },
      }),
    );
    expect(result.status).toBe(PaymentStatus.APPROVED);
  });

  it.each([PaymentStatus.REFUNDED, PaymentStatus.CHARGEBACK])(
    'concilia %s integral após aprovação sem revender títulos',
    async (status) => {
      const approved = payment({
        status: PaymentStatus.APPROVED,
        purchase: { ...payment().purchase, status: PurchaseStatus.PAID },
        campaign: { id: 'campaign-1', reservedNumbers: 0 },
      });
      prisma.payment.findFirst
        .mockResolvedValueOnce(approved)
        .mockResolvedValue({ ...approved, status });
      prisma.payment.findUniqueOrThrow.mockResolvedValue({
        ...approved,
        status,
      });
      const result = await (service as any).processGatewayUpdate(
        'event-reversal',
        gatewayResult({ status }),
      );
      await (service as any).processGatewayUpdate(
        'event-reversal-duplicate',
        gatewayResult({ status }),
      );
      expect(result.status).toBe(status);
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status, activePurchaseKey: null }),
        }),
      );
      expect(ledger.recordReversal).toHaveBeenCalledTimes(1);
      expect(ledger.recordReversal).toHaveBeenCalledWith(
        prisma,
        approved.id,
        status,
      );
      expect(commissions.reversePayment).toHaveBeenCalledTimes(1);
      expect(prisma.ticket.updateMany).not.toHaveBeenCalled();
      expect(prisma.ticket.deleteMany).not.toHaveBeenCalled();
      expect(prisma.purchase.update).not.toHaveBeenCalled();
    },
  );

  it('não reaprova cobrança estornada após atualização tardia', async () => {
    const refunded = payment({
      status: PaymentStatus.REFUNDED,
      purchase: { ...payment().purchase, status: PurchaseStatus.PAID },
      campaign: { id: 'campaign-1', reservedNumbers: 0 },
    });
    prisma.payment.findFirst.mockResolvedValue(refunded);
    const result = await (service as any).processGatewayUpdate(
      'event-stale',
      gatewayResult({ status: PaymentStatus.APPROVED }),
    );
    expect(result.status).toBe(PaymentStatus.REFUNDED);
    expect(ledger.recordApprovedPayment).not.toHaveBeenCalled();
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(prisma.ticket.updateMany).not.toHaveBeenCalled();
  });

  it('não lança estorno sem liquidação anterior no ledger', async () => {
    prisma.payment.findFirst.mockResolvedValue(payment());
    await expect(
      (service as any).processGatewayUpdate(
        'event-unreconciled',
        gatewayResult({ status: PaymentStatus.REFUNDED }),
      ),
    ).rejects.toThrow('sem aprovação local');
    expect(ledger.recordReversal).not.toHaveBeenCalled();
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it('encaminha estorno parcial para conciliação sem débito integral', async () => {
    prisma.payment.findFirst.mockResolvedValue(
      payment({
        status: PaymentStatus.APPROVED,
        purchase: { ...payment().purchase, status: PurchaseStatus.PAID },
      }),
    );
    await expect(
      (service as any).processGatewayUpdate(
        'event-partial',
        gatewayResult({
          status: PaymentStatus.PROCESSING,
          reconciliationIssue: 'PARTIAL_REFUND',
        }),
      ),
    ).rejects.toThrow('Estorno parcial');
    expect(ledger.recordReversal).not.toHaveBeenCalled();
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });

  it('rejeita webhook com valor divergente antes de alterar títulos', async () => {
    prisma.payment.findFirst.mockResolvedValue({
      ...payment(),
      campaign: { id: 'campaign-1', reservedNumbers: 2 },
    });
    await expect(
      (service as any).processGatewayUpdate(
        'event-1',
        gatewayResult({ amount: '11.00', status: PaymentStatus.APPROVED }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.ticket.updateMany).not.toHaveBeenCalled();
  });

  it('rejeita webhook com externalReference inválida', async () => {
    prisma.payment.findFirst.mockResolvedValue(null);
    await expect(
      (service as any).processGatewayUpdate(
        'event-1',
        gatewayResult({ externalReference: 'invalid' }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('não confirma compra expirada', async () => {
    prisma.payment.findFirst.mockResolvedValue({
      ...payment(),
      purchase: { ...payment().purchase, status: PurchaseStatus.EXPIRED },
      campaign: { id: 'campaign-1', reservedNumbers: 2 },
    });
    await expect(
      (service as any).processGatewayUpdate(
        'event-1',
        gatewayResult({ status: PaymentStatus.APPROVED }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('processa expiração do provider sem vender títulos', async () => {
    prisma.payment.findFirst.mockResolvedValue({
      ...payment(),
      campaign: { id: 'campaign-1', reservedNumbers: 2 },
    });
    prisma.purchase.findUnique.mockResolvedValue({
      ...payment().purchase,
      campaign: { id: 'campaign-1', reservedNumbers: 2 },
    });
    prisma.ticket.deleteMany.mockResolvedValue({ count: 2 });
    prisma.payment.findUniqueOrThrow.mockResolvedValue(
      payment({ status: PaymentStatus.EXPIRED }),
    );
    await (service as any).processGatewayUpdate(
      'event-1',
      gatewayResult({ status: PaymentStatus.EXPIRED }),
    );
    expect(prisma.ticket.updateMany).not.toHaveBeenCalled();
    expect(prisma.ticket.deleteMany).toHaveBeenCalled();
    expect(prisma.purchase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PurchaseStatus.EXPIRED }),
      }),
    );
  });

  it('faz rollback lógico quando a quantidade de títulos diverge', async () => {
    prisma.payment.findFirst.mockResolvedValue({
      ...payment(),
      campaign: { id: 'campaign-1', reservedNumbers: 2 },
    });
    prisma.ticket.updateMany.mockResolvedValue({ count: 1 });
    await expect(
      (service as any).processGatewayUpdate(
        'event-1',
        gatewayResult({ status: PaymentStatus.APPROVED }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.purchase.update).not.toHaveBeenCalled();
  });

  it('protege acesso de outro comprador', async () => {
    prisma.payment.findFirst.mockResolvedValue(null);
    await expect(service.get('payment-1', buyer)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('sanitiza a resposta sem metadata nem payload do gateway', async () => {
    prisma.payment.findFirst.mockResolvedValue(payment());
    const result = await service.get('payment-1', buyer);
    expect(result).not.toHaveProperty('metadata');
    expect(result).not.toHaveProperty('externalReference');
    expect(result).not.toHaveProperty('activePurchaseKey');
  });

  it('bloqueia cancelamento de pagamento aprovado', async () => {
    prisma.payment.findFirst.mockResolvedValue(
      payment({ status: PaymentStatus.APPROVED }),
    );
    await expect(service.cancel('payment-1', buyer)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
