'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { rollout, baseline, revision } = require('./redeploy-isolated-qa.cjs');
const origin = 'https://br-weathered-forest-bccwn49d-sortexqa.compute.c-16.us-east-1.aws.neon.tech';
const names = ['APP_ENV', 'APP_VERSION', 'PAYMENT_ENV', 'FEATURE_REAL_PAYMENTS',
  'FEATURE_PAYOUTS', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'INTEGRATION_ENCRYPTION_KEY'];
const env = {
  GITHUB_REPOSITORY: 'blackwolfoficiall-glitch/SorteX', GITHUB_REF: 'refs/heads/homologacao/web-ios-integrada',
  SORTEX_QA_CODE_SHA: revision, QA_ENABLE: 'yes', SORTEX_QA_NEON_API_KEY: 'synthetic-only',
};
function harness({ previousVersion = baseline, variables = names, previousId = 4, after = names, currentId = previousId } = {}) {
  const posts = [];
  let calls = 0;
  const request = async (href, options) => {
    calls++;
    const u = new URL(href);
    const isAdmin = u.origin === 'https://console.neon.tech';
    assert.equal(!!options.headers?.Authorization, isAdmin);
    if (u.pathname.endsWith('/deployments')) {
      posts.push(options.body);
      return Response.json({ deployment: { id: 5 } });
    }
    if (u.pathname.endsWith('/functions/sortexqa')) {
      const active = { id: posts.length ? 5 : previousId, status: 'completed', environment: posts.length ? after : variables };
      return Response.json({ function: { slug: 'sortexqa', invocation_url: origin + '/', active_deployment: active,
        current_deployment: { ...active, id: posts.length ? 5 : currentId } } });
    }
    if (u.pathname.endsWith('/health')) return Response.json({ status: 'ok', version: posts.length ? revision : previousVersion });
    if (u.pathname.endsWith('/health/ready')) return Response.json({ status: 'ready', database: 'up', storage: 'disabled' });
    if (u.pathname.endsWith('/branches/br-weathered-forest-bccwn49d')) return Response.json({ branch: { id: 'br-weathered-forest-bccwn49d' } });
    return Response.json({ project: { id: 'lingering-mud-57461462', name: 'sortex-web-ios-qa', owner: { subscription_type: 'free_v3' } } });
  };
  return { posts, calls: () => calls, run: (overrides = {}) => rollout({
    env: { ...env, ...overrides }, request, load: async () => Buffer.from('PKaa'), sleep: async () => {},
  }) };
}
test('only uploads the package and changes APP_VERSION; preserves existing configuration', async () => {
  const h = harness();
  assert.deepEqual(await h.run(), { id: 5, unchanged: false });
  assert.equal(h.posts.length, 1);
  assert.deepEqual([...h.posts[0].keys()].sort(), ['environment', 'zip']);
  assert.deepEqual(JSON.parse(h.posts[0].get('environment')), { APP_VERSION: revision });
});
test('wrong branch is rejected before network', async () => {
  const h = harness();
  await assert.rejects(h.run({ GITHUB_REF: 'refs/heads/main' }));
  assert.equal(h.calls(), 0);
});
test('rejects running deployment, mismatched base and payment configuration without uploading', async () => {
  for (const h of [harness({ currentId: 5 }), harness({ previousId: 1 }),
    harness({ variables: [...names, 'MERCADO_PAGO_ACCESS_TOKEN'] })]) {
    await assert.rejects(h.run());
    assert.equal(h.posts.length, 0);
  }
});
test('a completed identical version does not redeploy; key loss stops readiness acceptance', async () => {
  const h = harness({ previousVersion: revision, previousId: 5 });
  assert.deepEqual(await h.run(), { id: 5, unchanged: true });
  assert.equal(h.posts.length, 0);
  const changed = harness({ after: names.filter(x => x !== 'JWT_ACCESS_SECRET') });
  await assert.rejects(changed.run());
});
