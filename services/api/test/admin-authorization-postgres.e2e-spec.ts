import type { INestApplication } from '@nestjs/common';
import { AdminPermission, AdminTeamRole, UserRole } from '@prisma/client';
import { hash } from 'bcrypt';
import { randomBytes, randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';
import { createApplication } from '../src/application';
import { PrismaService } from '../src/prisma/prisma.service';

const isolatedUrl = process.env.SORTEX_ADMIN_E2E_DATABASE_URL;
const isolated = isolatedUrl ? describe : describe.skip;

type Session = { id: string; accessToken: string; refreshToken: string };

const paths = [
  '/admin/users',
  '/admin/organizers',
  '/admin/campaigns',
  '/admin/payments',
  '/admin/support',
  '/admin/audit-logs',
  '/admin/settings',
] as const;
type AdminPath = (typeof paths)[number];

// Deliberately independent from ADMIN_ROLE_PERMISSIONS: a production policy
// change must be reviewed against the expected HTTP access here.
const matrix: [AdminTeamRole, AdminPath[], AdminPermission[]][] = [
  [AdminTeamRole.SUPERADMIN, [...paths], []],
  [
    AdminTeamRole.ADMIN,
    [
      '/admin/users',
      '/admin/organizers',
      '/admin/campaigns',
      '/admin/payments',
    ],
    [
      AdminPermission.USERS_READ,
      AdminPermission.USERS_WRITE,
      AdminPermission.ORGANIZERS_REVIEW,
      AdminPermission.CAMPAIGNS_REVIEW,
      AdminPermission.FINANCE_READ,
    ],
  ],
  [
    AdminTeamRole.REGISTRATION_ANALYST,
    ['/admin/users', '/admin/organizers'],
    [AdminPermission.USERS_READ, AdminPermission.ORGANIZERS_REVIEW],
  ],
  [
    AdminTeamRole.FINANCE,
    ['/admin/payments'],
    [
      AdminPermission.FINANCE_READ,
      AdminPermission.FINANCE_WRITE,
      AdminPermission.PAYOUTS_REVIEW,
    ],
  ],
  [
    AdminTeamRole.SUPPORT,
    ['/admin/users', '/admin/support'],
    [AdminPermission.USERS_READ, AdminPermission.SUPPORT_WRITE],
  ],
  [AdminTeamRole.AUDIT, ['/admin/audit-logs'], [AdminPermission.AUDIT_READ]],
];

isolated(
  'Scenario 9: administrative permissions against isolated PostgreSQL',
  () => {
    jest.setTimeout(30_000);

    const run = randomUUID();
    const password = randomBytes(18).toString('hex');
    const previous = new Map<string, string | undefined>();
    const admins = new Map<AdminTeamRole, Session>();
    const reason = 'Validação sintética de acesso e auditoria';
    let app: INestApplication<Server>;
    let prisma: PrismaService;
    let buyer: Session;
    let organizer: Session;

    function api() {
      return request(app.getHttpServer());
    }

    async function seed(
      label: string,
      role: UserRole,
      adminTeamRole?: AdminTeamRole,
      adminPermissions: AdminPermission[] = [],
    ): Promise<Session> {
      const email = `${run}-${label.toLowerCase()}@example.test`;
      const user = await prisma.user.create({
        data: {
          name: 'Synthetic QA account',
          email,
          phone: '00000000000',
          password: await hash(password, 4),
          role,
          adminTeamRole,
          adminPermissions,
        },
        select: { id: true },
      });
      const login = await api()
        .post(role === UserRole.ADMIN ? '/auth/admin-login' : '/auth/login')
        .send({ email, password })
        .expect(201);
      const { accessToken, refreshToken } = login.body as Omit<Session, 'id'>;
      expect(typeof accessToken).toBe('string');
      expect(typeof refreshToken).toBe('string');
      return { id: user.id, accessToken, refreshToken };
    }

    beforeAll(async () => {
      const url = new URL(isolatedUrl!);
      if (
        !['postgres:', 'postgresql:'].includes(url.protocol) ||
        !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
        !/^\/sortex_admin_[a-z0-9_]+$/.test(url.pathname)
      ) {
        throw new Error(
          'Use an isolated loopback database named sortex_admin_*.',
        );
      }

      for (const [key, value] of Object.entries({
        DATABASE_URL: isolatedUrl!,
        APP_ENV: 'staging',
        UPLOADS_DISABLED: 'true',
        EMAIL_DELIVERY_MODE: 'disabled',
        PAYMENT_ENV: 'sandbox',
        FEATURE_REAL_PAYMENTS: 'false',
        FEATURE_EXTERNAL_CRM: 'false',
        JWT_ACCESS_SECRET: randomBytes(32).toString('hex'),
        JWT_REFRESH_SECRET: randomBytes(32).toString('hex'),
      })) {
        previous.set(key, process.env[key]);
        process.env[key] = value;
      }

      app = (await createApplication()) as INestApplication<Server>;
      await app.init();
      prisma = app.get(PrismaService);
      for (const [role, , permissions] of matrix) {
        admins.set(role, await seed(role, UserRole.ADMIN, role, permissions));
      }
      buyer = await seed('buyer', UserRole.BUYER);
      organizer = await seed('organizer', UserRole.ORGANIZER);
    });

    afterAll(async () => {
      try {
        await app?.close();
      } finally {
        try {
          await prisma?.$disconnect();
        } finally {
          for (const [key, value] of previous) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
          }
        }
      }
    });

    it.each(matrix)(
      '%s can read only the delegated modules',
      async (role, allowed) => {
        const { accessToken } = admins.get(role)!;
        for (const path of paths) {
          await api()
            .get(path)
            .auth(accessToken, { type: 'bearer' })
            .expect(allowed.includes(path) ? 200 : 403);
        }
      },
    );

    it('requires an admin session for administrative login and reads', async () => {
      for (const session of [buyer, organizer]) {
        await api()
          .get('/auth/me')
          .auth(session.accessToken, { type: 'bearer' })
          .expect(200);
        for (const path of [...paths, '/admin/dashboard']) {
          await api()
            .get(path)
            .auth(session.accessToken, { type: 'bearer' })
            .expect(403);
        }
      }
      await api().get('/admin/users').expect(401);
      await api()
        .post('/auth/admin-login')
        .send({ email: `${run}-buyer@example.test`, password })
        .expect(403);
    });

    it('applies new permissions to an existing session without exceeding its team role', async () => {
      const actor = admins.get(AdminTeamRole.SUPERADMIN)!;
      const target = await seed(
        'limited-analyst',
        UserRole.ADMIN,
        AdminTeamRole.REGISTRATION_ANALYST,
        [AdminPermission.USERS_READ, AdminPermission.ORGANIZERS_REVIEW],
      );

      await api()
        .get('/admin/organizers')
        .auth(target.accessToken, { type: 'bearer' })
        .expect(200);
      await api()
        .patch(`/admin/users/${target.id}/permissions`)
        .auth(actor.accessToken, { type: 'bearer' })
        .send({
          permissions: [AdminPermission.USERS_READ, AdminPermission.AUDIT_READ],
          reason,
        })
        .expect(200, {
          id: target.id,
          permissions: [AdminPermission.USERS_READ],
        });
      await api()
        .get('/admin/users')
        .auth(target.accessToken, { type: 'bearer' })
        .expect(200);
      for (const path of ['/admin/organizers', '/admin/audit-logs']) {
        await api()
          .get(path)
          .auth(target.accessToken, { type: 'bearer' })
          .expect(403);
      }
      const entry = await prisma.auditLog.findFirstOrThrow({
        where: { entityId: target.id, action: 'ADMIN_PERMISSIONS_UPDATED' },
      });
      expect(entry.actorUserId).toBe(actor.id);
      expect(entry.previousData).toEqual({
        permissions: [
          AdminPermission.USERS_READ,
          AdminPermission.ORGANIZERS_REVIEW,
        ],
      });
      expect(entry.newData).toEqual({
        permissions: [AdminPermission.USERS_READ],
      });
    });

    it('does not change permissions if an audit justification is missing', async () => {
      const actor = admins.get(AdminTeamRole.SUPERADMIN)!;
      const target = await seed(
        'atomic-auditor',
        UserRole.ADMIN,
        AdminTeamRole.AUDIT,
        [AdminPermission.AUDIT_READ],
      );
      await api()
        .patch(`/admin/users/${target.id}/permissions`)
        .auth(actor.accessToken, { type: 'bearer' })
        .send({ permissions: [], reason: '     ' })
        .expect(400);
      await api()
        .get('/admin/audit-logs')
        .auth(target.accessToken, { type: 'bearer' })
        .expect(200);
      expect(
        await prisma.auditLog.count({
          where: { entityId: target.id, action: 'ADMIN_PERMISSIONS_UPDATED' },
        }),
      ).toBe(0);
    });

    it('shows safe details for historical audit rows without changing stored evidence', async () => {
      const actor = admins.get(AdminTeamRole.ADMIN)!;
      const auditor = admins.get(AdminTeamRole.AUDIT)!;
      const historical = {
        status: 'ACTIVE',
        email: 'synthetic-old-snapshot@example.test',
        password: 'synthetic-password-hash-marker',
        cpf: 'synthetic-document-marker',
      };
      const record = await prisma.auditLog.create({
        data: {
          entityType: 'User',
          entityId: buyer.id,
          actorUserId: actor.id,
          action: 'USER_BLOCK',
          previousData: historical,
          newData: { status: 'BLOCKED', isActive: false },
        },
      });
      const readAudit = await api()
        .get('/admin/audit-logs')
        .query({
          action: 'USER_BLOCK',
          actorUserId: actor.id,
          entityType: 'User',
        })
        .auth(auditor.accessToken, { type: 'bearer' })
        .expect(200);
      await api()
        .get('/admin/audit-logs')
        .query({ role: 'NOT_A_ROLE' })
        .auth(auditor.accessToken, { type: 'bearer' })
        .expect(400);
      const readMember = await api()
        .get(`/admin/users/${actor.id}`)
        .auth(actor.accessToken, { type: 'bearer' })
        .expect(200);
      type AuditRow = { id: string; previousData: unknown; newData: unknown };
      const filtered = (readAudit.body as { data: AuditRow[] }).data;
      expect(filtered.map((entry) => entry.id)).toEqual([record.id]);
      for (const entries of [
        filtered,
        (readMember.body as { auditLogs: AuditRow[] }).auditLogs,
      ]) {
        const result = entries.find((entry) => entry.id === record.id);
        expect(result?.previousData).toEqual({ status: 'ACTIVE' });
        expect(result?.newData).toEqual({ status: 'BLOCKED', isActive: false });
      }
      expect(
        await prisma.auditLog.findUniqueOrThrow({ where: { id: record.id } }),
      ).toMatchObject({ previousData: historical });
    });

    it('invites a new analyst, enforces delegated access, and revokes the session through the team API', async () => {
      const owner = admins.get(AdminTeamRole.SUPERADMIN)!;
      const nonManager = admins.get(AdminTeamRole.AUDIT)!;
      const name = 'Analista sintético da equipe';
      const email = `${run}-invited-analyst@example.test`;
      const newPassword = `Aa!1${randomBytes(20).toString('hex')}`;
      const invitePayload = {
        name,
        email,
        reason,
        adminTeamRole: AdminTeamRole.REGISTRATION_ANALYST,
      };
      await api()
        .post('/admin/team/invite')
        .auth(nonManager.accessToken, { type: 'bearer' })
        .send(invitePayload)
        .expect(403);

      const created = await api()
        .post('/admin/team/invite')
        .auth(owner.accessToken, { type: 'bearer' })
        .send(invitePayload)
        .expect(201);
      const invite = created.body as {
        id: string;
        invitationPath?: string;
        status: string;
        sandbox: boolean;
      };
      expect(invite.status).toBe('PENDING');
      expect(invite.sandbox).toBe(true);
      const token = /^\/admin\/convite\/([a-f0-9]{64})$/.exec(
        invite.invitationPath ?? '',
      )?.[1];
      expect(Boolean(token)).toBe(true);
      const path = `/admin/invitations/${token}`;

      const inspect = await api().get(path).expect(200);
      const details = inspect.body as {
        name: string;
        email: string;
        role: AdminTeamRole;
      };
      expect([details.name, details.email, details.role]).toEqual([
        name,
        email,
        AdminTeamRole.REGISTRATION_ANALYST,
      ]);
      expect(await prisma.user.count({ where: { email } })).toBe(0);
      const acceptance = {
        name,
        password: newPassword,
        passwordConfirmation: newPassword,
      };
      const accepted = await api()
        .post(`${path}/accept`)
        .send(acceptance)
        .expect(201);
      const { userId } = accepted.body as { userId: string };
      expect(typeof userId).toBe('string');
      const consumed = await api().get(path).expect(400);
      expect((consumed.body as { path: string }).path).toBe(
        '/admin/invitations/[redacted]',
      );

      const login = await api()
        .post('/auth/admin-login')
        .send({ email, password: newPassword })
        .expect(201);
      const { accessToken, refreshToken } = login.body as Omit<Session, 'id'>;
      expect(typeof accessToken === 'string' && accessToken.length > 0).toBe(
        true,
      );
      expect(typeof refreshToken === 'string' && refreshToken.length > 0).toBe(
        true,
      );
      const user = await api()
        .get('/auth/me')
        .auth(accessToken, { type: 'bearer' })
        .expect(200);
      const me = user.body as {
        id: string;
        role: UserRole;
        adminPermissions: AdminPermission[];
      };
      expect([me.id, me.role]).toEqual([userId, UserRole.ADMIN]);
      expect(me.adminPermissions).toEqual([
        AdminPermission.USERS_READ,
        AdminPermission.ORGANIZERS_REVIEW,
      ]);

      const organizerDirectory = () =>
        api().get('/admin/organizers').auth(accessToken, { type: 'bearer' });
      await organizerDirectory().expect(200);
      await api()
        .get('/admin/payments')
        .auth(accessToken, { type: 'bearer' })
        .expect(403);
      await api()
        .post(`/admin/team/${userId}/action`)
        .auth(owner.accessToken, { type: 'bearer' })
        .send({ action: 'REVOKE_SESSIONS', reason })
        .expect(201);
      await organizerDirectory().expect(401);
      await api().post('/auth/refresh').send({ refreshToken }).expect(401);

      const storedInvite = await prisma.adminTeamInvitation.findUniqueOrThrow({
        where: { id: invite.id },
        select: { status: true, acceptedUserId: true },
      });
      expect(storedInvite).toEqual({
        status: 'ACCEPTED',
        acceptedUserId: userId,
      });
      const acceptanceLog = await prisma.auditLog.findFirstOrThrow({
        where: { entityId: invite.id, action: 'ADMIN_INVITATION_ACCEPTED' },
        select: { actorUserId: true, newData: true },
      });
      expect(acceptanceLog).toEqual({
        actorUserId: userId,
        newData: {
          role: AdminTeamRole.REGISTRATION_ANALYST,
          promotedExistingUser: false,
        },
      });
      const revocationLog = await prisma.auditLog.findFirstOrThrow({
        where: { entityId: userId, action: 'ADMIN_MEMBER_REVOKE_SESSIONS' },
        select: { actorUserId: true },
      });
      expect(revocationLog.actorUserId).toBe(owner.id);
    });

    it('revokes access and refresh tokens only with write permission and audits minimal state', async () => {
      const analyst = admins.get(AdminTeamRole.REGISTRATION_ANALYST)!;
      const admin = admins.get(AdminTeamRole.ADMIN)!;
      const target = await seed('revocable', UserRole.BUYER);
      const payload = { action: 'REVOKE_SESSIONS', reason };
      const accessibleWithToken = () =>
        api().get('/auth/me').auth(target.accessToken, { type: 'bearer' });

      await api()
        .post(`/admin/users/${target.id}/action`)
        .auth(analyst.accessToken, { type: 'bearer' })
        .send(payload)
        .expect(403);
      await accessibleWithToken().expect(200);
      await api()
        .post(`/admin/users/${target.id}/action`)
        .auth(admin.accessToken, { type: 'bearer' })
        .send(payload)
        .expect(201);
      await accessibleWithToken().expect(401);
      await api()
        .post('/auth/refresh')
        .send({ refreshToken: target.refreshToken })
        .expect(401);
      const entry = await prisma.auditLog.findFirstOrThrow({
        where: { entityId: target.id, action: 'USER_REVOKE_SESSIONS' },
      });
      expect(entry.actorUserId).toBe(admin.id);
      expect(entry.previousData).toEqual({
        status: 'ACTIVE',
        isActive: true,
        forcePasswordReset: false,
      });
      expect(entry.newData).toEqual({ sessionsRevoked: true });
    });
  },
);
