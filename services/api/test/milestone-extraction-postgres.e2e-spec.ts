import type { INestApplication } from '@nestjs/common';
import { LotteryDrawStatus, LotterySourceType } from '@prisma/client';
import { hash } from 'bcrypt';
import { randomBytes, randomUUID } from 'node:crypto';
import { createApplication } from '../src/application';
import { PrismaService } from '../src/prisma/prisma.service';

const database = process.env.SORTEX_MILESTONE_DRAW_E2E_DATABASE_URL;
const isolated = database ? describe : describe.skip;

isolated(
  'Milestone extraction after snapshot (Nest HTTP and PostgreSQL)',
  () => {
    jest.setTimeout(45_000);
    let app: INestApplication | undefined;
    let prisma: PrismaService;
    let origin: string;
    let organizerId: string;
    let buyerId: string;
    let headers: Record<string, string>;
    const original = new Map<string, string | undefined>();

    beforeAll(async () => {
      const url = new URL(database!);
      if (
        url.protocol !== 'postgresql:' ||
        url.hostname !== '127.0.0.1' ||
        url.search ||
        url.hash ||
        !/^\/sortex_milestone_test_[a-z0-9_]+$/.test(url.pathname)
      )
        throw new Error('This suite requires a disposable IPv4 loopback DB.');
      for (const [key, value] of Object.entries({
        DATABASE_URL: database!,
        PRISMA_USE_PG_ADAPTER: 'true',
        APP_ENV: 'staging',
        UPLOADS_DISABLED: 'true',
        EMAIL_DELIVERY_MODE: 'disabled',
        PAYMENT_ENV: 'sandbox',
        INTEGRATIONS_MODE: 'sandbox',
        FEATURE_REAL_PAYMENTS: 'false',
        FEATURE_REAL_DRAWS: 'false',
        CAIXA_FEDERAL_IMPORT_ENABLED: 'false',
        JWT_ACCESS_SECRET: randomBytes(32).toString('hex'),
        JWT_REFRESH_SECRET: randomBytes(32).toString('hex'),
      })) {
        original.set(key, process.env[key]);
        process.env[key] = value;
      }
      app = await createApplication();
      await app.listen(0, '127.0.0.1');
      prisma = app.get(PrismaService);
      origin = await app.getUrl();
      if (await prisma.user.count())
        throw new Error('Requires an empty migrated disposable database.');
      const password = randomBytes(18).toString('hex');
      const passwordHash = await hash(password, 4);
      const organizer = await prisma.user.create({
        data: {
          name: 'Synthetic milestone organizer',
          email: 'milestone-organizer@example.test',
          password: passwordHash,
          role: 'ORGANIZER',
        },
      });
      organizerId = organizer.id;
      const buyer = await prisma.user.create({
        data: {
          name: 'Synthetic milestone buyer',
          email: 'milestone-buyer@example.test',
          password: passwordHash,
          role: 'BUYER',
        },
      });
      buyerId = buyer.id;
      const login = await fetch(origin + '/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: organizer.email, password }),
        redirect: 'error',
      });
      expect(login.status).toBe(201);
      const session = (await login.json()) as { accessToken: string };
      headers = { Authorization: `Bearer ${session.accessToken}` };
    });

    afterAll(async () => {
      try {
        await app?.close();
      } finally {
        for (const [key, value] of original) {
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        }
      }
    });

    async function lottery(
      date: string,
      status: LotteryDrawStatus,
      sourceType: LotterySourceType = 'OFFICIAL_API',
      drawTime?: string,
      officialProof = true,
      provider = 'LOTERIA_FEDERAL',
    ) {
      return prisma.lotteryDraw.create({
        data: {
          extractionNumber: `synthetic-${randomUUID()}`,
          provider,
          drawDate: new Date(date),
          drawTime,
          status,
          sourceType,
          firstPrize: '00091',
          secondPrize: '04852',
          thirdPrize: '00091',
          fourthPrize: '82438',
          fifthPrize: '39210',
          reviewedAt: new Date(),
          ...(sourceType === 'OFFICIAL_API' && officialProof
            ? {
                sourcePrizes: [
                  '000091',
                  '004852',
                  '000091',
                  '082438',
                  '039210',
                ],
                sourceDocumentHash: 'a'.repeat(64),
                sourceUrl: 'https://example.test/synthetic-milestone-only',
              }
            : {}),
        },
      });
    }

    async function fixture(options: {
      snapshotAt?: Date | null;
      scheduledAt?: Date;
    }) {
      const campaign = await prisma.campaign.create({
        data: {
          organizerId,
          title: '[FICTÍCIO] Sorteio por meta',
          slug: `milestone-qa-${randomUUID()}`,
          status: 'PUBLISHED',
          totalNumbers: 100_000,
          soldNumbers: 5_000,
          publishedRuleSnapshot: {
            version: 1,
            outputLength: 5,
            normalization: { mode: 'REJECT_OUT_OF_RANGE' },
            steps: ['TEN_THOUSAND', 'THOUSAND', 'HUNDRED', 'TEN', 'UNIT'].map(
              (digitPosition, order) => ({
                order: order + 1,
                sourcePrize: 1,
                digitPosition,
                direction: 'NORMAL',
              }),
            ),
          },
        },
      });
      const syntheticDate = new Date('2026-11-17T05:00:00Z');
      const paid = await prisma.purchase.create({
        data: {
          campaignId: campaign.id,
          buyerId,
          status: 'PAID',
          selectionMode: 'MANUAL',
          quantity: 1,
          unitPrice: 1,
          subtotal: 1,
          total: 1,
          expiresAt: syntheticDate,
          confirmedAt: syntheticDate,
        },
      });
      const pending = await prisma.purchase.create({
        data: {
          campaignId: campaign.id,
          buyerId,
          status: 'AWAITING_PAYMENT',
          selectionMode: 'MANUAL',
          quantity: 1,
          unitPrice: 1,
          subtotal: 1,
          total: 1,
          expiresAt: syntheticDate,
        },
      });
      const ticket = await prisma.ticket.create({
        data: {
          campaignId: campaign.id,
          buyerId,
          purchaseId: paid.id,
          status: 'SOLD',
          number: 91,
        },
      });
      await prisma.ticket.create({
        data: {
          campaignId: campaign.id,
          buyerId,
          purchaseId: pending.id,
          status: 'RESERVED',
          number: 92,
        },
      });

      const snapshotAt = options.snapshotAt;
      const milestone = await prisma.campaignMilestonePrize.create({
        data: {
          campaignId: campaign.id,
          name: 'Meta sintética',
          percentage: 5,
          scheduledAt: options.scheduledAt,
          ...(snapshotAt === undefined
            ? {}
            : {
                status: 'RELEASED',
                snapshotAt,
                reachedAt: snapshotAt ?? syntheticDate,
                eligibleTicketCount: 1,
                eligibleTickets: {
                  create: {
                    ticketId: ticket.id,
                    buyerId,
                    purchaseId: paid.id,
                    number: 91,
                    capturedAt: snapshotAt ?? syntheticDate,
                  },
                },
              }),
        },
      });
      return { campaign, milestone, ticket };
    }

    const invoke = (path: string) =>
      fetch(origin + path, { method: 'POST', headers, redirect: 'error' });
    const snapshot = (id: string) =>
      prisma.campaignMilestoneEligibleTicket.findMany({
        where: { milestoneId: id },
        orderBy: { number: 'asc' },
      });

    it('does not select an archived verification without an explicit schedule', async () => {
      await lottery('2026-11-18T00:00:00Z', 'LOCKED');
      const { campaign, milestone, ticket } = await fixture({});
      const base = `/campaigns/${campaign.id}/milestones`;
      const evaluated = await invoke(`${base}/evaluate`);
      expect(evaluated.status).toBe(201);
      expect(await evaluated.json()).toEqual([milestone.id]);
      const frozen = await snapshot(milestone.id);
      expect(frozen.map((row) => row.ticketId)).toEqual([ticket.id]);

      const response = await invoke(`${base}/${milestone.id}/draw`);
      expect(response.status).toBe(404);
      expect(await snapshot(milestone.id)).toEqual(frozen);
      expect(
        await prisma.campaignMilestonePrize.findUniqueOrThrow({
          where: { id: milestone.id },
        }),
      ).toMatchObject({
        status: 'RELEASED',
        lotteryDrawId: null,
        winnerTicketId: null,
      });
    });

    it('rejects same Brasília civil day and honours an elapsed schedule plus the freeze', async () => {
      await lottery('2026-11-21T22:00:00Z', 'VERIFIED', 'MANUAL');
      await lottery('2026-11-22T00:00:00Z', 'VERIFIED');
      // 23 November in UTC, but still 22 November in Brasília.
      await lottery('2026-11-23T02:30:00Z', 'LOCKED', 'MANUAL', '23:30');
      await lottery('2026-11-23T00:00:00Z', 'PENDING_REVIEW');
      await lottery('2099-11-26T00:00:00Z', 'VERIFIED');
      const capturedAt = new Date('2026-11-23T02:15:00Z');
      const { campaign, milestone, ticket } = await fixture({
        snapshotAt: capturedAt,
        scheduledAt: new Date('2026-11-21T18:00:00Z'),
      });
      const path = `/campaigns/${campaign.id}/milestones/${milestone.id}/draw`;
      const frozen = await snapshot(milestone.id);
      expect((await invoke(path)).status).toBe(404);

      const locked = await lottery('2026-11-24T00:00:00Z', 'LOCKED');
      const verified = await lottery('2026-11-23T00:00:00Z', 'VERIFIED');
      // This stored midnight precedes the freeze as a UTC instant, but the
      // source supplies just 23 November as a civil day, genuinely later.
      expect((await invoke(path)).status).toBe(201);
      expect(
        await prisma.campaignMilestonePrize.findUniqueOrThrow({
          where: { id: milestone.id },
        }),
      ).toMatchObject({
        status: 'DRAWN',
        lotteryDrawId: verified.id,
        winnerTicketId: ticket.id,
        eligibleTicketCount: 1,
        snapshotAt: capturedAt,
      });
      expect(await snapshot(milestone.id)).toEqual(frozen);

      const second = await fixture({
        snapshotAt: new Date('2026-11-24T02:15:00Z'),
      });
      expect(
        (
          await invoke(
            `/campaigns/${second.campaign.id}/milestones/${second.milestone.id}/draw`,
          )
        ).status,
      ).toBe(201);
      expect(
        await prisma.campaignMilestonePrize.findUniqueOrThrow({
          where: { id: second.milestone.id },
        }),
      ).toMatchObject({ lotteryDrawId: locked.id });
    });

    it('blocks ambiguous dates, sourceless official rows and non-Federal providers', async () => {
      await lottery('2026-11-25T00:00:00Z', 'VERIFIED', 'MANUAL');
      await lottery(
        '2026-11-25T00:00:00Z',
        'LOCKED',
        'OFFICIAL_API',
        undefined,
        false,
      );
      await lottery(
        '2026-11-25T14:00:00Z',
        'VERIFIED',
        'MANUAL',
        undefined,
        true,
        'LOTERIA_SINTETICA_NAO_FEDERAL',
      );
      const { campaign, milestone } = await fixture({
        // 24 November in Brasília; plain UTC midnight for 25 could still be
        // an instant on the same day, because the manual entry has no marker.
        snapshotAt: new Date('2026-11-25T02:15:00Z'),
        scheduledAt: new Date('2026-11-24T17:00:00Z'),
      });
      const path = `/campaigns/${campaign.id}/milestones/${milestone.id}/draw`;
      expect((await invoke(path)).status).toBe(404);
      const later = await lottery('2026-11-25T15:00:00Z', 'VERIFIED', 'MANUAL');
      expect((await invoke(path)).status).toBe(201);
      expect(
        await prisma.campaignMilestonePrize.findUniqueOrThrow({
          where: { id: milestone.id },
        }),
      ).toMatchObject({ lotteryDrawId: later.id });
    });

    it('refuses future schedule and missing capture metadata without rewriting the pool', async () => {
      for (const setup of [
        {
          snapshotAt: new Date('2026-11-22T00:00:00Z'),
          scheduledAt: new Date('2099-11-25T00:00:00Z'),
        },
        { snapshotAt: null },
      ]) {
        const { campaign, milestone } = await fixture(setup);
        const frozen = await snapshot(milestone.id);
        expect(
          (
            await invoke(
              `/campaigns/${campaign.id}/milestones/${milestone.id}/draw`,
            )
          ).status,
        ).toBe(400);
        expect(await snapshot(milestone.id)).toEqual(frozen);
        expect(
          await prisma.campaignMilestonePrize.findUniqueOrThrow({
            where: { id: milestone.id },
          }),
        ).toMatchObject({ status: 'RELEASED', lotteryDrawId: null });
      }
      expect(await prisma.payment.count()).toBe(0);
    });
  },
);
