'use strict';

// Preparation for the offline Actions draft. This file cannot migrate, deploy
// or read QA credentials; its only external operations are pinned GitHub GETs.
const candidate = '09a0f9ac2d18d3369c464cfa7fec8a8b5f6745be';
const confirmation = 'QA-13+21-to-22+' + candidate;
const repository = 'blackwolfoficiall-glitch/SorteX';
const branch = 'homologacao/web-ios-integrada';
const workflowPath = '.github/workflows/release-draw-window-qa.yml';
const maxAge = 30 * 60 * 1000;
const runNumber = /^[1-9][0-9]{0,14}$/;
const unsafe = () => { throw Error('QA manual recusado: confira escopo, confirmação ou recibo.'); };

function inputs(env) {
  const { QA_MODE: mode, QA_PLAN_RUN_ID: plan, QA_QUIET_WINDOW: quiet,
    QA_CONFIRMATION: phrase, GITHUB_RUN_ID: run } = env;
  if (env.GITHUB_ACTIONS !== 'true' || env.GITHUB_EVENT_NAME !== 'workflow_dispatch' ||
    env.GITHUB_RUN_ATTEMPT !== '1' || env.GITHUB_REPOSITORY !== repository ||
    env.GITHUB_REF !== 'refs/heads/' + branch ||
    env.GITHUB_WORKFLOW_REF !== repository + '/' + workflowPath + '@refs/heads/' + branch ||
    !/^[0-9a-f]{40}$/.test(env.GITHUB_SHA ?? '') ||
    !runNumber.test(run ?? '') || !env.GITHUB_ACTOR || env.RUNNER_DEBUG === '1') unsafe();

  if (mode === 'plan' && !plan && !phrase && quiet === 'false') return { mode };
  if (mode === 'apply' && runNumber.test(plan ?? '') && plan !== run &&
    quiet === 'true' && phrase === confirmation) return { mode, plan, run };
  return unsafe();
}

async function priorPlan(env, request = fetch, now = Date.now()) {
  const { mode, plan, run } = inputs(env);
  const token = env.QA_ACTIONS_READ_TOKEN;
  if (mode !== 'apply' || !token) unsafe();

  const get = async suffix => {
    const response = await request('https://api.github.com/repos/' + repository + '/actions/runs/' + suffix, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) unsafe();
    return response.json();
  };

  const [planRun, applyRun, planJobs] = await Promise.all([
    get(plan), get(run), get(plan + '/attempts/1/jobs?per_page=100'),
  ]);

  const exact = (payload, id) => String(payload.id) === id &&
    payload.repository?.full_name === repository && payload.head_repository?.full_name === repository &&
    payload.head_branch === branch && payload.head_sha === env.GITHUB_SHA &&
    payload.event === 'workflow_dispatch' && payload.run_attempt === 1 &&
    payload.actor?.login === env.GITHUB_ACTOR &&
    (payload.path === workflowPath || payload.path === workflowPath + '@refs/heads/' + branch);
  if (!exact(planRun, plan) || !exact(applyRun, run) ||
    !Number.isSafeInteger(planRun.workflow_id) || planRun.workflow_id !== applyRun.workflow_id ||
    planRun.status !== 'completed' || planRun.conclusion !== 'success') unsafe();

  if (planJobs.total_count !== 2 || !Array.isArray(planJobs.jobs) || planJobs.jobs.length !== 2 ||
    !planJobs.jobs.every(job => job.status === 'completed' && job.conclusion === 'success')) unsafe();
  const completed = planJobs.jobs.find(job => job.name === 'QA read-only plan');
  const stamp = Date.parse(completed?.completed_at);
  if (!Number.isFinite(stamp) || stamp > now || now - stamp > maxAge) unsafe();
}

async function main() {
  const [flag] = process.argv.slice(2);
  if (process.argv.length !== 3) unsafe();
  if (flag === '--input') inputs(process.env);
  else if (flag === '--plan-receipt') await priorPlan(process.env);
  else unsafe();
  console.log('Escopo QA manual confirmado.');
}

if (require.main === module) main().catch(() => {
  // Do not include raw input, API errors, connection strings or tokens.
  console.error('QA manual recusado: confira escopo, confirmação ou recibo.');
  process.exitCode = 1;
});

module.exports = { candidate, confirmation, inputs, priorPlan };
