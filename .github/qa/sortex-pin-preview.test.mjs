import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eligibleEmail, isSha, ownTunnel, cloudflaredReady, validGate, verifyGate } from './sortex-pin-preview.mjs';

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
