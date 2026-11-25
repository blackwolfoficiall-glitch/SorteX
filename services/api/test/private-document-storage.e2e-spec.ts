import { INestApplication } from '@nestjs/common';
import { AdminPermission, AdminTeamRole, UserRole } from '@prisma/client';
import { hash } from 'bcrypt';
import { randomBytes, randomUUID } from 'node:crypto';
import { access, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import request from 'supertest';
import { createApplication } from '../src/application';
import { PrismaService } from '../src/prisma/prisma.service';

const isolatedUrl = process.env.SORTEX_STORAGE_E2E_DATABASE_URL;
const isolated = isolatedUrl ? describe : describe.skip;

isolated(
  'Private organizer documents against an isolated API and local filesystem',
  () => {
    jest.setTimeout(30_000);

    let app: INestApplication;
    let prisma: PrismaService;
    let directory: string;
    let root: string;
    let ownerId: string;
    let ownerToken: string;
    let documentId: string;
    const run = randomUUID();
    const password = randomBytes(18).toString('hex');
    const syntheticDocument = Buffer.from(
      '%PDF-1.4\nSorteX fixture, no personal data.\n',
    );
    const envOverrides: Record<string, string> = {
      APP_ENV: 'staging',
      STORAGE_DRIVER: 'filesystem',
      UPLOADS_DISABLED: 'false',
      EMAIL_DELIVERY_MODE: 'disabled',
      PAYMENT_ENV: 'sandbox',
      FEATURE_REAL_PAYMENTS: 'false',
      FEATURE_EXTERNAL_CRM: 'false',
      RATE_LIMIT_LOGIN: '20',
      JWT_ACCESS_SECRET: randomBytes(32).toString('hex'),
      JWT_REFRESH_SECRET: randomBytes(32).toString('hex'),
    };
    const priorEnv = new Map<string, string | undefined>();

    async function seed(
      label: string,
      role: UserRole,
      adminTeamRole?: AdminTeamRole,
      adminPermissions: AdminPermission[] = [],
    ) {
      const email = `${run}-${label}@example.test`;
      const user = await prisma.user.create({
        data: {
          name: 'Synthetic storage-test account',
          email,
          password: await hash(password, 4),
          role,
          adminTeamRole,
          adminPermissions,
          ...(role === UserRole.ORGANIZER
            ? {
                organizerProfile: {
                  create: {
                    fullName: 'Synthetic organizer',
                    cpf: '00000000000',
                    phone: '00000000000',
                  },
                },
              }
            : {}),
        },
      });
      const response = await request(app.getHttpServer())
        .post(role === UserRole.ADMIN ? '/auth/admin-login' : '/auth/login')
        .send({ email, password })
        .expect(201);
      return {
        userId: user.id,
        token: String((response.body as { accessToken: string }).accessToken),
      };
    }

    beforeAll(async () => {
      const url = new URL(isolatedUrl!);
      if (
        !['postgres:', 'postgresql:'].includes(url.protocol) ||
        !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
        !/^\/sortex_storage_[a-z0-9_]+$/.test(url.pathname)
      ) {
        throw new Error(
          'Use an isolated loopback database named sortex_storage_*.',
        );
      }
      directory = await mkdtemp(resolve(tmpdir(), 'sortex-storage-e2e-'));
      root = resolve(directory, 'private-uploads');
      await expect(access(root)).rejects.toMatchObject({ code: 'ENOENT' });
      for (const [key, value] of Object.entries({
        ...envOverrides,
        DATABASE_URL: isolatedUrl!,
        ORGANIZER_UPLOAD_DIR: root,
      })) {
        priorEnv.set(key, process.env[key]);
        process.env[key] = value;
      }
      app = await createApplication();
      await app.init();
      prisma = app.get(PrismaService);
      const owner = await seed('owner', UserRole.ORGANIZER);
      ownerId = owner.userId;
      ownerToken = owner.token;
      const response = await request(app.getHttpServer())
        .post('/organizers/me/documents')
        .auth(ownerToken, { type: 'bearer' })
        .field('type', 'IDENTITY')
        .attach('file', syntheticDocument, {
          filename: 'synthetic-document.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);
      const document = (
        response.body as {
          documents: { id: string; fileUrl: string; storageKey?: string }[];
        }
      ).documents[0];
      expect(document.storageKey).toBeUndefined();
      expect(document.fileUrl).toBe(
        `/organizers/documents/${document.id}/file`,
      );
      documentId = document.id;
    });

    afterAll(async () => {
      await app?.close();
      for (const [key, value] of priorEnv) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      if (directory) await rm(directory, { recursive: true, force: true });
    });

    function download() {
      return request(app.getHttpServer()).get(
        `/organizers/documents/${documentId}/file`,
      );
    }

    it('starts with a fresh private upload directory and returns ready for that directory', async () => {
      expect((await stat(root)).mode & 0o777).toBe(0o700);
      await request(app.getHttpServer())
        .get('/health/ready')
        .expect(200, { status: 'ready', database: 'up', storage: 'up' });
    });

    it('reports explicitly disabled uploads without attempting to write', async () => {
      process.env.UPLOADS_DISABLED = 'true';
      try {
        await request(app.getHttpServer()).get('/health/ready').expect(200, {
          status: 'ready',
          database: 'up',
          storage: 'disabled',
        });
        await request(app.getHttpServer())
          .post('/organizers/me/documents')
          .auth(ownerToken, { type: 'bearer' })
          .field('type', 'IDENTITY')
          .attach('file', syntheticDocument, {
            filename: 'synthetic-document.pdf',
            contentType: 'application/pdf',
          })
          .expect(503);
        expect(
          await prisma.organizerDocument.count({
            where: { organizerProfile: { userId: ownerId } },
          }),
        ).toBe(1);
      } finally {
        process.env.UPLOADS_DISABLED = 'false';
      }
    });

    it('delivers just the original bytes to the owner, with a private no-store response', async () => {
      const stored = await prisma.organizerDocument.findUniqueOrThrow({
        where: { id: documentId },
      });
      expect((await stat(resolve(root, stored.storageKey))).mode & 0o777).toBe(
        0o600,
      );
      const response = await download()
        .auth(ownerToken, { type: 'bearer' })
        .expect('Cache-Control', 'private, no-store')
        .expect('X-Content-Type-Options', 'nosniff')
        .expect('Content-Type', 'application/pdf')
        .expect(200);
      expect(response.body).toEqual(syntheticDocument);
    });

    it('enforces permission and tenant boundaries and audits approved reviewer access', async () => {
      await download().expect(401);
      const other = await seed('other', UserRole.ORGANIZER);
      await download().auth(other.token, { type: 'bearer' }).expect(403);

      const finance = await seed(
        'finance',
        UserRole.ADMIN,
        AdminTeamRole.FINANCE,
        [AdminPermission.FINANCE_READ],
      );
      await download().auth(finance.token, { type: 'bearer' }).expect(403);
      const analystWithoutPermission = await seed(
        'unassigned',
        UserRole.ADMIN,
        AdminTeamRole.REGISTRATION_ANALYST,
      );
      await download()
        .auth(analystWithoutPermission.token, { type: 'bearer' })
        .expect(403);

      const reviewer = await seed(
        'reviewer',
        UserRole.ADMIN,
        AdminTeamRole.REGISTRATION_ANALYST,
        [AdminPermission.ORGANIZERS_REVIEW],
      );
      const response = await download()
        .auth(reviewer.token, { type: 'bearer' })
        .expect(200);
      expect(response.body).toEqual(syntheticDocument);
      const audit = await prisma.auditLog.findMany({
        where: {
          entityType: 'OrganizerDocument',
          entityId: documentId,
          action: 'ORGANIZER_DOCUMENT_VIEWED',
        },
      });
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({
        actorUserId: reviewer.userId,
        metadata: { organizerUserId: ownerId },
      });
    });
  },
);
