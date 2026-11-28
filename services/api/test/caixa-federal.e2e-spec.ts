import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminTeamRole, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { DrawsModule } from '../src/draws/draws.module';
import { PrismaService } from '../src/prisma/prisma.service';

const isolatedUrl = process.env.SORTEX_FEDERAL_TEST_DATABASE_URL;
if (isolatedUrl) {
  const url = new URL(isolatedUrl);
  if (
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    !/^\/sortex_federal_[a-z0-9_]+$/.test(url.pathname)
  )
    throw new Error(
      'Federal tests require a loopback sortex_federal_* database.',
    );
  process.env.DATABASE_URL = isolatedUrl;
}
const isolated = isolatedUrl ? describe : describe.skip;
isolated('CAIXA Federal HTTP and isolated PostgreSQL', () => {
  let app: INestApplication;
  let db: PrismaService;
  let adminToken: string;
  let buyerToken: string;
  let importedId: string | undefined;
  const userIds: string[] = [];
  const importPath = '/admin/lottery-draws/import/caixa';
  const previousFlag = process.env.CAIXA_FEDERAL_IMPORT_ENABLED;

  beforeAll(async () => {
    process.env.CAIXA_FEDERAL_IMPORT_ENABLED = 'false';
    const module = await Test.createTestingModule({
      imports: [AuthModule, DrawsModule],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    db = app.get(PrismaService);
    const password = `Fixture!${randomUUID()}`;
    const hash = await bcrypt.hash(password, 10);
    for (const role of [UserRole.ADMIN, UserRole.BUYER]) {
      const user = await db.user.create({
        data: {
          name: 'Conta sintética Federal',
          email: `${randomUUID()}@example.test`,
          password: hash,
          verified: true,
          status: 'ACTIVE',
          isActive: true,
          role,
          ...(role === UserRole.ADMIN && {
            adminTeamRole: AdminTeamRole.SUPERADMIN,
          }),
        },
      });
      userIds.push(user.id);
      const login = await request(app.getHttpServer())
        .post(role === UserRole.ADMIN ? '/auth/admin-login' : '/auth/login')
        .send({ email: user.email, password })
        .expect(201);
      if (role === UserRole.ADMIN) adminToken = String(login.body.accessToken);
      else buyerToken = String(login.body.accessToken);
    }
  }, 15_000);

  afterAll(async () => {
    if (previousFlag === undefined)
      delete process.env.CAIXA_FEDERAL_IMPORT_ENABLED;
    else process.env.CAIXA_FEDERAL_IMPORT_ENABLED = previousFlag;
    if (db && importedId) {
      await db.auditLog.deleteMany({
        where: { entityType: 'LotteryDraw', entityId: importedId },
      });
      await db.lotteryDraw.delete({ where: { id: importedId } });
    }
    if (db && userIds.length) {
      await db.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await app?.close();
  });

  it('rejects unauthenticated calls and buyers before contacting CAIXA', async () => {
    await request(app.getHttpServer())
      .post(importPath)
      .send({ extractionNumber: '6091' })
      .expect(401);
    await request(app.getHttpServer())
      .post(importPath)
      .auth(buyerToken, { type: 'bearer' })
      .send({ extractionNumber: '6091' })
      .expect(403);
  });
  it('rejects malformed IDs and keeps the integration disabled unless explicitly enabled', async () => {
    await request(app.getHttpServer())
      .post(importPath)
      .auth(adminToken, { type: 'bearer' })
      .send({ extractionNumber: '6091/teste' })
      .expect(400);
    await request(app.getHttpServer())
      .post(importPath)
      .auth(adminToken, { type: 'bearer' })
      .send({ extractionNumber: '6091' })
      .expect(503);
  });
  const live = process.env.SORTEX_FEDERAL_LIVE_CHECK === 'true' ? it : it.skip;
  live(
    'imports one official historical draw as pending, audits it and does not replace it',
    async () => {
      process.env.CAIXA_FEDERAL_IMPORT_ENABLED = 'true';
      expect(
        await db.lotteryDraw.count({
          where: { lotteryName: 'Loteria Federal', extractionNumber: '6091' },
        }),
      ).toBe(0);
      const first = await request(app.getHttpServer())
        .post(importPath)
        .auth(adminToken, { type: 'bearer' })
        .send({ extractionNumber: '6091' })
        .expect(201);
      importedId = String(first.body.id);
      const row = await db.lotteryDraw.findUniqueOrThrow({
        where: { id: importedId },
        include: { campaignDraws: true },
      });
      expect(row).toMatchObject({
        firstPrize: '86997',
        secondPrize: '04852',
        thirdPrize: '00091',
        fourthPrize: '82438',
        fifthPrize: '39210',
        sourcePrizes: ['086997', '004852', '000091', '082438', '039210'],
        sourceType: 'OFFICIAL_API',
        status: 'PENDING_REVIEW',
        sourceDocumentHash: expect.stringMatching(/^[0-9a-f]{64}$/),
        campaignDraws: [],
      });
      expect(
        await db.auditLog.count({
          where: {
            entityId: importedId,
            entityType: 'LotteryDraw',
            action: 'IMPORTED_CAIXA',
          },
        }),
      ).toBe(1);
      await request(app.getHttpServer())
        .post(importPath)
        .auth(adminToken, { type: 'bearer' })
        .send({ extractionNumber: '6091' })
        .expect(409);
      await request(app.getHttpServer())
        .patch(`/admin/lottery-draws/${importedId}`)
        .auth(adminToken, { type: 'bearer' })
        .send({ thirdPrize: '99999' })
        .expect(409);
      expect(
        await db.lotteryDraw.findUnique({ where: { id: importedId } }),
      ).toMatchObject({ thirdPrize: '00091', status: 'PENDING_REVIEW' });
      await request(app.getHttpServer())
        .post(`/admin/lottery-draws/${importedId}/lock`)
        .auth(adminToken, { type: 'bearer' })
        .send({ reason: 'Teste sintético: verificação ainda pendente' })
        .expect(409);
      for (const [route, status] of [
        ['verify', 'VERIFIED'],
        ['lock', 'LOCKED'],
      ] as const) {
        const response = await request(app.getHttpServer())
          .post(`/admin/lottery-draws/${importedId}/${route}`)
          .auth(adminToken, { type: 'bearer' })
          .send({ reason: 'Teste sintético: extração CAIXA conferida' })
          .expect(201);
        expect(response.body).toMatchObject({
          status,
          sourcePrizes: row.sourcePrizes,
        });
      }
      await request(app.getHttpServer())
        .post(`/admin/lottery-draws/${importedId}/reject`)
        .auth(adminToken, { type: 'bearer' })
        .send({ reason: 'Teste sintético: extração já bloqueada' })
        .expect(409);
      expect(
        await db.auditLog.count({
          where: { entityId: importedId, entityType: 'LotteryDraw' },
        }),
      ).toBe(3);
    },
    25_000,
  );
});
