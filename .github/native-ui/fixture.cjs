const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const { readFileSync } = require('node:fs');

const database = new URL(process.env.DATABASE_URL || 'postgresql://invalid');
const email = 'sortex-ios-ui@example.test';
const slug = 'campanha-sintetica-ios';
const title = 'Campanha sintetica iOS';
const regulation = 'Regulamento sintetico da campanha iOS.';
const mode = process.argv[2];

function fixtureGuard() {
  assert.equal(process.env.SORTEX_IOS_UI_SCOPE, 'disposable-loopback');
  assert.equal(database.protocol, 'postgresql:');
  assert.equal(database.hostname, '127.0.0.1');
  assert.equal(database.port, '55478');
  assert.equal(database.pathname, '/sortex_ios_ui');
  assert.equal(database.username, 'sortex_ios_ui');
  assert.match(database.password, /^[0-9a-f]{48}$/);
  assert.equal(database.search, '');
  assert.equal(database.hash, '');
}

// The backend is the real application, not an HTTP response fixture.
async function serve() {
  const { createApplication } = require('../../services/api/dist/src/application.js');
  const app = await createApplication();
  app.enableShutdownHooks();
  await app.listen(3338, '127.0.0.1');
}

async function dbOperation() {
  const apiRequire = createRequire(resolve(__dirname, '../../services/api/package.json'));
  const { PrismaClient } = apiRequire('@prisma/client');
  const { PrismaPg } = apiRequire('@prisma/adapter-pg');
  const { hash } = apiRequire('bcrypt');
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: database.href }) });

  try {
    if (mode === 'seed') {
      const password = process.env.SORTEX_IOS_UI_BUYER_PASSWORD;
      assert.match(password, /^[0-9a-f]{48}$/);
      await db.$transaction(async (tx) => {
        assert.equal(await tx.user.count(), 0, 'Fixture requires an empty disposable database.');
        assert.equal(await tx.campaign.count(), 0, 'Fixture requires an empty disposable database.');
        const organizer = await tx.user.create({
          data: {
            name: 'Organizador sintetico iOS', email: 'sortex-ios-organizer@example.test',
            password: await hash(password, 12), role: 'ORGANIZER',
          },
        });
        await tx.user.create({
          data: { name: 'CompradorIOS Sintetico', email, password: await hash(password, 12), role: 'BUYER' },
        });
        await tx.campaign.create({
          data: {
            organizerId: organizer.id, title, slug, regulation,
            status: 'PUBLISHED', publishedAt: new Date(),
            isFeatured: true, mainPrizeName: 'Premio sintetico iOS', numberPrice: 2,
          },
        });
      });
      console.log('Seeded one synthetic published campaign and two synthetic identities.');
      return;
    }

    const buyer = await db.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
    const sessions = await db.authSession.findMany({
      where: { userId: buyer.id }, select: { revokedAt: true },
    });
    assert.equal(sessions.length, 1, 'Reopening must reuse the original session.');
    assert.ok(sessions[0].revokedAt, 'Native logout must persist a real server-side revocation.');
    assert.equal(await db.payment.count(), 0, 'The native smoke must not create payment records.');

    const lines = readFileSync(process.argv[3], 'utf8').split('\n').flatMap((line) => {
      try { return [JSON.parse(line)]; } catch { return []; }
    });
    const required = [
      ['POST', '/auth/login'],
      ['GET', '/auth/me'],
      ['GET', '/buyer/campaigns'],
      ['GET', '/public/campaigns/' + slug],
      ['POST', '/auth/refresh'],
      ['POST', '/auth/logout'],
    ];
    let after = -1;
    for (const [method, path] of required) {
      after = lines.findIndex((x, i) => i > after && x.method === method &&
        (x.path === path || x.path?.startsWith(path + '?')) &&
        x.status >= 200 && x.status < 300 &&
        (!['/auth/me', '/auth/logout', '/buyer/campaigns'].includes(path) || x.userId === buyer.id));
      assert.notEqual(after, -1, `Missing successful, ordered fixture request: ${method} ${path}`);
    }
    console.log('Verified ordered local Nest requests, one revoked PostgreSQL session, no payments.');
  } finally {
    await db.$disconnect();
  }
}

async function main() {
  fixtureGuard();
  if (mode === 'serve') return serve();
  assert.ok(['seed', 'verify'].includes(mode), 'Unknown fixture mode.');
  return dbOperation();
}

main().catch(() => {
  // Do not print connection strings, request data or generated credentials.
  console.error('Native UI fixture failed its environment, database or HTTP checks.');
  process.exitCode = 1;
});
