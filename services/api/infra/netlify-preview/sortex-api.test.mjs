import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPreviewHandler } from './sortex-api.mjs';
const context = { site: { id: 'af720ddb-9366-4e26-bcfe-d92ea8c27caf' } };
const env = { DATABASE_URL: 'postgresql://synthetic:synthetic@ep-old-dawn-bcrbqzmd.c-16.us-east-1.aws.neon.tech/sortex_preview', API_URL: 'https://sortex-fase1-review.netlify.app/.netlify/functions/sortex-api', APP_ENV: 'staging', PAYMENT_ENV: 'sandbox', INTEGRATIONS_MODE: 'sandbox', UPLOADS_DISABLED: 'true', EMAIL_DELIVERY_MODE: 'disabled' };
function handler(overrides = {}) {
  let loads = 0;
  const fn = createPreviewHandler({ readEnv: (key) => ({ ...env, ...overrides })[key], loadApplication: async () => { loads++; return { default: { fetch: async (r) => Response.json({ path: new URL(r.url).pathname, query: new URL(r.url).search, method: r.method, auth: r.headers.get('authorization'), body: ['GET', 'HEAD'].includes(r.method) ? null : await r.text() }) } }; } });
  return { fn, loads: () => loads };
}
test('preserves API method, body, auth and query while removing only the hosting prefix', async () => {
  const h = handler(); const response = await h.fn(new Request(env.API_URL + '/auth/register?synthetic=1', { method: 'POST', headers: { authorization: 'Bearer synthetic-session' }, body: '{"synthetic":true}' }), context);
  assert.deepEqual(await response.json(), { path: '/auth/register', query: '?synthetic=1', method: 'POST', auth: 'Bearer synthetic-session', body: '{"synthetic":true}' });
  assert.match(response.headers.get('x-robots-tag'), /noindex/);
  await h.fn(new Request(env.API_URL + '/health/ready'), context); assert.equal(h.loads(), 1);
});
test('rejects the published site before loading the application', async () => {
  const h = handler(); await assert.rejects(h.fn(new Request(env.API_URL), { site: { id: 'a3040361-02c8-4222-8110-36f043eeb5e1' } })); assert.equal(h.loads(), 0);
});
test('rejects another database and unsafe modes before loading the application', async () => {
  for (const change of [{ DATABASE_URL: 'postgresql://synthetic:synthetic@published.example.invalid/sortex' }, { PAYMENT_ENV: 'production' }, { APP_ENV: 'production' }, { EMAIL_DELIVERY_MODE: 'enabled' }, { UPLOADS_DISABLED: 'false' }]) {
    const h = handler(change); await assert.rejects(h.fn(new Request(env.API_URL), context)); assert.equal(h.loads(), 0);
  }
});
test('rejects paths outside the function boundary', async () => { const h = handler(); assert.equal((await h.fn(new Request(env.API_URL + 'wrong'), context)).status, 404); assert.equal(h.loads(), 0); });
