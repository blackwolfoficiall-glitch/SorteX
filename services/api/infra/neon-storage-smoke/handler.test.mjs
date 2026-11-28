import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createHandler,
  branch,
  bucket,
  endpoint,
  region,
  fixture,
  digest,
} from './handler.mjs';

const clock = () => 1_000_000;
const token = 'a'.repeat(64);
const auth = { Authorization: 'Bearer ' + token };
const run = 'd4c2040a-a02c-4ede-89f7-d409591de584';
const missing = { $metadata: { httpStatusCode: 404 } };
function harness({
  env = {},
  existing = false,
  read = fixture,
  anonymous = 403,
} = {}) {
  const events = [];
  const config = {
    NEON_BRANCH_ID: branch,
    AWS_ENDPOINT_URL_S3: endpoint,
    AWS_REGION: region,
    STORAGE_DRIVER: 'neon-s3',
    STORAGE_BUCKET: bucket,
    AWS_ACCESS_KEY_ID: 'synthetic',
    AWS_SECRET_ACCESS_KEY: 'synthetic',
    SORTEX_STORAGE_PROBE_HASH: digest(token),
    SORTEX_STORAGE_PROBE_EXPIRES_MS: String(clock() + 10_000),
    SORTEX_STORAGE_PROBE_ID: run,
    ...env,
  };
  const writer = {
    async send(command) {
      events.push(['write-client', command.constructor.name, command.input]);
      return {};
    },
  };
  const reader = {
    async send(command) {
      events.push(['read-client', command.constructor.name, command.input]);
      if (command.constructor.name === 'HeadObjectCommand' && !existing)
        throw missing;
      return {
        ContentLength: fixture.length,
        ContentType: 'image/png',
        Body: { transformToByteArray: async () => read },
      };
    },
  };
  const handler = createHandler({
    clock,
    env: config,
    getStorage: () => ({ bucket, client: writer }),
    newReader: () => reader,
    request: async (url, options) => {
      events.push(['anonymous', url, options]);
      return new Response(null, { status: anonymous });
    },
  });
  return {
    events,
    call(path = '/probe', headers = auth, method = 'POST') {
      return handler.fetch(
        new Request('https://qa.example.invalid' + path, { method, headers }),
      );
    },
  };
}

test('anonymous, wrong/expired authorization and unallowlisted paths never call storage', async () => {
  const h = harness();
  for (const result of [
    h.call('/probe', {}),
    h.call('/probe', { Authorization: 'Bearer ' + 'b'.repeat(64) }),
    h.call('/probe?token=x'),
    h.call('/elsewhere'),
    h.call('/probe', auth, 'GET'),
  ]) {
    const denied = await result;
    assert.equal(denied.status, 404);
    assert.equal(await denied.text(), '');
  }
  const expired = harness({
    env: { SORTEX_STORAGE_PROBE_EXPIRES_MS: String(clock() - 1) },
  });
  assert.equal((await expired.call()).status, 404);
  assert.deepEqual(expired.events, []);
  assert.deepEqual(h.events, []);
});

test('mismatched branch, region, bucket, credentials or endpoint fail closed', async () => {
  for (const env of [
    { NEON_BRANCH_ID: 'wrong' },
    { AWS_ENDPOINT_URL_S3: endpoint + '?secret=unexpected' },
    { AWS_REGION: 'wrong' },
    { STORAGE_BUCKET: 'wrong' },
    { AWS_ACCESS_KEY_ID: undefined },
    { AWS_SECRET_ACCESS_KEY: undefined },
  ]) {
    const h = harness({ env });
    const res = await h.call();
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { ok: false, phase: 'runtime' });
    assert.deepEqual(h.events, []);
  }
});

test('authorized preflight uses the existing adapter for a read-only HeadBucket', async () => {
  const h = harness();
  assert.deepEqual(await (await h.call('/preflight')).json(), {
    ok: true,
    injected: true,
  });
  assert.deepEqual(h.events, [
    ['write-client', 'HeadBucketCommand', { Bucket: bucket }],
  ]);
});

test('writes one new conditional PNG, reads via separate client, requires anonymous denial', async () => {
  const h = harness();
  const receipt = await (await h.call()).json();
  assert.deepEqual(receipt, {
    ok: true,
    bytes: 69,
    sha256: digest(fixture),
    anonymousDenied: true,
  });
  assert.ok(!JSON.stringify(receipt).includes(run));
  assert.deepEqual(
    h.events.map((x) => x.slice(0, 2)),
    [
      ['write-client', 'HeadBucketCommand'],
      ['read-client', 'HeadObjectCommand'],
      ['write-client', 'PutObjectCommand'],
      ['read-client', 'GetObjectCommand'],
      ['anonymous', `${endpoint}/${bucket}/__sortex_smoke__/${run}.png`],
    ],
  );
  assert.deepEqual(h.events[2][2], {
    Bucket: bucket,
    Key: `__sortex_smoke__/${run}.png`,
    Body: fixture,
    ContentType: 'image/png',
    CacheControl: 'private, no-store',
    IfNoneMatch: '*',
  });
  assert.equal(h.events[4][2].credentials, 'omit');
  assert.equal(h.events[4][2].redirect, 'error');
  assert.equal(h.events[4][2].headers.Authorization, undefined);
  assert.equal((await h.call()).status, 409);
  assert.equal(h.events.length, 5);
});

test('never overwrites, and fails without public/private or integrity evidence', async () => {
  const already = harness({ existing: true });
  assert.equal((await already.call()).status, 409);
  assert.equal(
    already.events.some((x) => x[1] === 'PutObjectCommand'),
    false,
  );
  for (const [options, phase] of [
    [{ read: Buffer.alloc(fixture.length) }, 'get'],
    [{ anonymous: 200 }, 'anonymous'],
    [{ anonymous: 404 }, 'anonymous'],
  ]) {
    const h = harness(options);
    const fail = await h.call();
    assert.equal(fail.status, 503);
    assert.deepEqual(await fail.json(), { ok: false, phase });
  }
});
