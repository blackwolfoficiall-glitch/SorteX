import type { INestApplication } from '@nestjs/common';
import { CampaignStatus, UserRole } from '@prisma/client';
import { hash } from 'bcrypt';
import { execFile } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { SortexClient } from '../../../apps/mobile/src/api/client';
import { buyerInboxSession } from '../../../apps/mobile/src/buyer/inbox';
import { readFavorites } from '../../../apps/mobile/src/buyer/favorites';
import { createApplication } from '../src/application';
import { PrismaService } from '../src/prisma/prisma.service';

const database = process.env.SORTEX_FAVORITES_E2E_DATABASE_URL;
const web = process.env.SORTEX_FAVORITES_E2E_WEB_URL;
const browserCheck = process.env.SORTEX_FAVORITES_E2E_BROWSER === '1';
const isolated = database ? describe : describe.skip;

isolated('Buyer private favorites with isolated PostgreSQL', () => {
  jest.setTimeout(45_000);
  let app: INestApplication | undefined;
  let prisma: PrismaService | undefined;
  let base: string;
  const saved = new Map<string, string | undefined>();
  const password = randomBytes(18).toString('hex');
  const version = randomUUID();
  const favoritePath = '/buyer/favorites/private';

  beforeAll(async () => {
    const url = new URL(database!);
    if (
      url.protocol !== 'postgresql:' ||
      url.hostname !== '127.0.0.1' ||
      !/^\/sortex_favorites_[a-z0-9_]+$/.test(url.pathname)
    )
      throw new Error(
        'Use a freshly migrated disposable IPv4 loopback DB named sortex_favorites_*.',
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
    const port = Number(process.env.SORTEX_FAVORITES_E2E_API_PORT ?? 0);
    if (browserCheck && !web)
      throw new Error('Browser check requires local web URL.');
    if (
      web &&
      (!/^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}$/.test(web) ||
        port < 1 ||
        !Number.isInteger(port) ||
        port > 65535)
    )
      throw new Error('Set local BFF URL and API port.');
    app = await createApplication();
    await app.listen(port, '127.0.0.1');
    prisma = app.get(PrismaService);
    base = await app.getUrl();
    if ((await prisma.user.count()) || (await prisma.buyerFavorite.count()))
      throw new Error('Synthetic fixtures require an empty disposable DB.');
  });

  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      try {
        await prisma?.$disconnect();
      } finally {
        for (const [key, value] of saved) {
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        }
      }
    }
  });

  async function account(role: UserRole) {
    return prisma!.user.create({
      data: {
        name: 'Synthetic favorites QA',
        email: `sortex-favorites-${randomUUID()}@example.test`,
        password: await hash(password, 4),
        role,
      },
    });
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

  async function requestLogin(url: string, email: string) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      redirect: 'error',
    });
  }

  async function auth(email: string) {
    const response = await requestLogin(base + '/auth/login', email);
    expect(response.status).toBe(201);
    return {
      Authorization: `Bearer ${((await response.json()) as { accessToken: string }).accessToken}`,
    };
  }

  it('shares only the owner’s visible saved campaigns across clients, without making CRM leads', async () => {
    const owner = await account(UserRole.BUYER);
    const other = await account(UserRole.BUYER);
    const organizer = await account(UserRole.ORGANIZER);
    const campaign = (
      title: string,
      status: CampaignStatus,
      publicationBlocked = false,
    ) =>
      prisma!.campaign.create({
        data: {
          title,
          slug: `synthetic-favorites-${randomUUID()}`,
          organizerId: organizer.id,
          status,
          publicationBlocked,
          publishedAt: new Date(),
        },
      });
    const first = await campaign(
      'Synthetic Favorite from App',
      CampaignStatus.PUBLISHED,
    );
    const second = await campaign(
      'Synthetic Favorite from Web',
      CampaignStatus.PUBLISHED,
    );
    const paused = await campaign(
      'Synthetic hidden paused',
      CampaignStatus.PUBLISHED,
    );
    const blocked = await campaign(
      'Synthetic hidden blocked',
      CampaignStatus.PUBLISHED,
    );
    const draft = await campaign(
      'Synthetic hidden draft',
      CampaignStatus.DRAFT,
    );
    const slug = (id: string) => `${favoritePath}/${id}`;
    const read = (headers?: Record<string, string>) =>
      fetch(base + favoritePath, { headers });
    const mutate = (
      id: string,
      method: 'POST' | 'DELETE',
      headers?: Record<string, string>,
    ) => fetch(base + slug(id), { method, headers });

    const user = await mobile(owner.email);
    const session = buyerInboxSession(user)!;
    expect(session.buyerId).toBe(owner.id);
    expect(await readFavorites(user, session)).toEqual({
      kind: 'ok',
      items: [],
    });
    const ownerHeaders = await auth(owner.email);
    const otherHeaders = await auth(other.email);
    const organizerHeaders = await auth(organizer.email);
    expect((await read()).status).toBe(401);
    expect((await mutate(first.id, 'POST')).status).toBe(401);
    expect((await read(organizerHeaders)).status).toBe(403);
    expect((await mutate(first.id, 'POST', organizerHeaders)).status).toBe(403);
    expect((await mutate(first.id, 'DELETE', organizerHeaders)).status).toBe(
      403,
    );

    const fromApp = await readFavorites(user, session, {
      campaignId: first.id,
      saved: true,
    });
    expect(fromApp).toMatchObject({
      kind: 'ok',
      items: [{ campaign: { id: first.id, title: first.title } }],
    });
    const submissions = await Promise.all([
      mutate(first.id, 'POST', ownerHeaders),
      mutate(first.id, 'POST', ownerHeaders),
    ]);
    expect(submissions.map((response) => response.status)).toEqual([201, 201]);
    const receipts = await Promise.all(
      submissions.map(
        async (response) =>
          (await response.json()) as { id: string; createdAt: string },
      ),
    );
    expect(receipts[0]).toEqual(receipts[1]);
    expect(
      await prisma!.buyerFavorite.count({
        where: { buyerId: owner.id, campaignId: first.id },
      }),
    ).toBe(1);

    for (const done of await Promise.all([
      mutate(paused.id, 'POST', ownerHeaders),
      mutate(blocked.id, 'POST', ownerHeaders),
    ]))
      expect(done.status).toBe(201);
    await prisma!.campaign.update({
      where: { id: paused.id },
      data: { status: 'PAUSED' },
    });
    await prisma!.campaign.update({
      where: { id: blocked.id },
      data: { publicationBlocked: true },
    });
    for (const item of [draft, paused, blocked])
      expect((await mutate(item.id, 'POST', ownerHeaders)).status).toBe(404);
    // Hidden rows are retained non-destructively but must not expose campaigns.
    expect(
      await prisma!.buyerFavorite.count({ where: { buyerId: owner.id } }),
    ).toBe(3);

    const another = await mobile(other.email);
    expect(await readFavorites(another, buyerInboxSession(another)!)).toEqual({
      kind: 'ok',
      items: [],
    });
    expect((await mutate(first.id, 'DELETE', otherHeaders)).status).toBe(200);
    await user.logout();
    await user.login(owner.email, password);
    const fresh = buyerInboxSession(user)!;
    expect(await readFavorites(user, fresh)).toEqual(fromApp);
    const noCache = await read(ownerHeaders);
    expect(noCache.headers.get('cache-control')).toBe('private, no-store');
    expect((await noCache.json()) as unknown[]).toHaveLength(1);

    if (web) {
      const health = await fetch(web + '/api/health', { redirect: 'error' });
      expect(health.status).toBe(200);
      expect(((await health.json()) as { version: string }).version).toBe(
        version,
      );
      const login = await requestLogin(web + '/api/auth/login', owner.email);
      expect(login.status).toBe(200);
      expect(((await login.json()) as { user: { id: string } }).user.id).toBe(
        owner.id,
      );
      const cookie = login.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; ');
      const bff = await fetch(web + '/api' + favoritePath, {
        headers: { cookie },
        redirect: 'error',
      });
      expect(bff.status).toBe(200);
      expect(bff.headers.get('cache-control')).toBe('private, no-store');
      expect(await bff.json()).toEqual(await (await read(ownerHeaders)).json());
      if (browserCheck) {
        const { stdout } = await promisify(execFile)(
          process.execPath,
          [
            resolve(
              __dirname,
              '../../../apps/web/e2e/run-buyer-favorites-ui.mjs',
            ),
          ],
          {
            timeout: 30_000,
            env: {
              ...process.env,
              SORTEX_FAVORITES_E2E_BROWSER_EMAIL: owner.email,
              SORTEX_FAVORITES_E2E_BROWSER_PASSWORD: password,
            },
          },
        ).catch((error: unknown) => {
          const stderr = (error as { stderr?: unknown }).stderr;
          throw new Error(
            typeof stderr === 'string' && stderr.trim()
              ? stderr
              : 'Local Chromium favorites run did not return a result.',
          );
        });
        expect(stdout).toContain('PASS: browser catalog save');
      } else {
        expect(
          (
            await fetch(web + '/api' + slug(second.id), {
              method: 'POST',
              headers: { cookie },
              redirect: 'error',
            })
          ).status,
        ).toBe(201);
        expect(
          (
            await fetch(web + '/api' + slug(first.id), {
              method: 'DELETE',
              headers: { cookie },
              redirect: 'error',
            })
          ).status,
        ).toBe(200);
      }
    } else {
      await readFavorites(user, fresh, { campaignId: second.id, saved: true });
      await readFavorites(user, fresh, { campaignId: first.id, saved: false });
    }

    expect(await readFavorites(user, fresh)).toMatchObject({
      kind: 'ok',
      items: [{ campaign: { id: second.id, title: second.title } }],
    });
    expect((await mutate(first.id, 'DELETE', ownerHeaders)).status).toBe(200);
    const removed = await readFavorites(user, fresh, {
      campaignId: second.id,
      saved: false,
    });
    expect(removed).toEqual({ kind: 'ok', items: [] });
    expect(
      await prisma!.buyerFavorite.count({ where: { buyerId: owner.id } }),
    ).toBe(2);
    expect(
      await prisma!.crmContact.count({ where: { organizerId: organizer.id } }),
    ).toBe(0);
    expect(
      await prisma!.crmInteraction.count({
        where: { organizerId: organizer.id },
      }),
    ).toBe(0);
    expect(await prisma!.notification.count()).toBe(0);
  });
});
