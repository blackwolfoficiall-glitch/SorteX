import type { INestApplication } from '@nestjs/common';
import { PurchaseStatus, UserRole } from '@prisma/client';
import { hash } from 'bcrypt';
import { randomBytes, randomUUID } from 'node:crypto';
import { createApplication } from '../src/application';
import { PrismaService } from '../src/prisma/prisma.service';
import { confirmedSalesPeriod } from '../src/growth/ads-confirmed-sales';

describe('Ads confirmed sales periods', () => {
  const now = new Date('2026-11-27T02:59:00.000Z'); // November 26 in São Paulo

  it('uses calendar days in São Paulo, with an exclusive end', () => {
    expect(confirmedSalesPeriod({ period: 'TODAY' }, now)).toEqual({
      key: 'TODAY',
      timeZone: 'America/Sao_Paulo',
      fromDate: '2026-11-26',
      toDateExclusive: '2026-11-27',
    });
    expect(confirmedSalesPeriod({ period: 'YESTERDAY' }, now)).toMatchObject({
      fromDate: '2026-11-25',
      toDateExclusive: '2026-11-26',
    });
    expect(confirmedSalesPeriod({ period: '15D' }, now)).toMatchObject({
      fromDate: '2026-11-12',
      toDateExclusive: '2026-11-27',
    });
  });

  it('rejects missing, invalid, future, inverted, and excessively long periods', () => {
    for (const dates of [
      {},
      { startDate: '2026-02-31', endDate: '2026-11-25' },
      { startDate: '2026-11-26', endDate: '2026-11-27' },
      { startDate: '2026-11-26', endDate: '2026-11-25' },
      { startDate: '2024-01-01', endDate: '2026-11-25' },
    ])
      expect(() =>
        confirmedSalesPeriod({ period: 'CUSTOM', ...dates }, now),
      ).toThrow();
    expect(() =>
      confirmedSalesPeriod({ period: 'TODAY', startDate: '2026-11-01' }, now),
    ).toThrow();
  });
});

const database = process.env.SORTEX_ADS_E2E_DATABASE_URL;
const isolated = database ? describe : describe.skip;
isolated('Ads confirmed sales with HTTP and disposable PostgreSQL', () => {
  jest.setTimeout(25_000);
  let app: INestApplication | undefined;
  let prisma: PrismaService;
  let base: string;
  const password = randomBytes(16).toString('hex');
  const saved = new Map<string, string | undefined>();

  beforeAll(async () => {
    const url = new URL(database!);
    if (
      url.protocol !== 'postgresql:' ||
      url.hostname !== '127.0.0.1' ||
      !/^\/sortex_ads_[a-z0-9_]+$/.test(url.pathname)
    )
      throw new Error(
        'Use only a freshly migrated disposable loopback sortex_ads_* database.',
      );
    for (const [key, value] of Object.entries({
      DATABASE_URL: database!,
      APP_ENV: 'staging',
      INTEGRATIONS_MODE: 'sandbox',
      FEATURE_REAL_PAYMENTS: 'false',
      FEATURE_EXTERNAL_CRM: 'false',
      PAYMENT_ENV: 'test',
      EMAIL_DELIVERY_MODE: 'disabled',
      UPLOADS_DISABLED: 'true',
      JWT_ACCESS_SECRET: randomBytes(32).toString('hex'),
      JWT_REFRESH_SECRET: randomBytes(32).toString('hex'),
    })) {
      saved.set(key, process.env[key]);
      process.env[key] = value;
    }
    app = await createApplication();
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
    base = await app.getUrl();
    if (await prisma.user.count())
      throw new Error('A disposable empty database is required.');
  });

  afterAll(async () => {
    try {
      await app?.close();
      await prisma?.$disconnect();
    } finally {
      for (const [key, value] of saved) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  async function account(role: UserRole) {
    return prisma.user.create({
      data: {
        name: 'Fictício QA Ads',
        email: `sortex-ads-${randomUUID()}@example.test`,
        password: await hash(password, 4),
        role,
      },
    });
  }

  async function login(email: string) {
    const response = await fetch(base + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    expect(response.ok).toBe(true);
    return ((await response.json()) as { accessToken: string }).accessToken;
  }

  it('counts only scoped PAID purchases once; ignores client sales and preserves unknown origin', async () => {
    const [owner, outsider, buyer, otherBuyer] = await Promise.all([
      account(UserRole.ORGANIZER),
      account(UserRole.ORGANIZER),
      account(UserRole.BUYER),
      account(UserRole.BUYER),
    ]);
    const campaign = (organizerId: string) =>
      prisma.campaign.create({
        data: {
          organizerId,
          title: 'Campanha QA fictícia',
          slug: randomUUID(),
        },
      });
    const [main, second, external] = await Promise.all([
      campaign(owner.id),
      campaign(owner.id),
      campaign(outsider.id),
    ]);
    const day = new Date('2026-01-13T03:00:00.000Z'); // local midnight on the 13th
    const makePurchase = (
      campaignId: string,
      buyerId: string,
      status: PurchaseStatus,
      total: string,
      quantity: number,
      confirmedAt: Date | null = day,
    ) =>
      prisma.purchase.create({
        data: {
          campaignId,
          buyerId,
          status,
          total,
          quantity,
          confirmedAt,
          subtotal: total,
          unitPrice: '2.20',
          selectionMode: 'RANDOM',
          expiresAt: day,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      });
    const [attributed, unknown] = await Promise.all([
      makePurchase(main.id, buyer.id, 'PAID', '10.00', 5),
      makePurchase(main.id, buyer.id, 'PAID', '6.60', 3),
      makePurchase(second.id, otherBuyer.id, 'PAID', '18.01', 3),
      makePurchase(external.id, otherBuyer.id, 'PAID', '88.33', 12),
      makePurchase(main.id, buyer.id, 'REFUNDED', '99.00', 5),
      makePurchase(main.id, buyer.id, 'RESERVED', '99.00', 5),
      makePurchase(main.id, buyer.id, 'PAID', '99.00', 5, null),
      makePurchase(
        main.id,
        buyer.id,
        'PAID',
        '99.00',
        5,
        new Date(day.getTime() - 1),
      ),
      makePurchase(
        main.id,
        buyer.id,
        'PAID',
        '99.00',
        5,
        new Date('2026-01-14T03:00:00.000Z'),
      ),
    ]);
    const approvedPayment = (purchaseId: string, amount: string) =>
      prisma.payment.create({
        data: {
          purchaseId,
          amount,
          netAmount: amount,
          buyerId: buyer.id,
          campaignId: main.id,
          organizerId: owner.id,
          externalReference: randomUUID(),
          provider: 'MERCADO_PAGO',
          method: 'PIX',
          status: 'APPROVED',
          approvedAt: day,
        },
      });
    const createConversion = async (
      purchaseId: string,
      amount: string,
      organizerId: string,
    ) => {
      const program = await prisma.affiliateProgram.create({
        data: {
          organizerId,
          name: 'QA afiliados',
          commissionType: 'PERCENTAGE',
        },
      });
      const affiliate = await prisma.affiliate.create({
        data: {
          programId: program.id,
          organizerId,
          name: 'QA fictício',
          email: 'sortex-affiliate@example.test',
          referralCode: randomUUID(),
          slug: randomUUID(),
        },
      });
      const payment = await approvedPayment(purchaseId, amount);
      await prisma.affiliateConversion.create({
        data: {
          affiliateId: affiliate.id,
          programId: program.id,
          campaignId: main.id,
          buyerId: buyer.id,
          purchaseId,
          paymentId: payment.id,
          status: 'APPROVED',
          grossAmount: amount,
          eligibleAmount: amount,
          commissionAmount: '0.00',
          approvedAt: day,
        },
      });
    };
    await createConversion(attributed.id, '10.00', owner.id);
    await createConversion(unknown.id, '6.60', outsider.id);

    const ad = await prisma.sortexAdCampaign.create({
      data: {
        organizerId: owner.id,
        campaignId: main.id,
        code: randomUUID(),
        name: 'Anúncio interno fictício',
        status: 'SANDBOX_ACTIVE',
        channels: ['INSTAGRAM', 'TIKTOK'],
        objective: 'SALES',
        budgetType: 'TOTAL',
        budget: '75.00',
        audience: {},
        creative: {},
        location: {},
        approvedSales: 700,
        attributedRevenue: '8999.00',
        spent: '174.00',
      },
    });
    await prisma.sortexAdEvent.createMany({
      data: [
        {
          adId: ad.id,
          purchaseId: attributed.id,
          type: 'APPROVED_SALE',
          channel: 'INSTAGRAM',
          value: '300.00',
          occurredAt: day,
        },
        {
          adId: ad.id,
          purchaseId: attributed.id,
          type: 'APPROVED_SALE',
          channel: 'TIKTOK',
          value: '100.00',
          occurredAt: day,
        },
      ],
    });

    const [organizerToken, buyerToken] = await Promise.all([
      login(owner.email),
      login(buyer.email),
    ]);
    const visit = (token?: string, extras = '') =>
      fetch(
        base +
          '/sortex-ads/confirmed-sales?period=CUSTOM&startDate=2026-01-13&endDate=2026-01-13' +
          extras,
        { headers: token ? { Authorization: 'Bearer ' + token } : {} },
      );
    expect((await visit()).status).toBe(401);
    expect((await visit(buyerToken)).status).toBe(403);
    expect((await visit(organizerToken, '&platform=META_ADS')).status).toBe(
      400,
    );

    expect((await visit(organizerToken, '&origin=META_ADS')).status).toBe(400);
    expect((await visit(organizerToken, '&origin=')).status).toBe(400);

    const response = await visit(organizerToken);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const totals = {
      confirmedOrders: 3,
      buyers: 2,
      titlesSold: 11,
      paidOrderValue: '34.61',
      averageOrderValue: '11.54',
    };
    expect(await response.json()).toMatchObject({
      originFilter: 'ALL',
      totals,
      daily: [{ date: '2026-01-13', ...totals }],
      attribution: {
        adsWindowDays: null,
        channels: [
          { origin: 'AFFILIATE', confirmedOrders: 1, paidOrderValue: '10.00' },
          { origin: 'UNKNOWN', confirmedOrders: 2, paidOrderValue: '24.61' },
        ],
      },
      paidMedia: {
        status: 'UNAVAILABLE',
        spend: null,
        attributedRevenue: null,
        roas: null,
        roi: null,
        reportingProviders: ['META_ADS', 'GOOGLE_ADS', 'TIKTOK_ADS'].map(
          (provider) => ({
            provider,
            intendedCapability: 'READ_ONLY_REPORTING',
            status: 'DISABLED',
            canReadProviderData: false,
            canPublish: false,
            canChangeBudget: false,
          }),
        ),
      },
    });
    const onlyAffiliate = await visit(organizerToken, '&origin=AFFILIATE');
    expect(onlyAffiliate.status).toBe(200);
    expect(await onlyAffiliate.json()).toMatchObject({
      originFilter: 'AFFILIATE',
      totals: {
        confirmedOrders: 1,
        buyers: 1,
        titlesSold: 5,
        paidOrderValue: '10.00',
      },
      daily: [
        { date: '2026-01-13', confirmedOrders: 1, paidOrderValue: '10.00' },
      ],
      attribution: { channels: [{ origin: 'AFFILIATE', confirmedOrders: 1 }] },
    });
    const onlyUnknown = await visit(organizerToken, '&origin=UNKNOWN');
    expect(onlyUnknown.status).toBe(200);
    expect(await onlyUnknown.json()).toMatchObject({
      originFilter: 'UNKNOWN',
      totals: {
        confirmedOrders: 2,
        buyers: 2,
        titlesSold: 6,
        paidOrderValue: '24.61',
      },
      attribution: { channels: [{ origin: 'UNKNOWN', confirmedOrders: 2 }] },
    });
    const scoped = await visit(organizerToken, '&campaignId=' + main.id);
    expect(await scoped.json()).toMatchObject({
      totals: { confirmedOrders: 2, buyers: 1, paidOrderValue: '16.60' },
    });
    const foreign = await visit(
      organizerToken,
      '&origin=AFFILIATE&campaignId=' + external.id,
    );
    const missing = await visit(organizerToken, '&campaignId=' + 'nonexistent');
    for (const filtered of [foreign, missing])
      expect(await filtered.json()).toMatchObject({
        totals: {
          confirmedOrders: 0,
          paidOrderValue: '0.00',
          averageOrderValue: null,
        },
        daily: [],
      });
  });
});
