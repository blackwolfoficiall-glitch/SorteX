/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthModule } from '../src/auth/auth.module';
import { LocationsModule } from '../src/locations/locations.module';
import { BuyerModule } from '../src/buyer/buyer.module';
import { resolve } from 'node:path';
import { OrganizersModule } from '../src/organizers/organizers.module';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import request from 'supertest';
const isolatedUrl = process.env.SORTEX_PHASE1_DATABASE_URL;
if (isolatedUrl) {
  const url = new URL(isolatedUrl);
  if (
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    !/^\/sortex_phase1_[a-z0-9_]+$/.test(url.pathname)
  )
    throw new Error(
      'Phase 1 tests require a loopback sortex_phase1_* database.',
    );
  process.env.DATABASE_URL = isolatedUrl;
}
const isolated = isolatedUrl ? describe : describe.skip;
isolated('Phase 1 HTTP and PostgreSQL (isolated only)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const run = randomUUID().replace(/-/g, '').slice(0, 10);
  const email = (name: string) => `${name}-${run}@example.test`;
  const base = {
    name: 'Pessoa Sintética',
    email: email('buyer'),
    cpf: '11144477735',
    phone: '71999990001',
    password: 'Phase1-password!',
    passwordConfirmation: 'Phase1-password!',
    termsAccepted: true,
    privacyAccepted: true,
    dataProcessingAccepted: true,
    role: 'BUYER',
    postalCode: '44000000',
    state: 'BA',
    city: 'Feira de Santana',
    municipalityCode: '2910800',
    neighborhood: 'Centro',
    address: 'Rua Sintética',
    addressNumber: '10',
  };
  // Valid, run-specific synthetic CPF avoids deleting or reusing existing users on reruns.
  function cpf(seed: number) {
    let digits = String(
      (parseInt(run.slice(0, 6), 16) * 20 + seed) % 999999999,
    ).padStart(9, '0');
    for (const size of [9, 10]) {
      const rest =
        [...digits].reduce((n, d, i) => n + Number(d) * (size + 1 - i), 0) % 11;
      digits += rest < 2 ? '0' : String(11 - rest);
    }
    return digits;
  }
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AuthModule, LocationsModule, OrganizersModule, BuyerModule],
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
    prisma = app.get(PrismaService);
  });
  afterAll(async () => {
    await app?.close();
  });
  it('preserves the old synthetic account, slogan, session and nullable classification after migration', async () => {
    const beforePath = process.env.SORTEX_PHASE1_BEFORE_PATH;
    if (!beforePath || !existsSync(beforePath))
      throw new Error(
        'Provide the synthetic legacy snapshot saved before applying migration 17.',
      );
    const before = JSON.parse(readFileSync(beforePath, 'utf8'));
    const after = await prisma.user.findUniqueOrThrow({
      where: { id: before.id },
      include: {
        sessions: true,
        organizerProfile: true,
        organizerBrandProfile: true,
        buyerAddress: true,
      },
    });
    expect(after.organizerProfile?.personType).toBeNull();
    expect(after.buyerAddress).toBeNull();
    const { buyerAddress, organizerProfile, ...rest } = after;
    void buyerAddress;
    const { personType, ...oldProfile } = organizerProfile!;
    void personType;
    expect(
      JSON.parse(JSON.stringify({ ...rest, organizerProfile: oldProfile })),
    ).toEqual(before);
  });
  it('serves IBGE lists without external requests', async () => {
    const states = await request(app.getHttpServer())
      .get('/locations/states')
      .expect(200);
    expect(states.body).toHaveLength(27);
    const cities = await request(app.getHttpServer())
      .get('/locations/states/BA/cities')
      .expect(200);
    expect(cities.body).toEqual(
      expect.arrayContaining([{ id: '2910800', name: 'Feira de Santana' }]),
    );
    await request(app.getHttpServer())
      .get('/locations/states/XX/cities')
      .expect(400);
  });
  it('registers buyer, full address and three consent records atomically and preserves login/refresh', async () => {
    const body = { ...base, cpf: cpf(1) };
    const result = await request(app.getHttpServer())
      .post('/auth/register')
      .send(body)
      .expect(201);
    expect(result.body).not.toHaveProperty('password');
    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: result.body.id },
      include: { buyerAddress: true, consentRecords: true },
    });
    expect(stored.buyerAddress).toMatchObject({
      city: base.city,
      municipalityCode: base.municipalityCode,
      addressNumber: '10',
    });
    expect(stored.consentRecords).toHaveLength(3);
    expect(stored.password).not.toBe(base.password);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: body.email, password: body.password })
      .expect(201);
    const refreshed = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(201);
    expect(refreshed.body.accessToken).toBeTruthy();
    await request(app.getHttpServer())
      .patch('/buyer/profile')
      .auth(refreshed.body.accessToken, { type: 'bearer' })
      .send({ city: 'Salvador', state: 'BA', municipalityCode: '2927408' })
      .expect(200);
    const changed = await prisma.buyerAddress.findUniqueOrThrow({
      where: { userId: stored.id },
    });
    expect(changed).toMatchObject({
      city: 'Salvador',
      municipalityCode: '2927408',
      address: base.address,
      postalCode: base.postalCode,
    });
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: stored.id } })).id,
    ).toBe(stored.id);
  });
  it.each(['PF', 'PJ'])(
    'registers organizer %s with only the corresponding fields',
    async (personType) => {
      const suffix = personType === 'PF' ? 2 : 3;
      const body = {
        ...base,
        email: email(personType),
        cpf: cpf(suffix),
        role: 'ORGANIZER',
        personType,
        ...(personType === 'PJ'
          ? {
              cnpj: '12.ABC.345/01DE-35',
              organizationName: 'Empresa Sintética',
              fantasyName: 'Marca Sintética',
            }
          : {}),
      };
      // A unique CNPJ for this run with the official alphanumeric algorithm.
      if (personType === 'PJ') {
        let doc = run.toUpperCase().slice(0, 8).padEnd(8, '0') + '0001';
        for (const size of [12, 13]) {
          const rest =
            [...doc.slice(0, size)]
              .reverse()
              .reduce(
                (n, c, i) => n + (c.charCodeAt(0) - 48) * (2 + (i % 8)),
                0,
              ) % 11;
          doc += rest < 2 ? '0' : String(11 - rest);
        }
        body.cnpj = doc;
      }
      const result = await request(app.getHttpServer())
        .post('/auth/register')
        .send(body)
        .expect(201);
      const stored = await prisma.user.findUniqueOrThrow({
        where: { id: result.body.id },
        include: { organizerProfile: true, organizerBrandProfile: true },
      });
      expect(stored.organizerProfile).toMatchObject({
        personType,
        cpf: body.cpf,
        municipalityCode: base.municipalityCode,
        fullName: body.name,
      });
      if (personType === 'PJ')
        expect(stored.organizerBrandProfile?.fantasyName).toBe(
          'Marca Sintética',
        );
      else expect(stored.cnpj).toBeNull();
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: body.email, password: body.password })
        .expect(201);
      // Real Prisma regression: these fields used to be mistakenly sent to User.
      for (const status of ['REJECTED', 'CORRECTION_REQUESTED'] as const) {
        await prisma.organizerProfile.update({
          where: { userId: stored.id },
          data: {
            verificationStatus: status,
            rejectionReason: 'Motivo sintético preservado no histórico',
            reviewedAt: new Date(),
            reviewedById: 'synthetic-reviewer',
          },
        });
        await request(app.getHttpServer())
          .patch('/organizers/me/account')
          .auth(login.body.accessToken, { type: 'bearer' })
          .send({ name: 'Nome sintético atualizado' })
          .expect(200);
        expect(
          (
            await prisma.organizerProfile.findUniqueOrThrow({
              where: { userId: stored.id },
            })
          ).verificationStatus,
        ).toBe('PENDING');
        expect(
          (
            await prisma.organizerProfile.findUniqueOrThrow({
              where: { userId: stored.id },
            })
          ).rejectionReason,
        ).toBe('Motivo sintético preservado no histórico');
      }
    },
  );
  it.each([
    { state: 'SP' },
    { city: 'Salvador' },
    { municipalityCode: '9999999' },
    { address: '' },
    { postalCode: '123' },
    { cpf: '11111111111' },
    { role: 'ORGANIZER' },
    {
      role: 'ORGANIZER',
      personType: 'PJ',
      cnpj: '12ABC34501DE34',
      organizationName: 'Empresa',
    },
    { role: 'ORGANIZER', personType: 'PF', cnpj: '11222333000181' },
    { role: 'BUYER', personType: 'PJ' },
  ])('rejects invalid input without partial users (%j)', async (patch) => {
    const address = email('invalid-' + randomUUID());
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...base, email: address, cpf: cpf(5), ...patch })
      .expect(400);
    expect(await prisma.user.count({ where: { email: address } })).toBe(0);
  });
  it('rolls back the user and address if a nested consent write fails in PostgreSQL', async () => {
    const failEmail = email('atomic-fail');
    // Test-only trigger restricted to this one synthetic email, in the guarded isolated DB.
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION phase1_fail_${run}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS (SELECT 1 FROM "User" WHERE id = NEW."userId" AND email = '${failEmail}') THEN RAISE EXCEPTION 'phase1 synthetic failure'; END IF; RETURN NEW; END $$`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER phase1_fail_${run} BEFORE INSERT ON "ConsentRecord" FOR EACH ROW EXECUTE FUNCTION phase1_fail_${run}()`,
    );
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...base, email: failEmail, cpf: cpf(6) })
      .expect(500);
    expect(await prisma.user.count({ where: { email: failEmail } })).toBe(0);
  });
  it('handles concurrent unique document/email conflicts as 409, creating one account and one address', async () => {
    const body = { ...base, email: email('race'), cpf: cpf(7) };
    const responses = await Promise.all(
      [1, 2].map(() =>
        request(app.getHttpServer()).post('/auth/register').send(body),
      ),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.user.count({ where: { cpf: body.cpf } })).toBe(1);
  });
  it('preserves uniqueness against formatted legacy documents and mixed-case legacy emails', async () => {
    const legacyCpf = cpf(8);
    const formatted = legacyCpf.replace(
      /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
      '$1.$2.$3-$4',
    );
    await prisma.user.create({
      data: {
        name: 'Legacy formatted synthetic',
        email: email('legacy-formatted').toUpperCase(),
        cpf: formatted,
        password: 'synthetic-not-for-login',
      },
    });
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...base, email: email('different'), cpf: legacyCpf })
      .expect(409);
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...base, email: email('legacy-formatted'), cpf: cpf(9) })
      .expect(409);
  });
  it('aborts canonical migration on legacy duplicates without changing rows', async () => {
    const migration = readFileSync(
      resolve(
        __dirname,
        '../prisma/migrations/20261113231000_canonical_identity_uniqueness/migration.sql',
      ),
      'utf8',
    );
    const check = migration.slice(
      migration.indexOf('DO $$'),
      migration.indexOf('END $$;') + 'END $$;'.length,
    );
    const schema = `phase1_duplicates_${run}`;
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`CREATE SCHEMA ${schema}`);
        await tx.$executeRawUnsafe(
          `CREATE TABLE ${schema}."User" (email text, cpf text, cnpj text)`,
        );
        await tx.$executeRawUnsafe(
          `INSERT INTO ${schema}."User" (email, cpf) VALUES ('Case@example.test', '52998224725'), ('case@example.test', '529.982.247-25')`,
        );
        await tx.$executeRawUnsafe(`SET LOCAL search_path TO ${schema}`);
        await tx.$executeRawUnsafe(check);
      }),
    ).rejects.toThrow('Canonical identity duplicates detected');
    const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT count(*) FROM information_schema.schemata WHERE schema_name = '${schema}'`,
    );
    expect(Number(rows[0].count)).toBe(0);
  });
  it('preserves the simplified checkout without requiring a CPF or address', async () => {
    const body = {
      name: base.name,
      email: email('checkout'),
      phone: '719' + String(parseInt(run.slice(0, 6), 16)).padStart(8, '0'),
      password: base.password,
      passwordConfirmation: base.password,
      termsAccepted: true,
    };
    const result = await request(app.getHttpServer())
      .post('/auth/checkout/mini-register')
      .send(body)
      .expect(201);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: result.body.id },
      include: { buyerAddress: true },
    });
    expect(user.cpf).toBeNull();
    expect(user.buyerAddress).toBeNull();
  });
});
