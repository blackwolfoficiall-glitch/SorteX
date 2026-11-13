// Initial provisioning only. Never resets, restores, seeds or overwrites a database.
const { PrismaClient } = require('@prisma/client');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

async function main() {
  if (
    process.env.APP_ENV !== 'staging' ||
    process.env.ALLOW_STAGING_MIGRATIONS !== 'true'
  ) {
    throw new Error('Exige APP_ENV=staging e ALLOW_STAGING_MIGRATIONS=true.');
  }
  const target = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
  const url = new URL(target || '');
  const database = decodeURIComponent(url.pathname.slice(1));
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !process.env.EXPECTED_DATABASE_HOST ||
    !process.env.EXPECTED_DATABASE_NAME ||
    url.hostname !== process.env.EXPECTED_DATABASE_HOST ||
    database !== process.env.EXPECTED_DATABASE_NAME
  ) {
    throw new Error('Destino não corresponde ao host/banco esperados.');
  }
  if ((url.searchParams.get('schema') || 'public') !== 'public') {
    throw new Error('Destino deve usar explicitamente o schema public.');
  }
  const local = ['localhost', '127.0.0.1'].includes(url.hostname);
  if (
    !local &&
    url.searchParams.get('sslmode') !== 'require' &&
    url.searchParams.get('sslmode') !== 'verify-full'
  ) {
    throw new Error('TLS obrigatório para o banco remoto.');
  }
  const prisma = new PrismaClient({ datasources: { db: { url: target } } });
  try {
    const [identity] =
      await prisma.$queryRaw`SELECT current_database() AS name`;
    if (identity.name !== database)
      throw new Error('Identidade do banco divergente.');
    const [objects] = await prisma.$queryRaw`
      SELECT (
        (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','S','f')) +
        (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE n.nspname = 'public' AND t.typtype = 'e')
      )::int AS count`;
    if (objects.count !== 0) {
      throw new Error(
        'Banco não vazio: exige auditoria e autorização específica; nada foi aplicado.',
      );
    }
    console.info(
      'Identidade e schema public vazio confirmados; dados antigos não foram recuperados.',
    );
  } finally {
    await prisma.$disconnect();
  }
  process.chdir(path.resolve(__dirname, '..'));
  const result = spawnSync(
    process.execPath,
    ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
    {
      env: { ...process.env, DATABASE_URL: target },
      stdio: 'inherit',
    },
  );
  if (result.status !== 0)
    throw new Error(
      'Migration falhou; não executar reset ou resolve automaticamente.',
    );
}

main().catch((error) => {
  // Never log database URLs, credentials or raw database exceptions.
  const known =
    /^(Exige |Destino |TLS |Identidade |Banco não vazio:|Migration falhou;)/;
  console.error(
    known.test(error.message)
      ? error.message
      : 'Falha na verificação do banco; revise o destino de forma privada.',
  );
  process.exitCode = 1;
});
