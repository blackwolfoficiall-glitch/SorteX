/* Code-only update of the existing isolated QA Function. No DB or payment inputs. */
'use strict';
const { readFile } = require('node:fs/promises');
const { setTimeout: delay } = require('node:timers/promises');

const repo = 'blackwolfoficiall-glitch/SorteX';
const ref = 'refs/heads/homologacao/web-ios-integrada';
const projectId = 'lingering-mud-57461462';
const branchId = 'br-weathered-forest-bccwn49d';
const slug = 'sortexqa';
const baseline = '73e846a8dce25569a89005af1202533b8de47e76';
const revision = 'a51eb9a3693c955b5105146631f5cc4e9666c9cc';
const baselineDeploymentId = 3;
const origin = 'https://br-weathered-forest-bccwn49d-sortexqa.compute.c-16.us-east-1.aws.neon.tech';
const projectPath = '/projects/' + projectId;
const functionPath = projectPath + '/branches/' + branchId + '/functions/' + slug;
const required = ['APP_ENV', 'APP_VERSION', 'PAYMENT_ENV', 'FEATURE_REAL_PAYMENTS',
  'FEATURE_PAYOUTS', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'INTEGRATION_ENCRYPTION_KEY'];
const forbidden = /^(MERCADO_PAGO_|ENABLE_NATIVE_SANDBOX_PIX)/;

function inspect(state) {
  const fn = state.function ?? state;
  const current = fn.current_deployment;
  const active = fn.active_deployment;
  if (fn.slug !== slug || fn.invocation_url?.replace(/\/$/, '') !== origin ||
      !Number.isInteger(active?.id) || !Number.isInteger(current?.id)) {
    throw Error('Identidade da função existente não comprovada.');
  }
  return { current, active };
}

function safeKeys(active) {
  const names = active.environment;
  if (!Array.isArray(names) || names.some(n => typeof n !== 'string' || !/^[A-Z0-9_]+$/.test(n)) ||
      !required.every(k => names.includes(k)) || names.some(n => forbidden.test(n))) {
    throw Error('Configuração QA não corresponde a uma revisão sem Mercado Pago.');
  }
  return [...names].sort();
}

async function rollout({ env = process.env, request = fetch, load = readFile, sleep = delay } = {}) {
  if (env.GITHUB_REPOSITORY !== repo || env.GITHUB_REF !== ref ||
      env.SORTEX_QA_CODE_SHA !== revision || env.QA_ENABLE !== 'yes' || !env.SORTEX_QA_NEON_API_KEY) {
    throw Error('Executar apenas no ambiente protegido, na revisão autorizada.');
  }
  const zip = await load('dist/neon/sortex-api.zip');
  if (zip.length < 4 || zip.length > 10 * 1024 * 1024 || zip[0] !== 0x50 || zip[1] !== 0x4b) {
    throw Error('Pacote inexistente ou fora dos limites.');
  }
  async function get(url, options = {}) {
    const res = await request(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(25000) });
    if (!res.ok) throw Error('Operação QA retornou HTTP ' + res.status + '.');
    return res.json();
  }
  const api = (path, options = {}) => get('https://console.neon.tech/api/v2' + path, {
    ...options, headers: { Authorization: 'Bearer ' + env.SORTEX_QA_NEON_API_KEY },
  });
  const { project } = await api(projectPath);
  if (project?.id !== projectId || project?.name !== 'sortex-web-ios-qa' ||
      !/^free/.test(project?.owner?.subscription_type ?? '')) {
    throw Error('Projeto Neon Free isolado não comprovado.');
  }
  const { branch } = await api(projectPath + '/branches/' + branchId);
  if (branch?.id !== branchId) throw Error('Branch Neon QA não comprovada.');

  const { active, current } = inspect(await api(functionPath));
  if (active.status !== 'completed' || current.id !== active.id || current.status !== 'completed') {
    throw Error('Já existe publicação em andamento ou a anterior requer revisão.');
  }
  const keys = safeKeys(active);
  const [health, ready] = await Promise.all([get(origin + '/health'), get(origin + '/health/ready')]);
  const readyQa = r => r.status === 'ready' && r.database === 'up' && r.storage === 'disabled';
  if (health.status !== 'ok' || !readyQa(ready)) throw Error('QA não está saudável antes da atualização.');
  if (health.version === revision) return { id: active.id, unchanged: true };
  if (health.version !== baseline || active.id !== baselineDeploymentId) throw Error('A publicação de base mudou; não sobrescrever.');

  const form = new FormData();
  form.set('zip', new Blob([zip], { type: 'application/zip' }), 'sortex-api.zip');
  form.set('environment', JSON.stringify({ APP_VERSION: revision }));
  const receipt = await api(functionPath + '/deployments', { method: 'POST', body: form });
  const id = receipt.deployment?.id ?? receipt.id;
  if (!Number.isInteger(id) || id <= active.id) throw Error('Neon não confirmou uma nova publicação.');
  for (let i = 0; i < 40; i++) {
    const found = inspect(await api(functionPath));
    if (found.current.id !== id || found.current.status === 'failed') throw Error('Publicação QA mudou ou falhou.');
    if (found.active.id === id && found.active.status === 'completed') {
      if (JSON.stringify(safeKeys(found.active)) !== JSON.stringify(keys)) throw Error('Os nomes do ambiente QA mudaram.');
      let probe;
      try { probe = await Promise.all([get(origin + '/health'), get(origin + '/health/ready')]); }
      catch { /* cold start */ }
      if (probe?.[0].version === revision && probe[0].status === 'ok' && readyQa(probe[1])) {
        return { id, unchanged: false };
      }
    }
    await sleep(5000);
  }
  throw Error('A nova revisão não confirmou prontidão no prazo.');
}

if (require.main === module) {
  rollout().then(r => console.log('SorteX QA verificada: deployment ' + r.id + ', SHA ' + revision))
    .catch(() => { console.error('Não foi possível comprovar a atualização de código da API QA. Verifique as métricas do projeto QA e o SHA antes de repetir.'); process.exitCode = 1; });
}
module.exports = { rollout, baseline, revision };
