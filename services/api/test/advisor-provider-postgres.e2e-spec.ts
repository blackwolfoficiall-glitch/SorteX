import type { INestApplication } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { hash } from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import request, { type Response as HttpResponse } from 'supertest';
import type { Server } from 'node:http';
import { createApplication } from '../src/application';
import { PrismaService } from '../src/prisma/prisma.service';

const database = process.env.SORTEX_ADVISOR_E2E_DATABASE_URL;
const isolated = database ? describe : describe.skip;
const GEMINI =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent';
const fixtureKey = 'AQ.disposable-no-real-key';
const question = 'Como estão minhas vendas?';
const endpoint = '/ai-sortex/advisor/chat';
type Quota = {
  scope: string;
  scopeId: string;
  requestCount: number;
  inputUnits: number;
  outputUnits: number;
};
type Outbound = {
  body: string;
  owner: string;
  beforeResponse: Quota[];
};
type ChatBody = {
  mode?: string;
  answer?: string;
  code?: string;
  fallbackReason?: string;
};
type Scope = { id: string; email: string; token: string };

function chatBody(response: HttpResponse): ChatBody {
  return response.body as ChatBody;
}

isolated(
  'Advisor Gemini HTTP authorization and shared quota (transport replaced)',
  () => {
    jest.setTimeout(45_000);
    let app: INestApplication | undefined;
    let prisma: PrismaService;
    let originalEnv: NodeJS.ProcessEnv;
    let password: string;
    let responseStatus = 200;
    let scopes: Scope[];
    let buyer: Scope;
    const exchanges: Outbound[] = [];

    beforeAll(async () => {
      const url = new URL(database!);
      if (
        url.protocol !== 'postgresql:' ||
        url.hostname !== '127.0.0.1' ||
        !/^\/sortex_advisor_[a-z0-9_]+$/.test(url.pathname) ||
        url.search !== '' ||
        url.hash !== ''
      )
        throw new Error(
          'A disposable loopback PostgreSQL database is required.',
        );
      originalEnv = process.env;
      process.env = {
        ...originalEnv,
        DATABASE_URL: database,
        APP_ENV: 'staging',
        APP_VERSION: randomUUID(),
        UPLOADS_DISABLED: 'true',
        EMAIL_DELIVERY_MODE: 'disabled',
        PAYMENT_ENV: 'sandbox',
        INTEGRATIONS_MODE: 'sandbox',
        FEATURE_REAL_PAYMENTS: 'false',
        FEATURE_PAYOUTS: 'false',
        FEATURE_EXTERNAL_CRM: 'false',
        JWT_ACCESS_SECRET: randomBytes(32).toString('hex'),
        JWT_REFRESH_SECRET: randomBytes(32).toString('hex'),
        SORTEX_ADVISOR_PROVIDER: 'gemini',
        SORTEX_ADVISOR_PILOT_BUDGET: 'approved',
        SORTEX_ADVISOR_SYNTHETIC_DATA: 'verified-fixtures-only',
        GEMINI_API_KEY: fixtureKey,
        GEMINI_MODEL: 'gemini-3.1-flash-lite',
        SORTEX_GEMINI_FREE_TIER: 'verified-no-billing',
        SORTEX_GEMINI_FREE_KEY_SHA256: createHash('sha256')
          .update(fixtureKey)
          .digest('hex'),
        SORTEX_GEMINI_FREE_VERIFIED_AT: new Date().toISOString(),
        // Verify Google failures never route to OpenAI even with both configured.
        OPENAI_API_KEY: 'isolated-test-not-a-key',
        OPENAI_MODEL: 'isolated-test-model',
      };
      delete process.env.SORTEX_ADVISOR_PILOT_ORGANIZER_ID;

      // Supertest speaks HTTP to the real Nest app without using global fetch.
      // Do not actually open any TCP connection from an outbound fetch path.
      jest.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
        if (url !== GEMINI)
          throw new Error('Unexpected egress blocked by test.');
        const headers = new Headers(init?.headers);
        const owner = process.env.SORTEX_ADVISOR_PILOT_ORGANIZER_ID;
        if (
          !owner ||
          init?.method !== 'POST' ||
          init.redirect !== 'error' ||
          headers.get('x-goog-api-key') !== fixtureKey ||
          typeof init.body !== 'string'
        )
          throw new Error('Unexpected provider request.');
        exchanges.push({
          owner,
          body: init.body,
          beforeResponse: await today(),
        });
        if (responseStatus !== 200)
          return Response.json(
            { detail: 'sensitive provider failure detail' },
            { status: responseStatus, headers: { 'Retry-After': '7331' } },
          );
        return Response.json({
          candidates: [
            {
              finishReason: 'STOP',
              content: {
                role: 'model',
                parts: [
                  {
                    text: JSON.stringify({
                      answer: 'Revise a operação de teste.',
                    }),
                  },
                ],
              },
            },
          ],
          usageMetadata: {
            promptTokenCount: 100,
            candidatesTokenCount: 30,
            thoughtsTokenCount: 5,
          },
        });
      });

      app = await createApplication();
      await app.init();
      prisma = app.get(PrismaService);
      const [count] = await prisma.$queryRaw<[{ count: number }]>`
      SELECT COUNT(*)::int AS count FROM "_prisma_migrations"
      WHERE "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL
    `;
      if (
        count.count !== 23 ||
        (await prisma.user.count()) !== 0 ||
        (await today()).length !== 0
      )
        throw new Error(
          'Requires an empty disposable database with the exact 23 QA migrations.',
        );
      password = randomBytes(18).toString('hex');
      scopes = [];
      for (let i = 1; i <= 4; i++)
        scopes.push(await account(UserRole.ORGANIZER));
      buyer = await account(UserRole.BUYER);
      await seedReview(scopes[0].id);
    });

    afterAll(async () => {
      try {
        await app?.close();
      } finally {
        try {
          await prisma?.$disconnect();
        } finally {
          if (originalEnv) process.env = originalEnv;
          jest.restoreAllMocks();
        }
      }
    });

    function server() {
      if (!app) throw new Error('Nest is not initialized.');
      return app.getHttpServer() as Server;
    }

    async function account(role: UserRole): Promise<Scope> {
      const { id, email } = await prisma.user.create({
        data: {
          name: 'Synthetic Advisor account',
          email: `sortex-advisor-${randomUUID()}@example.test`,
          password: await hash(password, 4),
          role,
        },
      });
      const r = await request(server())
        .post('/auth/login')
        .send({ email, password })
        .expect(201);
      const body = r.body as { accessToken: string };
      expect(typeof body.accessToken).toBe('string');
      return { id, email, token: `Bearer ${body.accessToken}` };
    }

    const ids = [
      'sortex-review-v1-c1',
      'sortex-review-v1-c2',
      'sortex-review-v1-c3',
    ];
    const auditId = 'sortex-review-v1-seed-audit';
    const auditMetadata = {
      fictitious: true,
      paymentProviderInvoked: false,
      officialDraw: false,
      campaigns: 3,
    };
    const annotation =
      'DADOS FICTÍCIOS · AVALIAÇÃO SORTEX · Nenhuma compra real.';
    const fixtures = [
      [
        'qa-avaliacao-pedal-urbano',
        '[FICTÍCIO] Pedal de Montanha',
        'DRAFT',
        28,
        '2.50',
        '70.00',
      ],
      [
        'qa-avaliacao-estudio-criativo',
        '[FICTÍCIO] Estúdio Criativo',
        'PAUSED',
        64,
        '3.75',
        '240.00',
      ],
      [
        'qa-avaliacao-fim-de-semana',
        '[FICTÍCIO] Refúgio de Fim de Semana',
        'CANCELLED',
        100,
        '1.25',
        '125.00',
      ],
    ] as const;

    async function seedReview(organizerId: string) {
      await prisma.auditLog.create({
        data: {
          id: auditId,
          entityType: 'QaSyntheticFixture',
          entityId: 'sortex-review-v1',
          action: 'QA_FIXTURE_CREATED',
          actorUserId: organizerId,
          actorRole: 'ORGANIZER',
          metadata: auditMetadata,
        },
      });
      for (const [
        index,
        [slug, title, status, quantity, unitPrice, total],
      ] of fixtures.entries()) {
        const campaignId = ids[index];
        await prisma.campaign.create({
          data: {
            id: campaignId,
            organizerId,
            slug,
            title,
            status,
            regulation: annotation,
            purchasesBlocked: true,
            drawBasis: 'MANUAL_RESULT',
            publishedRuleSnapshot: { syntheticReview: true },
          },
        });
        await prisma.purchase.create({
          data: {
            id: `${campaignId}-paid`,
            campaignId,
            buyerId: buyer.id,
            status: 'PAID',
            selectionMode: 'MANUAL',
            quantity,
            unitPrice,
            subtotal: total,
            total,
            expiresAt: new Date(),
            confirmedAt: new Date(),
            idempotencyKey: `${campaignId}-historical-test-only`,
          },
        });
        if (index < 2)
          await prisma.campaignPromotion.create({
            data: {
              id: `${campaignId}-promo`,
              campaignId,
              name: 'Pacote fictício de 10 cotas',
              numberQuantity: 10,
              packagePrice: 20,
              description: annotation,
            },
          });
      }
      await prisma.purchase.create({
        data: {
          id: 'sortex-review-v1-c1-expired',
          campaignId: ids[0],
          buyerId: buyer.id,
          status: 'EXPIRED',
          selectionMode: 'MANUAL',
          quantity: 2,
          unitPrice: '2.50',
          subtotal: '5.00',
          total: '5.00',
          expiresAt: new Date(),
          idempotencyKey: 'sortex-review-v1-c1-expired',
        },
      });

      // Deliberately place unrelated rows under the same tenant, and a
      // lookalike purchase and promo under an exact audited campaign itself.
      await prisma.campaign.createMany({
        data: [
          {
            organizerId,
            slug: 'same-tenant-unreviewed',
            title: 'Unreviewed same tenant',
            status: 'PUBLISHED',
          },
          {
            organizerId: scopes[1].id,
            slug: 'other-tenant-unreviewed',
            title: 'Unreviewed foreign tenant',
          },
        ],
      });
      await prisma.purchase.create({
        data: {
          id: 'sortex-review-v1-c1-lookalike-paid',
          campaignId: ids[0],
          buyerId: buyer.id,
          status: 'PAID',
          selectionMode: 'MANUAL',
          quantity: 11,
          unitPrice: 111,
          subtotal: 1221,
          total: 1221,
          expiresAt: new Date(),
          confirmedAt: new Date(),
          idempotencyKey: 'sortex-review-v1-c1-lookalike-historical-test-only',
        },
      });
      await prisma.campaignPromotion.create({
        data: {
          id: 'sortex-review-v1-c1-lookalike-promo',
          campaignId: ids[0],
          name: 'Pacote fictício de 10 cotas',
          numberQuantity: 10,
          packagePrice: 20,
          description: annotation,
        },
      });
      await prisma.financialAccount.create({
        data: {
          ownerType: 'ORGANIZER',
          ownerId: organizerId,
          availableBalance: '99771.11',
          pendingBalance: '97771.12',
        },
      });
    }

    async function configurePilot(actor: Scope) {
      // All DB edits are solely within this disposable test. Each simulated
      // pilot has one exact fixture source; global quota rows are not reset.
      await prisma.$transaction([
        prisma.campaign.updateMany({
          where: { id: { in: ids } },
          data: { organizerId: actor.id },
        }),
        prisma.auditLog.update({
          where: { id: auditId },
          data: { actorUserId: actor.id },
        }),
      ]);
      process.env.SORTEX_ADVISOR_PILOT_ORGANIZER_ID = actor.id;
    }

    function providerPayload(body: string): unknown {
      const payload = JSON.parse(body) as {
        contents: { parts: { text: string }[] }[];
      };
      return JSON.parse(payload.contents[0].parts[0].text) as unknown;
    }

    function chat(token?: string) {
      const req = request(server()).post(endpoint);
      return token ? req.set('Authorization', token) : req;
    }

    async function today() {
      return prisma.$queryRaw<Quota[]>`
      SELECT "scope", "scopeId", "requestCount", "inputUnits", "outputUnits"
      FROM "AiUsageDailyQuota"
      WHERE "day" = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date
      ORDER BY "scope", "scopeId"
    `;
    }

    function expectGemini(reply: HttpResponse) {
      expect(reply.status).toBe(201);
      expect(chatBody(reply)).toMatchObject({
        mode: 'GEMINI',
        answer: 'Revise a operação de teste.',
      });
    }

    function expectDeterministic(
      reply: HttpResponse,
      reason?: 'PROVIDER_RATE_LIMIT',
    ) {
      expect(reply.status).toBe(201);
      expect(chatBody(reply)).toMatchObject({ mode: 'DETERMINISTIC' });
      expect(chatBody(reply).fallbackReason).toBe(reason);
      expect(chatBody(reply).code).toBeUndefined();
      expect(reply.text).not.toContain('sensitive provider failure detail');
      expect(reply.text).not.toContain(fixtureKey);
      expect(reply.headers['retry-after']).toBeUndefined();
    }

    function expectQuota(reply: HttpResponse) {
      expect(reply.status).toBe(429);
      expect(chatBody(reply).code).toBe('AI_QUOTA_LIMIT');
      expect(chatBody(reply).mode).toBeUndefined();
      expect(chatBody(reply).fallbackReason).toBeUndefined();
    }

    it('authenticates, isolates tenants, validates opt-in and never sends arbitrary questions; commits quota before egress', async () => {
      const [owner, other] = scopes;
      process.env.SORTEX_ADVISOR_PILOT_ORGANIZER_ID = owner.id;
      await chat().send({ question, allowAi: true }).expect(401);
      await chat(buyer.token).send({ question, allowAi: true }).expect(403);
      await chat(owner.token).send({ question, allowAi: 'true' }).expect(400);
      expectDeterministic(await chat(owner.token).send({ question }));
      expectDeterministic(
        await chat(other.token).send({ question, allowAi: true }),
      );
      expectDeterministic(
        await chat(owner.token).send({
          question: `${question} ${owner.email}`,
          allowAi: true,
        }),
      );
      expect(exchanges).toHaveLength(0);
      expect(await today()).toEqual([]);

      // Even the exact account fails closed when the source audit or an exact order marker is wrong.
      await prisma.auditLog.update({
        where: { id: auditId },
        data: { metadata: { ...auditMetadata, officialDraw: true } },
      });
      expectDeterministic(
        await chat(owner.token).send({ question, allowAi: true }),
      );
      await prisma.auditLog.update({
        where: { id: auditId },
        data: { metadata: auditMetadata },
      });
      await prisma.purchase.update({
        where: { id: 'sortex-review-v1-c1-paid' },
        data: { total: 10000 },
      });
      expectDeterministic(
        await chat(owner.token).send({ question, allowAi: true }),
      );
      await prisma.purchase.update({
        where: { id: 'sortex-review-v1-c1-paid' },
        data: { total: '70.00' },
      });
      expect(exchanges).toHaveLength(0);
      expect(await today()).toEqual([]);

      expectGemini(await chat(owner.token).send({ question, allowAi: true }));
      expect(exchanges).toHaveLength(1);
      const [first] = exchanges;
      expect(providerPayload(first.body)).toEqual({
        source: 'SYNTHETIC_REVIEW_V1',
        intent: 'OVERVIEW',
        aggregates: {
          campaigns: 3,
          publishedCampaigns: 0,
          approvedSales: 3,
          revenue: 435,
          ticketsSold: 192,
          abandonedReservations: 1,
          pendingPayments: 0,
          promotions: 2,
        },
      });
      for (const secret of [
        owner.id,
        owner.email,
        other.id,
        buyer.id,
        buyer.email,
        fixtureKey,
        'Unreviewed same tenant',
        'Pedal de Montanha',
        'qa-avaliacao-pedal-urbano',
        question,
      ])
        expect(first.body).not.toContain(secret);
      const expected = {
        requestCount: 1,
        inputUnits: Buffer.byteLength(first.body, 'utf8') + 128,
        outputUnits: 512,
      };
      expect(first.beforeResponse).toEqual([
        { scope: 'GLOBAL', scopeId: 'GLOBAL', ...expected },
        { scope: 'ORGANIZER', scopeId: owner.id, ...expected },
      ]);
    });

    it('counts failed provider requests, labels only valid answers Gemini, and stops at per-organizer and shared limits', async () => {
      const [first, second, third, fourth] = scopes;
      process.env.SORTEX_ADVISOR_PILOT_ORGANIZER_ID = first.id;
      for (const [requested, key] of [
        ['Como está meu CRM?', 'crm'],
        ['Como está meu financeiro?', 'finance'],
        ['Qual a origem das vendas?', 'ads'],
      ]) {
        expectGemini(
          await chat(first.token).send({ question: requested, allowAi: true }),
        );
        const emitted = exchanges.at(-1)?.body ?? '';
        expect(providerPayload(emitted)).toMatchObject({ [key]: null });
        expect(emitted).not.toContain('99771.11');
        expect(emitted).not.toContain('97771.12');
      }
      responseStatus = 429;
      expectDeterministic(
        await chat(first.token).send({ question, allowAi: true }),
        'PROVIDER_RATE_LIMIT',
      );
      responseStatus = 200;
      expect(exchanges).toHaveLength(5);

      // Every attempted provider exchange reserves 512 output units, so the
      // tenant can reach six attempts although request-count capacity is eight.
      const ownReplies = await Promise.all(
        Array.from({ length: 3 }, () =>
          chat(first.token).send({ question, allowAi: true }),
        ),
      );
      expect(ownReplies.filter((reply) => reply.status === 201)).toHaveLength(
        1,
      );
      for (const reply of ownReplies) {
        if (reply.status === 201) expectGemini(reply);
        else expectQuota(reply);
      }
      expect(exchanges).toHaveLength(6);
      expect((await today()).map(({ requestCount }) => requestCount)).toEqual([
        6, 6,
      ]);

      // The production gate allows one synthetic organizer at a time. Rotate
      // only the test configuration to use distinct real authenticated scopes;
      // summarize counters from one shared DB without resetting any buckets.
      for (const other of [second, third]) {
        await configurePilot(other);
        for (let index = 0; index < 6; index++)
          expectGemini(
            await chat(other.token).send({ question, allowAi: true }),
          );
      }
      expect(exchanges).toHaveLength(18);
      await configurePilot(fourth);
      expectQuota(await chat(fourth.token).send({ question, allowAi: true }));
      expect(exchanges).toHaveLength(18);

      const [global, ...orgs] = await today();
      expect(global).toMatchObject({
        scope: 'GLOBAL',
        scopeId: 'GLOBAL',
        requestCount: 18,
        outputUnits: 9216,
      });
      expect(orgs).toHaveLength(3);
      expect(orgs.some((row) => row.scopeId === fourth.id)).toBe(false);
      for (const row of orgs)
        expect(row).toMatchObject({ requestCount: 6, outputUnits: 3072 });
      for (const name of ['requestCount', 'inputUnits', 'outputUnits'] as const)
        expect(orgs.reduce((sum, row) => sum + row[name], 0)).toBe(
          global[name],
        );
    });
  },
);
