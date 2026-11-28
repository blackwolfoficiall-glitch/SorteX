/* One-time QA release intent. Only bounded public GETs; no provider credential. */
'use strict';
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

const repo = 'blackwolfoficiall-glitch/SorteX';
const repoId = 1285644124;
const reviewer = 'blackwolfoficiall-glitch';
const reviewerId = 245107855;
const ref = 'refs/heads/homologacao/web-ios-integrada';
const environment = 'sortex-web-ios-qa';
const environmentId = 28558120511;
const workflow = '.github/workflows/queue-draw-window-qa.yml';
const intent = '.github/qa-release-intents/d4-21-to-22.json';
const candidate = 'd4e499e29c76a11f4275c2be8d34e6a4a616cb70';
const base = '48eeb85830c2dddab048796d7859200e65cc73f9';
const waypoints = Object.freeze({ candidate, base, deployment: 13,
  migration: '20261126230000_explicit_campaign_draw_timezone' });
const sha = (value) => /^[0-9a-f]{40}$/.test(value ?? '');
const exactUtc = (value) => typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const fail = () => { throw Error('Intenção QA recusada: origem, aprovação ou janela não confirmadas.'); };

function validateWindow(approval, now, remaining) {
  const keys = Object.keys(waypoints).concat('windowStartUtc', 'windowEndUtc').sort();
  if (!approval || Array.isArray(approval) ||
      JSON.stringify(Object.keys(approval).sort()) !== JSON.stringify(keys) ||
      Object.entries(waypoints).some(([key, value]) => approval[key] !== value) ||
      !exactUtc(approval.windowStartUtc) || !exactUtc(approval.windowEndUtc)) fail();
  const start = Date.parse(approval.windowStartUtc), end = Date.parse(approval.windowEndUtc);
  if (!Number.isFinite(now) || start > now || end - now < remaining ||
      end - start < 10 * 60000 || end - start > 45 * 60000) fail();
  return { end };
}

function validateEvent(env, event, readGit, job) {
  const before = event?.before, after = event?.after;
  if (!['preflight', 'approved_qa'].includes(job) || env.GITHUB_JOB !== job ||
      env.GITHUB_ACTIONS !== 'true' || env.GITHUB_EVENT_NAME !== 'push' ||
      env.GITHUB_RUN_ATTEMPT !== '1' || env.GITHUB_REPOSITORY !== repo ||
      env.GITHUB_REPOSITORY_ID !== String(repoId) || env.GITHUB_REF !== ref ||
      env.GITHUB_WORKFLOW_REF !== repo + '/' + workflow + '@' + ref ||
      env.GITHUB_ACTOR !== reviewer || env.GITHUB_ACTOR_ID !== String(reviewerId) ||
      env.GITHUB_WORKFLOW_SHA !== env.GITHUB_SHA || env.RUNNER_DEBUG === '1' ||
      !sha(before) || !sha(after) || before === after || after !== env.GITHUB_SHA ||
      event?.ref !== ref || event?.forced !== false || event?.created !== false || event?.deleted !== false ||
      event?.repository?.full_name !== repo || event?.repository?.id !== repoId ||
      event?.repository?.private !== false || event?.sender?.login !== reviewer ||
      event?.sender?.id !== reviewerId ||
      readGit(['rev-parse', 'HEAD']) !== after ||
      readGit(['rev-list', '--parents', '-n', '1', after]) !== after + ' ' + before ||
      readGit(['diff', '--no-renames', '--name-status', before, after, '--']) !== 'A\t' + intent ||
      readGit(['ls-tree', after, '--', intent]).split(' ')[0] !== '100644' ||
      readGit(['status', '--porcelain', '--untracked-files=no']) !== '') fail();
}

function verifyProtection(settings, policy) {
  const rules = settings?.protection_rules ?? [];
  const review = rules.filter(rule => rule.type === 'required_reviewers');
  const subject = review[0]?.reviewers;
  if (settings?.id !== environmentId || settings.name !== environment ||
      settings.can_admins_bypass !== false ||
      settings.deployment_branch_policy?.protected_branches !== false ||
      settings.deployment_branch_policy?.custom_branch_policies !== true ||
      review.length !== 1 || review[0].prevent_self_review !== false ||
      subject?.length !== 1 || subject[0]?.type !== 'User' ||
      subject[0]?.reviewer?.login !== reviewer || subject[0]?.reviewer?.id !== reviewerId ||
      policy?.total_count !== 1 || policy.branch_policies?.length !== 1 ||
      policy.branch_policies[0]?.type !== 'branch' || policy.branch_policies[0]?.name !== ref.slice(11)) fail();
}

async function verifiedQueue(root, job, env = process.env, request = fetch) {
  const readGit = args => execFileSync('git', args, {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10000,
  }).trim();
  const event = JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
  validateEvent(env, event, readGit, job);
  const approval = JSON.parse(readGit(['show', env.GITHUB_SHA + ':' + intent]));
  const check = (remaining = 180000) => validateWindow(approval, Date.now(), remaining);
  check();
  const get = async endpoint => {
    const result = await request(endpoint, { method: 'GET', redirect: 'error',
      cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!result.ok) fail();
    return result.json();
  };
  const envUrl = 'https://api.github.com/repos/' + repo + '/environments/' + environment;
  const [settings, policies] = await Promise.all([get(envUrl), get(envUrl + '/deployment-branch-policies')]);
  verifyProtection(settings, policies);
  check();
  return { check };
}

if (require.main === module) {
  const job = process.argv[2];
  if (!['preflight', 'approved_qa'].includes(job)) fail();
  verifiedQueue(require('node:path').resolve(__dirname, '../../..'), job).then(() => {
    console.log('Intenção, janela e proteção nativa exatas verificadas.');
  }).catch(() => {
    console.error('Intenção QA recusada: origem, aprovação ou janela não confirmadas.');
    process.exitCode = 1;
  });
}
module.exports = { repo, repoId, reviewer, reviewerId, ref, environment, workflow, intent,
  waypoints, validateWindow, validateEvent, verifyProtection, verifiedQueue };
