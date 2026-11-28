'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const gate = require('./queue-draw-window-qa.cjs');
const { validateInvocation } = require('./release-draw-window-qa.cjs');

const now = Date.parse('2026-11-28T00:20:00.000Z');
const window = { ...gate.waypoints, windowStartUtc: '2026-11-28T00:10:00.000Z',
  windowEndUtc: '2026-11-28T00:40:00.000Z' };
const before = 'a'.repeat(40), after = 'b'.repeat(40);
const env = { GITHUB_JOB: 'preflight', GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'push',
  GITHUB_RUN_ATTEMPT: '1', GITHUB_REPOSITORY: gate.repo, GITHUB_REPOSITORY_ID: String(gate.repoId),
  GITHUB_REF: gate.ref, GITHUB_WORKFLOW_REF: gate.repo + '/' + gate.workflow + '@' + gate.ref,
  GITHUB_SHA: after, GITHUB_WORKFLOW_SHA: after, GITHUB_ACTOR: gate.reviewer,
  GITHUB_ACTOR_ID: String(gate.reviewerId) };
const event = { before, after, ref: gate.ref, forced: false, created: false, deleted: false,
  repository: { full_name: gate.repo, id: gate.repoId, private: false },
  sender: { login: gate.reviewer, id: gate.reviewerId } };
const git = (args) => ({
  'rev-parse': after, 'rev-list': after + ' ' + before,
  diff: 'A\t' + gate.intent, 'ls-tree': '100644 blob ' + after + '\t' + gate.intent, status: '',
}[args[0]]);
const envResponse = { id: 28558120511, name: gate.environment, can_admins_bypass: false,
  deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
  protection_rules: [{ type: 'branch_policy' }, { type: 'required_reviewers', prevent_self_review: false,
    reviewers: [{ type: 'User', reviewer: { login: gate.reviewer, id: gate.reviewerId } }] }] };
const branchPolicy = { total_count: 1,
  branch_policies: [{ type: 'branch', name: gate.ref.slice(11) }] };

test('exact quiet window only; absent, expired, incomplete, overly broad or mismatched slips are denied', () => {
  assert.equal(gate.validateWindow(window, now, 180000).end, Date.parse(window.windowEndUtc));
  for (const value of [null, {}, { ...window, extra: true }, { ...window, deployment: 14 },
    { ...window, windowStartUtc: '2026-11-28T00:30:00.000Z' },
    { ...window, windowEndUtc: '2026-11-28T00:21:00.000Z' },
    { ...window, windowEndUtc: '2026-11-28T02:40:00.000Z' },
    { ...window, candidate: 'c'.repeat(40) }]) {
    assert.throws(() => gate.validateWindow(value, now, 180000));
  }
  assert.throws(() => gate.validateWindow(window, Date.parse(window.windowEndUtc), 90000));
});

test('only one newly added intent in exact one-parent clean QA push can queue', () => {
  gate.validateEvent(env, event, git, 'preflight');
  gate.validateEvent({ ...env, GITHUB_JOB: 'approved_qa' }, event, git, 'approved_qa');
  for (const options of [
    { env: { GITHUB_RUN_ATTEMPT: '2' } }, { env: { GITHUB_JOB: 'test' } },
    { env: { GITHUB_WORKFLOW_SHA: before } }, { env: { GITHUB_ACTOR_ID: '12' } },
    { event: { forced: true } }, { event: { created: true } },
    { event: { sender: { login: gate.reviewer, id: 0 } } },
    { git: { 'rev-list': after + ' ' + before + ' ' + after } },
    { git: { diff: 'M\t' + gate.intent } }, { git: { diff: 'A\t' + gate.intent + '\nM\tpath' } },
    { git: { 'ls-tree': '120000 blob ' + after + '\t' + gate.intent } },
  ]) {
    assert.throws(() => gate.validateEvent({ ...env, ...options.env }, { ...event, ...options.event },
      (args) => options.git?.[args[0]] ?? git(args), 'preflight'));
  }
});

test('reviewer, admin bypass, unchanged self-review, exact branch and zero tags fail closed', () => {
  gate.verifyProtection(envResponse, branchPolicy);
  for (const variant of [
    { ...envResponse, can_admins_bypass: true },
    { ...envResponse, protection_rules: envResponse.protection_rules.slice(0, 1) },
    { ...envResponse, protection_rules: [envResponse.protection_rules[0],
      { ...envResponse.protection_rules[1], prevent_self_review: true }] },
    { ...envResponse, protection_rules: [envResponse.protection_rules[0],
      { ...envResponse.protection_rules[1], reviewers: [{ type: 'User', reviewer: { login: gate.reviewer, id: 1 } }] }] },
  ]) assert.throws(() => gate.verifyProtection(variant, branchPolicy));
  assert.throws(() => gate.verifyProtection(envResponse, { ...branchPolicy, total_count: 2 }));
  assert.throws(() => gate.verifyProtection(envResponse, { total_count: 1,
    branch_policies: [{ name: gate.ref.slice(11), type: 'tag' }] }));
});

test('original manual executor cannot reinterpret push as manual approval', () => {
  assert.throws(() => validateInvocation('--plan', env));
  assert.throws(() => validateInvocation('--apply', env));
});
