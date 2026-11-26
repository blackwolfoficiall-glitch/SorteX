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
    });
    expect(b.parsed?.summary).toEqual({
      grossRevenue: 7.05,
      activeCampaigns: 1,
      participants: 1,
      soldTickets: 1,
    });
    expect(noCampaigns.parsed?.summary).toEqual({
      grossRevenue: 0,
      activeCampaigns: 0,
      participants: 0,
      soldTickets: 0,
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
});
