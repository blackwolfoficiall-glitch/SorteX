import assert from 'node:assert/strict';
import { test } from 'node:test';
import { smoke } from './ci.mjs';

const env = {
  GITHUB_ACTIONS: 'true',
  GITHUB_REPOSITORY: 'blackwolfoficiall-glitch/SorteX',
  GITHUB_REF: 'refs/heads/homologacao/web-ios-integrada',
  GITHUB_EVENT_NAME: 'workflow_dispatch',
  SORTEX_QA_NEON_API_KEY: 'fixture-project-key',
  QA_ENABLE: 'yes',
  SORTEX_QA_STORAGE_SMOKE: 'yes',
  SORTEX_QA_STORAGE_CONFIRMATION: 'sortex-qa-media',
};
const project = 'lingering-mud-57461462';
const branch = 'br-weathered-forest-bccwn49d';
const projectPath = '/api/v2/projects/' + project;
const branchPath = projectPath + '/branches/' + branch;
const slug = 'sortexqastoragesmoke';
const qaOrigin = `https://${branch}-sortexqa.compute.c-16.us-east-1.aws.neon.tech`;
const smokeOrigin = `https://${branch}-${slug}.compute.c-16.us-east-1.aws.neon.tech`;
const qaDeploy = {
  id: 5,
  status: 'completed',
  environment: ['UPLOADS_DISABLED'],
};
const token = 'a'.repeat(64);
const defaultPin = '90851959c3d7beceb7c259249e284c08b246e4ee';
const expiryId = 'd4c2040a-a02c-4ede-89f7-d409591de584';

function fixture({
  subscription = 'free_v2',
  access = 'private',
  pinned = defaultPin,
  qaStorage = 'disabled',
  untrustedEnv = [],
  extraFunction = [],
  headOk = true,
} = {}) {
  const calls = [];
  let active;
  const request = async (raw, options) => {
    const method = options?.method ?? 'GET';
    const url = new URL(raw);
    calls.push([url.href, method]);
    assert.equal(options.redirect, 'error');
    if (url.origin === qaOrigin) {
      assert.equal(options?.headers?.Authorization, undefined);
      if (url.pathname === '/health')
        return Response.json({ status: 'ok', version: pinned });
      if (url.pathname === '/health/ready')
        return Response.json({
          status: 'ready',
          database: 'up',
          storage: qaStorage,
        });
    }
    if (url.origin === smokeOrigin) {
      const auth = options?.headers?.Authorization;
      if (auth === undefined) return new Response(null, { status: 404 });
      assert.equal(auth, 'Bearer ' + token);
      if (url.pathname === '/preflight')
        return Response.json({ ok: headOk, injected: headOk });
      if (url.pathname === '/probe')
        return Response.json({
          ok: true,
          bytes: 69,
          sha256:
            'e99cd5cfefa136740dfeeb46c41e0783b06944bc88994cb86080c3356c977853',
          anonymousDenied: true,
        });
    }
    assert.equal(url.origin, 'https://console.neon.tech');
    assert.deepEqual(options?.headers, {
      Authorization: 'Bearer ' + env.SORTEX_QA_NEON_API_KEY,
    });
    switch (url.pathname) {
      case projectPath:
        return Response.json({
          project: {
            id: project,
            name: 'sortex-web-ios-qa',
            owner: { subscription_type: subscription },
          },
        });
      case branchPath:
        return Response.json({ branch: { id: branch, project_id: project } });
      case branchPath + '/storage':
        return Response.json({
          enabled: true,
          s3_endpoint: `https://${branch}.storage.c-16.us-east-1.aws.neon.tech`,
          region: 'us-east-1',
          force_path_style: true,
        });
      case branchPath + '/buckets':
        return Response.json({
          buckets: [{ name: 'sortex-qa-media', access_level: access }],
        });
      case branchPath + '/functions/sortexqa': {
        const withEnv = {
          ...qaDeploy,
          environment: [...qaDeploy.environment, ...untrustedEnv],
        };
        return Response.json({
          slug: 'sortexqa',
          invocation_url: qaOrigin,
          current_deployment: qaDeploy,
          active_deployment: withEnv,
        });
      }
      case branchPath + '/functions':
        return Response.json({
          functions: [{ slug: 'sortexqa' }, ...extraFunction],
        });
      case branchPath + '/functions/' + slug + '/deployments': {
        assert.equal(method, 'POST');
        assert.ok(options.body.get('zip') instanceof File);
        const variables = JSON.parse(options.body.get('environment'));
        assert.ok(!options.body.get('environment').includes(token));
        assert.deepEqual(
          Object.keys(variables).sort(),
          [
            'STORAGE_BUCKET',
            'STORAGE_DRIVER',
            'SORTEX_STORAGE_PROBE_EXPIRES_MS',
            'SORTEX_STORAGE_PROBE_HASH',
            'SORTEX_STORAGE_PROBE_ID',
          ].sort(),
        );
        assert.equal(variables.SORTEX_STORAGE_PROBE_ID, expiryId);
        active = {
          id: 1,
          status: 'completed',
          environment: Object.keys(variables),
        };
        return Response.json({ deployment: { id: 1 } });
      }
      case branchPath + '/functions/' + slug:
        return Response.json({
          slug,
          invocation_url: smokeOrigin,
          active_deployment: active,
          current_deployment: active,
        });
      default:
        throw Error('unexpected target');
    }
  };
  return { request, calls };
}
const stub = {
  env,
  sleep: () => {},
  tokenFactory: () => token,
  idFactory: () => expiryId,
  load: async () => Buffer.from([0x50, 0x4b, 1, 1]),
  clock: () => 1000,
};

test('manual protected preflight is read-only and has no need for a ZIP', async () => {
  const h = fixture();
  assert.deepEqual(
    await smoke({ ...stub, request: h.request, load: () => assert.fail() }),
    { privateBucket: true, apiUnchanged: true, didWrite: false },
  );
  assert.equal(h.calls.length, 7);
  assert.ok(h.calls.every(([, method]) => method === 'GET'));
});

test('a reviewed branch push may use the metadata preflight, not execute', async () => {
  const h = fixture();
  const onPush = { ...env, GITHUB_EVENT_NAME: 'push' };
  assert.equal(
    (await smoke({ ...stub, env: onPush, request: h.request })).didWrite,
    false,
  );
  await assert.rejects(
    smoke({ ...stub, env: onPush, mode: 'execute', request: h.request }),
  );
  assert.equal(h.calls.length, 7);
  assert.ok(h.calls.every(([, method]) => method === 'GET'));
});

test('rejects wrong invocation, no confirmation, public bucket, paid plan, changed environment or occupied helper', async () => {
  for (const envOverride of [
    { GITHUB_EVENT_NAME: 'push' },
    { GITHUB_REF: 'refs/heads/main' },
    { SORTEX_QA_STORAGE_SMOKE: '' },
    { SORTEX_QA_STORAGE_CONFIRMATION: '' },
  ]) {
    const h = fixture();
    await assert.rejects(
      smoke({
        ...stub,
        mode: 'execute',
        env: { ...env, ...envOverride },
        request: h.request,
      }),
    );
    assert.equal(h.calls.length, 0);
  }
  for (const options of [
    { subscription: 'launch' },
    { access: 'public_read' },
    { qaStorage: 'up' },
    { pinned: 'not-current' },
    { untrustedEnv: ['AWS_ACCESS_KEY_ID'] },
    { extraFunction: [{ slug }] },
  ]) {
    const h = fixture(options);
    await assert.rejects(
      smoke({ ...stub, mode: 'execute', request: h.request }),
    );
    assert.ok(h.calls.every(([, method]) => method === 'GET'));
  }
});

test('authorized execute only deploys separate helper, tests anon denial, verifies HeadBucket before one real probe', async () => {
  const h = fixture();
  let receipt = await smoke({ ...stub, mode: 'execute', request: h.request });
  assert.deepEqual(receipt, {
    privateBucket: true,
    apiUnchanged: true,
    didWrite: true,
    injected: true,
    bytes: 69,
    sha256: 'e99cd5cfefa136740dfeeb46c41e0783b06944bc88994cb86080c3356c977853',
    anonymousDenied: true,
  });
  assert.deepEqual(
    h.calls.filter(([, method]) => method !== 'GET'),
    [
      [
        'https://console.neon.tech' +
          branchPath +
          '/functions/' +
          slug +
          '/deployments',
        'POST',
      ],
      [smokeOrigin + '/probe', 'POST'],
      [smokeOrigin + '/preflight', 'POST'],
      [smokeOrigin + '/probe', 'POST'],
    ],
  );
  const blocked = fixture({ headOk: false });
  await assert.rejects(
    smoke({ ...stub, mode: 'execute', request: blocked.request }),
  );
  assert.equal(
    blocked.calls.filter(([url]) => url === smokeOrigin + '/probe').length,
    1,
  ); // anonymous only
});

test('one reviewed push is bounded by time and cannot write on replay', async () => {
  const onPush = {
    ...env,
    GITHUB_EVENT_NAME: 'push',
    GITHUB_RUN_ATTEMPT: '1',
    SORTEX_QA_STORAGE_APPROVED_PUSH: 'yes',
  };
  const start = Date.parse('2026-11-26T15:04:00Z');
  const end = Date.parse('2026-11-26T15:25:00Z');
  for (const [settings, time] of [
    [onPush, start - 1],
    [onPush, end],
    [{ ...onPush, GITHUB_RUN_ATTEMPT: '2' }, start],
    [{ ...onPush, GITHUB_REF: 'refs/heads/main' }, start],
  ]) {
    const h = fixture();
    await assert.rejects(
      smoke({
        ...stub,
        mode: 'execute',
        env: settings,
        clock: () => time,
        request: h.request,
      }),
    );
    assert.equal(h.calls.length, 0);
  }
  const h = fixture();
  assert.equal(
    (
      await smoke({
        ...stub,
        mode: 'execute',
        env: onPush,
        clock: () => start,
        request: h.request,
      })
    ).didWrite,
    true,
  );
});
