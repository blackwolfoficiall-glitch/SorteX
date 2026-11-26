import assert from 'node:assert/strict';
import test from 'node:test';
import { activateStorage } from './activate-storage-isolated-qa.mjs';
const repo = 'blackwolfoficiall-glitch/SorteX';
const gitBranch = 'homologacao/web-ios-integrada';
const branch = 'br-weathered-forest-bccwn49d';
const project = 'lingering-mud-57461462';
const bucket = 'sortex-qa-media';
const sha = '90851959c3d7beceb7c259249e284c08b246e4ee';
const ciSha = 'a9ca00692fada67d1902701fe56dbffd0f4e2815';
const cwd = '/api/v2/projects/' + project + '/branches/' + branch;
const env = {
  GITHUB_ACTIONS:'true', GITHUB_REPOSITORY:repo, GITHUB_REF:'refs/heads/' + gitBranch,
  GITHUB_RUN_ATTEMPT:'1', GITHUB_EVENT_NAME:'push', QA_ENABLE:'yes', CONFIRM_STORAGE_BUCKET:bucket,
  EXPECTED_API_SHA:sha, EXPECTED_API_DEPLOYMENT:'5', VALIDATED_CODE_SHA:ciSha, VALIDATED_CI_RUN:'444',
  SORTEX_QA_NEON_API_KEY:'project-only', GH_TOKEN:'actions-read',
};
const old = ['APP_ENV', 'APP_VERSION', 'PAYMENT_ENV', 'FEATURE_REAL_PAYMENTS',
  'FEATURE_PAYOUTS', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'INTEGRATION_ENCRYPTION_KEY', 'UPLOADS_DISABLED'];
const next = [...old, 'STORAGE_BUCKET', 'STORAGE_DRIVER'];
const helperNames = ['STORAGE_BUCKET', 'STORAGE_DRIVER', 'SORTEX_STORAGE_PROBE_EXPIRES_MS',
  'SORTEX_STORAGE_PROBE_HASH', 'SORTEX_STORAGE_PROBE_ID'];
const activate = { STORAGE_DRIVER:'neon-s3', STORAGE_BUCKET:bucket, UPLOADS_DISABLED:'false' };
const rollback = { STORAGE_DRIVER:'', STORAGE_BUCKET:'', UPLOADS_DISABLED:'true' };
function harness(controls = {}) {
  const opts = { ...controls };
  const requests = [];
  const writes = [];
  const receipts = [];
  let id = 5;
  let failures = 0;
  const origin = slug => `https://${branch}-${slug}.compute.c-16.us-east-1.aws.neon.tech`;
  const fn = (slug, id, environment, current = id, status = 'completed') => ({ function: {
    slug, invocation_url: origin(slug), active_deployment:{id,status:'completed',environment},
    current_deployment:{id:current,status},
  } });
  function json(body, status = 200) {
    return { status, ok: status < 300, json: async () => body };
  }
  function run(id, file, sha) {
    return { id, path:'.github/workflows/' + file, status:'completed', conclusion:'success',
      event:'push', run_attempt:1, head_branch:gitBranch, head_sha:sha, repository:{full_name:repo},
      head_repository:{full_name:repo} };
  }
  async function request(raw, options) {
    const url = new URL(raw);
    const { pathname } = url;
    requests.push(raw);
    assert.equal(options.redirect, 'error');
    if (url.hostname === 'api.github.com') {
      assert.equal(options.headers.Authorization, 'Bearer actions-read');
      if (pathname.endsWith('/runs/45845492623')) return json({
        ...run(45845492623, 'sortex-qa-storage-smoke.yml', 'b7edea01d44a86a9c3406690c65837dfeeb3a5d2'), ...opts.smoke,
      });
      if (pathname.endsWith('/runs/444')) return json({
        ...run(444, 'homologacao-web-ios.yml', ciSha), ...opts.ci,
      });
      if (pathname.endsWith('/runs/444/jobs')) return json({jobs:[{
        run_id:444, name:'API e paridade HTTP (sem deploy nem iPhone)', conclusion:'success',
        steps:[{ name:'Testar configuração e build do site', conclusion:opts.ciWeb ?? 'success' }],
      }]});
      assert.ok(pathname.endsWith('/jobs/139997941094'));
      return json({ run_id:45845492623, name:'storage', conclusion:'success', steps:[
        {name:'Preparar e verificar pacote separado sem credenciais',conclusion:opts.smokeJob ?? 'success'},
        {name:'Conferir somente o escopo QA selecionado',conclusion:'success'},
      ] });
    }
    if (url.hostname === 'console.neon.tech') {
      assert.equal(options.headers.Authorization, 'Bearer project-only');
      if (options.method === 'POST') {
        assert.equal(pathname, cwd + '/functions/sortexqa/deployments');
        assert.deepEqual([...options.body.keys()], ['environment']);
        writes.push(JSON.parse(options.body.get('environment')));
        if (opts.uncertainPost) throw Error('response lost');
        if (opts.invalidReceipt) return json({ deployment:{ id:5 } });
        return json({ deployment:{id:++id} }, 201);
      }
      assert.equal(options.method, undefined);
      if (pathname === '/api/v2/projects/' + project) return json({
        project:{id:project,name:'sortex-web-ios-qa',owner:{subscription_type:opts.plan ?? 'free_v3'}},
      });
      if (pathname === cwd) return json({branch:{id:branch,project_id:opts.branchProject ?? project}});
      if (pathname === cwd + '/storage') return json({
        enabled:true,s3_endpoint:`https://${branch}.storage.c-16.us-east-1.aws.neon.tech`,
        region:'us-east-1',force_path_style:true,
      });
      if (pathname === cwd + '/buckets') return json({
        buckets:[{name:bucket,access_level:opts.bucketLevel ?? 'private',inherited:opts.inherited ?? false}],
      });
      if (pathname === cwd + '/functions/sortexqastoragesmoke') return json(fn(
        'sortexqastoragesmoke', opts.helperId ?? 1, helperNames));
      assert.equal(pathname, cwd + '/functions/sortexqa');
      if (id === 6 && opts.lostMetadata) throw Error('control plane timeout');
      const names = id === 6 ? [...next, ...(opts.afterNames ?? [])] : [...old, ...(opts.oldNames ?? [])];
      const current = id === 6 && opts.takeover && failures >= 3 ? 7 : (opts.current ?? id);
      return json(fn('sortexqa', id, names, current, id === 6 && opts.failedDeployment ? 'failed' : 'completed'));
    }
    assert.equal(url.origin, origin('sortexqa'));
    assert.equal(options.headers.Authorization, undefined);
    if (pathname === '/health') return json({status:'ok',version:id === 5
      ? (opts.initialSha ?? sha) : (opts.afterSha ?? sha)});
    assert.equal(pathname, '/health/ready');
    if (id === 6 && opts.timeout) throw Error('network timeout');
    if (id === 6 && opts.gateway503) return json({error:'gateway'},503);
    if (id === 6 && opts.app503) {
      failures++;
      return json({statusCode:503,code:'HTTP_503',path:'/health/ready',message:'Serviço ainda não está pronto.'},503);
    }
    return json({status:'ready',database:'up',storage:id === 6 ? 'up' : 'disabled'});
  }
  return { request, writes, receipts, requests,
    execute: (override = {}) => activateStorage({env:{...env,...override},request,sleep:async()=>{},
      report: id=>receipts.push(id)}) };
}

test('activates by merging exactly three flags and proves matching SHA, DB and private storage', async () => {
  const h = harness();
  assert.deepEqual(await h.execute(), {status:'enabled',id:6});
  assert.deepEqual(h.writes,[activate]);
  assert.deepEqual(h.receipts,[6]);
});
test('refuses local/fork/tag/retry/unconfirmed invocations before any external request', async () => {
  for (const override of [
    {GITHUB_ACTIONS:'false'}, {GITHUB_REPOSITORY:'other/SorteX'}, {GITHUB_REF:'refs/tags/v1'},
    {GITHUB_REF:'refs/heads/main'}, {GITHUB_RUN_ATTEMPT:'2'}, {CONFIRM_STORAGE_BUCKET:'wrong'},
    {EXPECTED_API_SHA:'short'}, {EXPECTED_API_DEPLOYMENT:'0'}, {QA_ENABLE:'no'},
  ]) {
    const h = harness();
    await assert.rejects(h.execute(override), /execução deliberada/);
    assert.deepEqual(h.requests,[]);
  }
});
test('requires exact official smoke run and executable job plus validated CI and unchanged helper', async () => {
  for (const scenario of [
    {smoke:{head_sha:ciSha}}, {smoke:{run_attempt:2}}, {smokeJob:'skipped'},
    {ci:{conclusion:'failure'}}, {ciWeb:'skipped'}, {ci:{head_repository:{full_name:'fork/SorteX'}}}, {helperId:2},
  ]) {
    const h = harness(scenario);
    await assert.rejects(h.execute());
    assert.deepEqual(h.writes,[]);
  }
});
test('wrong plan, branch, privacy, baseline SHA/ID, or injected overrides do not write', async () => {
  for (const scenario of [
    {plan:'paid'}, {branchProject:'production'}, {bucketLevel:'public'}, {inherited:true},
    {initialSha:ciSha}, {current:6}, {oldNames:['AWS_ACCESS_KEY_ID']},
    {oldNames:['DATABASE_URL']}, {oldNames:['STORAGE_BUCKET']},
  ]) {
    const h = harness(scenario);
    await assert.rejects(h.execute());
    assert.deepEqual(h.writes,[]);
  }
});
test('reverts only flags after three genuine same-SHA app 503 responses', async () => {
  const h = harness({app503:true});
  assert.deepEqual(await h.execute(), {status:'rolled-back',id:7});
  assert.deepEqual(h.writes,[activate,rollback]);
  assert.deepEqual(h.receipts,[6,7]);
});
test('never performs another POST after a lost/invalid receipt or ambiguous live reads', async () => {
  for (const scenario of [
    {uncertainPost:true}, {invalidReceipt:true}, {lostMetadata:true}, {timeout:true},
    {gateway503:true}, {afterSha:ciSha,app503:true}, {afterNames:['SOME_UNRELATED_KEY']},
    {failedDeployment:true},
  ]) {
    const h = harness(scenario);
    await assert.rejects(h.execute());
    assert.deepEqual(h.writes,[activate]);
  }
});
test('never rolls back if the active/current slot moved since the objective failure', async () => {
  const h = harness({app503:true,takeover:true});
  await assert.rejects(h.execute(), /simultaneamente ativa/);
  assert.deepEqual(h.writes,[activate]);
});
