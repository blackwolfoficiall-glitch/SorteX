const test = require('node:test');
const assert = require('node:assert/strict');
const { assertTarget } = require('./seed-organizer-demo.cjs');
const env = {
  DATABASE_URL:
    'postgresql://fixture:fixture@ep-old-dawn-bcrbqzmd.c-16.us-east-1.aws.neon.tech/sortex_preview',
  ALLOW_ORGANIZER_DEMO: 'isolated-preview-only',
  APP_ENV: 'staging',
  PAYMENT_ENV: 'sandbox',
  INTEGRATIONS_MODE: 'sandbox',
  EMAIL_DELIVERY_MODE: 'disabled',
};
test('allows only the dedicated preview with explicit sandbox and disabled delivery', () =>
  assert.doesNotThrow(() => assertTarget(env)));
for (const change of [
  { DATABASE_URL: 'postgresql://fixture:fixture@localhost/production' },
  { PAYMENT_ENV: 'production' },
  { EMAIL_DELIVERY_MODE: 'enabled' },
  { ALLOW_ORGANIZER_DEMO: '' },
])
  test(`refuses unsafe target/configuration: ${Object.keys(change)[0]}`, () =>
    assert.throws(() => assertTarget({ ...env, ...change })));
