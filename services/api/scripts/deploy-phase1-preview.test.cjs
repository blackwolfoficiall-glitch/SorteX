const { test } = require('node:test');
const assert = require('node:assert/strict');
const { deploy, target } = require('./deploy-phase1-preview.cjs');
const free = { id: target.project, name: 'sortex-fase1-preview', owner: { subscription_type: 'free_v3' } };
function fixture({ project = free, branch = { id: target.branch, project_id: target.project, name: 'fase1-preview' }, databases = [{ name: target.database }] } = {}) {
  const writes = [];
  return { writes, fetchImpl: async (url, options = {}) => {
    if (options.method === 'POST') { writes.push(url); return Response.json({ accepted: true }); }
    if (url.endsWith(`/functions/${target.slug}`)) return new Response('', { status: 404 });
    if (url.endsWith('/databases')) return Response.json({ databases });
    if (url.endsWith(`/branches/${target.branch}`)) return Response.json({ branch });
    return Response.json({ project });
  } };
}
test('refuses paid or published projects before any write', async () => {
  for (const project of [{ ...free, owner: { subscription_type: 'launch' } }, { ...free, id: 'crimson-bread-73821703' }]) {
    const f = fixture({ project }); await assert.rejects(deploy({ ...f, key: 'synthetic-test-key' })); assert.equal(f.writes.length, 0);
  }
});
test('refuses another branch or missing preview database before any write', async () => {
  for (const options of [{ branch: { id: 'br-lingering-voice-bc92seow' } }, { databases: [{ name: 'sortex' }] }]) {
    const f = fixture(options); await assert.rejects(deploy({ ...f, key: 'synthetic-test-key' })); assert.equal(f.writes.length, 0);
  }
});
test('uploads only to the fixed preview function after verifying Free', async () => {
  const f = fixture(); await deploy({ ...f, key: 'synthetic-test-key', readZip: () => Buffer.from('synthetic-zip') });
  assert.equal(f.writes.length, 1); assert.match(f.writes[0], /rough-cherry-09901194\/branches\/br-weathered-grass-bcisqlpm\/functions\/sortexpreview\/deployments$/);
});
