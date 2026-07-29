/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
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
    };
    service = new PaymentsService(
      prisma,
      { get: jest.fn().mockReturnValue(provider) } as any,
      { calculate: jest.fn() } as any,
      { detectForPurchase: jest.fn() } as any,
      { recordApprovedPayment: jest.fn() } as any,
      { recordApprovedPayment: jest.fn(), reversePayment: jest.fn() } as any,
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
