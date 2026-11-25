import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHmac, randomUUID } from 'node:crypto';
import { Order } from 'mercadopago';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const isolatedUrl = process.env.SORTEX_PAYMENTS_TEST_DATABASE_URL;
if (isolatedUrl) {
  const url = new URL(isolatedUrl);
  if (
    !['postgresql:', 'postgres:'].includes(url.protocol) ||
    url.hostname !== '127.0.0.1' ||
    !/^\/sortex_payments_test_[a-z0-9_]+$/.test(url.pathname) ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'Use um PostgreSQL descartável sortex_payments_test_* em 127.0.0.1.',
    );
  }
}
const isolated = isolatedUrl ? describe : describe.skip;

isolated('Pagamento HTTP + PostgreSQL (provedor não contatado)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const secret = randomUUID();
  const initialEnv = process.env;

  beforeAll(async () => {
    process.env = {
      ...initialEnv,
      DATABASE_URL: isolatedUrl!,
      APP_ENV: 'staging',
      PAYMENT_ENV: 'sandbox',
      MERCADO_PAGO_ACCESS_TOKEN: 'local-sdk-double-no-real-credential',
      MERCADO_PAGO_WEBHOOK_SECRET_TEST: secret,
      MERCADO_PAGO_WEBHOOK_SECRET: '',
      MERCADO_PAGO_WEBHOOK_SECRET_PRODUCTION: '',
      INTEGRATIONS_MODE: 'sandbox',
      EMAIL_DELIVERY_MODE: 'disabled',
      UPLOADS_DISABLED: 'true',
    };
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    try {
      await app?.close();
    } finally {
      process.env = initialEnv;
    }
  });

  it('liquida cotas uma vez e registra apenas um estorno integral no extrato', async () => {
    const run = randomUUID();
    const externalReference = `pay-${run}`;
    const providerPaymentId = `ord-${run}`;
    const [organizer, buyer] = await Promise.all([
      prisma.user.create({
        data: {
          name: 'Organizador Sintético',
          email: `organizer-${run}@example.test`,
          password: 'unusable-fixture-hash',
          role: 'ORGANIZER',
        },
      }),
      prisma.user.create({
        data: {
          name: 'Comprador Sintético',
          email: `buyer-${run}@example.test`,
          password: 'unusable-fixture-hash',
          role: 'BUYER',
        },
      }),
    ]);
    const campaign = await prisma.campaign.create({
      data: {
        title: 'Campanha sintética',
        slug: run,
        organizerId: organizer.id,
        totalNumbers: 10,
        numberPrice: 5,
        reservedNumbers: 2,
      },
    });
    const expiresAt = new Date(Date.now() + 1_800_000);
    const purchase = await prisma.purchase.create({
      data: {
        campaignId: campaign.id,
        buyerId: buyer.id,
        selectionMode: 'MANUAL',
        quantity: 2,
        unitPrice: 5,
        subtotal: 10,
        total: 10,
        expiresAt,
        status: 'AWAITING_PAYMENT',
      },
    });
    await prisma.ticket.createMany({
      data: [1, 2].map((number) => ({
        number,
        purchaseId: purchase.id,
        buyerId: buyer.id,
        campaignId: campaign.id,
        reservedUntil: expiresAt,
      })),
    });
    const payment = await prisma.payment.create({
      data: {
        purchaseId: purchase.id,
        buyerId: buyer.id,
        campaignId: campaign.id,
        organizerId: organizer.id,
        provider: 'MERCADO_PAGO',
        providerPaymentId,
        externalReference,
        activePurchaseKey: purchase.id,
        method: 'PIX',
        status: 'PENDING',
        amount: 10,
        platformFee: 0.29,
        gatewayFee: 0.1,
        netAmount: 9.61,
        expiresAt,
      },
    });

    let status = 'processed';
    let detail = 'accredited';
    const order = jest
      .spyOn(Order.prototype, 'get')
      .mockImplementation(async () => ({
        id: providerPaymentId,
        external_reference: externalReference,
        total_amount: '10.00',
        status,
        status_detail: detail,
      }));
    function webhook(eventId: string) {
      const id = `${eventId}-${run}`;
      const ts = String(Math.floor(Date.now() / 1000));
      const requestId = randomUUID();
      const signature = createHmac('sha256', secret)
        .update(`id:${providerPaymentId};request-id:${requestId};ts:${ts};`)
        .digest('hex');
      return request(app.getHttpServer())
        .post('/webhooks/payments/mercado-pago')
        .query({ 'data.id': providerPaymentId })
        .set('x-signature', `ts=${ts},v1=${signature}`)
        .set('x-request-id', requestId)
        .send({ id, action: 'order.updated', data: { id: providerPaymentId } });
    }

    await webhook('approved')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ status: 'APPROVED' });
      });
    await webhook('approved')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ duplicate: true });
      });
    expect(order).toHaveBeenCalledTimes(1);
    await expect(
      prisma.ledgerEntry.count({
        where: {
          paymentId: payment.id,
          reference: `payment:${payment.id}:refund`,
        },
      }),
    ).resolves.toBe(0);

    detail = 'partially_refunded';
    await webhook('partial').expect(409);
    const partial = await prisma.paymentEvent.findUniqueOrThrow({
      where: {
        provider_providerEventId: {
          provider: 'MERCADO_PAGO',
          providerEventId: `partial-${run}`,
        },
      },
    });
    expect(partial).toMatchObject({ processed: false });
    expect(partial.errorMessage).toMatch(/Estorno parcial/);

    status = 'refunded';
    detail = 'refunded';
    await webhook('full')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ status: 'REFUNDED' });
      });
    await webhook('full-redelivery-with-new-id').expect(200);
    status = 'processed';
    detail = 'accredited';
    await webhook('late-approval')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ status: 'REFUNDED' });
      });

    const snapshot = await prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
      include: {
        campaign: true,
        purchase: { include: { tickets: true } },
        ledgerEntries: true,
      },
    });
    expect(snapshot.status).toBe('REFUNDED');
    expect(snapshot.refundedAt).toBeInstanceOf(Date);
    expect(snapshot.purchase.status).toBe('PAID');
    expect(
      snapshot.purchase.tickets
        .map(({ number, status }) => ({ number, status }))
        .sort((a, b) => a.number - b.number),
    ).toEqual([
      { number: 1, status: 'SOLD' },
      { number: 2, status: 'SOLD' },
    ]);
    expect(snapshot.campaign).toMatchObject({
      soldNumbers: 2,
      reservedNumbers: 0,
    });
    expect(snapshot.campaign.grossRevenue.toString()).toBe('10');
    const refunds = snapshot.ledgerEntries.filter(
      (entry) => entry.type === 'REFUND',
    );
    expect(refunds).toHaveLength(1);
    expect(refunds[0].amount.toFixed(2)).toBe('9.61');
    const account = await prisma.financialAccount.findUniqueOrThrow({
      where: {
        ownerType_ownerId_currency: {
          ownerType: 'ORGANIZER',
          ownerId: organizer.id,
          currency: 'BRL',
        },
      },
    });
    expect(account.pendingBalance.toString()).toBe('0');
    expect(account.availableBalance.toString()).toBe('0');
  });
});
