'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const net = require('node:net');
const {
  pins, confirmation, validateInvocation, readManifest, databaseState, promote,
  applyPrisma, assertRuntimeHttp,
} = require('./release-draw-window-qa.cjs');

const cwd = path.resolve(__dirname, '..');
const env = {
  GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_RUN_ATTEMPT: '1',
  GITHUB_REPOSITORY: pins.repository, GITHUB_REF: pins.ref, GITHUB_SHA: 'f'.repeat(40),
  QA_ENABLE: 'yes', SORTEX_QA_NEON_API_KEY: 'synthetic',
  SORTEX_QA_DATABASE_URL: 'postgresql://synthetic:synthetic@ep-fragrant-fire-bcnc824c.c-16.us-east-1.aws.neon.tech/neondb?sslmode=require',
  SORTEX_QA_RELEASE_CONFIRM: confirmation,
};
const manifest = readManifest(cwd);
const rows = count => manifest.slice(0, count).map(
  ([migration_name, checksum]) => ({ migration_name, checksum, complete: true }),
);
const column = { data_type: 'text', is_nullable: 'YES', column_default: null };

function harness(options = {}) {
  let count = options.initial ?? 21;
  const events = [];
  const client = { query: async sql => {
    if (sql.includes('pg_try_advisory_lock')) {
      events.push('lock');
      return { rows: [{ granted: !options.busy }] };
    }
    if (sql.includes('pg_advisory_unlock')) { events.push('unlock'); return { rows: [] }; }
    if (sql.includes('current_database()'))
      return { rows: [{ name: options.db ?? 'neondb', schema: 'public', recovery: false }] };
    if (sql.includes('_prisma_migrations')) {
      const seen = rows(count);
      if (options.badHash) seen[0].checksum = 'f'.repeat(64);
      if (options.incomplete) seen.at(-1).complete = false;
      events.push('ledger' + count);
      return { rows: seen };
    }
    if (sql.includes('information_schema')) {
      return { rows: count === 22 || options.strayColumn ? [options.badColumn ?? column] : [] };
    }
    if (sql === 'BEGIN' || sql === 'ROLLBACK') { events.push(sql); return { rows: [] }; }
    if (sql.includes('ACCESS EXCLUSIVE MODE NOWAIT')) {
      events.push('table-lock-check');
      if (options.tableBusy) throw Error('synthetic raw database input');
      return { rows: [] };
    }
    throw Error('unexpected SQL');
  } };
  const assertRuntime = async revision => {
    events.push(revision === pins.baseSha ? 'base' : 'candidate');
    if (options.runtimeFailure === events.length) throw Error('synthetic raw provider input');
  };
  const migrate = async () => {
    events.push('migrate');
    if (options.migrateFailure) throw Error('synthetic raw database input');
    count = options.staleMigration ? 21 : 22;
  };
  const deploy = async () => {
    events.push('deploy');
    if (options.deployFailure) throw Error('synthetic raw provider input');
    return { id: 14, unchanged: false };
  };
  return { events, run: (mode = '--apply') => promote({ mode, manifest, client, assertRuntime, migrate, deploy }) };
}

test('manual candidate requires exact ref, repository, attempt, DB identity and explicit apply confirmation', () => {
  assert.equal(new URL(validateInvocation('--plan', { ...env, SORTEX_QA_RELEASE_CONFIRM: undefined })).pathname, '/neondb');
  assert.match(validateInvocation('--apply', env), /connect_timeout=15/);
  for (const overrides of [
    { GITHUB_EVENT_NAME: 'push' }, { GITHUB_RUN_ATTEMPT: '2' },
    { GITHUB_REF: 'refs/heads/main' }, { GITHUB_REPOSITORY: 'other/project' },
    { GITHUB_SHA: '09a0f9a' }, { QA_ENABLE: 'no' }, { SORTEX_QA_DATABASE_URL: 'postgresql://user:pass@127.0.0.1/neondb' },
    { SORTEX_QA_RELEASE_CONFIRM: 'yes' }, { SORTEX_QA_NEON_API_KEY: '' },
  ]) assert.throws(() => validateInvocation('--apply', { ...env, ...overrides }));
});

test('migration manifest refuses edited, extra, or symlinked files', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sortex-release-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.cpSync(path.join(cwd, 'prisma/migrations'), path.join(dir, 'prisma/migrations'), { recursive: true });
  assert.equal(readManifest(dir).length, 22);
  const sql = path.join(dir, 'prisma/migrations', pins.migration, 'migration.sql');
  fs.symlinkSync(sql, path.join(path.dirname(sql), 'extra.sql'));
  assert.throws(() => readManifest(dir), /Arquivos inesperados/);
  fs.unlinkSync(path.join(path.dirname(sql), 'extra.sql'));
  fs.appendFileSync(sql, '\n');
  assert.throws(() => readManifest(dir), /Manifesto/);
});

test('plan reads only base/ledger and releases the lease without touching schema or code', async () => {
  const h = harness();
  assert.deepEqual(await h.run('--plan'), { stage: 'read-only', migrations: 21, checksum: pins.first21 });
  assert.deepEqual(h.events, ['lock', 'base', 'ledger21', 'unlock']);
});

test('apply strictly sequences authorized migration, old runtime, single deployment and final checks', async () => {
  const h = harness();
  assert.deepEqual(await h.run(), { stage: 'candidate-verified', migrations: 22, checksum: pins.all22, deployment: 14 });
  assert.deepEqual(h.events, ['lock', 'base', 'ledger21', 'BEGIN', 'table-lock-check', 'ROLLBACK', 'migrate',
    'ledger22', 'base', 'deploy', 'candidate', 'ledger22', 'unlock']);
});

test('lease contention, incorrect baseline, edited checksum, incomplete schema and table lock block writes', async () => {
  for (const options of [
    { busy: true }, { initial: 22 }, { badHash: true }, { incomplete: true }, { db: 'postgres' },
    { strayColumn: true }, { runtimeFailure: 2 }, { tableBusy: true },
  ]) {
    const h = harness(options);
    await assert.rejects(h.run());
    assert.equal(h.events.includes('migrate'), false);
    assert.equal(h.events.includes('deploy'), false);
  }
});

test('schema errors refuse code promotion; uncertain provider result is never retried', async () => {
  for (const options of [
    { migrateFailure: true }, { staleMigration: true }, { badColumn: { ...column, is_nullable: 'NO' } },
    { runtimeFailure: 9 },
  ]) {
    const h = harness(options);
    await assert.rejects(h.run(), /não repita sem reconciliar/);
    assert.equal(h.events.filter(x => x === 'migrate').length, 1);
    assert.equal(h.events.includes('deploy'), false);
  }
  const h = harness({ deployFailure: true });
  await assert.rejects(h.run(), /promote-code/);
  assert.equal(h.events.filter(x => x === 'deploy').length, 1);
  assert.equal(h.events.includes('candidate'), false);
});

test('HTTP readiness requires matching SHA, storage and a readable public campaigns route', async () => {
  const calls = [];
  const request = (badPath = '') => async (href, options) => {
    const url = new URL(href);
    assert.equal(url.origin, pins.origin);
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers, undefined);
    calls.push(url.pathname);
    const bodies = {
      '/health': { status: 'ok', version: pins.candidateSha },
      '/health/ready': { status: 'ready', storage: 'up', database: 'up' },
      '/public/campaigns': [],
    };
    return Response.json(url.pathname === badPath ? { error: 'synthetic' } : bodies[url.pathname]);
  };
  await assertRuntimeHttp(pins.candidateSha, request());
  assert.deepEqual(calls.sort(), ['/health', '/health/ready', '/public/campaigns']);
  for (const failed of [...calls]) await assert.rejects(assertRuntimeHttp(pins.candidateSha, request(failed)));
  await assert.rejects(assertRuntimeHttp(pins.baseSha, request()));
});

const pgBin = process.env.SORTEX_LOCAL_RELEASE_TEST_PG_BIN;
test('real disposable PostgreSQL: refuses lock, applies exact Prisma migration, preserves old row, blocks rerun',
  { skip: !pgBin, timeout: 80000 }, async t => {
    const { Client } = require('pg');
    const version = spawnSync(path.join(pgBin, 'postgres'), ['--version'], { encoding: 'utf8' });
    assert.match(version.stdout, /PostgreSQL\) 18\./);
    const listener = net.createServer();
    await new Promise((resolve, reject) => listener.listen(0, '127.0.0.1', resolve).once('error', reject));
    const port = listener.address().port;
    await new Promise(resolve => listener.close(resolve));
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sortex-disposable-pg-gate-'));
    const data = path.join(tmp, 'pgdata');
    const copy = path.join(tmp, 'baseline');
    const pgctl = (...args) => spawnSync(path.join(pgBin, 'pg_ctl'), ['-D', data, ...args], { stdio: 'ignore', timeout: 15000 });
    t.after(() => {
      pgctl('-m', 'fast', '-w', 'stop');
      fs.rmSync(tmp, { recursive: true, force: true });
    });
    assert.equal(spawnSync(path.join(pgBin, 'initdb'), ['-D', data, '-A', 'trust', '-U', 'synthetic_qa',
      '--locale=C', '--encoding=UTF8'], { stdio: 'ignore', timeout: 15000 }).status, 0);
    assert.equal(pgctl('-o', '-h 127.0.0.1 -p ' + port + ' -c unix_socket_directories= -c shared_buffers=16MB',
      '-l', path.join(tmp, 'pg.log'), '-w', 'start').status, 0);
    const basePath = 'postgresql://synthetic_qa@127.0.0.1:' + port;
    const root = new Client({ connectionString: basePath + '/postgres' });
    await root.connect();
    await root.query('CREATE DATABASE neondb');
    await root.end();
    const url = basePath + '/neondb';
    fs.mkdirSync(copy);
    fs.cpSync(path.join(cwd, 'prisma'), path.join(copy, 'prisma'), { recursive: true });
    fs.copyFileSync(path.join(cwd, 'prisma.config.ts'), path.join(copy, 'prisma.config.ts'));
    fs.symlinkSync(path.join(cwd, 'node_modules'), path.join(copy, 'node_modules'), 'dir');
    fs.rmSync(path.join(copy, 'prisma/migrations', pins.migration), { recursive: true });
    applyPrisma(copy, url);
    const client = new Client({ connectionString: url });
    const blocker = new Client({ connectionString: url });
    await client.connect();
    await blocker.connect();
    try {
      await client.query(`INSERT INTO public."User" (id, name, email, password, role, "updatedAt")
        VALUES ('release-owner', 'Fictício', 'release-owner@example.test', 'non-login-fixture', 'ORGANIZER', '2026-11-26')`);
      await client.query(`INSERT INTO public."Campaign" (id, "organizerId", title, slug, "drawDate", "drawTime", "updatedAt")
        VALUES ('release-campaign', 'release-owner', 'Campanha fictícia', 'release-campaign', '2026-11-29 23:00', '20:00', '2026-11-26')`);
      const snapshotSql = 'SELECT id, title, "drawDate", "drawTime", "updatedAt" FROM public."Campaign"';
      const before = (await client.query(snapshotSql)).rows;
      const events = [];
      const run = mode => promote({
        mode, manifest, client,
        assertRuntime: async version => events.push(version),
        migrate: () => { events.push('prisma'); return applyPrisma(cwd, url); },
        deploy: async () => { events.push('simulated-provider'); return { id: 14, unchanged: false }; },
      });
      await blocker.query('BEGIN');
      await blocker.query('LOCK TABLE public."Campaign" IN ACCESS SHARE MODE');
      await assert.rejects(run('--apply'), /table-lock-preflight/);
      assert.equal(events.includes('prisma'), false);
      await blocker.query('ROLLBACK');
      assert.equal((await run('--plan')).migrations, 21);
      assert.equal((await run('--apply')).migrations, 22);
      assert.deepEqual(await databaseState(client, manifest, 22), { migrations: 22, checksum: pins.all22 });
      assert.deepEqual((await client.query(snapshotSql)).rows, before);
      assert.equal((await client.query('SELECT "drawTimeZone" FROM public."Campaign"')).rows[0].drawTimeZone, null);
      assert.equal((await client.query('SELECT count(*)::int AS count FROM public."Payment"')).rows[0].count, 0);
      await assert.rejects(run('--apply'), /base-ready/);
      assert.equal(events.filter(x => x === 'prisma').length, 1);
      assert.equal(events.filter(x => x === 'simulated-provider').length, 1);
      assert.equal(pins.digest, createHash('sha256').update(fs.readFileSync(
        path.join(cwd, 'prisma/migrations', pins.migration, 'migration.sql'))).digest('hex'));
    } finally {
      await blocker.end();
      await client.end();
    }
  });
