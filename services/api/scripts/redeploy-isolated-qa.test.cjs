'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { rollout } = require('./redeploy-isolated-qa.cjs');

const baseline = '8f1c947c9197928c08e20716cc88cf406bae0722';
const revision = 'd758a4e679cc03af9653243f72f5524c05aedd8b';
const branch = 'br-weathered-forest-bccwn49d';
const project = 'lingering-mud-57461462';
const origin = `https://${branch}-sortexqa.compute.c-16.us-east-1.aws.neon.tech`;
const endpoint = `https://${branch}.storage.c-16.us-east-1.aws.neon.tech`;
const names = ['APP_ENV', 'APP_VERSION', 'PAYMENT_ENV', 'FEATURE_REAL_PAYMENTS',
  'FEATURE_PAYOUTS', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'INTEGRATION_ENCRYPTION_KEY', 'UPLOADS_DISABLED'];
const privateNames = [...names, 'STORAGE_BUCKET', 'STORAGE_DRIVER'];
const env = {
  GITHUB_ACTIONS: 'true', GITHUB_RUN_ATTEMPT: '1', GITHUB_EVENT_NAME: 'push',
  GITHUB_REPOSITORY: 'blackwolfoficiall-glitch/SorteX', GITHUB_REF: 'refs/heads/homologacao/web-ios-integrada',
  SORTEX_QA_BASE_SHA: baseline, SORTEX_QA_BASE_DEPLOYMENT: '9', SORTEX_QA_CODE_SHA: revision,
  SORTEX_QA_EXPECTED_STORAGE: 'private-neon-s3', QA_ENABLE: 'yes', SORTEX_QA_NEON_API_KEY: 'synthetic-only',
};
function harness({
  previousVersion = baseline, variables = privateNames, previousId = 9, after = variables,
  currentId = previousId, baseStorage = 'up', finalStorage = baseStorage, storageMetadata = {},
  bucket = { name: 'sortex-qa-media', access_level: 'private', inherited: false },
  finalBucket = bucket, plan = 'free_v3', branchProject = project, takeoverAt = 0,
  loseReceipt = false, receiptId = 10,
} = {}) {
  const posts = [];
  const calls = [];
  let fnCalls = 0;
  const request = async (href, options) => {
    calls.push(href);
    const u = new URL(href);
    const isAdmin = u.origin === 'https://console.neon.tech';
    assert.equal(!!options.headers?.Authorization, isAdmin);
    assert.equal(options.redirect, 'error');
    if (u.pathname.endsWith('/deployments')) {
      assert.equal(u.pathname, `/api/v2/projects/${project}/branches/${branch}/functions/sortexqa/deployments`);
      assert.equal(options.method, 'POST');
      posts.push(options.body);
      if (loseReceipt) throw Error('timeout');
      return Response.json({ deployment: { id: receiptId } });
    }
    if (u.pathname.endsWith('/functions/sortexqa')) {
      const active = { id: posts.length ? 10 : previousId, status: 'completed', environment: posts.length ? after : variables };
      const current = ++fnCalls === takeoverAt ? active.id + 1 : posts.length ? 10 : currentId;
      return Response.json({ function: { slug: 'sortexqa', invocation_url: origin + '/', active_deployment: active,
        current_deployment: { ...active, id: current } } });
    }
    if (u.pathname.endsWith('/storage')) return Response.json({
      enabled: true, s3_endpoint: endpoint, region: 'us-east-1', force_path_style: true, ...storageMetadata,
    });
    if (u.pathname.endsWith('/buckets')) return Response.json({ buckets: [posts.length ? finalBucket : bucket] });
    if (u.pathname.endsWith('/health')) return Response.json({ status: 'ok', version: posts.length ? revision : previousVersion });
    if (u.pathname.endsWith('/health/ready')) return Response.json({
      status: 'ready', database: 'up', storage: posts.length ? finalStorage : baseStorage,
    });
    if (u.pathname.endsWith('/branches/' + branch)) {
      return Response.json({ branch: { id: branch, project_id: branchProject } });
    }
    assert.equal(u.pathname, '/api/v2/projects/' + project);
    return Response.json({ project: { id: project, name: 'sortex-web-ios-qa', owner: { subscription_type: plan } } });
  };
  return { posts, calls, run: (overrides = {}) => rollout({
    env: { ...env, ...overrides }, request, load: async () => Buffer.from('PKaa'), sleep: async () => {},
  }) };
}
test('uses exact private Neon storage before/after and changes only code and APP_VERSION', async () => {
  const h = harness();
  assert.deepEqual(await h.run(), { id: 10, unchanged: false });
  assert.equal(h.posts.length, 1);
  assert.deepEqual([...h.posts[0].keys()].sort(), ['environment', 'zip']);
  assert.deepEqual(JSON.parse(h.posts[0].get('environment')), { APP_VERSION: revision });
  assert.equal(h.calls.filter(href => href.endsWith('/buckets')).length, 2);
});
test('explicitly disabled mode preserves disabled storage without probing bucket endpoints', async () => {
  const h = harness({ variables: names, baseStorage: 'disabled' });
  assert.deepEqual(await h.run({ SORTEX_QA_EXPECTED_STORAGE: 'disabled' }), { id: 10, unchanged: false });
  assert.equal(h.calls.filter(href => /\/(storage|buckets)$/.test(href)).length, 0);
  const mismatch = harness({ variables: privateNames, baseStorage: 'disabled' });
  await assert.rejects(mismatch.run({ SORTEX_QA_EXPECTED_STORAGE: 'disabled' }));
  assert.equal(mismatch.posts.length, 0);
});
test('rejects wrong ref, missing/malformed rollout pins and local shell before network', async () => {
  for (const overrides of [
    { GITHUB_REF: 'refs/heads/main' }, { GITHUB_ACTIONS: 'false' }, { GITHUB_RUN_ATTEMPT: '2' },
    { GITHUB_EVENT_NAME: 'pull_request_target' }, { SORTEX_QA_BASE_SHA: undefined },
    { SORTEX_QA_CODE_SHA: 'abc1234' }, { SORTEX_QA_BASE_DEPLOYMENT: '9e0' },
    { SORTEX_QA_EXPECTED_STORAGE: '' }, { SORTEX_QA_EXPECTED_STORAGE: 'up' },
  ]) {
    const h = harness();
    await assert.rejects(h.run(overrides));
    assert.equal(h.calls.length, 0);
  }
});
test('rejects divergent project/branch, active deployment, SHA and overrides before uploading', async () => {
  for (const scenario of [
    { currentId: 10 }, { previousId: 8 }, { previousVersion: revision }, { takeoverAt: 2 },
    { plan: 'freemium-paid' }, { branchProject: 'production' }, { baseStorage: 'disabled' },
    { variables: names }, { variables: [...privateNames, 'UPLOADS_DISABLED'] },
    ...['AWS_ENDPOINT_URL_S3', 'AWS_ACCESS_KEY_ID', 'NEON_BRANCH_ID', 'DATABASE_URL_UNPOOLED',
      'MERCADO_PAGO_ACCESS_TOKEN', 'ENABLE_NATIVE_SANDBOX_PIX', 'STORAGE_UNKNOWN']
      .map(key => ({ variables: [...privateNames, key] })),
  ]) {
    const h = harness(scenario);
    await assert.rejects(h.run());
    assert.equal(h.posts.length, 0);
  }
});
test('rejects missing, public, inherited or differently scoped bucket and wrong provider endpoint', async () => {
  for (const scenario of [
    { bucket: { name: 'another-private-bucket', access_level: 'private' } },
    { bucket: { name: 'sortex-qa-media', access_level: 'public' } },
    { bucket: { name: 'sortex-qa-media', access_level: 'private', inherited: true } },
    { bucket: { name: 'sortex-qa-media', access_level: 'private', branch_id: 'br-another' } },
    { storageMetadata: { s3_endpoint: 'https://example.invalid' } },
    { storageMetadata: { enabled: false } },
  ]) {
    const h = harness(scenario);
    await assert.rejects(h.run(), /storage QA ativo e privado/);
    assert.equal(h.posts.length, 0);
  }
});
test('a matching candidate is a no-op only when the baseline receipt and storage match', async () => {
  const h = harness();
  assert.deepEqual(await h.run({ SORTEX_QA_CODE_SHA: baseline }), { id: 9, unchanged: true });
  assert.equal(h.posts.length, 0);
  for (const scenario of [{ previousId: 10 }, { baseStorage: 'disabled' }]) {
    const h = harness(scenario);
    await assert.rejects(h.run({ SORTEX_QA_CODE_SHA: baseline }));
    assert.equal(h.posts.length, 0);
  }
});
test('fails closed without another write after loss of flags, readiness, receipt or bucket', async () => {
  for (const scenario of [
    { after: privateNames.filter(x => x !== 'JWT_ACCESS_SECRET') }, { after: [...privateNames, 'UNRELATED_FLAG'] },
    { finalStorage: 'disabled' }, { takeoverAt: 4 },
    { finalBucket: { name: 'sortex-qa-media', access_level: 'public' } },
    { loseReceipt: true }, { receiptId: 9 },
  ]) {
    const h = harness(scenario);
    await assert.rejects(h.run());
    assert.equal(h.posts.length, 1);
  }
});
