/* Run the checked-in Prisma migrations on the isolated Web+iOS QA only. */
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const directHost = 'ep-fragrant-fire-bcnc824c.c-16.us-east-1.aws.neon.tech';

function validateDestination(value) {
  const refuse = () =>
    new Error(
      'Use a conexão direta e exclusiva do Neon sortex-web-ios-qa (neondb).',
    );
  let url;
  try {
    url = new URL(value);
  } catch {
    throw refuse();
  }
  if (
    url.protocol !== 'postgresql:' ||
    url.hostname !== directHost ||
    (url.port && url.port !== '5432') ||
    url.pathname !== '/neondb' ||
    !url.username ||
    !url.password ||
    url.hash ||
    url.searchParams.get('sslmode') !== 'require'
  )
    throw refuse();
  const seen = new Set();
  for (const [key, val] of url.searchParams) {
    if (
      seen.has(key) ||
      !(
        (key === 'sslmode' && val === 'require') ||
        (key === 'channel_binding' && val === 'require') ||
        (key === 'connect_timeout' && /^[1-9][0-9]?$/.test(val))
      )
    )
      throw refuse();
    seen.add(key);
  }
  if (!url.searchParams.has('connect_timeout'))
    url.searchParams.set('connect_timeout', '15');
  return url.toString();
}

function run() {
  const args = process.argv.slice(2);
  if (
    args.length > 1 ||
    !['--status', '--apply'].includes(args[0] ?? '--status')
  ) {
    throw new Error(
      'Uso: node scripts/migrate-isolated-qa.cjs [--status|--apply]',
    );
  }
  const cwd = path.resolve(__dirname, '..');
  const databaseUrl = validateDestination(process.env.SORTEX_QA_DATABASE_URL);
  const env = { ...process.env, DATABASE_URL: databaseUrl };
  delete env.SORTEX_QA_DATABASE_URL;
  const prisma = (parameters, input) => {
    const result = spawnSync(
      process.execPath,
      [path.join(cwd, 'node_modules/prisma/build/index.js'), ...parameters],
      {
        cwd,
        env,
        input,
        stdio: [input ? 'pipe' : 'ignore', 'inherit', 'inherit'],
      },
    );
    if (result.status !== 0) {
      throw new Error(
        'Prisma não concluiu o passo solicitado no banco isolado.',
      );
    }
  };
  prisma(
    ['db', 'execute', '--stdin', '--schema', 'prisma/schema.prisma'],
    'SELECT current_database(), current_user;',
  );
  if (args[0] === '--apply') prisma(['migrate', 'deploy']);
  prisma(['migrate', 'status']);
}

if (require.main === module) {
  try {
    run();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { validateDestination };
