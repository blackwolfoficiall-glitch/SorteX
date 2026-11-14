// Only an empty database (or its pristine historical schema after an interrupted setup) is accepted.
// It must be a loopback PostgreSQL database named sortex_phase1_*.
// Applies the historical schema, creates synthetic legacy data, saves a snapshot,
// then applies the additive Phase 1 migrations. Never uses a production DATABASE_URL.
const { PrismaClient, Prisma } = require('@prisma/client');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, readdirSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { resolve, join } = require('node:path');
const { tmpdir } = require('node:os');
const api = resolve(__dirname, '..');
const databaseUrl = process.env.SORTEX_PHASE1_DATABASE_URL;
if (!databaseUrl) throw new Error('Set SORTEX_PHASE1_DATABASE_URL through your local secure environment.');
const url = new URL(databaseUrl);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !/^\/sortex_phase1_[a-z0-9_]+$/.test(url.pathname)) throw new Error('Refusing a non-isolated database.');
const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
const env = { ...process.env, DATABASE_URL: databaseUrl };
const prismaCli = join(api, 'node_modules/prisma/build/index.js');
function migrate(config) {
  try {
    execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy', '--config', config], { cwd: api, env, stdio: 'pipe' });
  } catch {
    throw new Error('Migration failed in the isolated database. Inspect it locally; no database was reset.');
  }
}
(async () => {
  const tables = await prisma.$queryRaw`SELECT count(*) AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`;
  if (Number(tables[0].count) !== 0) {
    const history = await prisma.$queryRaw`SELECT migration_name, checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
    const users = await prisma.$queryRaw`SELECT count(*) AS count FROM "User"`;
    if (history.length !== 16 || Number(users[0].count) !== 0 || !history.every((row) => row.migration_name < '20261113' && createHash('sha256').update(readFileSync(join(api, 'prisma/migrations', row.migration_name, 'migration.sql'))).digest('hex') === row.checksum)) {
      throw new Error('Refusing existing data or a modified schema. Create a NEW isolated database; do not reset existing data.');
    }
  }
  const work = mkdtempSync(join(tmpdir(), 'sortex-phase1-fixture-'));
  const migrations = join(work, 'migrations');
  mkdirSync(migrations);
  const source = join(api, 'prisma/migrations');
  for (const name of readdirSync(source)) {
    if (name === 'migration_lock.toml') copyFileSync(join(source, name), join(migrations, name));
    else if (name < '20261113' && /^\d{14}_/.test(name)) {
      mkdirSync(join(migrations, name));
      copyFileSync(join(source, name, 'migration.sql'), join(migrations, name, 'migration.sql'));
    }
  }
  const schema = join(work, 'schema.prisma');
  writeFileSync(schema, execFileSync('git', ['show', '2ad37ea:services/api/prisma/schema.prisma'], { cwd: api }), { mode: 0o600 });
  const config = join(work, 'prisma.config.cjs');
  writeFileSync(config, `module.exports = ${JSON.stringify({ schema, migrations: { path: migrations } })};\n`, { mode: 0o600 });
  migrate(config);
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`INSERT INTO "User" (id, name, email, password, role, cpf, "adminPermissions", "updatedAt") VALUES ('phase1-legacy', 'Conta sintética antiga', 'legacy-phase1@example.test', 'synthetic-not-for-login', 'ORGANIZER', '52998224725', '{}', CURRENT_TIMESTAMP)`;
    await tx.$executeRaw`INSERT INTO "OrganizerProfile" (id, "userId", "fullName", cpf, phone, city, state, "updatedAt") VALUES ('phase1-legacy-profile', 'phase1-legacy', 'Conta sintética antiga', '52998224725', '71999990000', 'Local legado', 'BA', CURRENT_TIMESTAMP)`;
    await tx.$executeRaw`INSERT INTO "OrganizerBrandProfile" ("organizerId", "publicName", slogan, "updatedAt") VALUES ('phase1-legacy', 'Marca sintética', 'Slogan preservado', CURRENT_TIMESTAMP)`;
    await tx.$executeRaw`INSERT INTO "AuthSession" (id, "userId", "refreshTokenHash", "expiresAt", "updatedAt") VALUES ('phase1-session', 'phase1-legacy', 'synthetic-session', '2027-01-01', CURRENT_TIMESTAMP)`;
  });
  const oldProfileFields = Object.fromEntries(Prisma.dmmf.datamodel.models.find((m) => m.name === 'OrganizerProfile').fields.filter((f) => f.kind !== 'object' && f.name !== 'personType').map((f) => [f.name, true]));
  const before = await prisma.user.findUniqueOrThrow({ where: { id: 'phase1-legacy' }, include: { sessions: true, organizerProfile: { select: oldProfileFields }, organizerBrandProfile: true } });
  const snapshot = join(work, 'legacy-before.json');
  writeFileSync(snapshot, JSON.stringify(before), { mode: 0o600 });
  migrate(join(api, 'prisma.config.ts'));
  console.log('Historical schema + synthetic fixture + additive migrations prepared in the isolated database.');
  console.log(`SORTEX_PHASE1_BEFORE_PATH=${snapshot}`);
  console.log('No connection credentials were written to repository files.');
})().catch((error) => { console.error(error.message.replaceAll(databaseUrl, '[ISOLATED_DB]')); process.exitCode = 1; }).finally(() => prisma.$disconnect());
