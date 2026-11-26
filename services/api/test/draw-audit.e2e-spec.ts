import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { AuditHashService } from '../src/draws/audit-hash.service';
import { DrawsModule } from '../src/draws/draws.module';
import { PrismaService } from '../src/prisma/prisma.service';

const isolatedUrl = process.env.SORTEX_DRAW_AUDIT_DATABASE_URL;
if (isolatedUrl) {
  const url = new URL(isolatedUrl);
  if (
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    !/^\/sortex_draw_audit_[a-z0-9_]+$/.test(url.pathname)
  )
    throw new Error(
      'Draw audit tests require a loopback sortex_draw_audit_* database.',
    );
  process.env.DATABASE_URL = isolatedUrl;
}
const isolated = isolatedUrl ? describe : describe.skip;

isolated('Federal audit proof via HTTP and isolated PostgreSQL', () => {
  let app: INestApplication;
  let db: PrismaService;
  const run = randomUUID();
  const day = new Date('2026-07-10T00:00:00Z');
  beforeAll(async () => {
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
  });
  afterAll(async () => {
    await app?.close();
    await db?.$disconnect();
  });

  it('replays the proof, confirms when intact, and revokes anonymous readback on invalidation', async () => {
    const password = `Synthetic!${run}`;
    const hashed = await bcrypt.hash(password, 10);
    const organizer = await db.user.create({
      data: {
        name: 'Organizador Auditório Sintético',
        email: `${run}-organizer@example.test`,
        password: hashed,
        role: 'ORGANIZER',
      },
    });
    const buyer = await db.user.create({
      data: {
        name: 'Comprador Auditório Sintético',
        email: `${run}-buyer@example.test`,
        password: hashed,
        role: 'BUYER',
      },
    });
    const campaign = await db.campaign.create({
      data: {
        organizerId: organizer.id,
        title: 'Apuração Sintética',
        slug: `synthetic-federal-${run}`,
        status: 'PUBLISHED',
        drawDate: day,
        salesEndAt: day,
        totalNumbers: 100_000,
        publishedRuleSnapshot: {
          version: 1,
          outputLength: 5,
          normalization: { mode: 'REJECT_OUT_OF_RANGE' },
          steps: ['TEN_THOUSAND', 'THOUSAND', 'HUNDRED', 'TEN', 'UNIT'].map(
            (digitPosition, order) => ({
              order: order + 1,
              sourcePrize: 3,
              digitPosition,
              direction: 'NORMAL',
            }),
          ),
        },
      },
    });
    const lotto = await db.lotteryDraw.create({
      data: {
        extractionNumber: `synthetic-${run}`,
        drawDate: day,
        firstPrize: '86997',
        secondPrize: '04852',
        thirdPrize: '00091',
        fourthPrize: '82438',
        fifthPrize: '39210',
        status: 'VERIFIED',
        sourceType: 'OFFICIAL_API',
        sourcePrizes: ['086997', '004852', '000091', '082438', '039210'],
        sourceDocumentHash: 'e'.repeat(64),
        sourceUrl: 'https://example.test/private-document?token=fixture',
        notes: 'Internal lottery moderation fixture',
        enteredByUserId: organizer.id,
        reviewedByUserId: organizer.id,
        reviewedAt: day,
      },
    });
    const purchase = await db.purchase.create({
      data: {
        campaignId: campaign.id,
        buyerId: buyer.id,
        status: 'PAID',
        selectionMode: 'MANUAL',
        quantity: 1,
        unitPrice: 1,
        subtotal: 1,
        total: 1,
        expiresAt: day,
        confirmedAt: day,
      },
    });
    await db.ticket.create({
      data: {
        campaignId: campaign.id,
        buyerId: buyer.id,
        purchaseId: purchase.id,
        status: 'SOLD',
        number: 91,
      },
    });
    const session = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: organizer.email, password })
      .expect(201);
    const token = String(session.body.accessToken);
    const path = `/campaigns/${campaign.id}/draw`;
    const execution = await request(app.getHttpServer())
      .post(`${path}/execute`)
      .auth(token, { type: 'bearer' })
      .send({ lotteryDrawId: lotto.id })
      .expect(201);
    const draw = await db.campaignDraw.findUniqueOrThrow({
      where: { campaignId: campaign.id },
    });
    expect(draw.auditHashVersion).toBe('sortex-draw-v2');
    expect(execution.body.executedAt).toBe(draw.executedAt.toISOString());
    expect(app.get(AuditHashService).drawHash(draw)).toBe(draw.auditHash);
    expect(draw.resultSnapshot).toMatchObject({
      lottery: {
        drawDate: day.toISOString(),
        sourcePrizes: ['086997', '004852', '000091', '082438', '039210'],
      },
    });
    expect(
      await db.auditLog.count({
        where: { entityId: draw.id, action: 'EXECUTED' },
      }),
    ).toBe(1);

    await db.campaignDraw.update({
      where: { id: draw.id },
      data: { normalizedWinningNumber: '00092' },
    });
    await request(app.getHttpServer())
      .post(`${path}/confirm`)
      .auth(token, { type: 'bearer' })
      .send({})
      .expect(409);
    expect(await db.winner.count({ where: { campaignId: campaign.id } })).toBe(
      0,
    );

    await db.campaignDraw.update({
      where: { id: draw.id },
      data: {
        normalizedWinningNumber: draw.normalizedWinningNumber,
        resultSnapshot: draw.resultSnapshot as Prisma.InputJsonValue,
      },
    });
    const confirmation = await request(app.getHttpServer())
      .post(`${path}/confirm`)
      .auth(token, { type: 'bearer' })
      .send({})
      .expect(201);
    expect(confirmation.body.winner.winningNumber).toBe('00091');
    const publicProof = await request(app.getHttpServer())
      .get(
        `/public/winners/verify/${confirmation.body.winner.publicVerificationCode}`,
      )
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(publicProof.body.draw.auditHash).toBe(draw.auditHash);
    expect(publicProof.body.draw).not.toHaveProperty('auditHashVersion');
    expect(publicProof.body.winningNumber).toBe('00091');
    const proof = publicProof.body as {
      draw: {
        result: { normalizedResult: string; lottery: { sourceUrl: unknown } };
        lottery: Record<string, unknown>;
      };
    };
    expect(proof.draw.result.normalizedResult).toBe('00091');
    expect(proof.draw.result).not.toHaveProperty('ticketId');
    expect(proof.draw.result.lottery).not.toHaveProperty('id');
    expect(proof.draw.result.lottery.sourceUrl).toBeNull();
    expect(proof.draw.lottery).toMatchObject({
      extractionNumber: lotto.extractionNumber,
      thirdPrize: '00091',
      sourceDocumentHash: 'e'.repeat(64),
      sourceUrl: null,
    });
    for (const field of [
      'notes',
      'enteredByUserId',
      'reviewedByUserId',
      'id',
    ]) {
      expect(proof.draw.lottery).not.toHaveProperty(field);
    }
    expect(JSON.stringify(proof)).not.toContain('private-document');
    expect(JSON.stringify(proof)).not.toContain(lotto.notes);

    const auditor = await db.user.create({
      data: {
        name: 'Auditor Sintético',
        email: `${run}-auditor@example.test`,
        password: hashed,
        role: 'ADMIN',
        adminTeamRole: 'SUPERADMIN',
      },
    });
    const adminLogin = await request(app.getHttpServer())
      .post('/auth/admin-login')
      .send({ email: auditor.email, password })
      .expect(201);
    const invalidation = await request(app.getHttpServer())
      .post(`/admin/campaign-draws/${draw.id}/invalidate`)
      .auth(String(adminLogin.body.accessToken), { type: 'bearer' })
      .send({ reason: 'Invalidação do cenário sintético de homologação' })
      .expect(201);
    expect(invalidation.body.status).toBe('INVALIDATED');
    const repeated = await request(app.getHttpServer())
      .post(`/admin/campaign-draws/${draw.id}/invalidate`)
      .auth(String(adminLogin.body.accessToken), { type: 'bearer' })
      .send({ reason: 'Não substitui a justificativa original' })
      .expect(201);
    expect(repeated.body.notes).toBe(invalidation.body.notes);
    const revoked = await request(app.getHttpServer())
      .get(
        `/public/winners/verify/${confirmation.body.winner.publicVerificationCode}`,
      )
      .expect(404)
      .expect('Cache-Control', 'no-store');
    expect(revoked.body).not.toHaveProperty('winningNumber');
    expect(revoked.body).not.toHaveProperty('draw');
    expect(await db.winner.count({ where: { campaignId: campaign.id } })).toBe(
      1,
    );
    expect(
      await db.auditLog.count({
        where: { entityId: draw.id, action: 'INVALIDATED' },
      }),
    ).toBe(1);
  }, 15_000);
});
