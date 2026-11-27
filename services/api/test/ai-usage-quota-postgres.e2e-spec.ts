import { HttpException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import type { PrismaService } from '../src/prisma/prisma.service';
import { AiUsageQuotaService } from '../src/growth/ai-usage-quota.service';

const database = process.env.SORTEX_AI_QUOTA_E2E_DATABASE_URL;
const isolated = database ? describe : describe.skip;
type Counter = {
  scope: string;
  scopeId: string;
  requestCount: number;
  inputUnits: number;
  outputUnits: number;
};

isolated('Advisor budget with real PostgreSQL across work processes', () => {
  jest.setTimeout(30_000);
  let workers: { db: PrismaClient; quota: AiUsageQuotaService }[] = [];

  beforeAll(async () => {
    const url = new URL(database!);
    if (
      url.protocol !== 'postgresql:' ||
      url.hostname !== '127.0.0.1' ||
      !/^\/sortex_ai_quota_[a-z0-9_]+$/.test(url.pathname) ||
      url.search !== '' ||
      url.hash !== ''
    )
      throw new Error('Use only a migrated disposable loopback database.');
    workers = Array.from({ length: 3 }, () => {
      const db = new PrismaClient({
        adapter: new PrismaPg({ connectionString: database, max: 2 }),
      });
      return {
        db,
        quota: new AiUsageQuotaService(db as unknown as PrismaService),
      };
    });
    const [{ existing }] = await workers[0].db.$queryRaw<
      [{ existing: number }]
    >`
      SELECT COUNT(*)::int AS existing FROM "AiUsageDailyQuota"
    `;
    if (existing !== 0)
      throw new Error('The quota fixture requires an empty table.');
  });

  afterAll(async () => {
    await Promise.all(workers.map(({ db }) => db.$disconnect()));
  });

  async function concurrentReservations(
    count: number,
    organizerAt: (index: number) => string,
    inputUnits: number,
    outputUnits: number,
    expected: number,
  ) {
    const requests = Array.from({ length: count }, (_, index) =>
      workers[index % workers.length].quota.reserve({
        organizerId: organizerAt(index),
        inputUnits,
        outputUnits,
      }),
    );
    const result = await Promise.allSettled(requests);
    expect(result.filter(({ status }) => status === 'fulfilled')).toHaveLength(
      expected,
    );
    for (const entry of result)
      if (entry.status === 'rejected') {
        expect(entry.reason).toBeInstanceOf(HttpException);
        expect((entry.reason as HttpException).getStatus()).toBe(429);
      }
  }

  async function today() {
    const result = await workers[0].db.$queryRaw<Counter[]>`
      SELECT "scope", "scopeId", "requestCount", "inputUnits", "outputUnits"
      FROM "AiUsageDailyQuota"
      WHERE "day" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date
      ORDER BY "scope", "scopeId"
    `;
    return result;
  }

  it('shares request/input/output limits, rolls back partial debits and excludes yesterday', async () => {
    await workers[0].db.$executeRaw`
      INSERT INTO "AiUsageDailyQuota"
        ("day", "scope", "scopeId", "requestCount", "inputUnits", "outputUnits")
      VALUES ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - 1,
        'GLOBAL', 'GLOBAL', 24, 24576, 9216)
    `;

    // Six wins on the organizer's output limit, with no global partial
    // debit left by any of the subsequently denied organizer attempts.
    await concurrentReservations(12, () => 'organizer-a', 1024, 512, 6);
    expect(await today()).toEqual([
      {
        scope: 'GLOBAL',
        scopeId: 'GLOBAL',
        requestCount: 6,
        inputUnits: 6144,
        outputUnits: 3072,
      },
      {
        scope: 'ORGANIZER',
        scopeId: 'organizer-a',
        requestCount: 6,
        inputUnits: 6144,
        outputUnits: 3072,
      },
    ]);

    // Three wins on organizer input and eight on organizer request count.
    await concurrentReservations(12, () => 'organizer-b', 2176, 64, 3);
    await concurrentReservations(12, () => 'organizer-c', 256, 64, 8);

    // Four wins by aggregate global input even across separate organizers.
    await concurrentReservations(12, (i) => 'global-input-' + i, 2176, 512, 4);

    // Three more small requests hit the aggregate global request maximum.
    await concurrentReservations(12, (i) => 'global-requests-' + i, 256, 64, 3);
    const [global, ...organizers] = await today();
    expect(global).toEqual({
      scope: 'GLOBAL',
      scopeId: 'GLOBAL',
      requestCount: 24,
      inputUnits: 24192,
      outputUnits: 6016,
    });
    expect(organizers).toHaveLength(10);
    for (const field of ['requestCount', 'inputUnits', 'outputUnits'] as const)
      expect(organizers.reduce((total, scope) => total + scope[field], 0)).toBe(
        global[field],
      );
  });

  it('caps the shared output total even while other global limits have room', async () => {
    // Keep each artificial reservation but simulate a new UTC quota day.
    // The suite refuses a nonempty DB and uses only its disposable fixture.
    await workers[0].db.$executeRaw`
      UPDATE "AiUsageDailyQuota"
      SET "day" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - 2
      WHERE "day" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date
    `;

    await concurrentReservations(24, (i) => 'global-output-' + i, 256, 512, 18);
    const [global, ...organizers] = await today();
    expect(global).toEqual({
      scope: 'GLOBAL',
      scopeId: 'GLOBAL',
      requestCount: 18,
      inputUnits: 4608,
      outputUnits: 9216,
    });
    expect(organizers).toHaveLength(18);
  });
});
