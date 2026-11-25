const assert = require('node:assert/strict');
const { test } = require('node:test');
const { validateDestination } = require('./migrate-isolated-qa.cjs');

const direct =
  'postgresql://qa:dummy@ep-fragrant-fire-bcnc824c.c-16.us-east-1.aws.neon.tech/neondb';
test('accepts the exact TLS-protected direct isolated destination', () => {
  const url = new URL(
    validateDestination(direct + '?sslmode=require&channel_binding=require'),
  );
  assert.equal(url.searchParams.get('connect_timeout'), '15');
});
test('refuses fallback, another database, a pooler, and unsafe options', () => {
  for (const unsafe of [
    undefined,
    '',
    direct,
    direct.replace('neondb', 'sortex') + '?sslmode=require',
    direct.replace('.c-16.', '-pooler.c-16.') + '?sslmode=require',
    direct.replace('ep-fragrant-fire-bcnc824c', 'ep-other') +
      '?sslmode=require',
    direct + '?sslmode=require&sslmode=disable',
    direct + '?sslmode=require&schema=other',
    direct + '?sslmode=require&host=other.example',
  ])
    assert.throws(() => validateDestination(unsafe), /sortex-web-ios-qa/);
});
