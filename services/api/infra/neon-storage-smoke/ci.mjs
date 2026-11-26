/* One confirmed write to a new synthetic key, only via a separate QA Function. */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { setTimeout as wait } from 'node:timers/promises';

const repo = 'blackwolfoficiall-glitch/SorteX';
const ref = 'refs/heads/homologacao/web-ios-integrada';
const project = 'lingering-mud-57461462';
const branch = 'br-weathered-forest-bccwn49d';
const bucket = 'sortex-qa-media';
const endpoint = `https://${branch}.storage.c-16.us-east-1.aws.neon.tech`;
const region = 'us-east-1';
const liveSha = '90851959c3d7beceb7c259249e284c08b246e4ee';
const liveDeployment = 5;
const slug = 'sortexqastoragesmoke';
const qaOrigin = `https://${branch}-sortexqa.compute.c-16.us-east-1.aws.neon.tech`;
const smokeOrigin = `https://${branch}-${slug}.compute.c-16.us-east-1.aws.neon.tech`;
const control = 'https://console.neon.tech/api/v2';
const projectPath = '/projects/' + project;
const branchPath = projectPath + '/branches/' + branch;
const funcsPath = branchPath + '/functions';
const targetPath = funcsPath + '/' + slug;
const fixtureHash =
  'e99cd5cfefa136740dfeeb46c41e0783b06944bc88994cb86080c3356c977853';

function guard(check, message) {
  if (!check) throw Error(message);
}
function deployment(state, name, origin) {
  const fn = state.function ?? state;
  const active = fn.active_deployment;
  guard(
    fn.slug === name && fn.invocation_url?.replace(/\/$/, '') === origin,
    'Identidade da função não comprovada.',
  );
  return { active, current: fn.current_deployment };
}
function storageOverride(name) {
  return /^(?:AWS_|NEON_BRANCH_ID$|NEON_FUNCTION_HOST_SUFFIX$)/.test(name);
}
function namesOnly(active) {
  guard(
    Array.isArray(active?.environment) &&
      active.environment.every(
        (n) => typeof n === 'string' && /^[A-Z0-9_]+$/.test(n),
      ) &&
      !active.environment.some(storageOverride),
    'Variáveis injetadas podem estar sobrepostas.',
  );
  return active.environment;
}

export async function smoke({
  mode = 'preflight',
  env = process.env,
  request = fetch,
  load = readFile,
  clock = Date.now,
  sleep = wait,
  tokenFactory = () => randomBytes(32).toString('hex'),
  idFactory = randomUUID,
} = {}) {
  guard(
    ['preflight', 'execute'].includes(mode) &&
      env.GITHUB_ACTIONS === 'true' &&
      env.GITHUB_REPOSITORY === repo &&
      env.GITHUB_REF === ref &&
      ((mode === 'preflight' && env.GITHUB_EVENT_NAME === 'push') ||
        env.GITHUB_EVENT_NAME === 'workflow_dispatch') &&
      env.QA_ENABLE === 'yes' &&
      env.SORTEX_QA_NEON_API_KEY,
    'Executar somente no workflow manual e protegido da QA.',
  );
  if (mode === 'execute')
    guard(
      env.SORTEX_QA_STORAGE_SMOKE === 'yes' &&
        env.SORTEX_QA_STORAGE_CONFIRMATION === bucket,
      'O smoke que escreve um objeto exige confirmação explícita.',
    );

  async function get(url, options = {}) {
    const response = await request(url, {
      ...options,
      redirect: 'error',
      signal: AbortSignal.timeout(28_000),
    });
    guard(response.ok, 'Operação QA retornou HTTP ' + response.status + '.');
    return response.json();
  }
  const api = (path, options = {}) =>
    get(control + path, {
      ...options,
      headers: { Authorization: 'Bearer ' + env.SORTEX_QA_NEON_API_KEY },
    });
  async function existingQa() {
    const live = deployment(
      await api(funcsPath + '/sortexqa'),
      'sortexqa',
      qaOrigin,
    );
    guard(
      live.active?.id === liveDeployment &&
        live.current?.id === liveDeployment &&
        live.active?.status === 'completed' &&
        live.current?.status === 'completed',
      'Revisão da API QA mudou; não toque na função existente.',
    );
    const envNames = namesOnly(live.active);
    guard(
      envNames.includes('UPLOADS_DISABLED'),
      'Não foi possível comprovar a configuração base.',
    );
    const [health, ready] = await Promise.all([
      get(qaOrigin + '/health'),
      get(qaOrigin + '/health/ready'),
    ]);
    guard(
      health.status === 'ok' &&
        health.version === liveSha &&
        ready.status === 'ready' &&
        ready.database === 'up' &&
        ready.storage === 'disabled',
      'Configuração ou SHA da API QA mudou.',
    );
  }

  const [p, b, s, buckets] = await Promise.all([
    api(projectPath),
    api(branchPath),
    api(branchPath + '/storage'),
    api(branchPath + '/buckets'),
  ]);
  guard(
    p.project?.id === project &&
      p.project?.name === 'sortex-web-ios-qa' &&
      /^free(?:$|[_-])/.test(p.project?.owner?.subscription_type ?? ''),
    'Plano Neon Free e projeto QA não comprovados.',
  );
  guard(
    b.branch?.id === branch &&
      b.branch?.project_id === project &&
      s.enabled === true &&
      s.s3_endpoint?.replace(/\/$/, '') === endpoint &&
      s.region === region &&
      s.force_path_style === true,
    'Escopo e endpoint de storage QA não comprovados.',
  );
  const matches =
    buckets.buckets?.filter((entry) => entry.name === bucket) ?? [];
  guard(
    matches.length === 1 &&
      matches[0].access_level === 'private' &&
      matches[0].inherited !== true &&
      (!matches[0].branch_id || matches[0].branch_id === branch) &&
      (!matches[0].source_branch_id || matches[0].source_branch_id === branch),
    'Bucket QA já existente e privado não comprovado.',
  );

  await existingQa();
  if (mode === 'preflight')
    return { privateBucket: true, apiUnchanged: true, didWrite: false };
  const functions = (await api(funcsPath)).functions;
  guard(
    Array.isArray(functions) &&
      functions.length === 1 &&
      functions[0].slug === 'sortexqa',
    'Só a função QA principal deve existir; não substitua outra função.',
  );

  const zip = await load(
    new URL('../../dist/neon/sortex-storage-smoke.zip', import.meta.url),
  );
  guard(
    zip.length >= 4 &&
      zip.length <= 10 * 1024 * 1024 &&
      zip[0] === 0x50 &&
      zip[1] === 0x4b,
    'Pacote isolado ausente ou inválido.',
  );
  const token = tokenFactory();
  guard(/^[0-9a-f]{64}$/.test(token), 'Token efêmero inválido.');
  const expiry = clock() + 8 * 60_000;
  const variables = {
    STORAGE_DRIVER: 'neon-s3',
    STORAGE_BUCKET: bucket,
    SORTEX_STORAGE_PROBE_HASH: createHash('sha256').update(token).digest('hex'),
    SORTEX_STORAGE_PROBE_EXPIRES_MS: String(expiry),
    SORTEX_STORAGE_PROBE_ID: idFactory(),
  };
  const body = new FormData();
  body.set('runtime', 'nodejs24');
  body.set('zip', new Blob([zip], { type: 'application/zip' }), 'smoke.zip');
  body.set('environment', JSON.stringify(variables));
  const receipt = await api(targetPath + '/deployments', {
    method: 'POST',
    body,
  });
  const id = receipt.deployment?.id ?? receipt.id;
  guard(
    Number.isInteger(id) && id > 0,
    'Deploy isolado do smoke não comprovado. Não repita automaticamente.',
  );
  let deployed = false;
  for (let i = 0; i < 30 && clock() + 65_000 < expiry; i++) {
    let s;
    try {
      s = await api(targetPath);
    } catch {
      await sleep(4_000);
      continue;
    }
    const fn = deployment(s, slug, smokeOrigin);
    guard(
      fn.current?.id === id && fn.current.status !== 'failed',
      'A publicação do smoke mudou ou falhou. Não repita automaticamente.',
    );
    if (
      fn.active?.id === id &&
      fn.active.status === 'completed' &&
      fn.current.status === 'completed'
    ) {
      guard(
        JSON.stringify(namesOnly(fn.active).sort()) ===
          JSON.stringify(Object.keys(variables).sort()),
        'Nomes do ambiente do smoke divergentes.',
      );
      deployed = true;
      break;
    }
    await sleep(4_000);
  }
  guard(
    deployed && clock() + 65_000 < expiry,
    'Função de smoke não confirmada antes do prazo.',
  );

  const denied = await request(smokeOrigin + '/probe', {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  });
  await denied.body?.cancel();
  guard(denied.status === 404, 'Função de smoke permitiu chamada sem o token.');
  const call = (path) =>
    get(smokeOrigin + path, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
    });
  const head = await call('/preflight');
  guard(
    head.ok === true && head.injected === true,
    'HeadBucket com credenciais injetadas não comprovado.',
  );
  // Exactly one invocation. Never retry a timed-out write.
  const probe = await call('/probe');
  guard(
    probe.ok === true &&
      probe.bytes === 69 &&
      probe.sha256 === fixtureHash &&
      probe.anonymousDenied === true,
    'Integridade do PNG privado não comprovada.',
  );
  await existingQa();
  return {
    privateBucket: true,
    apiUnchanged: true,
    didWrite: true,
    injected: true,
    bytes: probe.bytes,
    sha256: fixtureHash,
    anonymousDenied: true,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  smoke({ mode: process.argv[2] ?? 'preflight' })
    .then((receipt) => console.log(JSON.stringify(receipt)))
    .catch(() => {
      // Do not print provider errors, object IDs, tokens, response bodies or configuration.
      console.error(
        'Não foi possível comprovar o smoke de storage somente na QA. Revise o escopo e o estado; não repita uma execução de escrita.',
      );
      process.exitCode = 1;
    });
}
