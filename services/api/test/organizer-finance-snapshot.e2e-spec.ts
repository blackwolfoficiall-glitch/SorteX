import type { INestApplication } from '@nestjs/common';
import { LedgerStatus, UserRole } from '@prisma/client';
import { hash } from 'bcrypt';
import { randomBytes, randomUUID } from 'node:crypto';
import { SortexClient } from '../../../apps/mobile/src/api/client';
import {
  loadOrganizerFinance,
  organizerFinanceSession,
} from '../../../apps/mobile/src/organizer/finance';
import { createApplication } from '../src/application';
import { PrismaService } from '../src/prisma/prisma.service';

const database = process.env.SORTEX_FINANCE_E2E_DATABASE_URL;
const web = process.env.SORTEX_FINANCE_E2E_WEB_URL;
const isolated = database ? describe : describe.skip;

isolated(
  'Organizer finance read-only snapshots with isolated PostgreSQL',
  () => {
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
        !/^\/sortex_finance_[a-z0-9_]+$/.test(url.pathname)
      )
        throw new Error(
          'Use a freshly migrated disposable loopback database named sortex_finance_*.',
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
      const port = Number(process.env.SORTEX_FINANCE_E2E_API_PORT ?? 0);
      if (!Number.isInteger(port) || port < 0 || port > 65535 || (web && !port))
        throw new Error('Set the API port for the local Next BFF.');
      app = await createApplication();
      await app.listen(port, '127.0.0.1');
      prisma = app.get(PrismaService);
      base = await app.getUrl();
      if (
        (await prisma.user.count()) ||
        (await prisma.financialAccount.count())
      )
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
          name: 'Synthetic finance QA',
          email: `sortex-finance-${randomUUID()}@example.test`,
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

    it('loads truthful, paginated internal values for the owner without mutating the ledger', async () => {
      const owner = await account(UserRole.ORGANIZER);
      const other = await account(UserRole.ORGANIZER);
      const empty = await account(UserRole.ORGANIZER);
      const buyer = await account(UserRole.BUYER);
      const ledger = await prisma!.financialAccount.create({
        data: {
          ownerType: 'ORGANIZER',
          ownerId: owner.id,
          availableBalance: '8.00',
          pendingBalance: '10.00',
          blockedBalance: '2.00',
          lifetimeGrossRevenue: '9999999999999999.99',
          lifetimeNetRevenue: '20.00',
          lifetimePlatformFees: '1.29',
          lifetimeGatewayFees: '0.71',
        },
      });
      const foreign = await prisma!.financialAccount.create({
        data: {
          ownerType: 'ORGANIZER',
          ownerId: other.id,
          availableBalance: '123.45',
        },
      });
      const seed = {
        type: 'ORGANIZER_NET_REVENUE',
        direction: 'CREDIT',
        status: 'PENDING',
        amount: '10.00',
        balanceBefore: '0.00',
        balanceAfter: '10.00',
        description: 'Synthetic read-only fixture',
        metadata: { private: 'not exposed' },
      } as const;
      const pending = await prisma!.ledgerEntry.create({
        data: {
          ...seed,
          accountId: ledger.id,
          reference: 'finance-synthetic-pending',
          availableAt: new Date('2020-01-01T00:00:00.000Z'),
          createdAt: new Date('2026-10-02T00:00:00.000Z'),
        },
      });
      const privateForeign = await prisma!.ledgerEntry.create({
        data: {
          ...seed,
          accountId: foreign.id,
          reference: 'finance-synthetic-foreign',
        },
      });
      await prisma!.ledgerEntry.createMany({
        data: Array.from({ length: 15 }, (_, i) => ({
          ...seed,
          amount: '0.71',
          accountId: ledger.id,
          reference: `finance-synthetic-${i}`,
          type: 'GATEWAY_FEE',
          direction: 'DEBIT',
          status: 'COMPLETED',
          createdAt: new Date(
            `2026-10-01T00:00:${String(i).padStart(2, '0')}.000Z`,
          ),
        })),
      });

      const native = await mobile(owner.email);
      const current = organizerFinanceSession(native)!;
      const a = await loadOrganizerFinance(native, current, 1);
      const b = await loadOrganizerFinance(native, current, 2);
      if (a.kind !== 'ok' || b.kind !== 'ok')
        throw new Error('Native snapshot unavailable.');
      expect(a.balance).toEqual({
        currency: 'BRL',
        accountExists: true,
        gross: '9999999999999999.99',
        net: '20.00',
        available: '8.00',
        pending: '10.00',
        blocked: '2.00',
        platformFees: '1.29',
        gatewayFees: '0.71',
      });
      expect(a.statement.pagination).toEqual({
        page: 1,
        limit: 15,
        total: 16,
        pages: 2,
      });
      expect(a.statement.data[0]).toMatchObject({
        id: pending.id,
        amount: '10.00',
        status: 'PENDING',
      });
      const all = [...a.statement.data, ...b.statement.data];
      expect(new Set(all.map((row) => row.id)).size).toBe(16);
      expect(all.some((row) => row.id === privateForeign.id)).toBe(false);

      const auth = async (email: string) => {
        const response = await fetch(base + '/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        expect(response.status).toBe(201);
        return {
          Authorization: `Bearer ${((await response.json()) as { accessToken: string }).accessToken}`,
        };
      };
      const ownerHeaders = await auth(owner.email);
      for (const url of [
        '/finance/balance/snapshot',
        '/finance/statement/snapshot',
      ]) {
        expect((await fetch(base + url)).status).toBe(401);
        expect(
          (await fetch(base + url, { headers: await auth(buyer.email) }))
            .status,
        ).toBe(403);
      }
      const statement = await fetch(
        base + '/finance/statement/snapshot?page=1&limit=15',
        { headers: ownerHeaders },
      );
      expect(statement.headers.get('cache-control')).toBe('private, no-store');
      expect(await statement.json()).toEqual(a.statement);
      if (web) {
        const health = await fetch(web + '/api/health', { redirect: 'error' });
        expect(health.status).toBe(200);
        expect(((await health.json()) as { version: string }).version).toBe(
          version,
        );
        const webLogin = await fetch(web + '/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: owner.email, password }),
          redirect: 'error',
        });
        expect(webLogin.status).toBe(200);
        expect(
          ((await webLogin.json()) as { user: { id: string } }).user.id,
        ).toBe(owner.id);
        const cookie = webLogin.headers
          .getSetCookie()
          .map((value) => value.split(';')[0])
          .join('; ');
        expect(cookie).not.toBe('');
        for (const [suffix, expected] of [
          ['/balance/snapshot', a.balance],
          ['/statement/snapshot?page=1&limit=15', a.statement],
          ['/statement/snapshot?page=2&limit=15', b.statement],
        ] as const) {
          const result = await fetch(web + '/api/finance' + suffix, {
            headers: { cookie },
            redirect: 'error',
          });
          expect(result.status).toBe(200);
          expect(result.headers.get('cache-control')).toBe('private, no-store');
          expect(await result.json()).toEqual(expected);
        }
      }
      expect(
        (
          await fetch(base + '/finance/statement/snapshot?page=1.5', {
            headers: ownerHeaders,
          })
        ).status,
      ).toBe(400);

      const another = await mobile(other.email);
      const unrelated = await loadOrganizerFinance(
        another,
        organizerFinanceSession(another)!,
        1,
      );
      expect(unrelated).toMatchObject({
        kind: 'ok',
        balance: { available: '123.45' },
        statement: {
          data: [expect.objectContaining({ id: privateForeign.id })],
        },
      });
      const newOrganizer = await mobile(empty.email);
      const notOpened = await loadOrganizerFinance(
        newOrganizer,
        organizerFinanceSession(newOrganizer)!,
        1,
      );
      expect(notOpened).toMatchObject({
        kind: 'ok',
        balance: { accountExists: false },
        statement: { data: [], pagination: { total: 0, pages: 0 } },
      });
      expect(await prisma!.financialAccount.count()).toBe(2);
      expect(await prisma!.ledgerEntry.count()).toBe(17);
      expect(
        await prisma!.auditLog.count({ where: { action: 'BALANCE_RELEASED' } }),
      ).toBe(0);
      expect(
        (
          await prisma!.ledgerEntry.findUniqueOrThrow({
            where: { id: pending.id },
          })
        ).status,
      ).toBe(LedgerStatus.PENDING);
    });
  },
);
