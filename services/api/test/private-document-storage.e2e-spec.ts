import type { INestApplication } from '@nestjs/common';
import { AdminPermission, AdminTeamRole, UserRole } from '@prisma/client';
import { hash } from 'bcrypt';
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  access,
  chmod,
  cp,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import type { Server } from 'node:http';
import request from 'supertest';
import { createApplication } from '../src/application';
import { PrismaService } from '../src/prisma/prisma.service';

const isolatedUrl = process.env.SORTEX_STORAGE_E2E_DATABASE_URL;
const restoreUrl = process.env.SORTEX_STORAGE_RESTORE_E2E_DATABASE_URL;
const isolated = isolatedUrl ? describe : describe.skip;
const restoreTest = restoreUrl ? it : it.skip;
if (restoreUrl && !isolatedUrl) {
  throw new Error(
    'A origem descartável precisa ser configurada junto ao destino.',
  );
}

function restorePair(source: string, target: string) {
  const from = new URL(source);
  const into = new URL(target);
  const pair = /^\/sortex_storage_backup_([a-f0-9]{12})$/.exec(
    from.pathname,
  )?.[1];
  if (
    !pair ||
    into.pathname !== `/sortex_storage_restore_${pair}` ||
    from.port !== into.port ||
    ![from, into].every(
      (url) =>
        url.protocol === 'postgresql:' &&
        url.hostname === '127.0.0.1' &&
        Boolean(url.port) &&
        url.username === 'sortex_restore_fixture' &&
        !url.password &&
        !url.search &&
        !url.hash,
    )
  )
    throw new Error(
      'Restauração exclusiva do par descartável gerado por test-storage-backup-restore.sh.',
    );
  return { from, into };
}

function pgTool(
  tool: 'pg_dump' | 'pg_restore' | 'psql',
  url: URL,
  args: string[],
) {
  // Never let ambient PG* variables override the explicit isolated target.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('PG')),
  );
  return execFileSync(
    tool,
    [
      '--no-password',
      '--host',
      url.hostname,
      '--port',
      url.port,
      '--username',
      url.username,
      '--dbname',
      url.pathname.slice(1),
      ...args,
    ],
    {
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 25_000,
    },
  );
}

function assertEmptyTarget(url: URL) {
  const tables = pgTool('psql', url, [
    '--no-psqlrc',
    '--tuples-only',
    '--no-align',
    '--quiet',
    '--set=ON_ERROR_STOP=1',
    '--command',
    "SELECT count(*)::int FROM pg_tables WHERE schemaname = 'public'",
  ]);
  expect(tables.trim()).toBe('0');
}

function sha256(bytes: Buffer) {
  return createHash('sha256').update(bytes).digest('hex');
}

isolated(
  'Private organizer documents against an isolated API and local filesystem',
  () => {
    jest.setTimeout(30_000);

    let app: INestApplication<Server>;
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
      if (restoreUrl) {
        assertEmptyTarget(restorePair(isolatedUrl!, restoreUrl).into);
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
      app = (await createApplication()) as INestApplication<Server>;
      await app.init();
      prisma = app.get(PrismaService);
      if (restoreUrl) {
        expect(await prisma.user.count()).toBe(0);
        expect(await prisma.organizerDocument.count()).toBe(0);
      }
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
      await prisma?.$disconnect();
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

    it('preserves a private document across an API restart on the same database and upload root', async () => {
      const { storageKey } = await prisma.organizerDocument.findUniqueOrThrow({
        where: { id: documentId },
      });

      await app.close();
      await prisma.$disconnect();
      app = (await createApplication()) as INestApplication<Server>;
      await app.init();
      prisma = app.get(PrismaService);

      await request(app.getHttpServer())
        .get('/health/ready')
        .expect(200, { status: 'ready', database: 'up', storage: 'up' });
      expect(
        await prisma.organizerDocument.findUniqueOrThrow({
          where: { id: documentId },
          select: { storageKey: true },
        }),
      ).toEqual({ storageKey });
      await download().expect(401);
      const response = await download()
        .auth(ownerToken, { type: 'bearer' })
        .expect('Cache-Control', 'private, no-store')
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
    restoreTest(
      'restores database and private PDF into a separate local database and volume',
      async () => {
        const { from, into } = restorePair(isolatedUrl!, restoreUrl!);
        const reviewer = await seed(
          'backup-reviewer',
          UserRole.ADMIN,
          AdminTeamRole.REGISTRATION_ANALYST,
          [AdminPermission.ORGANIZERS_REVIEW],
        );
        const other = await seed('backup-other', UserRole.ORGANIZER);
        const sourceDocument = await prisma.organizerDocument.findUniqueOrThrow(
          {
            where: { id: documentId },
            include: { organizerProfile: { select: { userId: true } } },
          },
        );
        async function profileDocument(token: string) {
          const response = await request(app.getHttpServer())
            .get('/organizers/me/profile')
            .auth(token, { type: 'bearer' })
            .expect(200);
          const profile = response.body as {
            id: string;
            userId: string;
            documents: { id: string; fileUrl: string; storageKey?: string }[];
          };
          const document = profile.documents.find(
            (item) => item.id === documentId,
          );
          expect(document).toBeDefined();
          expect(document?.storageKey).toBeUndefined();
          return { profileId: profile.id, userId: profile.userId, document };
        }
        const sourceProfile = await profileDocument(ownerToken);
        expect(sourceProfile.profileId).toBe(sourceDocument.organizerProfileId);
        expect(sourceProfile.userId).toBe(ownerId);
        expect(sourceProfile.document?.fileUrl).toBe(
          `/organizers/documents/${documentId}/file`,
        );
        const sourceOwner = await download()
          .auth(ownerToken, { type: 'bearer' })
          .expect(200);
        const sourceReviewer = await download()
          .auth(reviewer.token, { type: 'bearer' })
          .expect(200);
        await download().auth(other.token, { type: 'bearer' }).expect(403);
        const digest = sha256(syntheticDocument);
        expect(sha256(sourceOwner.body as Buffer)).toBe(digest);
        expect(sha256(sourceReviewer.body as Buffer)).toBe(digest);
        const auditWhere = {
          entityType: 'OrganizerDocument',
          entityId: documentId,
          action: 'ORGANIZER_DOCUMENT_VIEWED',
        };
        const sourceAudit = await prisma.auditLog.findMany({
          where: auditWhere,
          orderBy: { id: 'asc' },
        });
        expect(
          sourceAudit.some((row) => row.actorUserId === reviewer.userId),
        ).toBe(true);
        const appliedMigrations = () =>
          prisma.$queryRaw<
            { migration_name: string; checksum: string }[]
          >`SELECT migration_name, checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY migration_name`;
        const migrations = await appliedMigrations();
        expect(migrations.length).toBeGreaterThan(0);

        // Quiesce the only application using this synthetic source before its paired backup.
        await app.close();
        await prisma.$disconnect();
        const archive = resolve(directory, 'postgres.dump');
        const volumeArchive = resolve(directory, 'volume-backup');
        const restoredVolume = resolve(directory, 'volume-restored');
        const offlineSource = resolve(directory, 'volume-original-offline');
        pgTool('pg_dump', from, [
          '--format=custom',
          '--no-owner',
          '--no-acl',
          '--file',
          archive,
        ]);
        await chmod(archive, 0o600);
        await cp(root, volumeArchive, {
          recursive: true,
          errorOnExist: true,
          force: false,
        });
        assertEmptyTarget(into);
        pgTool('pg_restore', into, [
          '--single-transaction',
          '--exit-on-error',
          '--no-owner',
          '--no-acl',
          archive,
        ]);
        await cp(volumeArchive, restoredVolume, {
          recursive: true,
          errorOnExist: true,
          force: false,
        });
        // No fallback to the old volume can satisfy the restored read.
        await rename(root, offlineSource);
        await expect(access(root)).rejects.toMatchObject({ code: 'ENOENT' });

        process.env.DATABASE_URL = restoreUrl!;
        process.env.ORGANIZER_UPLOAD_DIR = restoredVolume;
        process.env.JWT_ACCESS_SECRET = randomBytes(32).toString('hex');
        process.env.JWT_REFRESH_SECRET = randomBytes(32).toString('hex');
        app = (await createApplication()) as INestApplication<Server>;
        await app.init();
        prisma = app.get(PrismaService);
        await request(app.getHttpServer())
          .get('/health/ready')
          .expect(200, { status: 'ready', database: 'up', storage: 'up' });
        expect(
          await prisma.$queryRaw<
            { db: string }[]
          >`SELECT current_database()::text AS db`,
        ).toEqual([{ db: into.pathname.slice(1) }]);
        expect(
          await prisma.organizerDocument.findUniqueOrThrow({
            where: { id: documentId },
            include: { organizerProfile: { select: { userId: true } } },
          }),
        ).toEqual(sourceDocument);
        expect(
          await prisma.auditLog.findMany({
            where: auditWhere,
            orderBy: { id: 'asc' },
          }),
        ).toEqual(sourceAudit);
        expect(await appliedMigrations()).toEqual(migrations);

        const restoredFile = resolve(restoredVolume, sourceDocument.storageKey);
        expect(restoredFile.startsWith(restoredVolume + '/')).toBe(true);
        expect((await stat(restoredVolume)).mode & 0o777).toBe(0o700);
        expect((await stat(restoredFile)).mode & 0o777).toBe(0o600);
        expect(sha256(await readFile(restoredFile))).toBe(digest);
        await download().expect(401);
        await download().auth(ownerToken, { type: 'bearer' }).expect(401);

        async function restoredLogin(
          label: string,
          expectedId: string,
          admin = false,
        ) {
          const response = await request(app.getHttpServer())
            .post(admin ? '/auth/admin-login' : '/auth/login')
            .send({ email: `${run}-${label}@example.test`, password })
            .expect(201);
          const token = (response.body as { accessToken: string }).accessToken;
          const identity = await request(app.getHttpServer())
            .get('/auth/me')
            .auth(token, { type: 'bearer' })
            .expect(200);
          expect((identity.body as { id: string }).id).toBe(expectedId);
          return token;
        }
        const restoredOwner = await restoredLogin('owner', ownerId);
        expect(await profileDocument(restoredOwner)).toEqual(sourceProfile);
        const restoredReviewer = await restoredLogin(
          'backup-reviewer',
          reviewer.userId,
          true,
        );
        const restoredOther = await restoredLogin('backup-other', other.userId);
        for (const token of [restoredOwner, restoredReviewer]) {
          const reply = await download()
            .auth(token, { type: 'bearer' })
            .expect('Cache-Control', 'private, no-store')
            .expect('Content-Type', 'application/pdf')
            .expect(200);
          expect(sha256(reply.body as Buffer)).toBe(digest);
        }
        await download().auth(restoredOther, { type: 'bearer' }).expect(403);
        expect(
          await prisma.auditLog.count({
            where: { ...auditWhere, actorUserId: reviewer.userId },
          }),
        ).toBe(
          sourceAudit.filter((row) => row.actorUserId === reviewer.userId)
            .length + 1,
        );
        console.info(
          JSON.stringify({
            evidence: 'sortex-local-private-document-backup-restore',
            sha256: digest,
            independentDatabase: true,
            independentVolume: true,
            restoredDatabaseRowsAndAudit: true,
            appliedMigrations: migrations.length,
            ownerAndReviewer: 200,
            anonymousAndOldSession: 401,
            otherOrganizer: 403,
          }),
        );
      },
    );
  },
);
