const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const script = fs.readFileSync(
  path.join(__dirname, 'bootstrap-admin-ci.cjs'),
  'utf8',
);

async function execute(options = {}) {
  const writes = [],
    messages = [];
  const env = options.missing
    ? {}
    : {
        NEON_API_KEY: 'test-private-key',
        SORTEX_ADMIN_EMAIL: 'owner@example.invalid',
        SORTEX_ADMIN_PASSWORD: 'Aa1!private-test-password',
      };
  const state = { env, exitCode: 0 };
  const client = class {
    user = { count: async () => (options.existing ? 1 : 0) };
    async $queryRaw() {
      return [{ db: options.database || 'sortex' }];
    }
    async $disconnect() {}
  };
  const context = {
    __dirname,
    URL,
    URLSearchParams,
    AbortSignal,
    process: state,
    console: { log: (s) => messages.push(s), error: (s) => messages.push(s) },
    fetch: async () =>
      Response.json({
        uri:
          options.uri ||
          'postgresql://test:fake@ep-summer-scene-bczo7vvq-pooler.c-16.us-east-1.aws.neon.tech/sortex?sslmode=require',
      }),
    require: (name) =>
      name === '@prisma/client'
        ? { PrismaClient: client }
        : name === 'node:child_process'
          ? {
              spawnSync: (...args) => {
                writes.push(args);
                return { status: 0 };
              },
            }
          : require(name),
  };
  await vm.runInNewContext(script, context);
  assert.ok(!messages.join('\n').includes('private-test-password'));
  assert.ok(!messages.join('\n').includes('test-private-key'));
  assert.ok(!messages.join('\n').includes('owner@example.invalid'));
  return { writes, messages, exitCode: state.exitCode };
}
test('does nothing without administrator secrets', async () => {
  const r = await execute({ missing: true });
  assert.equal(r.exitCode, 0);
  assert.equal(r.writes.length, 0);
});
test('refuses another host or database before invoking the account creator', async () => {
  for (const options of [
    { uri: 'postgresql://test:fake@other.example.invalid/sortex' },
    { database: 'production' },
  ]) {
    const r = await execute(options);
    assert.equal(r.exitCode, 1);
    assert.equal(r.writes.length, 0);
  }
});
test('preserves an active administrator without changing password or permissions', async () => {
  const r = await execute({ existing: true });
  assert.equal(r.exitCode, 0);
  assert.equal(r.writes.length, 0);
});
test('uses only the existing protected creator in staging without promotion', async () => {
  const r = await execute();
  assert.equal(r.exitCode, 0);
  assert.equal(r.writes.length, 1);
  const [, args, options] = r.writes[0];
  assert.equal(args[1], 'prisma/create-superadmin.ts');
  assert.equal(options.env.APP_ENV, 'staging');
  assert.equal(options.env.NODE_ENV, 'development');
  assert.equal(options.env.ADMIN_BOOTSTRAP_PROMOTE_EXISTING, 'false');
  assert.ok(options.env.DATABASE_URL.includes('sslmode=verify-full'));
  assert.equal(options.stdio, 'pipe');
});
