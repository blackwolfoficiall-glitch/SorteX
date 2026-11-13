const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const script = fs.readFileSync(path.join(__dirname, 'deploy-neon.cjs'), 'utf8');
const invocation =
  'https://br-lingering-voice-bc92seow-sortexapi.compute.c-16.us-east-1.aws.neon.tech';

async function execute(options = {}) {
  const calls = [],
    messages = [];
  const processStub = {
    env: { NEON_API_KEY: 'test-key-never-log' },
    argv: ['node', 'deploy', '--bootstrap-or-preserve'],
    exitCode: 0,
  };
  const context = {
    __dirname,
    URL,
    FormData,
    Blob,
    AbortSignal,
    process: processStub,
    console: { log: (s) => messages.push(s), error: (s) => messages.push(s) },
    setTimeout: (fn) => {
      fn();
    },
    require: (name) =>
      name === 'node:fs'
        ? { readFileSync: () => Buffer.from('test archive') }
        : require(name),
    fetch: async (url, init = {}) => {
      const method = init.method || 'GET';
      const environment = init.body?.get('environment');
      calls.push({
        url,
        method,
        environment: environment ? JSON.parse(environment) : undefined,
        hasZip: Boolean(init.body?.get('zip')),
      });
      if (url.endsWith('/health/ready'))
        return Response.json({ status: 'ready', database: 'up' });
      if (method === 'POST') return Response.json({});
      if (url.endsWith('/databases'))
        return Response.json({
          databases: [{ name: options.database || 'sortex' }],
        });
      if (url.endsWith('/functions/sortexapi')) {
        const posted = calls.some((c) => c.method === 'POST');
        return !options.existing && !posted
          ? new Response('', { status: 404 })
          : Response.json({ invocation_url: invocation });
      }
      if (url.includes('/branches/'))
        return Response.json({
          branch: {
            id: 'br-lingering-voice-bc92seow',
            name: options.branch || 'homologacao',
          },
        });
      return Response.json({
        project: {
          id: 'crimson-bread-73821703',
          owner: { subscription_type: options.plan || 'free_v3' },
        },
      });
    },
  };
  await vm.runInNewContext(script, context, { filename: 'deploy-neon.cjs' });
  assert.ok(!messages.join('\n').includes('test-key-never-log'));
  return { calls, messages, exitCode: processStub.exitCode };
}

test('refuses a paid plan before any write', async () => {
  const r = await execute({ plan: 'launch' });
  assert.equal(r.exitCode, 1);
  assert.equal(r.calls.filter((c) => c.method === 'POST').length, 0);
});
test('refuses another branch or a missing destination database before any write', async () => {
  for (const options of [{ branch: 'production' }, { database: 'neondb' }]) {
    const r = await execute(options);
    assert.equal(r.exitCode, 1);
    assert.equal(r.calls.filter((c) => c.method === 'POST').length, 0);
  }
});
test('first deployment creates private sandbox keys and updates the actual API URL', async () => {
  const r = await execute();
  assert.equal(r.exitCode, 0);
  const writes = r.calls.filter((c) => c.method === 'POST');
  assert.equal(writes.length, 2);
  assert.equal(writes[0].hasZip, true);
  const env = writes[0].environment;
  assert.equal(env.APP_ENV, 'staging');
  assert.equal(env.PAYMENT_ENV, 'sandbox');
  assert.equal(env.UPLOADS_DISABLED, 'true');
  assert.equal('DATABASE_URL' in env, false);
  for (const key of [
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'INTEGRATION_ENCRYPTION_KEY',
  ]) {
    assert.match(env[key], /^[0-9a-f]{64}$/);
    assert.ok(!r.messages.join('\n').includes(env[key]));
  }
  assert.notEqual(env.JWT_ACCESS_SECRET, env.JWT_REFRESH_SECRET);
  assert.equal(writes[1].hasZip, false);
  assert.equal(writes[1].environment.API_URL, invocation);
});
test('subsequent code deploy preserves existing JWT/encryption keys and configuration', async () => {
  const r = await execute({ existing: true });
  assert.equal(r.exitCode, 0);
  const writes = r.calls.filter((c) => c.method === 'POST');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].environment, undefined);
  assert.equal(writes[0].hasZip, true);
});
