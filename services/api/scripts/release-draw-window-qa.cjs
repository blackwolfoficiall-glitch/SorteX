/* One-release, manual-only migration gate for the existing isolated Neon QA. */
'use strict';
const { createHash } = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { validateDestination } = require('./migrate-isolated-qa.cjs');
const { rollout } = require('./redeploy-isolated-qa.cjs');

const pins = Object.freeze({
  repository: 'blackwolfoficiall-glitch/SorteX',
  ref: 'refs/heads/homologacao/web-ios-integrada',
  baseSha: '48eeb85830c2dddab048796d7859200e65cc73f9',
  deployment: '13',
  // Retest and explicitly review any replacement before repinning.
  candidateSha: 'd4e499e29c76a11f4275c2be8d34e6a4a616cb70',
  migration: '20261126230000_explicit_campaign_draw_timezone',
  digest: '2192bdf90202d7ab60e7d92ccdc0e474fa900a4b6914c77fa4f4e8a102cb6618',
  first21: 'd7dfe3b4f3d0d0951b1e4e38a72c33de6585c625f8553f498355488c85cf896b',
  all22: 'e131b2f1a3cff5363bc8e4f8c7cbb90d3864bfb17f69370a7688349b75b8354c',
  origin: 'https://br-weathered-forest-bccwn49d-sortexqa.compute.c-16.us-east-1.aws.neon.tech',
});
const confirmation = 'QA-13+21-to-22+' + pins.candidateSha;
const sha256 = value => createHash('sha256').update(value).digest('hex');
const fail = msg => { throw new Error(msg); };

function validateInvocation(mode, env) {
  if (!['--plan', '--apply'].includes(mode) || env.GITHUB_ACTIONS !== 'true' ||
    env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || env.GITHUB_RUN_ATTEMPT !== '1' ||
    env.GITHUB_REPOSITORY !== pins.repository || env.GITHUB_REF !== pins.ref ||
    !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? '') || env.QA_ENABLE !== 'yes' ||
    !env.SORTEX_QA_NEON_API_KEY || !env.SORTEX_QA_DATABASE_URL ||
    (mode === '--apply' && env.SORTEX_QA_RELEASE_CONFIRM !== confirmation)) {
    fail('Portão manual QA recusado: revisão, autorização ou contexto não conferem.');
  }
  return validateDestination(env.SORTEX_QA_DATABASE_URL);
}

function readManifest(cwd) {
  const root = path.join(cwd, 'prisma/migrations');
  const entries = fs.readdirSync(root, { withFileTypes: true });
  const lock = entries.find(e => e.name === 'migration_lock.toml');
  if (!lock?.isFile() || entries.some(e => e.name !== lock.name && !e.isDirectory())) {
    fail('Layout das migrações divergente.');
  }
  const manifest = entries.filter(e => e.isDirectory()).map(e => e.name).sort().map(name => {
    if (!/^\d{14}_[a-z0-9_]+$/.test(name)) fail('Nome de migração divergente.');
    const dir = path.join(root, name);
    const files = fs.readdirSync(dir, { withFileTypes: true });
    if (files.length !== 1 || files[0].name !== 'migration.sql' || !files[0].isFile()) {
      fail('Arquivos inesperados em uma migração.');
    }
    return [name, sha256(fs.readFileSync(path.join(dir, 'migration.sql')))];
  });
  if (manifest.length !== 22 || JSON.stringify(manifest[21]) !== JSON.stringify([pins.migration, pins.digest]) ||
    sha256(JSON.stringify(manifest.slice(0, 21))) !== pins.first21 ||
    sha256(JSON.stringify(manifest)) !== pins.all22) {
    fail('Manifesto de migração difere do ensaio revisado.');
  }
  return manifest;
}

function validateCheckout(candidateRoot, workflowRoot, env) {
  const git = (root, argv) => execFileSync('git', argv, {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10000,
  }).trim();
  if (git(candidateRoot, ['rev-parse', 'HEAD']) !== pins.candidateSha ||
    git(workflowRoot, ['rev-parse', 'HEAD']) !== env.GITHUB_SHA ||
    git(candidateRoot, ['status', '--porcelain', '--untracked-files=no']) ||
    git(workflowRoot, ['status', '--porcelain', '--untracked-files=no'])) {
    fail('Checkouts verificados de código candidato e do fluxo não conferem.');
  }
  git(workflowRoot, ['merge-base', '--is-ancestor', pins.candidateSha, env.GITHUB_SHA]);
  for (const dir of [candidateRoot, path.join(candidateRoot, 'services/api')]) {
    for (const basename of ['.env', '.env.local', '.env.production', '.env.staging']) {
      if (fs.existsSync(path.join(dir, basename))) fail('Arquivo de ambiente local inesperado.');
    }
  }
}

async function databaseState(client, manifest, expected) {
  const identity = (await client.query(
    "SELECT current_database() AS name, current_schema() AS schema, pg_is_in_recovery() AS recovery",
  )).rows[0];
  if (identity?.name !== 'neondb' || identity.schema !== 'public' || identity.recovery !== false) {
    fail('O banco/schema QA gravável não foi confirmado.');
  }
  const rows = (await client.query(
    'SELECT migration_name, checksum, (finished_at IS NOT NULL AND rolled_back_at IS NULL) AS complete FROM public._prisma_migrations ORDER BY migration_name',
  )).rows;
  if (rows.length !== expected || rows.some((row, i) =>
    row.migration_name !== manifest[i]?.[0] || row.checksum !== manifest[i]?.[1] || row.complete !== true)) {
    fail('Histórico de migrações inesperado; consultar antes de qualquer nova execução.');
  }
  const columns = (await client.query(
    "SELECT data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='Campaign' AND column_name='drawTimeZone'",
  )).rows;
  if (expected === 21 ? columns.length !== 0 : columns.length !== 1 ||
    columns[0].data_type !== 'text' || columns[0].is_nullable !== 'YES' || columns[0].column_default !== null) {
    fail('Coluna de sorteio não corresponde ao estado esperado.');
  }
  return { migrations: expected, checksum: expected === 21 ? pins.first21 : pins.all22 };
}

async function dbPreflight(client) {
  await client.query('BEGIN');
  try {
    await client.query('LOCK TABLE public."Campaign" IN ACCESS EXCLUSIVE MODE NOWAIT');
  } finally {
    await client.query('ROLLBACK');
  }
}

async function promote({ mode, manifest, client, assertRuntime, deploy, migrate }) {
  // Session lock serializes cooperating release operators. Prisma independently
  // owns its own migration lock. The protected workflow must use the existing
  // bootstrap concurrency group; no out-of-band writers during the window.
  const lock = (await client.query(
    'SELECT pg_try_advisory_lock(88641421, 20261126) AS granted',
  )).rows[0]?.granted;
  if (lock !== true) fail('Já existe uma operação QA concorrente.');
  let stage = 'base-ready';
  try {
    await assertRuntime(pins.baseSha);
    const before = await databaseState(client, manifest, 21);
    if (mode === '--plan') return { stage: 'read-only', ...before };
    stage = 'table-lock-preflight';
    await dbPreflight(client);
    stage = 'schema-change';
    await migrate();
    stage = 'verify-schema';
    const after = await databaseState(client, manifest, 22);
    stage = 'verify-old-runtime';
    await assertRuntime(pins.baseSha);
    stage = 'promote-code';
    const deployment = await deploy();
    if (deployment.unchanged || !Number.isSafeInteger(deployment.id) ||
      deployment.id <= Number(pins.deployment)) fail('Deployment novo não confirmado.');
    stage = 'verify-new-runtime';
    await assertRuntime(pins.candidateSha);
    await databaseState(client, manifest, 22);
    return { stage: 'candidate-verified', ...after, deployment: deployment.id };
  } catch {
    // Neither catch nor caller retries a read/write or prints the DB/provider
    // error containing possible connection values. A post-write state needs
    // reconciliation, even when the error was only a timeout.
    fail('Operação QA parada em ' + stage + '; não repita sem reconciliar o estado.');
  } finally {
    await client.query('SELECT pg_advisory_unlock(88641421, 20261126)').catch(() => {});
  }
}

function applyPrisma(cwd, databaseUrl) {
  const result = spawnSync(process.execPath, [
    path.join(cwd, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy',
  ], {
    cwd, timeout: 60000, killSignal: 'SIGKILL', stdio: 'ignore',
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      LANG: 'C.UTF-8',
      CI: 'true',
      DATABASE_URL: databaseUrl,
    },
  });
  if (result.status !== 0) fail('Migração Prisma sem confirmação.');
}

async function assertRuntimeHttp(revision, request = fetch) {
  const promises = ['/health', '/health/ready', '/public/campaigns'].map(async path => {
    const response = await request(pins.origin + path, {
      redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) fail('Leitura HTTP da API QA falhou.');
    return response.json();
  });
  const [health, ready, campaigns] = await Promise.all(promises);
  if (health.status !== 'ok' || health.version !== revision || ready.status !== 'ready' ||
    ready.database !== 'up' || ready.storage !== 'up' || !Array.isArray(campaigns)) {
    fail('Revisão, prontidão ou leitura de campanhas não confirmada.');
  }
}

async function main() {
  if (process.argv.length !== 4) fail('Uso: node scripts/release-draw-window-qa.cjs --plan|--apply /checkout/candidata');
  const [mode, checkout] = process.argv.slice(2);
  const env = process.env;
  const databaseUrl = validateInvocation(mode, env);
  const candidateRoot = fs.realpathSync(checkout);
  validateCheckout(candidateRoot, path.resolve(__dirname, '../../..'), env);
  const cwd = path.join(candidateRoot, 'services/api');
  const manifest = readManifest(cwd);
  const zip = fs.readFileSync(path.join(cwd, 'dist/neon/sortex-api.zip'));
  if (zip.length < 4 || zip.length > 10 * 1024 * 1024 || zip[0] !== 0x50 || zip[1] !== 0x4b)
    fail('Pacote inexistente ou fora dos limites.');
  const run = revision => rollout({
    env: { ...env, SORTEX_QA_BASE_SHA: pins.baseSha, SORTEX_QA_BASE_DEPLOYMENT: pins.deployment,
      SORTEX_QA_CODE_SHA: revision, SORTEX_QA_EXPECTED_STORAGE: 'private-neon-s3' },
    load: async () => zip,
  });
  // Validate the provider's project/branch/storage and the active and current
  // deploy IDs without writes before initiating a database connection.
  await run(pins.baseSha);
  const { Client } = require(require.resolve('pg', { paths: [cwd] }));
  const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 12000, query_timeout: 15000 });
  client.on('error', () => {});
  try {
    await client.connect();
    const result = await promote({
      mode, manifest, client,
      assertRuntime: async revision => {
        if (revision === pins.baseSha) await run(revision); // baseline path is a verified no-op
        await assertRuntimeHttp(revision);
      },
      migrate: () => applyPrisma(cwd, databaseUrl),
      deploy: () => run(pins.candidateSha),
    });
    // Only immutable IDs/digests and aggregate status. Never print row bodies.
    console.log(JSON.stringify({ ...result, release: pins.candidateSha, base: pins.baseSha, package: sha256(zip) }));
  } finally {
    await client.end();
  }
}

if (require.main === module) main().catch(error => {
  const message = /^(Operação QA parada em [a-z-]+; não repita sem reconciliar o estado\.|Portão manual QA recusado: revisão, autorização ou contexto não conferem\.)$/
    .test(error?.message) ? error.message : 'Portão manual QA recusado. Nada deve ser repetido sem conferir o estado.';
  console.error(message);
  process.exitCode = 1;
});

module.exports = { pins, confirmation, validateInvocation, readManifest, validateCheckout,
  databaseState, promote, dbPreflight, applyPrisma, assertRuntimeHttp };
