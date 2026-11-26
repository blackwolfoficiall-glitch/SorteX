const assert = require('node:assert/strict');
const { test } = require('node:test');
const { main } = require('./bootstrap-isolated-qa.cjs');

const projectId = 'lingering-mud-57461462';
const branchId = 'br-weathered-forest-bccwn49d';
const project = `/api/v2/projects/${projectId}`;
const branch = `${project}/branches/${branchId}`;

function fixture(t, functions = [], branchOverride = branchId) {
  t.mock.method(console, 'log', () => {});
  const calls = [];
  const request = async (url, options) => {
    const u = new URL(url);
    assert.equal(u.origin, 'https://console.neon.tech');
    assert.ok(options.method === undefined || options.method === 'GET');
    assert.equal(options.body, undefined);
    assert.equal(options.redirect, 'error');
    calls.push(u.pathname);
    const state = {
      [project]: {
        project: {
          id: projectId,
          name: 'sortex-web-ios-qa',
          owner: { subscription_type: 'free' },
        },
      },
      [branch]: { branch: { id: branchOverride } },
      [`${branch}/databases`]: { databases: [{ name: 'neondb' }] },
      [`${branch}/functions`]: { functions },
    };
    assert.ok(state[u.pathname], 'Requisição fora do escopo QA');
    return Response.json(state[u.pathname]);
  };
  return { calls, request };
}

function withQaEnv(fn) {
  const previous = process.env;
  process.env = {
    SORTEX_QA_NEON_API_KEY: 'local-test-only',
    GITHUB_SHA: 'a'.repeat(40),
    GITHUB_REF: 'refs/heads/homologacao/web-ios-integrada',
  };
  return Promise.resolve().then(fn).finally(() => {
    process.env = previous;
  });
}

test('pré-verificação confirma o destino usando somente leituras', (t) =>
  withQaEnv(async () => {
    const { calls, request } = fixture(t);
    await main('preflight', request);
    assert.deepEqual(calls, [
      project,
      branch,
      `${branch}/databases`,
      `${branch}/functions`,
    ]);
  }));

test('o bootstrap não permite migração pré-verificada sobre função existente', (t) =>
  withQaEnv(async () => {
    const { request } = fixture(t, [{ slug: 'sortexqa' }]);
    await assert.rejects(main('preflight', request), /sem funções existentes/);
  }));

test('recusa branch divergente antes de consultar o banco', (t) =>
  withQaEnv(async () => {
    const { calls, request } = fixture(t, [], 'branch-divergente');
    await assert.rejects(main('preflight', request), /Branch QA não comprovada/);
    assert.deepEqual(calls, [project, branch]);
  }));
