import type { INestApplication } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { hash } from 'bcrypt';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApplication } from '../src/application';
import { PrismaService } from '../src/prisma/prisma.service';

const database = process.env.SORTEX_ADVISOR_E2E_DATABASE_URL;
const isolated = database ? describe : describe.skip;

isolated(
  'Advisor privacy and role boundaries (isolated PostgreSQL, no vendor calls)',
  () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let originalEnv: NodeJS.ProcessEnv;
    const endpoint = '/ai-sortex/advisor/chat';
    const question = 'Como estão minhas vendas?';
    const password = randomBytes(18).toString('hex');

    beforeAll(async () => {
      const url = new URL(database!);
      if (
        url.protocol !== 'postgresql:' ||
        url.hostname !== '127.0.0.1' ||
        !/^\/sortex_advisor_[a-z0-9_]+$/.test(url.pathname)
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
        JWT_ACCESS_SECRET: randomBytes(32).toString('hex'),
        JWT_REFRESH_SECRET: randomBytes(32).toString('hex'),
      };
      app = await createApplication();
      await app.init();
      prisma = app.get(PrismaService);
      if (await prisma.user.count())
        throw new Error('A freshly migrated, empty database is required.');
    });

    afterAll(async () => {
      try {
        await app?.close();
        await prisma?.$disconnect();
      } finally {
        if (originalEnv) process.env = originalEnv;
      }
    });

    afterEach(() => jest.restoreAllMocks());

    async function account(role: UserRole) {
      return prisma.user.create({
        data: {
          name: 'Synthetic Advisor account',
          email: `sortex-advisor-${randomUUID()}@example.test`,
          password: await hash(password, 4),
          role,
        },
      });
    }

    async function tokenFor(email: string) {
      const r = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(201);
      return `Bearer ${r.body.accessToken}`;
    }

    it('sends only approved tenant aggregates and never reaches transport for invalid, unapproved or unconsented requests', async () => {
      const owner = await account(UserRole.ORGANIZER);
      const other = await account(UserRole.ORGANIZER);
      const buyer = await account(UserRole.BUYER);
      for (const [id, amount] of [
        [owner.id, 1],
        [other.id, 3],
      ] as const) {
        await prisma.campaign.createMany({
          data: Array.from({ length: amount }, () => ({
            organizerId: id,
            title: 'Private synthetic title',
            slug: `sortex-advisor-${randomUUID()}`,
            purchasesBlocked: true,
          })),
        });
      }
      const [ownerToken, otherToken, buyerToken] = await Promise.all(
        [owner, other, buyer].map((user) => tokenFor(user.email)),
      );
      Object.assign(process.env, {
        SORTEX_ADVISOR_PROVIDER: 'openai',
        SORTEX_ADVISOR_PILOT_BUDGET: 'approved',
        SORTEX_ADVISOR_PILOT_ORGANIZER_ID: owner.id,
        OPENAI_API_KEY: 'isolated-test-not-a-key',
        OPENAI_MODEL: 'isolated-test-model',
      });
      const exchange = jest.spyOn(global, 'fetch').mockImplementation((url) => {
        expect(url).toBe('https://api.openai.com/v1/responses');
        return Promise.resolve(
          Response.json({
            status: 'completed',
            output: [
              {
                type: 'message',
                role: 'assistant',
                status: 'completed',
                content: [
                  {
                    type: 'output_text',
                    text: JSON.stringify({ answer: 'Revise sua operação.' }),
                  },
                ],
              },
            ],
          }),
        );
      });
      const chat = (auth?: string) => {
        const r = request(app.getHttpServer()).post(endpoint);
        return auth ? r.set('Authorization', auth) : r;
      };
      await chat().send({ question, allowAi: true }).expect(401);
      await chat(buyerToken).send({ question, allowAi: true }).expect(403);
      await chat(ownerToken).send({ question, allowAi: 'true' }).expect(400);
      await chat(ownerToken)
        .send({ question })
        .expect(201)
        .expect(({ body }) => expect(body.mode).toBe('DETERMINISTIC'));
      await chat(otherToken)
        .send({ question, allowAi: true })
        .expect(201)
        .expect(({ body }) => expect(body.mode).toBe('DETERMINISTIC'));
      await chat(ownerToken)
        .send({ question: `${question} ${owner.email}`, allowAi: true })
        .expect(201)
        .expect(({ body }) => expect(body.mode).toBe('DETERMINISTIC'));
      expect(exchange).not.toHaveBeenCalled();

      await chat(ownerToken)
        .send({ question, allowAi: true })
        .expect(201)
        .expect(({ body }) => {
          expect(body.mode).toBe('OPENAI');
          expect(body.answer).toBe('Revise sua operação.');
        });
      expect(exchange).toHaveBeenCalledTimes(1);
      const outbound = String(exchange.mock.calls[0][1]?.body);
      expect(JSON.parse(JSON.parse(outbound).input).aggregates.campaigns).toBe(
        1,
      );
      expect(outbound).not.toContain(owner.id);
      expect(outbound).not.toContain(owner.email);
      expect(outbound).not.toContain('Private synthetic title');
    }, 30_000);
  },
);
