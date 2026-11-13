// Optional first administrator for the NEW homologacao DB only. Credentials
// come from protected repository secrets, never workflow inputs or log output.
const path = require('node:path');
const { spawnSync } = require('node:child_process');

async function main() {
  const email = process.env.SORTEX_ADMIN_EMAIL;
  const password = process.env.SORTEX_ADMIN_PASSWORD;
  if (!email || !password) {
    console.log(
      'Administrador não configurado: segredos opcionais de cadastro ausentes.',
    );
    return;
  }
  const key = process.env.NEON_API_KEY;
  if (!key) throw new Error('Credencial de gestão ausente.');
  const project = 'crimson-bread-73821703';
  const branch = 'br-lingering-voice-bc92seow';
  const query = new URLSearchParams({
    branch_id: branch,
    database_name: 'sortex',
    role_name: 'sortex_owner',
    pooled: 'true',
  });
  const response = await fetch(
    `https://console.neon.tech/api/v2/projects/${project}/connection_uri?${query}`,
    {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!response.ok)
    throw new Error(`Consulta privada de conexão HTTP ${response.status}.`);
  const data = await response.json();
  const uri = data.uri ?? data.connection_uri;
  if (typeof uri !== 'string')
    throw new Error('Conexão privada não retornada pelo serviço.');
  const target = new URL(uri);
  if (
    target.pathname !== '/sortex' ||
    target.hostname !==
      'ep-summer-scene-bczo7vvq-pooler.c-16.us-east-1.aws.neon.tech'
  )
    throw new Error(
      'Destino de homologação incorreto; nenhum usuário alterado.',
    );
  target.searchParams.set('sslmode', 'verify-full');
  const connection = target.toString();
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({ datasourceUrl: connection });
  try {
    const identity = await prisma.$queryRaw`SELECT current_database() AS db`;
    if (identity[0].db !== 'sortex')
      throw new Error('Identidade do banco incorreta.');
    const count = await prisma.user.count({
      where: { role: 'ADMIN', adminTeamRole: 'SUPERADMIN', isActive: true },
    });
    if (count) {
      console.log(
        'Administrador ativo já existe; nenhuma conta, senha ou permissão foi alterada.',
      );
      return;
    }
  } finally {
    await prisma.$disconnect();
  }
  const result = spawnSync(
    process.execPath,
    ['node_modules/ts-node/dist/bin.js', 'prisma/create-superadmin.ts'],
    {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'pipe',
      env: {
        ...process.env,
        DATABASE_URL: connection,
        APP_ENV: 'staging',
        NODE_ENV: 'development',
        ADMIN_BOOTSTRAP_NAME: 'Administrador SorteX',
        ADMIN_BOOTSTRAP_EMAIL: email,
        ADMIN_BOOTSTRAP_PASSWORD: password,
        ADMIN_BOOTSTRAP_PROMOTE_EXISTING: 'false',
      },
    },
  );
  if (result.status !== 0)
    throw new Error(
      'Cadastro recusado pelo comando protegido. Confira a força da senha ou colisão de conta; nenhum valor privado foi registrado.',
    );
  console.log(
    'Primeiro administrador da homologação configurado pelo comando existente; dados anteriores não foram restaurados.',
  );
}

main().catch(() => {
  console.error(
    'Configuração administrativa não concluída; nenhuma credencial foi exibida. Confira os requisitos e o destino do banco.',
  );
  process.exitCode = 1;
});
