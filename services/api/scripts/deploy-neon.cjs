// One-function deploy through Neon's documented multipart API. No migrations,
// branch creation, billing changes or secrets in arguments/logs.
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');

const project = 'crimson-bread-73821703';
const branch = 'br-lingering-voice-bc92seow';
const slug = 'sortexapi';
const root = 'https://console.neon.tech/api/v2';

async function main() {
  const key = process.env.NEON_API_KEY;
  if (!key) throw new Error('Configure NEON_API_KEY como segredo do ambiente.');
  const filename = process.argv[2];
  const bootstrapOrPreserve = filename === '--bootstrap-or-preserve';
  if (!filename)
    throw new Error('Informe o JSON privado ou --bootstrap-or-preserve.');
  let environment;
  if (!bootstrapOrPreserve)
    try {
      environment = JSON.parse(fs.readFileSync(filename, 'utf8'));
    } catch {
      throw new Error('Não foi possível ler o JSON privado de ambiente.');
    }
  if (
    environment &&
    (environment.APP_ENV !== 'staging' ||
      environment.PAYMENT_ENV !== 'sandbox' ||
      environment.INTEGRATIONS_MODE !== 'sandbox' ||
      environment.UPLOADS_DISABLED !== 'true' ||
      environment.PRISMA_USE_PG_ADAPTER !== 'true')
  )
    throw new Error('A configuração deve permanecer em homologação segura.');
  if (
    environment &&
    Object.keys(environment).some((name) => /^(DATABASE_URL|NEON_)/.test(name))
  )
    throw new Error('Não sobrescreva variáveis gerenciadas pelo Neon.');
  for (const name of environment
    ? ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'INTEGRATION_ENCRYPTION_KEY']
    : []) {
    if (typeof environment[name] !== 'string' || environment[name].length < 32)
      throw new Error(`Configure um valor privado forte para ${name}.`);
  }
  const headers = { Authorization: `Bearer ${key}` };
  async function api(route, options = {}) {
    const response = await fetch(`${root}${route}`, {
      ...options,
      headers: { ...headers, ...options.headers },
    });
    if (response.status === 404 && route.endsWith(`/functions/${slug}`))
      return null;
    if (!response.ok)
      throw new Error(
        `Neon API HTTP ${response.status}; nenhum conteúdo privado foi registrado.`,
      );
    try {
      return await response.json();
    } catch {
      throw new Error('Neon API retornou uma resposta JSON inválida.');
    }
  }
  const current = await api(`/projects/${project}`);
  const currentProject = current.project ?? current;
  if (
    currentProject.id !== project ||
    !/^free/.test(currentProject.owner?.subscription_type ?? '')
  )
    throw new Error(
      'Não foi possível comprovar o projeto existente no plano Free.',
    );
  const destination = await api(`/projects/${project}/branches/${branch}`);
  if (
    destination.branch?.id !== branch ||
    destination.branch?.name !== 'homologacao'
  )
    throw new Error('Branch Neon de destino não corresponde à homologação.');
  const databases = await api(
    `/projects/${project}/branches/${branch}/databases`,
  );
  if (!databases.databases?.some((database) => database.name === 'sortex'))
    throw new Error('Banco sortex não encontrado no destino existente.');
  const functionRoute = `/projects/${project}/branches/${branch}/functions/${slug}`;
  const existing = await api(functionRoute);
  if (bootstrapOrPreserve && !existing) {
    const web = 'https://sortex-homologacao.netlify.app';
    environment = {
      NODE_ENV: 'production',
      APP_ENV: 'staging',
      WEB_URL: web,
      APP_URL: web,
      WEB_APP_URL: web,
      PUBLIC_WEB_URL: web,
      API_URL: 'https://api.example.invalid',
      CORS_ALLOWED_ORIGINS: web,
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
      APP_VERSION: process.env.GITHUB_SHA || 'neon-homologacao',
    };
    for (const name of [
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'INTEGRATION_ENCRYPTION_KEY',
    ])
      environment[name] = randomBytes(32).toString('hex');
  }
  const zip = fs.readFileSync(
    path.resolve(__dirname, '../dist/neon/sortex-api.zip'),
  );
  if (zip.length > 10 * 1024 * 1024)
    throw new Error('ZIP excede o limite do runtime.');
  const form = new FormData();
  form.set(
    'zip',
    new Blob([zip], { type: 'application/zip' }),
    'sortex-api.zip',
  );
  form.set('runtime', 'nodejs24');
  // Omitting environment on later deploys preserves JWT/encryption keys.
  if (environment) form.set('environment', JSON.stringify(environment));
  await api(
    `/projects/${project}/branches/${branch}/functions/${slug}/deployments`,
    { method: 'POST', body: form },
  );
  console.log(
    `Upload aceito: projeto ${project}, branch homologacao, função ${slug}.`,
  );
  let invocation;
  for (let attempt = 0; attempt < 90; attempt++) {
    const status = await api(functionRoute);
    const record = status?.function ?? status;
    invocation = record?.invocation_url;
    if (invocation) break;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  if (!invocation)
    throw new Error(
      'Envio aceito, mas URL ainda não disponível; confira o deploy no Neon.',
    );
  const url = new URL(invocation);
  if (
    url.protocol !== 'https:' ||
    !url.hostname.startsWith(`${branch}-${slug}.compute.`) ||
    !url.hostname.endsWith('.neon.tech')
  )
    throw new Error('A URL retornada não corresponde à função de homologação.');
  for (let attempt = 0; attempt < 90; attempt++) {
    try {
      const response = await fetch(
        `${invocation.replace(/\/$/, '')}/health/ready`,
        { signal: AbortSignal.timeout(20000) },
      );
      if (response.ok) {
        const body = await response.json();
        if (body.status === 'ready' && body.database === 'up') {
          if (environment && environment.API_URL !== invocation) {
            environment.API_URL = invocation;
            const update = new FormData();
            update.set('environment', JSON.stringify(environment));
            await api(`${functionRoute}/deployments`, {
              method: 'POST',
              body: update,
            });
            continue;
          }
          console.log(`API validada: ${invocation}`);
          console.log(
            'Banco respondeu ao endpoint de prontidão; dados antigos não foram restaurados.',
          );
          return;
        }
      }
    } catch {
      /* Retry cold start/build without logging private response data. */
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(
    'Prontidão não confirmada; examine os logs da função no Neon.',
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : 'Falha na publicação.',
  );
  process.exitCode = 1;
});
