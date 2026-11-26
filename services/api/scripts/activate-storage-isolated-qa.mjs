/* Storage flags only: no bundle, no migration, no bucket/object/provider writes. */
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const repo = 'blackwolfoficiall-glitch/SorteX';
const gitBranch = 'homologacao/web-ios-integrada';
const project = 'lingering-mud-57461462';
const branch = 'br-weathered-forest-bccwn49d';
const bucket = 'sortex-qa-media';
const projectPath = '/projects/' + project;
const branchPath = projectPath + '/branches/' + branch;
const fnPath = branchPath + '/functions/';
const neon = 'https://console.neon.tech/api/v2';
const github = 'https://api.github.com/repos/' + repo + '/actions';
const origin = (slug) => `https://${branch}-${slug}.compute.c-16.us-east-1.aws.neon.tech`;
const target = 'sortexqa';
const smoke = {
  id: 45845492623,
  sha: 'b7edea01d44a86a9c3406690c65837dfeeb3a5d2',
  path: '.github/workflows/sortex-qa-storage-smoke.yml',
};
const ciPath = '.github/workflows/homologacao-web-ios.yml';
const activate = { STORAGE_DRIVER: 'neon-s3', STORAGE_BUCKET: bucket, UPLOADS_DISABLED: 'false' };
const restore = { STORAGE_DRIVER: '', STORAGE_BUCKET: '', UPLOADS_DISABLED: 'true' };
const override = /^(AWS_|NEON_BRANCH(?:_ID)?$|NEON_FUNCTION_HOST_SUFFIX$|DATABASE_URL(?:_UNPOOLED)?$)/;
const required = ['APP_ENV', 'APP_VERSION', 'PAYMENT_ENV', 'FEATURE_REAL_PAYMENTS',
  'FEATURE_PAYOUTS', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'INTEGRATION_ENCRYPTION_KEY', 'UPLOADS_DISABLED'];
const completed = (x, id) => x?.id === id && x?.status === 'completed';
const validSha = (x) => /^[0-9a-f]{40}$/.test(x ?? '');
const validId = (x) => /^[1-9][0-9]{0,14}$/.test(x ?? '');
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const guard = (test, message) => { if (!test) throw Error(message); };

function environmentNames(deployment) {
  const names = deployment?.environment;
  guard(Array.isArray(names) && names.length === new Set(names).size &&
    names.every(n => typeof n === 'string' && /^[A-Z0-9_]+$/.test(n) && !override.test(n)),
    'Metadados de ambiente inválidos ou injeção Neon sobreposta.');
  return [...names].sort();
}

export async function activateStorage({ env = process.env, request = fetch, sleep = delay,
  report = () => {} } = {}) {
  const apiSha = env.EXPECTED_API_SHA;
  const baseId = Number(env.EXPECTED_API_DEPLOYMENT);
  const ci = { id: Number(env.VALIDATED_CI_RUN), sha: env.VALIDATED_CODE_SHA, path: ciPath };
  guard(env.GITHUB_ACTIONS === 'true' && env.GITHUB_REPOSITORY === repo &&
    env.GITHUB_REF === 'refs/heads/' + gitBranch && env.GITHUB_RUN_ATTEMPT === '1' &&
    ['push', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME) &&
    env.QA_ENABLE === 'yes' && env.CONFIRM_STORAGE_BUCKET === bucket &&
    validSha(apiSha) && validId(env.EXPECTED_API_DEPLOYMENT) &&
    validSha(ci.sha) && validId(env.VALIDATED_CI_RUN) &&
    env.SORTEX_QA_NEON_API_KEY && env.GH_TOKEN,
    'Exige execução deliberada, primeira tentativa, ref QA e pinos completos.');

  async function read(url, options = {}, allow503 = false) {
    const r = await request(url, {
      ...options, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(18_000),
    });
    guard(r.ok || (allow503 && r.status === 503), 'Leitura ou mudança QA não confirmada.');
    return { status: r.status, body: await r.json() };
  }
  const json = async (...args) => (await read(...args)).body;
  const gh = path => json(github + path, {
    headers: { Authorization: 'Bearer ' + env.GH_TOKEN, Accept: 'application/vnd.github+json' },
  });
  const api = (path, options = {}) => json(neon + path, {
    ...options, headers: { Authorization: 'Bearer ' + env.SORTEX_QA_NEON_API_KEY },
  });
  async function verifyRun(pin) {
    const run = await gh('/runs/' + pin.id);
    guard(run.id === pin.id && run.path === pin.path && run.head_sha === pin.sha &&
      run.head_branch === gitBranch && run.repository?.full_name === repo &&
      run.head_repository?.full_name === repo && run.status === 'completed' &&
      run.event === 'push' && run.conclusion === 'success',
      'Fonte CI fixada não comprovada.');
    return run;
  }
  const smokeRun = await verifyRun(smoke);
  const smokeJob = await gh('/jobs/139997941094');
  guard(smokeRun.run_attempt === 1 && smokeJob?.run_id === smoke.id && smokeJob?.name === 'storage' &&
    smokeJob?.conclusion === 'success' && [
      'Preparar e verificar pacote separado sem credenciais',
      'Conferir somente o escopo QA selecionado',
    ].every(name => smokeJob.steps?.some(s => s.name === name && s.conclusion === 'success')),
    'Recibo da prova de storage privado não confirmado.');
  await verifyRun(ci);
  const { jobs: ciJobs } = await gh('/runs/' + ci.id + '/jobs?per_page=20');
  guard(ciJobs?.some(job => job.run_id === ci.id &&
    job.name === 'API e paridade HTTP (sem deploy nem iPhone)' && job.conclusion === 'success' &&
    job.steps?.some(s => s.name === 'Testar configuração e build do site' && s.conclusion === 'success')),
    'A etapa de teste Web da revisão fixada não foi aprovada.');

  const [p, b, s, list] = await Promise.all([
    api(projectPath), api(branchPath), api(branchPath + '/storage'), api(branchPath + '/buckets'),
  ]);
  const match = list.buckets?.filter(entry => entry.name === bucket) ?? [];
  guard(p.project?.id === project && p.project?.name === 'sortex-web-ios-qa' &&
    /^free(?:$|[_-])/.test(p.project?.owner?.subscription_type ?? '') &&
    b.branch?.id === branch && b.branch?.project_id === project && s.enabled === true &&
    s.s3_endpoint?.replace(/\/$/, '') === `https://${branch}.storage.c-16.us-east-1.aws.neon.tech` &&
    s.region === 'us-east-1' && s.force_path_style === true &&
    match.length === 1 && match[0].access_level === 'private' && match[0].inherited !== true &&
    (!match[0].branch_id || match[0].branch_id === branch) &&
    (!match[0].source_branch_id || match[0].source_branch_id === branch),
    'Projeto Free, branch e bucket privado exatos não comprovados.');

  async function inspect(slug = target) {
    const state = await api(fnPath + slug);
    const f = state.function ?? state;
    guard(f.slug === slug && f.invocation_url?.replace(/\/$/, '') === origin(slug),
      'Função ou origem QA divergiu.');
    return f;
  }
  function assertStable(f, id) {
    guard(completed(f.current_deployment, id) && completed(f.active_deployment, id),
      'Publicação esperada não é simultaneamente ativa, concluída e atual. Não repita.');
  }

  const helper = await inspect('sortexqastoragesmoke');
  assertStable(helper, 1);
  guard(equal(environmentNames(helper.active_deployment), [
    'SORTEX_STORAGE_PROBE_EXPIRES_MS', 'SORTEX_STORAGE_PROBE_HASH', 'SORTEX_STORAGE_PROBE_ID',
    'STORAGE_BUCKET', 'STORAGE_DRIVER',
  ]), 'Configuração do smoke anterior divergiu.');

  async function runtime() {
    const opts = { headers: { 'Cache-Control': 'no-store' } };
    const [health, readiness] = await Promise.all([
      read(origin(target) + '/health', opts),
      read(origin(target) + '/health/ready', opts, true),
    ]);
    if (health.status !== 200 || health.body.status !== 'ok' || health.body.version !== apiSha)
      return 'unknown';
    const r = readiness.body;
    if (readiness.status === 200 && r.status === 'ready' && r.database === 'up')
      return ['up', 'disabled', 'not-initialized'].includes(r.storage) ? r.storage : 'unknown';
    if (readiness.status === 503 && r.statusCode === 503 && r.code === 'HTTP_503' &&
      r.path === '/health/ready' && r.message === 'Serviço ainda não está pronto.')
      return 'app-not-ready';
    return 'unknown';
  }

  const base = await inspect();
  assertStable(base, baseId);
  const old = environmentNames(base.active_deployment);
  guard(required.every(n => old.includes(n)) &&
    !old.some(n => /^(STORAGE_|MERCADO_PAGO_|ENABLE_NATIVE_SANDBOX_PIX)/.test(n)),
    'Baseline exige uploads desativados sem flags de storage ou Mercado Pago.');
  const next = [...old, 'STORAGE_BUCKET', 'STORAGE_DRIVER'].sort();
  let baselineReady = false;
  for (let i = 0; i < 3; i++) {
    if (await runtime().catch(() => 'unknown') === 'disabled') {
      baselineReady = true;
      break;
    }
    if (i < 2) await sleep(4_000);
  }
  guard(baselineReady, 'SHA API/DB habilitado e storage desativado não comprovados.');

  async function write(variables, previous, expectedNames) {
    const live = await inspect();
    assertStable(live, previous);
    guard(equal(environmentNames(live.active_deployment), expectedNames),
      'Nomes de ambiente mudaram. Nenhuma nova gravação.');
    const body = new FormData();
    body.set('environment', JSON.stringify(variables));
    let receipt;
    try {
      receipt = await api(fnPath + target + '/deployments', { method: 'POST', body });
    } catch {
      throw Error('Status da mudança de configuração incerto. Nenhuma tentativa adicional; revise no Neon.');
    }
    const id = receipt.deployment?.id ?? receipt.id;
    guard(Number.isSafeInteger(id) && id > previous,
      'Neon não confirmou o recibo; não repita e não reverta automaticamente.');
    report(id);
    return id;
  }

  async function verify(id, names, expected, mayRollback) {
    let failures = 0;
    for (let i = 0; i < 12; i++) {
      // A metadata failure/mismatch after a write is uncertain and never authorizes another.
      const f = await inspect();
      guard(f.current_deployment?.id === id && f.current_deployment.status !== 'failed',
        'Publicação do recibo falhou ou foi substituída. Nenhuma nova gravação.');
      if (completed(f.active_deployment, id) && completed(f.current_deployment, id)) {
        guard(equal(environmentNames(f.active_deployment), names),
          'Nomes de ambiente divergiram depois da publicação. Nenhuma nova gravação.');
        const observed = await runtime().catch(() => 'unknown');
        if (observed === expected) {
          const confirmed = await inspect();
          assertStable(confirmed, id);
          guard(equal(environmentNames(confirmed.active_deployment), names),
            'Nomes de ambiente mudaram durante prontidão. Nenhuma nova gravação.');
          return true;
        }
        failures = ['disabled', 'not-initialized', 'app-not-ready'].includes(observed) ? failures + 1 : 0;
        if (mayRollback && failures >= 3) return false;
      } else {
        failures = 0;
      }
      if (i < 11) await sleep(5_000);
    }
    throw Error('Prontidão não confirmada; estado incerto, nenhuma nova gravação.');
  }

  const activatedId = await write(activate, baseId, old);
  if (await verify(activatedId, next, 'up', true)) return { status: 'enabled', id: activatedId };
  const rollbackId = await write(restore, activatedId, next);
  await verify(rollbackId, old, 'disabled', false);
  return { status: 'rolled-back', id: rollbackId };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  activateStorage({ report: id => console.log('Recibo de configuração QA: ' + id) })
    .then(result => {
      console.log(result.status === 'enabled'
        ? 'Storage privado QA ativo; mesma revisão, DB e HeadBucket confirmados.'
        : 'Ativação não verificada; rollback apenas das flags confirmado.');
      if (result.status !== 'enabled') process.exitCode = 1;
    })
    .catch(() => {
      // Provider response/error bodies may contain confidential data.
      console.error('Storage QA não confirmado. Confira os recibos e o estado no Neon antes de repetir.');
      process.exitCode = 1;
    });
}
