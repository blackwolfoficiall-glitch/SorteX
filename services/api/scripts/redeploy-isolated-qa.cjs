/* Code-only update of the existing isolated QA Function. No DB or payment inputs. */
'use strict';
const { readFile } = require('node:fs/promises');
const { setTimeout: delay } = require('node:timers/promises');

const repo = 'blackwolfoficiall-glitch/SorteX';
const ref = 'refs/heads/homologacao/web-ios-integrada';
const projectId = 'lingering-mud-57461462';
const branchId = 'br-weathered-forest-bccwn49d';
const slug = 'sortexqa';
const bucket = 'sortex-qa-media';
const endpoint = 'https://' + branchId + '.storage.c-16.us-east-1.aws.neon.tech';
const origin = 'https://br-weathered-forest-bccwn49d-sortexqa.compute.c-16.us-east-1.aws.neon.tech';
const projectPath = '/projects/' + projectId;
const branchPath = projectPath + '/branches/' + branchId;
const functionPath = branchPath + '/functions/' + slug;
const required = ['APP_ENV', 'APP_VERSION', 'PAYMENT_ENV', 'FEATURE_REAL_PAYMENTS',
  'FEATURE_PAYOUTS', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'INTEGRATION_ENCRYPTION_KEY', 'UPLOADS_DISABLED'];
const forbidden = /^(AWS_|MERCADO_PAGO_|ENABLE_NATIVE_SANDBOX_PIX|DATABASE_URL(?:_UNPOOLED)?$|NEON_BRANCH(?:_ID)?$|NEON_FUNCTION_HOST_SUFFIX$)/;
const sameNames = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sha = value => /^[0-9a-f]{40}$/.test(value ?? '');

function inspect(state) {
  const fn = state.function ?? state;
  const current = fn.current_deployment;
  const active = fn.active_deployment;
  if (fn.slug !== slug || fn.invocation_url?.replace(/\/$/, '') !== origin ||
      !Number.isSafeInteger(active?.id) || !Number.isSafeInteger(current?.id)) {
    throw Error('Identidade da função existente não comprovada.');
  }
  return { current, active };
}

function safeKeys(active, storageMode) {
  const names = active.environment;
  const expectedFlags = storageMode === 'private-neon-s3' ? ['STORAGE_BUCKET', 'STORAGE_DRIVER'] : [];
  if (!Array.isArray(names) || names.length !== new Set(names).size ||
      names.some(n => typeof n !== 'string' || !/^[A-Z0-9_]+$/.test(n)) ||
      !required.every(k => names.includes(k)) || names.some(n => forbidden.test(n)) ||
      !sameNames(names.filter(n => n.startsWith('STORAGE_')).sort(), expectedFlags)) {
    throw Error('Nomes de configuração QA ou flags de storage divergiram.');
  }
  return [...names].sort();
}

function sameDeployment({ active, current }, id) {
  return active.id === id && current.id === id &&
    active.status === 'completed' && current.status === 'completed';
}

async function rollout({ env = process.env, request = fetch, load = readFile, sleep = delay } = {}) {
  const baseline = env.SORTEX_QA_BASE_SHA;
  const revision = env.SORTEX_QA_CODE_SHA;
  const baselineDeploymentId = Number(env.SORTEX_QA_BASE_DEPLOYMENT);
  const storageMode = env.SORTEX_QA_EXPECTED_STORAGE;
  if (env.GITHUB_ACTIONS !== 'true' || env.GITHUB_REPOSITORY !== repo || env.GITHUB_REF !== ref ||
      env.GITHUB_RUN_ATTEMPT !== '1' || !['push', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME) ||
      !sha(revision) || !sha(baseline) || !/^[1-9][0-9]{0,14}$/.test(env.SORTEX_QA_BASE_DEPLOYMENT ?? '') ||
      !['disabled', 'private-neon-s3'].includes(storageMode) ||
      env.QA_ENABLE !== 'yes' || !env.SORTEX_QA_NEON_API_KEY) {
    throw Error('Exige ambiente protegido, revisão, deployment-base e modo de storage fixados.');
  }
  const zip = await load('dist/neon/sortex-api.zip');
  if (zip.length < 4 || zip.length > 10 * 1024 * 1024 || zip[0] !== 0x50 || zip[1] !== 0x4b) {
    throw Error('Pacote inexistente ou fora dos limites.');
  }
  async function get(url, options = {}) {
    const res = await request(url, { ...options, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(25000) });
    if (!res.ok) throw Error('Operação QA retornou HTTP ' + res.status + '.');
    return res.json();
  }
  const api = (path, options = {}) => get('https://console.neon.tech/api/v2' + path, {
    ...options, headers: { Authorization: 'Bearer ' + env.SORTEX_QA_NEON_API_KEY },
  });
  const { project } = await api(projectPath);
  if (project?.id !== projectId || project?.name !== 'sortex-web-ios-qa' ||
      !/^free(?:$|[_-])/.test(project?.owner?.subscription_type ?? '')) {
    throw Error('Projeto Neon Free isolado não comprovado.');
  }
  const { branch } = await api(branchPath);
  if (branch?.id !== branchId || branch?.project_id !== projectId) {
    throw Error('Branch Neon QA não comprovada.');
  }

  async function checkPrivateBucket() {
    if (storageMode === 'disabled') return;
    const [storage, list] = await Promise.all([api(branchPath + '/storage'), api(branchPath + '/buckets')]);
    const matches = list.buckets?.filter(b => b.name === bucket) ?? [];
    if (storage.enabled !== true || storage.s3_endpoint?.replace(/\/$/, '') !== endpoint ||
        storage.region !== 'us-east-1' || storage.force_path_style !== true ||
        matches.length !== 1 || matches[0].access_level !== 'private' || matches[0].inherited === true ||
        (matches[0].branch_id && matches[0].branch_id !== branchId) ||
        (matches[0].source_branch_id && matches[0].source_branch_id !== branchId)) {
      throw Error('Destino de storage QA ativo e privado não comprovado.');
    }
  }
  const state = async () => inspect(await api(functionPath));
  const base = await state();
  if (!sameDeployment(base, baselineDeploymentId)) {
    throw Error('A publicação de base mudou; não sobrescrever.');
  }
  const keys = safeKeys(base.active, storageMode);
  await checkPrivateBucket();
  const probeRuntime = () => Promise.all([get(origin + '/health'), get(origin + '/health/ready')]);
  const readyQa = r => r.status === 'ready' && r.database === 'up' &&
    r.storage === (storageMode === 'private-neon-s3' ? 'up' : 'disabled');
  const [health, ready] = await probeRuntime();
  if (health.status !== 'ok' || health.version !== baseline || !readyQa(ready)) {
    throw Error('SHA, banco e modo de storage QA de base não confirmados.');
  }
  const preWrite = await state();
  if (!sameDeployment(preWrite, baselineDeploymentId) ||
      !sameNames(safeKeys(preWrite.active, storageMode), keys)) {
    throw Error('A publicação/configuração de base mudou; não sobrescrever.');
  }
  if (baseline === revision) return { id: baselineDeploymentId, unchanged: true };

  const form = new FormData();
  form.set('zip', new Blob([zip], { type: 'application/zip' }), 'sortex-api.zip');
  form.set('environment', JSON.stringify({ APP_VERSION: revision }));
  const receipt = await api(functionPath + '/deployments', { method: 'POST', body: form });
  const id = receipt.deployment?.id ?? receipt.id;
  if (!Number.isSafeInteger(id) || id <= baselineDeploymentId) throw Error('Neon não confirmou uma nova publicação.');
  for (let i = 0; i < 40; i++) {
    const found = await state();
    if (found.current.id !== id || found.current.status === 'failed') throw Error('Publicação QA mudou ou falhou.');
    if (sameDeployment(found, id)) {
      if (!sameNames(safeKeys(found.active, storageMode), keys)) throw Error('Os nomes do ambiente QA mudaram.');
      let probe;
      try { probe = await probeRuntime(); }
      catch { /* cold start */ }
      if (probe?.[0].version === revision && probe[0].status === 'ok' && readyQa(probe[1])) {
        await checkPrivateBucket();
        const confirmed = await state();
        if (!sameDeployment(confirmed, id) || !sameNames(safeKeys(confirmed.active, storageMode), keys)) {
          throw Error('A publicação/configuração divergiu durante a verificação.');
        }
        return { id, unchanged: false };
      }
    }
    await sleep(5000);
  }
  throw Error('A nova revisão não confirmou prontidão no prazo.');
}

if (require.main === module) {
  rollout().then(r => console.log('SorteX QA verificada: deployment ' + r.id + ', SHA ' + process.env.SORTEX_QA_CODE_SHA))
    .catch(() => { console.error('Não foi possível comprovar a atualização de código da API QA. Verifique as métricas do projeto QA e o SHA antes de repetir.'); process.exitCode = 1; });
}
module.exports = { rollout };
