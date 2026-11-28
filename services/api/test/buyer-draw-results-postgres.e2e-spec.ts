import type { INestApplication } from '@nestjs/common';
import { CampaignDrawStatus, CampaignStatus, UserRole } from '@prisma/client';
import { hash } from 'bcrypt';
import { randomBytes, randomUUID } from 'node:crypto';
import { SortexClient } from '../../../apps/mobile/src/api/client';
import { loadBuyerDrawResults } from '../../../apps/mobile/src/buyer/draw-results';
import { createApplication } from '../src/application';
import { PrismaService } from '../src/prisma/prisma.service';

const database = process.env.SORTEX_PRIVATE_RESULTS_E2E_DATABASE_URL;
const isolated = database ? describe : describe.skip;

isolated('Buyer draw results with isolated PostgreSQL', () => {
  jest.setTimeout(45_000);
  let app: INestApplication | undefined;
  let prisma: PrismaService | undefined;
  let base: string;
  const previous = new Map<string, string | undefined>();
  const password = randomBytes(18).toString('hex');
  const endpoint = '/buyer/results/my';
  const web = process.env.SORTEX_PRIVATE_RESULTS_E2E_WEB_URL;

  beforeAll(async () => {
    const url = new URL(database!);
    const port = Number(process.env.SORTEX_PRIVATE_RESULTS_E2E_API_PORT ?? 0);
    if (
      url.protocol !== 'postgresql:' ||
      url.hostname !== '127.0.0.1' ||
      !/^\/sortex_own_results_[a-z0-9_]+$/.test(url.pathname) ||
      (web &&
        (!/^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}$/.test(web) ||
          !Number.isInteger(port) ||
          port < 1 ||
          port > 65535))
    )
      throw new Error(
        'Use a freshly migrated disposable IPv4 loopback DB and optional loopback BFF.',
      );
    for (const [key, value] of Object.entries({
      DATABASE_URL: database!,
      APP_ENV: 'staging',
      APP_VERSION: randomUUID(),
      UPLOADS_DISABLED: 'true',
      EMAIL_DELIVERY_MODE: 'disabled',
      PAYMENT_ENV: 'sandbox',
      INTEGRATIONS_MODE: 'sandbox',
      FEATURE_REAL_PAYMENTS: 'false',
      FEATURE_REAL_DRAWS: 'false',
      JWT_ACCESS_SECRET: randomBytes(32).toString('hex'),
      JWT_REFRESH_SECRET: randomBytes(32).toString('hex'),
    })) {
      previous.set(key, process.env[key]);
      process.env[key] = value;
    }
    app = await createApplication();
    await app.listen(port, '127.0.0.1');
    prisma = app.get(PrismaService);
    base = await app.getUrl();
    if (await prisma.user.count())
      throw new Error('Requires an empty disposable database.');
  });

  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      try {
        await prisma?.$disconnect();
      } finally {
        for (const [key, value] of previous) {
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        }
      }
    }
  });

  async function account(role: UserRole) {
    return prisma!.user.create({
      data: {
        name: 'Synthetic private results QA',
        email: `sortex-own-results-${randomUUID()}@example.test`,
        password: await hash(password, 4),
        role,
      },
    });
  }
  async function login(origin: string, path: string, email: string) {
    return fetch(origin + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
      redirect: 'error',
    });
  }
  async function auth(email: string) {
    const loginResponse = await login(base, '/auth/login', email);
    expect(loginResponse.status).toBe(201);
    const data = (await loginResponse.json()) as { accessToken: string };
    return { Authorization: `Bearer ${data.accessToken}` };
  }

  it('serves marked simulations only to actual paid ticket holders in QA, keeps public states unchanged and hides invalid, unpaid and foreign rows', async () => {
    const organizer = await account('ORGANIZER');
    const buyer = await account('BUYER');
    const other = await account('BUYER');
    const helper = async (
      id: string,
      status: CampaignStatus,
      simulated: boolean,
    ) => {
      const campaign = await prisma!.campaign.create({
        data: {
          id,
          organizerId: organizer.id,
          title: simulated ? '[FICTÍCIO] Avaliação' : '[FICTÍCIO] Controle',
          slug: `qa-own-results-${id}`,
          status,
          purchasesBlocked: true,
        },
      });
      await prisma!.campaignDraw.create({
        data: {
          campaignId: id,
          ruleSnapshot: { syntheticReview: simulated },
          resultSnapshot: {
            syntheticReview: simulated,
            unrelatedDetail: 'never projected',
          },
          winningNumber: '00042',
          normalizedWinningNumber: '42',
          status: simulated
            ? CampaignDrawStatus.SIMULATED
            : CampaignDrawStatus.CONFIRMED,
          executedByUserId: organizer.id,
          auditHash: randomBytes(32).toString('hex'),
        },
      });
      return campaign;
    };
    const synthetic = await helper('sortex-review-v1-c3', 'CANCELLED', true);
    const hiddenSim = await helper('hidden-sim', 'CANCELLED', true);
    const hiddenConfirmed = await helper('hidden-confirmed', 'DRAFT', false);
    const valid = await helper('visible-confirmed', 'FINISHED', false);
    const unpaid = await helper('unpaid-confirmed', 'FINISHED', false);
    const foreignTicket = await helper('foreign-ticket', 'FINISHED', false);
    const mismatched = await helper('mismatched-ticket', 'FINISHED', false);
    const noNumber = await helper('no-number', 'FINISHED', false);
    async function order(
      campaignId: string,
      status: 'PAID' | 'EXPIRED',
      ticketBuyerId = buyer.id,
      ticketCampaignId = campaignId,
    ) {
      const purchased = await prisma!.purchase.create({
        data: {
          buyerId: buyer.id,
          campaignId,
          status,
          selectionMode: 'MANUAL',
          quantity: 1,
          unitPrice: 1,
          subtotal: 1,
          total: 1,
          expiresAt: new Date(),
        },
      });
      await prisma!.ticket.create({
        data: {
          buyerId: ticketBuyerId,
          campaignId: ticketCampaignId,
          purchaseId: purchased.id,
          number: 42,
          status: 'SOLD',
        },
      });
    }
    await order(synthetic.id, 'PAID');
    await order(hiddenSim.id, 'PAID');
    await order(hiddenConfirmed.id, 'PAID');
    await order(valid.id, 'PAID');
    await order(unpaid.id, 'EXPIRED');
    await order(foreignTicket.id, 'PAID', other.id);
    await order(mismatched.id, 'PAID', buyer.id, noNumber.id);

    const [buyerAuth, otherAuth, organizerAuth] = await Promise.all([
      auth(buyer.email),
      auth(other.email),
      auth(organizer.email),
    ]);
    const expected = [
      {
        id: synthetic.id,
        title: synthetic.title,
        synthetic: true,
        draws: [{ winningNumber: '00042' }],
        winners: [],
      },
      {
        id: valid.id,
        title: valid.title,
        draws: [{ winningNumber: '00042' }],
        winners: [],
      },
    ];
    const owned = await fetch(base + endpoint, { headers: buyerAuth });
    expect(owned.status).toBe(200);
    expect(owned.headers.get('cache-control')).toBe('private, no-store');
    expect(await owned.json()).toEqual(expected);
    expect(
      await (await fetch(base + endpoint, { headers: otherAuth })).json(),
    ).toEqual([]);
    expect(
      (await fetch(base + endpoint, { headers: organizerAuth })).status,
    ).toBe(403);
    expect((await fetch(base + endpoint)).status).toBe(401);
    expect(
      (await fetch(base + '/public/campaigns/' + synthetic.slug)).status,
    ).toBe(404);
    const profile = await fetch(
      base + '/public/campaigns/organizers/' + organizer.id + '/profile',
    );
    expect(profile.status).toBe(200);
    expect(JSON.stringify(await profile.json())).not.toContain(synthetic.id);

    const mobile = new SortexClient(base, {
      read: async () => null,
      write: async () => {},
      clear: async () => {},
    });
    await mobile.login(buyer.email, password);
    await expect(loadBuyerDrawResults(mobile, buyer.id)).resolves.toEqual(
      expected,
    );

    if (web) {
      const anonymous = await fetch(web + '/api' + endpoint);
      expect(anonymous.status).toBe(401);
      expect(anonymous.headers.get('cache-control')).toBe('private, no-store');
      const response = await login(web, '/api/auth/login', buyer.email);
      expect(response.status).toBe(200);
      const cookie = response.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; ');
      const viaWeb = await fetch(web + '/api' + endpoint, {
        headers: { Cookie: cookie },
      });
      expect(viaWeb.status).toBe(200);
      expect(viaWeb.headers.get('cache-control')).toBe('private, no-store');
      expect(await viaWeb.json()).toEqual(expected);
    }

    const gates = {
      APP_ENV: 'production',
      PAYMENT_ENV: 'production',
      INTEGRATIONS_MODE: 'live',
      FEATURE_REAL_PAYMENTS: 'true',
      FEATURE_REAL_DRAWS: 'true',
    };
    for (const [key, wrong] of Object.entries(gates)) {
      const approved = process.env[key];
      process.env[key] = wrong;
      try {
        const gated = await fetch(base + endpoint, { headers: buyerAuth });
        expect(await gated.json()).toEqual([expected[1]]);
      } finally {
        process.env[key] = approved;
      }
    }
    // Even with the target ID, one marker alone must not enable the fixture.
    await prisma!.campaignDraw.update({
      where: { campaignId: synthetic.id },
      data: { resultSnapshot: { syntheticReview: false } },
    });
    expect(
      await (await fetch(base + endpoint, { headers: buyerAuth })).json(),
    ).toEqual([expected[1]]);
    expect(await prisma!.payment.count()).toBe(0);
  });
});
