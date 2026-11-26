import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eligibleEmail, isSha, ownTunnel, cloudflaredReady, validGate, verifyGate, verifyQaUpstream } from './sortex-pin-preview.mjs';

const origin = 'https://a-private-qa.trycloudflare.com';
const login = 'https://login.trycloudflare.com/authorize?hostname=a-private-qa.trycloudflare.com&state=fixture';

test('allows one concrete address, not domain, wildcard, multiple or control characters', () => {
  assert.equal(eligibleEmail('qa.tester+sortex@example.invalid'), true);
  for (const invalid of ['example.invalid','*.example.invalid','@example.invalid','x@y.z,other@y.z','first@y.z\nsecond@y.z','x@bad@y.z','x@y.z ']) {
    assert.equal(eligibleEmail(invalid), false);
  }
});

test('accepts pinned SHA and generated tunnel host only', () => {
  assert.equal(isSha('a'.repeat(40)), true);
  assert.equal(isSha('a'.repeat(39)), false);
  assert.equal(isSha('refs/heads/main'), false);
  assert.equal(ownTunnel(origin), true);
  for (const invalid of ['https://login.trycloudflare.com', 'https://api.trycloudflare.com',origin+':8080', origin+'/path', 'https://a.trycloudflare.com.example.invalid', 'http://a.trycloudflare.com']) {
    assert.equal(ownTunnel(invalid),false);
  }
});

test('rejects old releases and missing exact permission flag', () => {
  assert.equal(cloudflaredReady('cloudflared version 2026.11.2', '--allowed-mail value'), true);
  assert.equal(cloudflaredReady('cloudflared version 2026.11.1', '--allowed-mail value'), false);
  assert.equal(cloudflaredReady('cloudflared version 2026.11.2', '--url value'), false);
});

test('rejects origin redirect, foreign tenant, public response and cacheable redirect', () => {
  assert.equal(validGate(302,login,'private, no-store',origin),true);
  for (const [status, location, cache] of [
    [200,login,'private, no-store'], [302,origin+'/login','private, no-store'],
    [302,login.replace('a-private-qa','wrong-tenant'),'private, no-store'],
    [302,login.replace('login.trycloudflare.com','other.example.invalid'),'private, no-store'],
    [302,login.replace('&state=fixture',''),'private, no-store'],
    [302,login,'public, max-age=1800'], [403,login,'private, no-store'],
  ]) {
    assert.equal(validGate(status,location,cache,origin), false);
  }
});

test('requires public paths to redirect and anonymous BFF POST to be rejected', async () => {
  const trace = [];
  const accept = (url, init) => {
    trace.push(new URL(url).pathname);
    return init.method === 'POST' ? new Response(null,{status:401}) :
      new Response(null,{status:302,headers:{location:login,'cache-control':'private, no-store'}});
  };
  assert.equal(await verifyGate(origin,accept),true);
  assert.deepEqual(trace.sort(), ['/','/api/auth/login','/api/health/ready','/robots.txt']);
  assert.equal(await verifyGate(origin,(url,init)=>new URL(url).pathname==='/robots.txt'?new Response(null,{status:200}):accept(url,init)),false);
  assert.equal(await verifyGate(origin,(url,init)=>init.method==='POST'?new Response(null,{status:200}):accept(url,init)),false);
});

const qaApi = 'https://br-weathered-forest-bccwn49d-sortexqa.compute.c-16.us-east-1.aws.neon.tech';
const selectedSha = 'a'.repeat(40);
const staleSha = 'b'.repeat(40);
const goodHealth = { version: selectedSha };
const goodReady = { status: 'ready', database: 'up' };

test('accepts only responses from both pinned routes, with no delay while healthy', async () => {
  const requests = [];
  await verifyQaUpstream(selectedSha, (url, options) => {
    requests.push(url);
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers['Cache-Control'], 'no-store');
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json(url.endsWith('/ready') ? goodReady : goodHealth);
  }, () => assert.fail('a healthy QA must not wait for a retry'));
  assert.deepEqual(requests, [qaApi + '/health', qaApi + '/health/ready']);
});

test('rechecks both signals together after timeout and a partial rollout', async () => {
  const attempts = new Map();
  const waits = [];
  await verifyQaUpstream(selectedSha, (url, options) => {
    if (!attempts.has(options.signal)) attempts.set(options.signal, []);
    attempts.get(options.signal).push(url);
    const round = attempts.size;
    if (url.endsWith('/ready')) return Response.json(goodReady);
    if (round === 1) throw new DOMException('upstream timeout', 'TimeoutError');
    return Response.json(round === 2 ? { version: staleSha } : goodHealth);
  }, ms => waits.push(ms));
  assert.deepEqual([...attempts.values()], Array.from({ length: 3 }, () => [qaApi + '/health', qaApi + '/health/ready']));
  assert.deepEqual(waits, [1_000, 2_000]);
});

test('fails closed after three attempts: valid data from different rounds is never combined', async () => {
  const signals = new Set();
  const waits = [];
  let requests = 0;
  await assert.rejects(verifyQaUpstream(selectedSha, (url, options) => {
    requests++;
    signals.add(options.signal);
    const round = signals.size;
    if (url.endsWith('/ready')) {
      if (round === 1) return Response.json({ status: 'ready', database: 'down' });
      if (round === 3) return Response.json(goodReady, { status: 503 });
      return Response.json(goodReady);
    }
    return Response.json(round === 2 ? { version: staleSha } : goodHealth);
  }, ms => waits.push(ms)), /não confirmou o SHA e o banco esperados após três tentativas/);
  assert.equal(signals.size, 3);
  assert.equal(requests, 6);
  assert.deepEqual(waits, [1_000, 2_000]);
});

test('retries missing or malformed readiness and does not log response bodies', async () => {
  const rounds = new Set();
  await assert.rejects(verifyQaUpstream(selectedSha, (url, options) => {
    rounds.add(options.signal);
    if (url.endsWith('/ready'))
      return new Response(rounds.size === 1 ? 'not-json' : '{"status":"starting","notice":"not-for-console"}');
    return Response.json(goodHealth);
  }, () => {}), error => /não confirmou o SHA e o banco/.test(error.message) &&
    !/not-for-console|not-json/.test(error.message));
  assert.equal(rounds.size, 3);
});

test('does not send requests for an incomplete SHA', async () => {
  await assert.rejects(verifyQaUpstream('a'.repeat(7), () => assert.fail('no network')), /SHA/);
});
