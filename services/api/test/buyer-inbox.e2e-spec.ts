import type { INestApplication } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { hash } from 'bcrypt';
import { execFile } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { SortexClient } from '../../../apps/mobile/src/api/client';
import {
  buyerInboxSession,
  readBuyerInbox,
} from '../../../apps/mobile/src/buyer/inbox';
import { createApplication } from '../src/application';
import { PrismaService } from '../src/prisma/prisma.service';

const database = process.env.SORTEX_INBOX_E2E_DATABASE_URL;
const web = process.env.SORTEX_INBOX_E2E_WEB_URL;
const browserCheck = process.env.SORTEX_INBOX_E2E_BROWSER === '1';
const isolated = database ? describe : describe.skip;

isolated('Buyer notification inbox with isolated PostgreSQL', () => {
  jest.setTimeout(45_000);
  let app: INestApplication | undefined;
  let prisma: PrismaService | undefined;
  let base: string;
  const saved = new Map<string, string | undefined>();
  const password = randomBytes(18).toString('hex');
  const version = randomUUID();
  const inboxPath = '/buyer/notifications';

  beforeAll(async () => {
    const url = new URL(database!);
    if (
      url.protocol !== 'postgresql:' ||
      url.hostname !== '127.0.0.1' ||
      !/^\/sortex_inbox_[a-z0-9_]+$/.test(url.pathname)
    )
      throw new Error(
        'Use a freshly migrated disposable IPv4 loopback DB named sortex_inbox_*.',
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
    const port = Number(process.env.SORTEX_INBOX_E2E_API_PORT ?? 0);
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
    if ((await prisma.user.count()) || (await prisma.notification.count()))
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
        name: 'Synthetic inbox QA',
        email: `sortex-inbox-${randomUUID()}@example.test`,
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

  it('persists own single/bulk reads, never returns or changes other or deleted rows, and denies other roles', async () => {
    const owner = await account(UserRole.BUYER);
    const other = await account(UserRole.BUYER);
    const organizer = await account(UserRole.ORGANIZER);
    const seed = {
      type: 'TEST_ONLY',
      message: 'Synthetic internal inbox, no delivery.',
      data: { private: 'not exposed' },
    };
    const top = await prisma!.notification.create({
      data: {
        ...seed,
        title: 'First synthetic',
        userId: owner.id,
        createdAt: new Date('2026-11-26T10:00:00.000Z'),
      },
    });
    const second = await prisma!.notification.create({
      data: {
        ...seed,
        title: 'Second synthetic',
        userId: owner.id,
        createdAt: new Date('2026-11-25T10:00:00.000Z'),
      },
    });
    const third = await prisma!.notification.create({
      data: {
        ...seed,
        title: 'Third synthetic',
        userId: owner.id,
        createdAt: new Date('2026-11-24T10:00:00.000Z'),
      },
    });
    const deleted = await prisma!.notification.create({
      data: {
        ...seed,
        title: 'Deleted fixture',
        userId: owner.id,
        deletedAt: new Date(),
      },
    });
    const foreign = await prisma!.notification.create({
      data: { ...seed, title: 'Another buyer', userId: other.id },
    });
    const organizerRow = await prisma!.notification.create({
      data: { ...seed, title: 'Organizer only', userId: organizer.id },
    });

    const user = await mobile(owner.email);
    const session = buyerInboxSession(user)!;
    expect(session.buyerId).toBe(owner.id);
    const firstView = await readBuyerInbox(user, session);
    expect(firstView?.map((item) => [item.id, item.readAt])).toEqual([
      [top.id, null],
      [second.id, null],
      [third.id, null],
    ]);
    expect(
      (await user.request<{ unreadNotifications: number }>('/buyer/home'))
        .unreadNotifications,
    ).toBe(3);
    const ownerHeaders = await auth(owner.email);
    const otherHeaders = await auth(other.email);
    const organizerHeaders = await auth(organizer.email);
    const get = (headers?: Record<string, string>) =>
      fetch(base + inboxPath, { headers });
    const mark = (suffix: string, headers?: Record<string, string>) =>
      fetch(base + inboxPath + suffix, { method: 'POST', headers });

    expect((await get()).status).toBe(401);
    expect((await mark('/read-all')).status).toBe(401);
    expect((await get(organizerHeaders)).status).toBe(403);
    expect((await mark('/read-all', organizerHeaders)).status).toBe(403);
    expect(
      (await mark(`/${organizerRow.id}/read`, organizerHeaders)).status,
    ).toBe(403);
    expect((await mark(`/${top.id}/read`, otherHeaders)).status).toBe(404);
    expect((await mark(`/${deleted.id}/read`, ownerHeaders)).status).toBe(404);

    const transportView = await get(ownerHeaders);
    expect(transportView.headers.get('cache-control')).toBe(
      'private, no-store',
    );
    expect(await transportView.json()).toEqual(firstView); // No userId, metadata, or deletedAt sent.
    const singleRead = await readBuyerInbox(user, session, {
      kind: 'one',
      id: top.id,
    });
    const readAt = singleRead?.find((item) => item.id === top.id)?.readAt;
    expect(readAt).toBeTruthy();
    expect(singleRead?.find((item) => item.id === second.id)?.readAt).toBe(
      null,
    );
    await user.logout();
    await user.login(owner.email, password);
    const freshSession = buyerInboxSession(user)!;
    expect(
      (await readBuyerInbox(user, freshSession))?.find(
        (item) => item.id === top.id,
      )?.readAt,
    ).toBe(readAt);
    expect((await mark(`/${top.id}/read`, ownerHeaders)).status).toBe(201);
    expect(
      (
        await prisma!.notification.findUniqueOrThrow({ where: { id: top.id } })
      ).readAt?.toISOString(),
    ).toBe(readAt);

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
      expect(cookie).not.toBe('');
      const browser = await fetch(web + '/api' + inboxPath, {
        headers: { cookie },
        redirect: 'error',
      });
      expect(browser.status).toBe(200);
      expect(browser.headers.get('cache-control')).toBe('private, no-store');
      expect(await browser.json()).toEqual(singleRead);
      if (browserCheck) {
        const { stdout } = await promisify(execFile)(
          process.execPath,
          [resolve(__dirname, '../../../apps/web/e2e/run-buyer-inbox-ui.mjs')],
          {
            timeout: 30_000,
            env: {
              ...process.env,
              SORTEX_INBOX_E2E_BROWSER_EMAIL: owner.email,
              SORTEX_INBOX_E2E_BROWSER_PASSWORD: password,
            },
          },
        ).catch((error: unknown) => {
          const stderr = (error as { stderr?: unknown }).stderr;
          throw new Error(
            typeof stderr === 'string' && stderr.trim()
              ? stderr
              : 'Local Chromium inbox run did not return a result.',
          );
        });
        expect(stdout).toContain(
          'PASS: browser Home → inbox, single/bulk mark',
        );
      } else {
        expect(
          (
            await fetch(web + '/api' + inboxPath + '/read-all', {
              headers: { cookie },
              method: 'POST',
              redirect: 'error',
            })
          ).status,
        ).toBe(201);
      }
    } else {
      await readBuyerInbox(user, freshSession, { kind: 'all' });
    }

    const unread = await readBuyerInbox(user, freshSession);
    expect(unread?.filter((item) => !item.readAt)).toEqual([]);
    expect(unread?.find((item) => item.id === top.id)?.readAt).toBe(readAt);
    expect(
      (await user.request<{ unreadNotifications: number }>('/buyer/home'))
        .unreadNotifications,
    ).toBe(0);
    for (const id of [foreign.id, deleted.id, organizerRow.id])
      expect(
        (await prisma!.notification.findUniqueOrThrow({ where: { id } }))
          .readAt,
      ).toBe(null);
    expect(await prisma!.notification.count()).toBe(6);
  });
});
