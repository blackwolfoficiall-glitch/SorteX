/* One-time deployment to the isolated Web+iOS project, never the legacy site. */
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');

const target = {
  project: 'lingering-mud-57461462',
  branch: 'br-weathered-forest-bccwn49d',
  slug: 'sortexqa',
  web: 'https://sortex-web-ios-qa.netlify.app',
  api: 'https://br-weathered-forest-bccwn49d-sortexqa.compute.c-16.us-east-1.aws.neon.tech',
};

async function main() {
  const key = process.env.SORTEX_QA_NEON_API_KEY;
  const revision = process.env.GITHUB_SHA;
  if (!key || !/^[0-9a-f]{40}$/.test(revision ?? ''))
    throw new Error('Credencial restrita do Neon QA ou SHA ausente.');
  if (process.env.GITHUB_REF !== 'refs/heads/homologacao/web-ios-integrada')
    throw new Error('A publicação é exclusiva da branch Web + iOS.');
  const scope = `/projects/${target.project}`;
  const branch = `${scope}/branches/${target.branch}`;
  const functions = `${branch}/functions`;
  const instance = `${functions}/${target.slug}`;
  async function api(route, options = {}) {
    const response = await fetch(`https://console.neon.tech/api/v2${route}`, {
      ...options,
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(60000),
      redirect: 'error',
    });
    if (!response.ok)
      throw new Error(`Neon respondeu HTTP ${response.status}.`);
    return response.json();
  }
  const project = (await api(scope)).project;
  if (
    project?.id !== target.project ||
    project?.name !== 'sortex-web-ios-qa' ||
    !/^free/.test(project?.owner?.subscription_type ?? '')
  )
    throw new Error('Projeto QA Free não comprovado.');
  if ((await api(branch)).branch?.id !== target.branch)
    throw new Error('Branch QA não comprovada.');
  if (
    !(await api(`${branch}/databases`)).databases?.some(
      (d) => d.name === 'neondb',
    )
  )
    throw new Error('Banco QA não encontrado.');
  const existing = (await api(functions)).functions;
  if (!Array.isArray(existing) || existing.length !== 0)
    throw new Error(
      'Bootstrap aceita apenas branch QA sem funções existentes.',
    );

  const env = {
    NODE_ENV: 'production',
    APP_ENV: 'staging',
    WEB_URL: target.web,
    APP_URL: target.web,
    WEB_APP_URL: target.web,
    PUBLIC_WEB_URL: target.web,
    API_URL: target.api,
    CORS_ALLOWED_ORIGINS: target.web,
    PAYMENT_ENV: 'sandbox',
    INTEGRATIONS_MODE: 'sandbox',
    EMAIL_DELIVERY_MODE: 'disabled',
    UPLOADS_DISABLED: 'true',
    ORGANIZER_UPLOAD_DIR: '/tmp/sortex-uploads-disabled',
    PRISMA_USE_PG_ADAPTER: 'true',
    FEATURE_REAL_PAYMENTS: 'false',
    FEATURE_REAL_DRAWS: 'false',
    FEATURE_PAYOUTS: 'false',
    FEATURE_EXTERNAL_CRM: 'false',
    FEATURE_WHATSAPP: 'false',
    FEATURE_VIDEO_RENDERING: 'false',
    APP_VERSION: revision,
  };
  for (const secret of [
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'INTEGRATION_ENCRYPTION_KEY',
  ])
    env[secret] = randomBytes(32).toString('hex');

  const zip = fs.readFileSync(
    path.resolve(__dirname, '../dist/neon/sortex-api.zip'),
  );
  if (!zip.length || zip.length > 10 * 1024 * 1024)
    throw new Error('Pacote fora dos limites do bootstrap.');
  const form = new FormData();
  form.set(
    'zip',
    new Blob([zip], { type: 'application/zip' }),
    'sortex-api.zip',
  );
  form.set('runtime', 'nodejs24');
  form.set('environment', JSON.stringify(env));
  await api(`${instance}/deployments`, { method: 'POST', body: form });
  console.log('Pacote aceito pelo Neon isolado. Verificando a API.');
  for (let attempt = 0; attempt < 48; attempt++) {
    const functionState = await api(instance).catch(() => null);
    const actual = (functionState?.function ?? functionState)?.invocation_url;
    if (actual && actual.replace(/\/$/, '') !== target.api)
      throw new Error(
        'URL de invocação diferente do destino compilado no app.',
      );
    if (actual)
      try {
        const get = async (route) => {
          const r = await fetch(`${target.api}/health${route}`, {
            signal: AbortSignal.timeout(12000),
            redirect: 'error',
          });
          return r.ok ? r.json() : null;
        };
        const [health, ready] = await Promise.all([get(''), get('/ready')]);
        if (
          health?.version === revision &&
          ready?.status === 'ready' &&
          ready?.database === 'up'
        ) {
          console.log(`API QA pronta no SHA ${revision}: ${target.api}`);
          return;
        }
      } catch {
        // Cold start: retry without printing response data.
      }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error('A API isolada não confirmou prontidão e revisão no prazo.');
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : 'Falha no bootstrap QA.',
  );
  process.exitCode = 1;
});
