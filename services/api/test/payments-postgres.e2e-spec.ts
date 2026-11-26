import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { Order } from 'mercadopago';
import { hash } from 'bcrypt';
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
  let buyers: { id: string; token: string }[];
  const secret = randomUUID();
  const initialEnv = process.env;

  async function login(email: string, password: string) {
    const result = await request(app.getHttpServer() as Server)
      .post('/auth/login')
      .send({ email, password })
      .expect(201)
      .expect('RateLimit-Limit', /^[1-9]\d*$/);
    return (result.body as { accessToken: string }).accessToken;
  }

  async function organizerFixture(email: string, password?: string) {
    return prisma.user.create({
      data: {
        name: 'Organizador sintético',
        email,
        password: password ? await hash(password, 4) : 'unusable-fixture-hash',
        role: 'ORGANIZER',
      },
    });
  }

  beforeAll(async () => {
    process.env = {
      ...initialEnv,
      DATABASE_URL: isolatedUrl!,
      APP_ENV: 'staging',
      PAYMENT_ENV: 'sandbox',
      MERCADO_PAGO_ACCESS_TOKEN: 'local-sdk-double-no-real-credential',
      MERCADO_PAGO_WEBHOOK_SECRET_TEST: secret,
      MERCADO_PAGO_ESTIMATED_FEE_PERCENT: '1.25',
      FINANCE_PIX_AVAILABLE_DAYS: '1',
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
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    prisma = app.get(PrismaService);
    // Keep one loopback listener for overlapping Supertest requests.
    await app.listen(0, '127.0.0.1');
    // Reuse real buyer sessions rather than consuming the shared loopback
    // login budget in every case. Each case still owns its own campaign data;
    // the competition test needs three distinct buyers on that one campaign.
    const run = randomUUID();
    const password = `synthetic-buyers-${run}`;
    const passwordHash = await hash(password, 4);
    buyers = await Promise.all(
      [0, 1, 2].map(async (index) => {
        const buyer = await prisma.user.create({
          data: {
            name: 'Comprador sintético',
            email: `payment-fixture-${run}-${index}@example.test`,
            password: passwordHash,
            role: 'BUYER',
          },
        });
        return { id: buyer.id, token: await login(buyer.email, password) };
      }),
    );
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    try {
      await app?.close();
    } finally {
      try {
        // Nest does not disconnect this Prisma service on app.close().
        await prisma?.$disconnect();
      } finally {
        process.env = initialEnv;
      }
    }
  });

  it.each([
    {
      label: 'isenta somente a taxa SorteX na primeira campanha criada',
      olderDraft: false,
      platformFee: 0,
      netAmount: 30.12,
      rule: 'FIRST_CAMPAIGN_FREE',
    },
    {
      label:
        'mantém a taxa na primeira publicação após um rascunho mais antigo',
      olderDraft: true,
      platformFee: 0.88,
      netAmount: 29.24,
      rule: 'PLAN_RATE',
    },
  ])('$label', async ({ olderDraft, platformFee, netAmount, rule }) => {
    const server = app.getHttpServer() as Server;
    const run = randomUUID();
    const password = `synthetic-fee-${run}`;
    const organizer = await organizerFixture(
      `fee-organizer-${run}@example.test`,
      password,
    );
    const [{ token: buyerToken }] = buyers;
    await prisma.organizerProfile.create({
      data: {
        userId: organizer.id,
        fullName: 'Organizador sintético',
        cpf: '00000000000',
        phone: '00000000000',
        verificationStatus: 'VERIFIED',
        currentPlan: 'BASIC',
        firstCampaignFree: true,
        platformFee: 2.9,
      },
    });
    const now = Date.now();
    // Characterization only: an older unpublished draft currently counts.
    // This does not settle which campaign the business should waive.
    if (olderDraft) {
      await prisma.campaign.create({
        data: {
          title: 'Rascunho anterior sintético',
          slug: `fee-draft-${run}`,
          organizerId: organizer.id,
          status: 'DRAFT',
          publishedAt: null,
          createdAt: new Date(now - 120_000),
        },
      });
    }
    const campaign = await prisma.campaign.create({
      data: {
        title: 'Primeira publicação sintética',
        slug: `fee-published-${run}`,
        organizerId: organizer.id,
        totalNumbers: 10,
        numberPrice: 30.5,
        numberSelectionMode: 'MANUAL',
        status: 'PUBLISHED',
        createdAt: new Date(now - 60_000),
        publishedAt: new Date(now),
      },
    });
    const organizerToken = await login(organizer.email, password);
    const reserve = await request(server)
      .post('/purchases/reserve-manual')
      .auth(buyerToken, { type: 'bearer' })
      .send({
        campaignId: campaign.id,
        numbers: [1],
        idempotencyKey: randomUUID(),
      })
      .expect(201);
    const { id: purchaseId } = reserve.body as { id: string };
    const orderId = `fee-${run}`;
    const create = jest
      .spyOn(Order.prototype, 'create')
      .mockImplementation(({ body }) =>
        Promise.resolve({
          id: orderId,
          external_reference: body.external_reference,
          total_amount: body.total_amount,
          status: 'action_required',
          status_detail: 'waiting_transfer',
        }),
      );
    const get = jest
      .spyOn(Order.prototype, 'get')
      .mockRejectedValue(new Error('Consulta externa bloqueada no teste.'));
    try {
      const pix = await request(server)
        .post('/payments/pix')
        .auth(buyerToken, { type: 'bearer' })
        .send({ purchaseId, acceptedTerms: true })
        .expect(201);
      expect(pix.body).toMatchObject({
        status: 'PENDING',
        amount: 30.5,
        platformFee,
        gatewayFee: 0.38,
        netAmount,
      });
      expect(create).toHaveBeenCalledTimes(1);
      const payment = await prisma.payment.findUniqueOrThrow({
        where: { id: (pix.body as { id: string }).id },
      });
      expect(payment.metadata).toMatchObject({
        firstCampaignFreeApplied: !olderDraft,
        platformFeeRule: rule,
      });
      expect(payment.gatewayFeeRate.toFixed(2)).toBe('1.25');
      expect(
        await prisma.ledgerEntry.count({ where: { paymentId: payment.id } }),
      ).toBe(0);

      get.mockResolvedValueOnce({
        id: orderId,
        external_reference: payment.externalReference,
        total_amount: '30.50',
        status: 'processed',
        status_detail: 'accredited',
      });
      const notify = () => {
        const ts = String(Math.floor(Date.now() / 1000));
        const requestId = randomUUID();
        const digest = createHmac('sha256', secret)
          .update(`id:${orderId};request-id:${requestId};ts:${ts};`)
          .digest('hex');
        return request(server)
          .post('/webhooks/payments/mercado-pago')
          .query({ 'data.id': orderId })
          .set('x-signature', `ts=${ts},v1=${digest}`)
          .set('x-request-id', requestId)
          .send({
            id: `fee-approved-${run}`,
            action: 'order.processed',
            data: { id: orderId },
          });
      };
      await notify().expect(200, {
        received: true,
        duplicate: false,
        status: 'APPROVED',
      });
      await notify().expect(200, { received: true, duplicate: true });
      expect(get).toHaveBeenCalledTimes(1);

      const entries = await prisma.ledgerEntry.findMany({
        where: { paymentId: payment.id },
      });
      expect(
        entries
          .map(({ type, amount }) => [type, amount.toFixed(2)])
          .sort(([a], [b]) => a.localeCompare(b)),
      ).toEqual([
        ['GATEWAY_FEE', '0.38'],
        ['GROSS_SALE', '30.50'],
        ['ORGANIZER_NET_REVENUE', netAmount.toFixed(2)],
        ['PLATFORM_FEE', platformFee.toFixed(2)],
        ['PLATFORM_REVENUE', platformFee.toFixed(2)],
      ]);
      const credit = entries.find(
        (entry) => entry.type === 'ORGANIZER_NET_REVENUE',
      );
      expect(credit).toMatchObject({ direction: 'CREDIT', status: 'PENDING' });
      const approved = await prisma.payment.findUniqueOrThrow({
        where: { id: payment.id },
      });
      expect(credit?.availableAt?.getTime()).toBe(
        approved.approvedAt!.getTime() + 86_400_000,
      );
      const balance = await request(server)
        .get('/finance/balance')
        .auth(organizerToken, { type: 'bearer' })
        .expect(200);
      expect(balance.body).toMatchObject({
        gross: 30.5,
        net: netAmount,
        pending: netAmount,
        available: 0,
        platformFees: platformFee,
        gatewayFees: 0.38,
        totalRequested: 0,
      });
    } finally {
      create.mockRestore();
      get.mockRestore();
    }
  });

  it('só libera a reserva após cancelamento confirmado e preserva a outra reserva em callbacks tardios', async () => {
    const run = randomUUID();
    const server = app.getHttpServer() as Server;
    const owner = await organizerFixture(
      `cancel-organizer-${run}@example.test`,
    );
    const [{ token }, { token: secondToken }] = buyers;
    await prisma.organizerProfile.create({
      data: {
        userId: owner.id,
        fullName: 'Responsável sintético',
        cpf: '00000000000',
        phone: '00000000000',
        verificationStatus: 'VERIFIED',
      },
    });
    const campaign = await prisma.campaign.create({
      data: {
        title: 'Campanha sintética de cancelamento',
        slug: `cancel-${run}`,
        organizerId: owner.id,
        totalNumbers: 10,
        numberPrice: 5,
        numberSelectionMode: 'MANUAL',
        status: 'PUBLISHED',
      },
    });
    const reserve = (auth: string) =>
      request(server)
        .post('/purchases/reserve-manual')
        .auth(auth, { type: 'bearer' })
        .send({
          campaignId: campaign.id,
          numbers: [2],
          idempotencyKey: randomUUID(),
        });
    const reservation = await reserve(token).expect(201);
    const purchaseId = (reservation.body as { id: string }).id;
    const orderId = `ord-cancel-${run}`;
    const order = {
      id: orderId,
      total_amount: '5.00',
      status: 'action_required',
      status_detail: 'waiting_transfer',
    };
    const create = jest
      .spyOn(Order.prototype, 'create')
      .mockImplementation(async ({ body }) => {
        // A second action can arrive while the buyer's first checkout still
        // waits for the order ID. No cancellation has been confirmed yet.
        const inFlight = await request(server)
          .get(`/payments/purchase/${purchaseId}`)
          .auth(token, { type: 'bearer' })
          .expect(200);
        const inFlightId = (inFlight.body as { id: string }).id;
        await request(server)
          .post(`/payments/${inFlightId}/cancel`)
          .auth(token, { type: 'bearer' })
          .expect(409);
        return { ...order, external_reference: body.external_reference };
      });
    const gatewayCancel = jest
      .spyOn(Order.prototype, 'cancel')
      .mockRejectedValue(new Error('Cancelamento externo bloqueado no teste.'));
    const get = jest
      .spyOn(Order.prototype, 'get')
      .mockRejectedValue(new Error('Consulta externa bloqueada no teste.'));
    try {
      const checkout = await request(server)
        .post('/payments/pix')
        .auth(token, { type: 'bearer' })
        .send({ purchaseId, acceptedTerms: true })
        .expect(201);
      const paymentId = (checkout.body as { id: string }).id;
      const payment = await prisma.payment.findUniqueOrThrow({
        where: { id: paymentId },
      });
      const gatewayOrder = {
        ...order,
        external_reference: payment.externalReference,
      };
      const cancel = () =>
        request(server)
          .post(`/payments/${paymentId}/cancel`)
          .auth(token, { type: 'bearer' });
      const notify = (event: string, valid = true) => {
        const ts = String(Math.floor(Date.now() / 1000));
        const requestId = randomUUID();
        const digest = createHmac(
          'sha256',
          valid ? secret : 'invalid-test-secret',
        )
          .update(`id:${orderId};request-id:${requestId};ts:${ts};`)
          .digest('hex');
        return request(server)
          .post('/webhooks/payments/mercado-pago')
          .query({ 'data.id': orderId })
          .set('x-request-id', requestId)
          .set('x-signature', `ts=${ts},v1=${digest}`)
          .send({
            id: `cancel-${run}-${event}`,
            action: 'order.updated',
            data: { id: orderId },
          });
      };

      gatewayCancel.mockResolvedValueOnce(gatewayOrder);
      await cancel().expect(409);
      await reserve(secondToken).expect(409);
      expect(
        await prisma.payment.findUnique({ where: { id: paymentId } }),
      ).toMatchObject({ status: 'PENDING', activePurchaseKey: purchaseId });

      gatewayCancel.mockResolvedValueOnce({
        ...gatewayOrder,
        status: 'canceled',
        status_detail: 'canceled_by_api',
      });
      const cancelled = await cancel().expect(201);
      expect(cancelled.body).toMatchObject({
        status: 'CANCELLED',
        purchase: { status: 'CANCELLED' },
      });
      await cancel().expect(201, cancelled.body);
      const reused = await reserve(secondToken).expect(201);
      const newPurchase = (reused.body as { id: string }).id;

      await notify('stale', false).expect(401);
      expect(get).not.toHaveBeenCalled();
      expect(
        await prisma.paymentEvent.count({
          where: { providerEventId: `cancel-${run}-stale` },
        }),
      ).toBe(0);
      get.mockResolvedValueOnce(gatewayOrder);
      await notify('stale').expect(200, {
        received: true,
        duplicate: false,
        status: 'CANCELLED',
      });
      await notify('stale').expect(200, { received: true, duplicate: true });

      get.mockResolvedValueOnce({
        ...gatewayOrder,
        total_amount: '5.01',
        status: 'processed',
        status_detail: 'accredited',
      });
      await notify('wrong-value')
        .expect(409)
        .expect(({ body }) =>
          expect(body).toMatchObject({
            message: 'Valor do webhook divergente.',
          }),
        );
      get.mockResolvedValueOnce({
        ...gatewayOrder,
        status: 'processed',
        status_detail: 'accredited',
      });
      await notify('late-approval').expect(409);
      expect(
        await prisma.payment.findUnique({ where: { id: paymentId } }),
      ).toMatchObject({
        status: 'CANCELLED',
        activePurchaseKey: null,
      });
      expect(
        await prisma.ticket.findMany({
          where: { campaignId: campaign.id },
          select: { number: true, status: true, purchaseId: true },
        }),
      ).toEqual([{ number: 2, status: 'RESERVED', purchaseId: newPurchase }]);
      expect(await prisma.ledgerEntry.count({ where: { paymentId } })).toBe(0);
      expect(gatewayCancel).toHaveBeenCalledTimes(2);
      expect(get).toHaveBeenCalledTimes(3);
    } finally {
      create.mockRestore();
      gatewayCancel.mockRestore();
      get.mockRestore();
    }
  });

  it.each(['approval', 'expiry', 'cancellation'] as const)(
    'reconcilia cancelamento, expiração e aprovação concorrentes: %s vence',
    async (winner) => {
      const run = randomUUID();
      const server = app.getHttpServer() as Server;
      const owner = await organizerFixture(
        `race-organizer-${run}@example.test`,
      );
      const [buyer, competitor] = buyers;
      const { token } = buyer;
      const { token: competitorToken } = competitor;
      await prisma.organizerProfile.create({
        data: {
          userId: owner.id,
          fullName: 'Organizador sintético',
          cpf: '00000000000',
          phone: '00000000000',
          verificationStatus: 'VERIFIED',
        },
      });
      const campaign = await prisma.campaign.create({
        data: {
          title: 'Campanha sintética de concorrência',
          slug: `race-${run}`,
          organizerId: owner.id,
          numberPrice: 5,
          totalNumbers: 10,
          numberSelectionMode: 'MANUAL',
          status: 'PUBLISHED',
        },
      });
      const reserve = (auth: string) =>
        request(server)
          .post('/purchases/reserve-manual')
          .auth(auth, { type: 'bearer' })
          .send({
            campaignId: campaign.id,
            numbers: [2],
            idempotencyKey: randomUUID(),
          });
      const reservation = await reserve(token).expect(201);
      const purchaseId = (reservation.body as { id: string }).id;
      const orderId = `ord-race-${run}`;
      const providerOrder = {
        id: orderId,
        total_amount: '5.00',
        status: 'action_required',
        status_detail: 'waiting_transfer',
      };
      const create = jest
        .spyOn(Order.prototype, 'create')
        .mockImplementation(({ body }) =>
          Promise.resolve({
            ...providerOrder,
            external_reference: body.external_reference,
          }),
        );
      const cancel = jest
        .spyOn(Order.prototype, 'cancel')
        .mockRejectedValue(
          new Error('Cancelamento externo bloqueado no teste.'),
        );
      const get = jest
        .spyOn(Order.prototype, 'get')
        .mockRejectedValue(new Error('Consulta externa bloqueada no teste.'));
      const gate = () => {
        let open!: () => void;
        const promise = new Promise<void>((resolve) => {
          open = resolve;
        });
        return { promise, resolve: open };
      };
      const cancellationStarted = gate();
      const releaseCancellation = gate();
      const firstApprovalStarted = gate();
      const secondApprovalStarted = gate();
      const releaseApprovals = gate();
      const inFlight: Promise<unknown>[] = [];
      const awaitAdapter = (
        started: Promise<void>,
        response: Promise<{ status: number }>,
      ) =>
        Promise.race([
          started,
          response.then(({ status }) => {
            throw new Error(`HTTP ${status} antes de entrar no adaptador.`);
          }),
        ]);

      try {
        const checkout = await request(server)
          .post('/payments/pix')
          .auth(token, { type: 'bearer' })
          .send({ purchaseId, acceptedTerms: true })
          .expect(201);
        const paymentId = (checkout.body as { id: string }).id;
        const payment = await prisma.payment.findUniqueOrThrow({
          where: { id: paymentId },
        });
        const pendingOrder = {
          ...providerOrder,
          external_reference: payment.externalReference,
        };
        const approvedOrder = {
          ...pendingOrder,
          status: 'processed',
          status_detail: 'accredited',
        };
        const notify = (event: string) => {
          const ts = String(Math.floor(Date.now() / 1000));
          const requestId = randomUUID();
          const digest = createHmac('sha256', secret)
            .update(`id:${orderId};request-id:${requestId};ts:${ts};`)
            .digest('hex');
          return request(server)
            .post('/webhooks/payments/mercado-pago')
            .query({ 'data.id': orderId })
            .set('x-request-id', requestId)
            .set('x-signature', `ts=${ts},v1=${digest}`)
            .send({
              id: `race-${run}-${event}`,
              action: 'order.updated',
              data: { id: orderId },
            })
            .timeout(5_000);
        };
        cancel.mockImplementationOnce(async () => {
          cancellationStarted.resolve();
          await releaseCancellation.promise;
          return {
            ...pendingOrder,
            status: 'canceled',
            status_detail: 'canceled_by_api',
          };
        });
        const cancelling = request(server)
          .post(`/payments/${paymentId}/cancel`)
          .auth(token, { type: 'bearer' })
          .timeout(5_000)
          .then((response) => response);
        inFlight.push(cancelling);
        await awaitAdapter(cancellationStarted.promise, cancelling);

        // Force local expiration during in-flight cancellation, without sleeps.
        // An externally pending order must hold the quota despite the local clock.
        const past = new Date(Date.now() - 30_000);
        await prisma.$transaction([
          prisma.purchase.update({
            where: { id: purchaseId },
            data: { expiresAt: past },
          }),
          prisma.ticket.updateMany({
            where: { purchaseId },
            data: { reservedUntil: past },
          }),
          prisma.payment.update({
            where: { id: paymentId },
            data: { expiresAt: past },
          }),
        ]);
        await request(server)
          .get(`/public/campaigns/${campaign.slug}/availability`)
          .expect(200)
          .expect(({ body }) =>
            expect(body).toMatchObject({ reservedNumbers: 1, soldNumbers: 0 }),
          );
        await reserve(competitorToken).expect(409);

        get.mockImplementationOnce(async () => {
          firstApprovalStarted.resolve();
          await releaseApprovals.promise;
          return approvedOrder;
        });
        const first = notify('approval').then((response) => response);
        inFlight.push(first);
        await awaitAdapter(firstApprovalStarted.promise, first);
        let successorId: string | undefined;
        if (winner === 'approval') {
          // Same provider event ID, separate signed HTTP deliveries. Both reach
          // the adapter before either reconciliation begins.
          get.mockImplementationOnce(async () => {
            secondApprovalStarted.resolve();
            await releaseApprovals.promise;
            return approvedOrder;
          });
          const duplicate = notify('approval').then((response) => response);
          inFlight.push(duplicate);
          await awaitAdapter(secondApprovalStarted.promise, duplicate);
          releaseApprovals.resolve();
          const batch = await Promise.all([first, duplicate]);
          expect(batch.map(({ status }) => status)).toEqual([200, 200]);
          expect(
            batch
              .map(({ body }) => (body as { duplicate: boolean }).duplicate)
              .sort(),
          ).toEqual([false, true]);
          await notify('approval').expect(200, {
            received: true,
            duplicate: true,
          });
          await reserve(competitorToken).expect(409);
        } else {
          // A terminal update arrives while the older approval lookup is
          // still in flight; a different buyer can then reserve the quota.
          if (winner === 'expiry') {
            get.mockResolvedValueOnce({
              ...pendingOrder,
              status: 'expired',
              status_detail: 'expired',
            });
            await notify('expiry').expect(200, {
              received: true,
              duplicate: false,
              status: 'EXPIRED',
            });
          } else {
            releaseCancellation.resolve();
            const cancelled = await cancelling;
            expect(cancelled.status).toBe(201);
            expect(cancelled.body).toMatchObject({
              status: 'CANCELLED',
              purchase: { status: 'CANCELLED' },
            });
          }
          const successor = await reserve(competitorToken).expect(201);
          successorId = (successor.body as { id: string }).id;
          releaseApprovals.resolve();
          expect((await first).status).toBe(409);
          get.mockResolvedValueOnce(approvedOrder);
          await notify('approval').expect(409);
          if (winner === 'expiry') {
            await notify('expiry').expect(200, {
              received: true,
              duplicate: true,
            });
          }
        }
        if (winner !== 'cancellation') {
          releaseCancellation.resolve();
          expect((await cancelling).status).toBe(409);
        }

        expect(cancel).toHaveBeenCalledTimes(1);
        expect(get).toHaveBeenCalledTimes(winner === 'expiry' ? 3 : 2);
        const snapshot = await prisma.payment.findUniqueOrThrow({
          where: { id: paymentId },
          include: { purchase: true, campaign: true, ledgerEntries: true },
        });
        const tickets = await prisma.ticket.findMany({
          where: { campaignId: campaign.id },
          select: {
            number: true,
            buyerId: true,
            status: true,
            purchaseId: true,
          },
        });
        const credits = snapshot.ledgerEntries.filter(
          (entry) => entry.type === 'ORGANIZER_NET_REVENUE',
        );
        const events = await prisma.paymentEvent.findMany({
          where: { providerEventId: { startsWith: `race-${run}-` } },
          select: {
            processed: true,
            providerEventId: true,
            errorMessage: true,
          },
        });
        if (winner === 'approval') {
          expect(snapshot).toMatchObject({
            status: 'APPROVED',
            purchase: { status: 'PAID' },
            campaign: { reservedNumbers: 0, soldNumbers: 1 },
          });
          expect(snapshot.campaign.grossRevenue.toFixed(2)).toBe('5.00');
          expect(tickets).toEqual([
            {
              number: 2,
              status: 'SOLD',
              buyerId: buyer.id,
              purchaseId,
            },
          ]);
          expect(credits).toHaveLength(1);
          expect(credits[0].amount.toFixed(2)).toBe(
            snapshot.netAmount.toFixed(2),
          );
          expect(events).toEqual([
            {
              providerEventId: `race-${run}-approval`,
              processed: true,
              errorMessage: null,
            },
          ]);
        } else {
          const terminal = winner === 'expiry' ? 'EXPIRED' : 'CANCELLED';
          expect(snapshot).toMatchObject({
            status: terminal,
            activePurchaseKey: null,
            purchase: { status: terminal },
            campaign: { reservedNumbers: 1, soldNumbers: 0 },
          });
          expect(snapshot.campaign.grossRevenue.toFixed(2)).toBe('0.00');
          expect(tickets).toEqual([
            {
              number: 2,
              status: 'RESERVED',
              buyerId: competitor.id,
              purchaseId: successorId,
            },
          ]);
          expect(snapshot.ledgerEntries).toHaveLength(0);
          const late = events.find(
            (event) => event.providerEventId === `race-${run}-approval`,
          );
          expect(late?.processed).toBe(false);
          expect(late?.errorMessage).toContain('requer análise manual');
          if (winner === 'expiry') {
            expect(events).toContainEqual({
              providerEventId: `race-${run}-expiry`,
              processed: true,
              errorMessage: null,
            });
          }
          expect(events).toHaveLength(winner === 'expiry' ? 2 : 1);
        }
      } finally {
        releaseApprovals.resolve();
        releaseCancellation.resolve();
        await Promise.allSettled(inFlight);
        create.mockRestore();
        cancel.mockRestore();
        get.mockRestore();
      }
    },
    15_000,
  );

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
  it('bloqueia Pix nativo sem prova e reutiliza a tentativa verificada do mesmo pedido', async () => {
    const run = randomUUID();
    const organizer = await organizerFixture(
      `native-organizer-${run}@example.test`,
    );
    const [buyer, { token: secondToken }] = buyers;
    const { token } = buyer;
    const campaign = await prisma.campaign.create({
      data: {
        title: 'Campanha de teste',
        slug: `native-${run}`,
        organizerId: organizer.id,
        totalNumbers: 10,
        numberPrice: 5,
        reservedNumbers: 1,
      },
    });
    const expiresAt = new Date(Date.now() + 1_800_000);
    const purchase = await prisma.purchase.create({
      data: {
        campaignId: campaign.id,
        buyerId: buyer.id,
        selectionMode: 'MANUAL',
        quantity: 1,
        unitPrice: 5,
        subtotal: 5,
        total: 5,
        expiresAt,
        status: 'AWAITING_PAYMENT',
      },
    });
    await prisma.ticket.create({
      data: {
        number: 2,
        purchaseId: purchase.id,
        buyerId: buyer.id,
        campaignId: campaign.id,
        reservedUntil: expiresAt,
      },
    });
    const providerPaymentId = `native-${run}`;
    const eventId = `native-approved-${run}`;
    function notice(externalReference: string) {
      const ts = String(Math.floor(Date.now() / 1000));
      const requestId = randomUUID();
      const signature = createHmac('sha256', secret)
        .update(`id:${providerPaymentId};request-id:${requestId};ts:${ts};`)
        .digest('hex');
      return request(app.getHttpServer())
        .post('/webhooks/payments/mercado-pago')
        .query({ 'data.id': providerPaymentId })
        .set('x-request-id', requestId)
        .set('x-signature', `ts=${ts},v1=${signature}`)
        .send({
          id: eventId,
          action: 'order.processed',
          data: {
            id: providerPaymentId,
            external_reference: externalReference,
          },
        });
    }
    const lookup = jest.spyOn(Order.prototype, 'get');
    const sdk = jest
      .spyOn(Order.prototype, 'create')
      .mockImplementation(async ({ body }) => {
        if (!body.external_reference)
          throw new Error('Fixture sem referência.');
        const lookupCount = lookup.mock.calls.length;
        // The callback arrives while create() is still waiting for the SDK
        // response, before providerPaymentId is persisted.
        await notice(body.external_reference).expect(503);
        expect(lookup).toHaveBeenCalledTimes(lookupCount);
        const early = await prisma.paymentEvent.findUniqueOrThrow({
          where: {
            provider_providerEventId: {
              provider: 'MERCADO_PAGO',
              providerEventId: eventId,
            },
          },
        });
        expect(early).toMatchObject({
          processed: false,
          paymentId: null,
          errorMessage: 'ORDER_LINK_PENDING',
        });
        return {
          id: providerPaymentId,
          external_reference: body.external_reference,
          total_amount: body.total_amount,
          status: 'action_required',
          status_detail: 'waiting_transfer',
          transactions: {
            payments: [
              {
                payment_method: {
                  type: 'bank_transfer',
                  ticket_url:
                    'https://www.mercadopago.com.br/sandbox/payments/1234/ticket',
                  qr_code: 'synthetic-must-not-be-exposed',
                },
              },
            ],
          },
        };
      });
    const nativeUrl = '/payments/native-sandbox-pix';
    const send = () =>
      request(app.getHttpServer())
        .post(nativeUrl)
        .auth(token, { type: 'bearer' })
        .send({ purchaseId: purchase.id, acceptedTerms: true });
    const env = { ...process.env };
    try {
      process.env.ENABLE_NATIVE_SANDBOX_PIX = '1';
      process.env.NEON_BRANCH_ID = 'br-weathered-forest-bccwn49d';
      process.env.API_URL =
        'https://br-weathered-forest-bccwn49d-sortexqa.compute.c-16.us-east-1.aws.neon.tech';
      process.env.FEATURE_REAL_PAYMENTS = 'false';
      process.env.FEATURE_PAYOUTS = 'false';
      delete process.env.MERCADO_PAGO_VERIFIED_TEST_TOKEN_SHA256;
      await request(app.getHttpServer())
        .get(nativeUrl + '/config')
        .expect(401);
      await request(app.getHttpServer())
        .get(nativeUrl + '/config')
        .auth(token, { type: 'bearer' })
        .expect(200, {
          enabled: false,
          environment: 'sandbox',
          method: 'PIX',
          provider: 'MERCADO_PAGO',
        });
      await send().expect(503);
      expect(sdk).not.toHaveBeenCalled();
      expect(
        await prisma.payment.count({ where: { purchaseId: purchase.id } }),
      ).toBe(0);

      process.env.MERCADO_PAGO_VERIFIED_TEST_TOKEN_SHA256 = createHash('sha256')
        .update(process.env.MERCADO_PAGO_ACCESS_TOKEN!)
        .digest('hex');
      const first = await send().expect(201);
      const record = first.body as { id: string };
      expect(first.body).toEqual({
        id: expect.any(String),
        purchaseId: purchase.id,
        amount: 5,
        status: 'PENDING',
        environment: 'sandbox',
        expiresAt: expect.any(String),
        awaitingProvider: false,
      });
      await send().expect(201, first.body);
      expect(sdk).toHaveBeenCalledTimes(1);
      expect(
        await prisma.payment.count({ where: { purchaseId: purchase.id } }),
      ).toBe(1);
      const stored = await prisma.payment.findUniqueOrThrow({
        where: { id: record.id },
      });
      expect(stored).toMatchObject({
        method: 'PIX',
        pixCopyPaste: null,
        metadata: { nativeSandboxPix: true },
      });
      await request(app.getHttpServer())
        .get(nativeUrl + '/purchase/' + purchase.id)
        .auth(token, { type: 'bearer' })
        .expect(200, first.body);
      await request(app.getHttpServer())
        .get(nativeUrl + '/purchase/' + purchase.id)
        .auth(secondToken, { type: 'bearer' })
        .expect(200)
        .expect(({ text }) => {
          // Express represents a null result as an empty successful response.
          expect(['', 'null']).toContain(text);
        });
      const lookupCount = lookup.mock.calls.length;
      lookup.mockResolvedValueOnce({
        id: providerPaymentId,
        external_reference: stored.externalReference,
        total_amount: '5.00',
        status: 'processed',
        status_detail: 'accredited',
      });
      await notice(stored.externalReference).expect(200, {
        received: true,
        duplicate: false,
        status: 'APPROVED',
      });
      await notice(stored.externalReference).expect(200, {
        received: true,
        duplicate: true,
      });
      expect(lookup).toHaveBeenCalledTimes(lookupCount + 1);
      expect(
        await prisma.paymentEvent.findMany({
          where: { provider: 'MERCADO_PAGO', providerEventId: eventId },
          select: { processed: true, paymentId: true, errorMessage: true },
        }),
      ).toEqual([
        { processed: true, paymentId: record.id, errorMessage: null },
      ]);
      const [mobile, web] = await Promise.all([
        request(app.getHttpServer())
          .get(nativeUrl + '/purchase/' + purchase.id)
          .auth(token, { type: 'bearer' })
          .expect(200),
        request(app.getHttpServer())
          .get('/payments/purchase/' + purchase.id)
          .auth(token, { type: 'bearer' })
          .expect(200),
      ]);
      for (const { body } of [mobile, web])
        expect(body).toMatchObject({
          id: record.id,
          purchaseId: purchase.id,
          status: 'APPROVED',
        });
      expect(web.body.purchase.tickets).toEqual([
        { number: 2, status: 'SOLD' },
      ]);
      expect(
        await prisma.ledgerEntry.count({
          where: {
            paymentId: record.id,
            reference: `payment:${record.id}:organizer-net`,
          },
        }),
      ).toBe(1);
    } finally {
      process.env = env;
      sdk.mockRestore();
    }
  });
  it('libera somente a cota sem pagamento após expiração e admite um único comprador na nova disputa', async () => {
    const run = randomUUID();
    const owner = await organizerFixture(`reuse-organizer-${run}@example.test`);
    const [previous, competitorA, competitorB] = buyers;
    const accessTokens = buyers.map(({ token }) => token);
    await prisma.organizerProfile.create({
      data: {
        userId: owner.id,
        fullName: 'Responsável sintético',
        cpf: '00000000000',
        phone: '00000000000',
        verificationStatus: 'VERIFIED',
      },
    });
    const campaign = await prisma.campaign.create({
      data: {
        title: 'Campanha sintética de expiração',
        slug: `reuse-${run}`,
        organizerId: owner.id,
        totalNumbers: 10,
        numberPrice: 1,
        numberSelectionMode: 'MANUAL',
        status: 'PUBLISHED',
      },
    });
    const reserve = (token: string, number: number) =>
      request(app.getHttpServer())
        .post('/purchases/reserve-manual')
        .auth(token, { type: 'bearer' })
        .send({
          campaignId: campaign.id,
          numbers: [number],
          idempotencyKey: randomUUID(),
        });
    const { body: old } = await reserve(accessTokens[0], 2).expect(201);
    const { body: pending } = await reserve(accessTokens[0], 3).expect(201);
    const oldId = (old as { id: string }).id;
    const pendingId = (pending as { id: string }).id;
    const expiredAt = new Date(Date.now() - 30_000);
    const pendingPayment = await prisma.payment.create({
      data: {
        buyerId: previous.id,
        campaignId: campaign.id,
        organizerId: owner.id,
        purchaseId: pendingId,
        activePurchaseKey: pendingId,
        externalReference: `fixture-pending-${run}`,
        provider: 'MERCADO_PAGO',
        method: 'PIX',
        status: 'PENDING',
        amount: 1,
        netAmount: 1,
        expiresAt: expiredAt,
      },
    });
    // Backdate only records in this disposable database; no sleeps or provider calls.
    await prisma.$transaction([
      prisma.purchase.updateMany({
        where: { id: { in: [oldId, pendingId] } },
        data: { expiresAt: expiredAt },
      }),
      prisma.ticket.updateMany({
        where: { purchaseId: { in: [oldId, pendingId] } },
        data: { reservedUntil: expiredAt },
      }),
    ]);
    const publicPath = '/public/campaigns/' + campaign.slug;
    await request(app.getHttpServer())
      .get(publicPath + '/availability')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          availableNumbers: 9,
          reservedNumbers: 1,
          soldNumbers: 0,
        });
      });
    for (const [number, status] of [
      [2, 'AVAILABLE'],
      [3, 'RESERVED'],
    ] as const) {
      await request(app.getHttpServer())
        .get(publicPath + '/numbers')
        .query({ search: number })
        .expect(200)
        .expect(({ body }) => expect(body.items).toEqual([{ number, status }]));
    }

    const responses = await Promise.all([
      reserve(accessTokens[1], 2),
      reserve(accessTokens[2], 2),
    ]);
    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    const winner = responses.find(({ status }) => status === 201)!.body as {
      id: string;
      buyerId: string;
    };
    expect([competitorA.id, competitorB.id]).toContain(winner.buyerId);

    const [purchases, tickets, after] = await Promise.all([
      prisma.purchase.findMany({
        where: { campaignId: campaign.id },
        select: { id: true, status: true },
      }),
      prisma.ticket.findMany({
        where: { campaignId: campaign.id },
        orderBy: { number: 'asc' },
        select: { number: true, purchaseId: true, buyerId: true, status: true },
      }),
      prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } }),
    ]);
    expect(purchases).toHaveLength(3);
    expect(purchases).toEqual(
      expect.arrayContaining([
        { id: oldId, status: 'EXPIRED' },
        { id: pendingId, status: 'AWAITING_PAYMENT' },
        { id: winner.id, status: 'AWAITING_PAYMENT' },
      ]),
    );
    expect(tickets).toEqual([
      {
        number: 2,
        purchaseId: winner.id,
        buyerId: winner.buyerId,
        status: 'RESERVED',
      },
      {
        number: 3,
        purchaseId: pendingId,
        buyerId: previous.id,
        status: 'RESERVED',
      },
    ]);
    expect(after).toMatchObject({ reservedNumbers: 2, soldNumbers: 0 });
    expect(
      await prisma.payment.findMany({
        where: { campaignId: campaign.id },
        select: { id: true, status: true },
      }),
    ).toEqual([{ id: pendingPayment.id, status: 'PENDING' }]);
    expect(
      await prisma.ledgerEntry.count({ where: { campaignId: campaign.id } }),
    ).toBe(0);
  });
});
