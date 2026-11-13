// One-function deploy through Neon's documented multipart API. No migrations,
// branch creation, billing changes or secrets in arguments/logs.
const fs = require('node:fs');
const path = require('node:path');

const project = 'crimson-bread-73821703';
const branch = 'br-lingering-voice-bc92seow';
const slug = 'sortexapi';
const root = 'https://console.neon.tech/api/v2';

async function main() {
  const key = process.env.NEON_API_KEY;
  if (!key) throw new Error('Configure NEON_API_KEY como segredo do ambiente.');
  const filename = process.argv[2];
  if (!filename)
    throw new Error('Informe o caminho do JSON privado de ambiente.');
  let environment;
  try {
    environment = JSON.parse(fs.readFileSync(filename, 'utf8'));
  } catch {
    throw new Error('Não foi possível ler o JSON privado de ambiente.');
  }
  if (
    environment.APP_ENV !== 'staging' ||
    environment.PAYMENT_ENV !== 'sandbox' ||
    environment.INTEGRATIONS_MODE !== 'sandbox' ||
    environment.UPLOADS_DISABLED !== 'true' ||
    environment.PRISMA_USE_PG_ADAPTER !== 'true'
  )
    throw new Error('A configuração deve permanecer em homologação segura.');
  if (
    Object.keys(environment).some((name) => /^(DATABASE_URL|NEON_)/.test(name))
  )
    throw new Error('Não sobrescreva variáveis gerenciadas pelo Neon.');
  for (const name of [
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'INTEGRATION_ENCRYPTION_KEY',
  ]) {
    if (typeof environment[name] !== 'string' || environment[name].length < 32)
      throw new Error(`Configure um valor privado forte para ${name}.`);
  }
  const headers = { Authorization: `Bearer ${key}` };
  async function api(route, options = {}) {
    const response = await fetch(`${root}${route}`, {
      ...options,
      headers: { ...headers, ...options.headers },
    });
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
  form.set('environment', JSON.stringify(environment));
  await api(
    `/projects/${project}/branches/${branch}/functions/${slug}/deployments`,
    { method: 'POST', body: form },
  );
  console.log(
    `Upload aceito: projeto ${project}, branch homologacao, função ${slug}.`,
  );
  console.log(
    'Verifique o estado completed e /health/ready antes de declarar a API publicada.',
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : 'Falha na publicação.',
  );
  process.exitCode = 1;
});
