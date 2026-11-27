'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { candidate, confirmation, inputs, priorPlan } = require('./authorize.cjs');
const { pins } = require('../../../services/api/scripts/release-draw-window-qa.cjs');

const repository = 'blackwolfoficiall-glitch/SorteX';
const branch = 'homologacao/web-ios-integrada';
const path = '.github/workflows/release-draw-window-qa.yml';
const now = Date.parse('2026-11-27T03:00:00Z');
const plan = {
  QA_MODE: 'plan',
  QA_QUIET_WINDOW: 'false',
  GITHUB_ACTIONS: 'true',
  GITHUB_ACTOR: 'qa-reviewer-example',
  GITHUB_REPOSITORY: repository,
  GITHUB_REF: 'refs/heads/' + branch,
  GITHUB_WORKFLOW_REF: repository + '/' + path + '@refs/heads/' + branch,
  GITHUB_EVENT_NAME: 'workflow_dispatch',
  GITHUB_RUN_ATTEMPT: '1',
  GITHUB_SHA: 'a'.repeat(40),
  GITHUB_RUN_ID: '2002',
};
const apply = {
  ...plan,
  QA_MODE: 'apply',
  QA_QUIET_WINDOW: 'true',
  QA_CONFIRMATION: confirmation,
  QA_PLAN_RUN_ID: '2001',
  QA_ACTIONS_READ_TOKEN: 'fixture-only-token',
};

function evidence() {
  const common = {
    repository: { full_name: repository },
    head_repository: { full_name: repository },
    head_branch: branch,
    head_sha: apply.GITHUB_SHA,
    event: 'workflow_dispatch',
    run_attempt: 1,
    actor: { login: apply.GITHUB_ACTOR },
    path,
    workflow_id: 42,
  };
  const job = { status: 'completed', conclusion: 'success',
    completed_at: new Date(now - 60000).toISOString() };
  return {
    '2001': { ...common, id: 2001, status: 'completed', conclusion: 'success' },
    '2002': { ...common, id: 2002, status: 'in_progress' },
    '2001/attempts/1/jobs?per_page=100': {
      total_count: 2,
      jobs: [{ ...job, name: 'authorize' }, { ...job, name: 'QA read-only plan' }],
    },
  };
}

function transport(result) {
  return async (url, init) => {
    const prefix = 'https://api.github.com/repos/' + repository + '/actions/runs/';
    assert.ok(url.startsWith(prefix));
    assert.equal(init.method, 'GET');
    assert.equal(init.redirect, 'error');
    assert.equal(init.headers.Authorization, 'Bearer fixture-only-token');
    let body = result[url.slice(prefix.length)];
    return { ok: body !== undefined, json: async () => body };
  };
}

test('workflow uses the exact existing migration/deploy gate pins', () => {
  assert.equal(candidate, pins.candidateSha);
  assert.equal(pins.deployment, '13');
  assert.equal(pins.baseSha, '48eeb85830c2dddab048796d7859200e65cc73f9');
  assert.equal(confirmation, 'QA-13+21-to-22+' + candidate);
});

test('explicit separate plan and apply inputs', () => {
  assert.deepEqual(inputs(plan), { mode: 'plan' });
  assert.deepEqual(inputs(apply), { mode: 'apply', plan: '2001', run: '2002' });
  for (const overrides of [
    { QA_MODE: 'other' },
    { GITHUB_EVENT_NAME: 'push' },
    { GITHUB_EVENT_NAME: 'pull_request_target' },
    { GITHUB_RUN_ATTEMPT: '2' },
    { GITHUB_REF: 'refs/heads/main' },
    { GITHUB_SHA: 'latest' },
    { GITHUB_REPOSITORY: 'someone/SorteX' },
    { GITHUB_WORKFLOW_REF: repository + '/.github/workflows/ci.yml@refs/heads/' + branch },
    { RUNNER_DEBUG: '1' },
  ]) assert.throws(() => inputs({ ...plan, ...overrides }), /QA manual recusado/);
  for (const overrides of [
    { QA_QUIET_WINDOW: 'false' },
    { QA_CONFIRMATION: '' },
    { QA_PLAN_RUN_ID: '2002' },
    { QA_PLAN_RUN_ID: '2001?mode=apply' },
    { QA_PLAN_RUN_ID: '2001/../2020' },
  ]) assert.throws(() => inputs({ ...apply, ...overrides }), /QA manual recusado/);
  assert.throws(() => inputs({ ...plan, QA_PLAN_RUN_ID: '2001' }), /QA manual recusado/);
  assert.throws(() => inputs({ ...plan, QA_CONFIRMATION: confirmation }), /QA manual recusado/);
});

test('only fixed read-only requests verify a recent successful plan from the same workflow', async () => {
  await priorPlan(apply, transport(evidence()), now);
  const allowedRefSuffix = evidence();
  allowedRefSuffix['2001'].path += '@refs/heads/' + branch;
  await priorPlan(apply, transport(allowedRefSuffix), now);
  await assert.rejects(priorPlan(plan, transport({}), now));
  await assert.rejects(priorPlan({ ...apply, QA_ACTIONS_READ_TOKEN: '' }, transport({}), now));
});

test('wrong revision, actor, workflow, event, attempt or failure never authorizes apply', async () => {
  for (const overrides of [
    { id: 3000 },
    { head_sha: 'b'.repeat(40) },
    { head_branch: 'main' },
    { actor: { login: 'other-operator' } },
    { head_repository: { full_name: 'fork/SorteX' } },
    { path: '.github/workflows/ci.yml' },
    { workflow_id: 43 },
    { event: 'push' },
    { run_attempt: 2 },
    { status: 'in_progress' },
    { conclusion: 'failure' },
  ]) {
    const r = evidence();
    Object.assign(r['2001'], overrides);
    await assert.rejects(priorPlan(apply, transport(r), now), /QA manual recusado/);
  }
});

test('an apply, skipped, stale, future, ambiguous or missing receipt is refused', async () => {
  for (const overrides of [
    { name: 'QA apply' },
    { completed_at: 'yesterday' },
    { completed_at: new Date(now - 31 * 60 * 1000).toISOString() },
    { completed_at: new Date(now + 1000).toISOString() },
    { conclusion: 'skipped' },
  ]) {
    const r = evidence();
    Object.assign(r['2001/attempts/1/jobs?per_page=100'].jobs[1], overrides);
    await assert.rejects(priorPlan(apply, transport(r), now), /QA manual recusado/);
  }
  const r = evidence();
  r['2001/attempts/1/jobs?per_page=100'].total_count = 3;
  await assert.rejects(priorPlan(apply, transport(r), now), /QA manual recusado/);
  await assert.rejects(priorPlan(apply, transport({}), now), /QA manual recusado/);
});
