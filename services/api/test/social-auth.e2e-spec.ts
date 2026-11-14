import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  createHash,
  generateKeyPairSync,
  randomBytes,
  sign,
} from 'node:crypto';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { PrismaService } from '../src/prisma/prisma.service';
const url = process.env.SORTEX_SOCIAL_TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (
    !['127.0.0.1', 'localhost'].includes(parsed.hostname) ||
    parsed.pathname !== '/sortex_social_review'
  )
    throw new Error(
      'Social tests require the dedicated local sortex_social_review database.',
    );
  process.env.DATABASE_URL = url;
  process.env.PRISMA_USE_PG_ADAPTER = 'true';
}
const isolated = url ? describe : describe.skip;
isolated(
  'Social auth HTTP + real isolated PostgreSQL + signed OIDC fixtures',
  () => {
    let app: INestApplication, db: PrismaService;
    const run = randomBytes(5).toString('hex');
    const browserProof = randomBytes(32).toString('base64url');
    const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = {
      ...keys.publicKey.export({ format: 'jwk' }),
      kid: 'isolated-fixture',
      alg: 'RS256',
      use: 'sig',
    };
    const codes = new Map<
      string,
      { provider: string; nonce: string; subject: string; email: string }
    >();
    let mockFetch: jest.SpyInstance;
    let buyerTokens: {
      accessToken: string;
      refreshToken: string;
      user: { id: string };
    };
    let originalUserId: string;
    let oldEmailTokens: {
      accessToken: string;
      refreshToken: string;
      user: { id: string };
    };
    const email = (prefix: string) => `${prefix}-${run}@example.test`;
    const password = 'Synthetic-social-test-password!';
    let seed = 0;
    function cpf() {
      let value = String(
        (parseInt(run, 16) + ++seed * 337) % 999999999,
      ).padStart(9, '0');
      for (const length of [9, 10]) {
        const r =
          [...value].reduce((n, d, i) => n + Number(d) * (length + 1 - i), 0) %
          11;
        value += r < 2 ? '0' : String(11 - r);
      }
      return value;
    }
    const fields = () => ({
      role: 'BUYER',
      name: 'Pessoa Sintética OIDC',
      cpf: cpf(),
      phone: '71900000077',
      termsAccepted: true,
      privacyAccepted: true,
      dataProcessingAccepted: true,
      postalCode: '44000000',
      state: 'BA',
      city: 'Feira de Santana',
      municipalityCode: '2910800',
      neighborhood: 'Centro',
      address: 'Rua Sintética',
      addressNumber: '10',
    });
    async function start(
      provider = 'google',
      subject = `subject-${randomBytes(6).toString('hex')}`,
      mail = email(randomBytes(4).toString('hex')),
    ) {
      const result = await request(app.getHttpServer())
        .post(`/auth/social/${provider}/start`)
        .send({ browserProof })
        .expect(201);
      const location = new URL(result.body.authorizationUrl);
      const code = randomBytes(20).toString('base64url');
      const state = location.searchParams.get('state')!;
      codes.set(code, {
        provider,
        subject,
        email: mail,
        nonce: location.searchParams.get('nonce')!,
      });
      return { provider, code, state, browserProof, location };
    }
    async function pending(
      provider = 'google',
      subject?: string,
      mail?: string,
    ) {
      const flow = await start(provider, subject, mail);
      const callback = await request(app.getHttpServer())
        .post(`/auth/social/${provider}/callback`)
        .send(flow)
        .expect(201);
      return {
        flow,
        body: callback.body,
        ticket: callback.body.registrationToken as string,
      };
    }
    beforeAll(async () => {
      process.env.JWT_ACCESS_SECRET ||= randomBytes(40).toString('base64url');
      process.env.JWT_REFRESH_SECRET ||= randomBytes(40).toString('base64url');
      process.env.WEB_URL = 'http://127.0.0.1:3108';
      process.env.GOOGLE_OAUTH_CLIENT_ID = 'synthetic-google';
      process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'synthetic-google-secret';
      process.env.APPLE_OAUTH_CLIENT_ID = 'synthetic-apple';
      process.env.APPLE_TEAM_ID = 'synthetic-team';
      process.env.APPLE_KEY_ID = 'synthetic-key';
      process.env.APPLE_PRIVATE_KEY = generateKeyPairSync('ec', {
        namedCurve: 'P-256',
      })
        .privateKey.export({ type: 'pkcs8', format: 'pem' })
        .toString();
      mockFetch = jest
        .spyOn(global, 'fetch')
        .mockImplementation(async (input, init) => {
          const endpoint = String(input);
          if (endpoint.endsWith('/certs') || endpoint.endsWith('/auth/keys'))
            return Response.json({ keys: [jwk] });
          if (
            ![
              'https://oauth2.googleapis.com/token',
              'https://appleid.apple.com/auth/token',
            ].includes(endpoint)
          )
            throw new Error('Unexpected external call in isolated test.');
          const params = new URLSearchParams(String(init?.body));
          const fixture = codes.get(params.get('code')!);
          if (!fixture)
            return Response.json({ error: 'invalid_grant' }, { status: 400 });
          codes.delete(params.get('code')!);
          if (fixture.provider === 'google') {
            const attempt = await db.socialAuthAttempt.findFirstOrThrow({
              where: { nonce: fixture.nonce },
            });
            expect(params.get('code_verifier')).toBe(attempt.verifier);
          } else
            expect(params.get('client_secret')?.split('.')).toHaveLength(3);
          const payload = {
            iss:
              fixture.provider === 'google'
                ? 'https://accounts.google.com'
                : 'https://appleid.apple.com',
            aud:
              fixture.provider === 'google'
                ? 'synthetic-google'
                : 'synthetic-apple',
            sub: fixture.subject,
            nonce: fixture.nonce,
            email: fixture.email,
            email_verified: fixture.provider === 'apple' ? 'true' : true,
            is_private_email: fixture.provider === 'apple',
            name:
              fixture.provider === 'google'
                ? 'Pessoa Sintética Provedor'
                : undefined,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 300,
          };
          const data = [
            Buffer.from(
              JSON.stringify({ alg: 'RS256', kid: jwk.kid }),
            ).toString('base64url'),
            Buffer.from(JSON.stringify(payload)).toString('base64url'),
          ].join('.');
          return Response.json({
            id_token: `${data}.${sign('RSA-SHA256', Buffer.from(data), keys.privateKey).toString('base64url')}`,
          });
        });
      const module = await Test.createTestingModule({
        imports: [AuthModule],
      }).compile();
      app = module.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({
          transform: true,
          whitelist: true,
          forbidNonWhitelisted: true,
        }),
      );
      await app.init();
      db = app.get(PrismaService);
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...fields(),
          email: email('existing'),
          password,
          passwordConfirmation: password,
        })
        .expect(201);
      const result = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: email('existing'), password })
        .expect(201);
      oldEmailTokens = result.body;
      originalUserId = result.body.user.id;
    });
    afterAll(async () => {
      mockFetch?.mockRestore();
      await db?.$disconnect();
      await app?.close();
    });
    it('reports configured providers without exposing credentials', async () => {
      const r = await request(app.getHttpServer())
        .get('/auth/social/providers')
        .expect(200);
      expect(r.body).toEqual({
        google: { enabled: true },
        apple: { enabled: true },
      });
    });
    it('uses the official authorization endpoint and PKCE S256', async () => {
      const flow = await start();
      const attempt = await db.socialAuthAttempt.findUniqueOrThrow({
        where: { id: createHash('sha256').update(flow.state).digest('hex') },
      });
      expect(flow.location.origin).toBe('https://accounts.google.com');
      expect(flow.location.searchParams.get('code_challenge_method')).toBe(
        'S256',
      );
      expect(flow.location.searchParams.get('code_challenge')).toBe(
        createHash('sha256').update(attempt.verifier).digest('base64url'),
      );
    });
    it('rejects another browser without spending the valid state, then rejects callback replay', async () => {
      const flow = await start();
      await request(app.getHttpServer())
        .post('/auth/social/google/callback')
        .send({ ...flow, browserProof: randomBytes(32).toString('base64url') })
        .expect(401);
      await request(app.getHttpServer())
        .post('/auth/social/google/callback')
        .send(flow)
        .expect(201);
      await request(app.getHttpServer())
        .post('/auth/social/google/callback')
        .send(flow)
        .expect(401);
    });
    it('creates a social buyer, complete address and identity atomically, with SorteX sessions', async () => {
      const p = await pending('google', `buyer-${run}`, email('social-buyer'));
      const r = await request(app.getHttpServer())
        .post('/auth/social/complete')
        .send({ registrationToken: p.ticket, browserProof, fields: fields() })
        .expect(201);
      buyerTokens = r.body;
      const user = await db.user.findUniqueOrThrow({
        where: { id: buyerTokens.user.id },
        include: { buyerAddress: true, socialIdentities: true },
      });
      expect(user.buyerAddress?.municipalityCode).toBe('2910800');
      expect(user.socialIdentities[0].subject).toBe(`buyer-${run}`);
      await request(app.getHttpServer())
        .get('/auth/me')
        .auth(buyerTokens.accessToken, { type: 'bearer' })
        .expect(200);
      await request(app.getHttpServer())
        .post('/auth/social/complete')
        .send({ registrationToken: p.ticket, browserProof, fields: fields() })
        .expect(401);
    });
    it('returns to the same user through a linked provider without new users', async () => {
      const count = await db.user.count();
      const p = await pending('google', `buyer-${run}`, email('social-buyer'));
      expect(p.body.kind).toBe('session');
      expect(p.body.user.id).toBe(buyerTokens.user.id);
      expect(await db.user.count()).toBe(count);
    });
    it('never links an email collision automatically, requires authenticated explicit confirmation', async () => {
      const p = await pending('google', `existing-${run}`, email('existing'));
      const details = await request(app.getHttpServer())
        .post('/auth/social/pending')
        .send({ registrationToken: p.ticket, browserProof })
        .expect(201);
      expect(details.body.linkRequired).toBe(true);
      expect(
        await db.socialIdentity.count({ where: { userId: originalUserId } }),
      ).toBe(0);
      await request(app.getHttpServer())
        .post('/auth/social/link')
        .send({ registrationToken: p.ticket, browserProof })
        .expect(401);
      await request(app.getHttpServer())
        .post('/auth/social/link')
        .auth(oldEmailTokens.accessToken, { type: 'bearer' })
        .send({ registrationToken: p.ticket, browserProof })
        .expect(201);
      expect(
        (
          await db.socialIdentity.findFirstOrThrow({
            where: { subject: `existing-${run}` },
          })
        ).userId,
      ).toBe(originalUserId);
      await request(app.getHttpServer())
        .get('/auth/me')
        .auth(oldEmailTokens.accessToken, { type: 'bearer' })
        .expect(200);
      const refresh = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: oldEmailTokens.refreshToken })
        .expect(201);
      oldEmailTokens = { ...oldEmailTokens, ...refresh.body };
      const me = await request(app.getHttpServer())
        .get('/auth/me')
        .auth(oldEmailTokens.accessToken, { type: 'bearer' })
        .expect(200);
      expect(me.body.id).toBe(originalUserId);
      expect(me.body.email).toBe(email('existing'));
    });
    it('rolls back a failed registration, retaining its ticket and leaving no identity or partial user', async () => {
      const existing = await db.user.findUniqueOrThrow({
        where: { id: originalUserId },
      });
      const p = await pending();
      const count = await db.user.count();
      await request(app.getHttpServer())
        .post('/auth/social/complete')
        .send({
          registrationToken: p.ticket,
          browserProof,
          fields: { ...fields(), cpf: existing.cpf },
        })
        .expect(409);
      expect(await db.user.count()).toBe(count);
      await request(app.getHttpServer())
        .post('/auth/social/pending')
        .send({ registrationToken: p.ticket, browserProof })
        .expect(201);
    });
    it('handles an Apple private email and creates a PF organizer without asking for a password', async () => {
      const p = await pending(
        'apple',
        `apple-${run}`,
        `synthetic-${run}@privaterelay.appleid.com`,
      );
      expect(p.flow.location.searchParams.get('response_mode')).toBe(
        'form_post',
      );
      expect(p.flow.location.searchParams.has('code_challenge')).toBe(false);
      const r = await request(app.getHttpServer())
        .post('/auth/social/complete')
        .send({
          registrationToken: p.ticket,
          browserProof,
          fields: { ...fields(), role: 'ORGANIZER', personType: 'PF' },
        })
        .expect(201);
      const user = await db.user.findUniqueOrThrow({
        where: { id: r.body.user.id },
        include: { organizerProfile: true },
      });
      expect(user.organizerProfile?.personType).toBe('PF');
      expect(user.email).toBe(`synthetic-${run}@privaterelay.appleid.com`);
    });
    it('rejects caller-supplied email/password and privilege escalation', async () => {
      const p = await pending();
      for (const role of [undefined, null]) {
        await request(app.getHttpServer())
          .post('/auth/social/complete')
          .send({
            registrationToken: p.ticket,
            browserProof,
            fields: { ...fields(), role },
          })
          .expect(400);
      }
      await request(app.getHttpServer())
        .post('/auth/social/complete')
        .send({
          registrationToken: p.ticket,
          browserProof,
          fields: { ...fields(), email: email('spoof') },
        })
        .expect(400);
      await request(app.getHttpServer())
        .post('/auth/social/complete')
        .send({
          registrationToken: p.ticket,
          browserProof,
          fields: { ...fields(), role: 'ADMIN' },
        })
        .expect(403);
    });
    it('spends a registration ticket once under concurrent requests', async () => {
      const p = await pending();
      const input = {
        registrationToken: p.ticket,
        browserProof,
        fields: fields(),
      };
      const responses = await Promise.all([
        request(app.getHttpServer()).post('/auth/social/complete').send(input),
        request(app.getHttpServer()).post('/auth/social/complete').send(input),
      ]);
      expect(responses.map((r) => r.status).sort()).toEqual([201, 401]);
    });
    it('rejects expired challenges before token exchange', async () => {
      const flow = await start();
      await db.socialAuthAttempt.update({
        where: { id: createHash('sha256').update(flow.state).digest('hex') },
        data: { expiresAt: new Date(0) },
      });
      const calls = mockFetch.mock.calls.length;
      await request(app.getHttpServer())
        .post('/auth/social/google/callback')
        .send(flow)
        .expect(401);
      expect(mockFetch.mock.calls.length).toBe(calls);
    });
    it('rejects stale authenticated sessions for identity linking', async () => {
      const p = await pending('apple');
      await db.authSession.updateMany({
        where: { userId: originalUserId },
        data: { createdAt: new Date(Date.now() - 700000) },
      });
      await request(app.getHttpServer())
        .post('/auth/social/link')
        .auth(oldEmailTokens.accessToken, { type: 'bearer' })
        .send({ registrationToken: p.ticket, browserProof })
        .expect(401);
    });
    it('creates a social PJ organizer with an official-format alphanumeric CNPJ', async () => {
      let cnpj = randomBytes(4).toString('hex').toUpperCase() + '0001';
      for (const size of [12, 13]) {
        const sum = [...cnpj.slice(0, size)]
          .reverse()
          .reduce((n, c, i) => n + (c.charCodeAt(0) - 48) * (2 + (i % 8)), 0);
        const r = sum % 11;
        cnpj += r < 2 ? '0' : String(11 - r);
      }
      const p = await pending('apple');
      const r = await request(app.getHttpServer())
        .post('/auth/social/complete')
        .send({
          registrationToken: p.ticket,
          browserProof,
          fields: {
            ...fields(),
            role: 'ORGANIZER',
            personType: 'PJ',
            cnpj,
            organizationName: 'Empresa Sintética OIDC',
          },
        })
        .expect(201);
      const profile = await db.organizerProfile.findUniqueOrThrow({
        where: { userId: r.body.user.id },
      });
      expect(profile.personType).toBe('PJ');
      expect(profile.cnpj).toBe(cnpj);
    });
    it('preserves the original account email when provider email changes', async () => {
      const p = await pending(
        'google',
        `buyer-${run}`,
        email('changed-provider-email'),
      );
      expect(p.body.kind).toBe('session');
      expect(p.body.user.id).toBe(buyerTokens.user.id);
      expect(p.body.user.email).toBe(email('social-buyer'));
    });
    it('does not bypass an existing account deactivation through its linked provider', async () => {
      await db.user.update({
        where: { id: buyerTokens.user.id },
        data: { isActive: false },
      });
      const flow = await start('google', `buyer-${run}`, email('social-buyer'));
      await request(app.getHttpServer())
        .post('/auth/social/google/callback')
        .send(flow)
        .expect(403);
    });
  },
);
