import type { INestApplication } from '@nestjs/common';
import { CampaignStatus, PurchaseStatus, UserRole } from '@prisma/client';
import { hash } from 'bcrypt';
import { randomBytes, randomUUID } from 'node:crypto';
import { SortexClient } from '../../../apps/mobile/src/api/client';
import {
  loadOrganizerDashboard,
  organizerDashboardSession,
  parseOrganizerDashboard,
} from '../../../apps/mobile/src/organizer/dashboard';
import { createApplication } from '../src/application';
import { PrismaService } from '../src/prisma/prisma.service';

const database = process.env.SORTEX_DASHBOARD_E2E_DATABASE_URL;
const web = process.env.SORTEX_DASHBOARD_E2E_WEB_URL;
const isolated = database ? describe : describe.skip;

isolated('Organizer dashboard snapshots with isolated PostgreSQL', () => {
  jest.setTimeout(30_000);
  let app: INestApplication | undefined;
  let prisma: PrismaService | undefined;
  let base: string;
  const saved = new Map<string, string | undefined>();
  const password = randomBytes(18).toString('hex');
  const version = randomUUID();

  beforeAll(async () => {
    const url = new URL(database!);
    if (
      url.protocol !== 'postgresql:' ||
      url.hostname !== '127.0.0.1' ||
      !/^\/sortex_dashboard_[a-z0-9_]+$/.test(url.pathname)
    )
      throw new Error(
        'Use a freshly migrated disposable loopback database named sortex_dashboard_*.',
      );

    for (const [key, value] of Object.entries({
      DATABASE_URL: database!,
      APP_ENV: 'staging',
      APP_VERSION: version,
      UPLOADS_DISABLED: 'true',
      EMAIL_DELIVERY_MODE: 'disabled',
      PAYMENT_ENV: 'sandbox',
      FEATURE_REAL_PAYMENTS: 'false',
      FEATURE_EXTERNAL_CRM: 'false',
      JWT_ACCESS_SECRET: randomBytes(32).toString('hex'),
      JWT_REFRESH_SECRET: randomBytes(32).toString('hex'),
    })) {
      saved.set(key, process.env[key]);
      process.env[key] = value;
    }
    if (web && !/^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}$/.test(web))
      throw new Error('The optional Next BFF must also be on IPv4 loopback.');
    const port = Number(process.env.SORTEX_DASHBOARD_E2E_API_PORT ?? 0);
    if (!Number.isInteger(port) || port < 0 || port > 65535 || (web && !port))
      throw new Error('Set the API port for the local Next BFF.');
    app = await createApplication();
    await app.listen(port, '127.0.0.1');
    prisma = app.get(PrismaService);
    base = await app.getUrl();
    if ((await prisma.user.count()) || (await prisma.campaign.count()))
      throw new Error(
        'Synthetic fixtures require an empty disposable database.',
      );
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
    const user = await prisma!.user.create({
      data: {
        name: 'Synthetic dashboard QA',
        email: `sortex-dashboard-${randomUUID()}@example.test`,
        password: await hash(password, 4),
        role,
      },
    });
    return user;
  }

  async function mobile(email: string) {
    const client = new SortexClient(base, {
      read: () => Promise.resolve(null),
      write: async () => {},
      clear: async () => {},
    });
    await client.login(email, password);
    return client;
  }

  it('returns the same owned paid metrics and nonblocked active campaigns through mobile and Next', async () => {
    const primary = await account(UserRole.ORGANIZER);
    const another = await account(UserRole.ORGANIZER);
    const empty = await account(UserRole.ORGANIZER);
    const firstBuyer = await account(UserRole.BUYER);
    const repeatBuyer = await account(UserRole.BUYER);
    const makeCampaign = (
      organizerId: string,
      title: string,
      status: CampaignStatus,
      publicationBlocked = false,
    ) =>
      prisma!.campaign.create({
        data: {
          organizerId,
          title,
          slug: `synthetic-org-dashboard-${randomUUID()}`,
          status,
          publicationBlocked,
          grossRevenue: '955.90',
          totalNumbers: 100,
        },
      });
    const ready = await makeCampaign(
      primary.id,
      'Synthetic primary published',
      'PUBLISHED',
    );
    const sold = await makeCampaign(
      primary.id,
      'Synthetic primary sold out',
      'SOLD_OUT',
    );
    const blocked = await makeCampaign(
      primary.id,
      'Synthetic primary blocked',
      'PUBLISHED',
      true,
    );
    const draft = await makeCampaign(
      primary.id,
      'Synthetic primary draft',
      'DRAFT',
    );
    const secondary = await makeCampaign(
      another.id,
      'Synthetic second published',
      'PUBLISHED',
    );
    const paused = await makeCampaign(
      another.id,
      'Synthetic second paused',
      'PAUSED',
    );

    const makePurchase = (
      campaignId: string,
      buyerId: string,
      status: PurchaseStatus,
      quantity: number,
      unitPrice: string,
    ) => {
      const total = (quantity * Number(unitPrice)).toFixed(2);
      return prisma!.purchase.create({
        data: {
          campaignId,
          buyerId,
          status,
          quantity,
          unitPrice,
          total,
          subtotal: total,
          selectionMode: 'RANDOM',
          expiresAt: new Date(Date.now() + 900_000),
          confirmedAt: status === 'PAID' ? new Date() : undefined,
        },
      });
    };
    await makePurchase(ready.id, firstBuyer.id, 'PAID', 2, '5.25');
    await makePurchase(ready.id, firstBuyer.id, 'PAID', 3, '5.00');
    await makePurchase(sold.id, repeatBuyer.id, 'PAID', 4, '4.61');
    await makePurchase(
      ready.id,
      firstBuyer.id,
      'AWAITING_PAYMENT',
      444,
      '8.00',
    );
    await makePurchase(secondary.id, firstBuyer.id, 'PAID', 1, '7.05');
    await prisma!.campaign.update({
      where: { id: ready.id },
      data: { soldNumbers: 5 },
    });
    await prisma!.campaign.update({
      where: { id: sold.id },
      data: { soldNumbers: 4, totalNumbers: 4 },
    });
    await prisma!.campaign.update({
      where: { id: secondary.id },
      data: { soldNumbers: 1 },
    });

    const login = async (url: string, email: string) =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        redirect: 'error',
      });
    const authBuyer = await login(base + '/auth/login', firstBuyer.email);
    expect(authBuyer.status).toBe(201);
    const { accessToken } = (await authBuyer.json()) as { accessToken: string };
    expect((await fetch(base + '/dashboard')).status).toBe(401);
    expect(
      (
        await fetch(base + '/dashboard', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
      ).status,
    ).toBe(403);

    async function nativeDashboard(email: string) {
      const client = await mobile(email);
      const session = organizerDashboardSession(client)!;
      const [parsed, wire] = await Promise.all([
        loadOrganizerDashboard(client, session),
        client.request<unknown>('/dashboard'),
      ]);
      return { parsed, wire: parseOrganizerDashboard(wire) };
    }

    const a = await nativeDashboard(primary.email);
    const b = await nativeDashboard(another.email);
    const noCampaigns = await nativeDashboard(empty.email);
    expect(a.parsed?.summary).toEqual({
      grossRevenue: 43.94,
      activeCampaigns: 2,
      participants: 2,
      soldTickets: 9,
      averageTicket: 43.94 / 3,
    });
    expect(b.parsed?.summary).toEqual({
      grossRevenue: 7.05,
      activeCampaigns: 1,
      participants: 1,
      soldTickets: 1,
      averageTicket: 7.05,
    });
    expect(noCampaigns.parsed?.summary).toEqual({
      grossRevenue: 0,
      activeCampaigns: 0,
      participants: 0,
      soldTickets: 0,
      averageTicket: 0,
    });
    expect(noCampaigns.parsed?.campaigns).toEqual([]);
    expect(
      a.parsed?.campaigns.filter((c) => c.publicationBlocked).map((c) => c.id),
    ).toEqual([blocked.id]);
    expect(a.parsed?.campaigns.map((c) => c.id).sort()).toEqual(
      [ready.id, sold.id, blocked.id, draft.id].sort(),
    );
    expect(b.parsed?.campaigns.map((c) => c.id).sort()).toEqual(
      [secondary.id, paused.id].sort(),
    );
    expect(a.wire.summary).toEqual(a.parsed?.summary);
    expect(b.wire.campaigns).toEqual(b.parsed?.campaigns);

    if (web) {
      const health = await fetch(web + '/api/health', { redirect: 'error' });
      expect(health.status).toBe(200);
      expect(((await health.json()) as { version: string }).version).toBe(
        version,
      );
      for (const [user, dashboard] of [
        [primary, a],
        [another, b],
        [empty, noCampaigns],
      ] as const) {
        const response = await login(web + '/api/auth/login', user.email);
        expect(response.status).toBe(200);
        expect(
          ((await response.json()) as { user: { id: string } }).user.id,
        ).toBe(user.id);
        const cookie = response.headers
          .getSetCookie()
          .map((line) => line.split(';')[0])
          .join('; ');
        expect(cookie).not.toBe('');
        const proxy = await fetch(web + '/api/dashboard', {
          headers: { cookie },
          redirect: 'error',
        });
        expect(proxy.status).toBe(200);
        expect(proxy.headers.get('cache-control')).toBe('private, no-store');
        const webView = parseOrganizerDashboard(await proxy.json());
        expect(webView.summary).toEqual(dashboard.parsed?.summary);
        expect(webView.campaigns).toEqual(dashboard.parsed?.campaigns);
      }
      const guest = await fetch(web + '/api/dashboard', { redirect: 'error' });
      expect(guest.status).toBe(401);
      expect(guest.headers.get('cache-control')).toBe('private, no-store');
    }
    expect(await prisma!.payment.count()).toBe(0);
    expect(await prisma!.financialAccount.count()).toBe(0);
    expect(await prisma!.ledgerEntry.count()).toBe(0);
  });

  it('reports only paid owned purchases in explicit São Paulo days without exposing buyer rows', async () => {
    const [owner, other, empty, buyer, repeat] = await Promise.all([
      account(UserRole.ORGANIZER),
      account(UserRole.ORGANIZER),
      account(UserRole.ORGANIZER),
      account(UserRole.BUYER),
      account(UserRole.BUYER),
    ]);
    const addCampaign = (organizerId: string) =>
      prisma!.campaign.create({
        data: {
          organizerId,
          title: 'Synthetic reporting campaign',
          slug: `synthetic-reporting-${randomUUID()}`,
        },
      });
    const [c1, c2, otherCampaign] = await Promise.all([
      addCampaign(owner.id),
      addCampaign(owner.id),
      addCampaign(other.id),
    ]);
    const purchase = (
      campaignId: string,
      buyerId: string,
      confirmedAt: string | null,
      quantity: number,
      total: string,
      status: PurchaseStatus = PurchaseStatus.PAID,
    ) => ({
      campaignId,
      buyerId,
      confirmedAt: confirmedAt === null ? null : new Date(confirmedAt),
      quantity,
      unitPrice: '1.00',
      total,
      subtotal: total,
      status,
      selectionMode: 'RANDOM' as const,
      expiresAt: new Date('2026-01-18T03:00:00Z'),
    });
    await prisma!.purchase.createMany({
      data: [
        purchase(c1.id, buyer.id, '2026-01-15T02:59:59.999Z', 90, '900.00'),
        purchase(c1.id, buyer.id, '2026-01-15T03:00:00.000Z', 1, '10.00'),
        purchase(c2.id, buyer.id, '2026-01-16T01:00:00.000Z', 2, '20.00'),
        purchase(c2.id, repeat.id, '2026-01-16T03:00:00.000Z', 3, '30.01'),
        purchase(c1.id, buyer.id, '2026-01-17T02:59:59.999Z', 4, '40.02'),
        purchase(c1.id, buyer.id, '2026-01-17T03:00:00.000Z', 90, '900.00'),
        purchase(c1.id, buyer.id, null, 90, '900.00'),
        purchase(
          c1.id,
          buyer.id,
          '2026-01-16T09:00:00.000Z',
          90,
          '900.00',
          PurchaseStatus.AWAITING_PAYMENT,
        ),
        purchase(
          c1.id,
          buyer.id,
          '2026-01-16T10:00:00.000Z',
          90,
          '900.00',
          PurchaseStatus.CANCELLED,
        ),
        purchase(
          c1.id,
          buyer.id,
          '2026-01-16T11:00:00.000Z',
          90,
          '900.00',
          PurchaseStatus.REFUNDED,
        ),
        purchase(
          otherCampaign.id,
          buyer.id,
          '2026-01-15T03:00:00.000Z',
          20,
          '200.00',
        ),
        // January 2018 was UTC−02 in São Paulo. A fixed current UTC−03 offset would omit this row.
        purchase(c1.id, buyer.id, '2018-01-15T01:59:59.999Z', 90, '900.00'),
        purchase(c1.id, buyer.id, '2018-01-15T02:00:00.000Z', 1, '5.00'),
      ],
    });
    const login = async (email: string) => {
      const response = await fetch(base + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      expect(response.status).toBe(201);
      const { accessToken } = (await response.json()) as {
        accessToken: string;
      };
      return { Authorization: `Bearer ${accessToken}` };
    };
    const [headers, otherHeaders, emptyHeaders, buyerHeaders] =
      await Promise.all(
        [owner, other, empty, buyer].map((user) => login(user.email)),
      );
    const path = base + '/dashboard/period';
    const dates = '?start=2026-01-15&end=2026-01-16';
    const response = await fetch(path + dates, { headers });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual({
      version: 1,
      period: {
        start: '2026-01-15',
        end: '2026-01-16',
        timeZone: 'America/Sao_Paulo',
      },
      summary: {
        grossRevenue: 100.03,
        soldTickets: 10,
        participants: 2,
        averageTicket: 25.01,
        paidOrders: 4,
      },
      revenueHistory: [
        { date: '2026-01-15', revenue: 30 },
        { date: '2026-01-16', revenue: 70.03 },
      ],
    });
    const distinctOwner = await fetch(path + dates, { headers: otherHeaders });
    expect(await distinctOwner.json()).toMatchObject({
      summary: {
        grossRevenue: 200,
        soldTickets: 20,
        participants: 1,
        averageTicket: 200,
        paidOrders: 1,
      },
    });
    const noPurchases = await fetch(path + dates, { headers: emptyHeaders });
    expect(await noPurchases.json()).toMatchObject({
      summary: {
        grossRevenue: 0,
        soldTickets: 0,
        participants: 0,
        averageTicket: 0,
        paidOrders: 0,
      },
      revenueHistory: [],
    });
    const historical = await fetch(path + '?start=2018-01-15&end=2018-01-15', {
      headers,
    });
    expect(await historical.json()).toMatchObject({
      summary: { grossRevenue: 5, participants: 1 },
      revenueHistory: [{ date: '2018-01-15', revenue: 5 }],
    });
    expect((await fetch(path + dates)).status).toBe(401);
    expect((await fetch(path + dates, { headers: buyerHeaders })).status).toBe(
      403,
    );
    for (const invalid of [
      '',
      '?start=2026-02-29&end=2026-03-01',
      '?start=2026-01-16&end=2026-01-15',
      '?start=2020-01-01&end=2026-01-16',
      '?start=2026-01-01&end=9999-01-16',
      dates + '&start=2026-01-13',
      dates + '&organizerId=' + other.id,
    ]) {
      expect((await fetch(path + invalid, { headers })).status).toBe(400);
    }
    expect(await prisma!.payment.count()).toBe(0);
  });

  it('uses the same observation instant for the São Paulo day and the confirmation cutoff', async () => {
    const now = new Date('2026-11-27T01:30:00.000Z');
    // Freeze only Date while keeping the request, sockets, and timeouts real.
    jest.useFakeTimers({
      now,
      doNotFake: [
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'setImmediate',
        'clearImmediate',
        'nextTick',
        'queueMicrotask',
        'performance',
        'hrtime',
      ],
    });
    try {
      const [owner, buyer, futureBuyer] = await Promise.all([
        account(UserRole.ORGANIZER),
        account(UserRole.BUYER),
        account(UserRole.BUYER),
      ]);
      const campaign = await prisma!.campaign.create({
        data: {
          organizerId: owner.id,
          title: 'Synthetic as-of cutoff',
          slug: `synthetic-as-of-${randomUUID()}`,
        },
      });
      await prisma!.purchase.createMany({
        data: [
          {
            buyerId: buyer.id,
            confirmedAt: '2026-11-26T23:30:00.000Z',
            total: '11.01',
            quantity: 1,
          },
          {
            buyerId: buyer.id,
            confirmedAt: '2026-11-27T00:30:00.000Z',
            total: '20.00',
            quantity: 2,
          },
          {
            buyerId: buyer.id,
            confirmedAt: now.toISOString(),
            total: '33.04',
            quantity: 3,
          },
          {
            buyerId: futureBuyer.id,
            confirmedAt: '2026-11-27T01:30:00.001Z',
            total: '900.00',
            quantity: 400,
          },
        ].map(({ buyerId, confirmedAt, total, quantity }) => ({
          campaignId: campaign.id,
          buyerId,
          confirmedAt: new Date(confirmedAt),
          total,
          subtotal: total,
          quantity,
          unitPrice: '1.00',
          status: PurchaseStatus.PAID,
          selectionMode: 'RANDOM',
          expiresAt: new Date('2026-11-28T00:00:00.000Z'),
        })),
      });
      const ownerLogin = await fetch(base + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: owner.email, password }),
      });
      expect(ownerLogin.status).toBe(201);
      const { accessToken } = (await ownerLogin.json()) as {
        accessToken: string;
      };
      const headers = { Authorization: `Bearer ${accessToken}` };
      const path = base + '/dashboard/period';
      const report = await fetch(path + '?start=2026-11-26&end=2026-11-26', {
        headers,
      });
      expect(report.status).toBe(200);
      expect(await report.json()).toMatchObject({
        period: {
          start: '2026-11-26',
          end: '2026-11-26',
          timeZone: 'America/Sao_Paulo',
        },
        summary: {
          grossRevenue: 64.05,
          paidOrders: 3,
          participants: 1,
          averageTicket: 21.35,
          soldTickets: 6,
        },
        revenueHistory: [{ date: '2026-11-26', revenue: 64.05 }],
      });
      // The same owner and database snapshot must agree with Ads, which
      // applies its own confirmed-purchase query.
      const ads = await fetch(base + '/sortex-ads/confirmed-sales?period=TODAY', {
        headers,
      });
      expect(ads.status).toBe(200);
      expect(await ads.json()).toMatchObject({
        period: { fromDate: '2026-11-26', toDateExclusive: '2026-11-27' },
        totals: {
          paidOrderValue: '64.05',
          confirmedOrders: 3,
          buyers: 1,
          averageOrderValue: '21.35',
          titlesSold: 6,
        },
        daily: [{ date: '2026-11-26', paidOrderValue: '64.05' }],
      });
      const tomorrowInSaoPaulo = await fetch(
        path + '?start=2026-11-27&end=2026-11-27',
        { headers },
      );
      expect(tomorrowInSaoPaulo.status).toBe(400);
      expect(await prisma!.payment.count()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
