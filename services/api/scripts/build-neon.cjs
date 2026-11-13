// Build the existing compiled Nest app for Neon's Node 24/linux-arm64 runtime.
// Output contains code only. Deployment secrets are supplied separately.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { nodeFileTrace } = require('@vercel/nft');
const { zipSync } = require('fflate');

async function main() {
  const base = path.resolve(__dirname, '..');
  process.chdir(base);
  const entry = 'dist/src/neon-handler.js';
  if (!fs.existsSync(entry)) throw new Error('Execute npm run build primeiro.');
  const cache = path.join(base, 'node_modules', '.cache');
  fs.mkdirSync(cache, { recursive: true });
  const temporary = fs.mkdtempSync(path.join(cache, 'sortex-neon-build-'));
  const client = path.join(temporary, 'client');
  const schema = fs
    .readFileSync('prisma/schema.prisma', 'utf8')
    .replace(
      /generator client \{[\s\S]*?\n\}/,
      `generator client {\n provider = "prisma-client-js"\n engineType = "client"\n output = ${JSON.stringify(client)}\n}`,
    );
  const schemaPath = path.join(temporary, 'schema.prisma');
  fs.writeFileSync(schemaPath, schema);
  const result = spawnSync(
    process.execPath,
    ['node_modules/prisma/build/index.js', 'generate', '--schema', schemaPath],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL:
          process.env.DATABASE_URL ||
          'postgresql://validation:validation@127.0.0.1:5432/sortex_build',
      },
    },
  );
  if (result.status !== 0) throw new Error('Geração ARM64 do Prisma falhou.');
  const traced = await nodeFileTrace([entry], { base, processCwd: base });
  const armClient = await nodeFileTrace([path.join(client, 'index.js')], {
    base: client,
    processCwd: client,
  });
  const files = {};
  function add(name, source) {
    const stat = fs.statSync(source);
    if (stat.isFile()) files[name] = new Uint8Array(fs.readFileSync(source));
  }
  for (const name of traced.fileList) {
    if (name.startsWith('node_modules/.prisma/client/')) continue;
    if (name.startsWith('node_modules/bcrypt/prebuilds/')) continue;
    add(name, path.join(base, name));
  }
  for (const name of armClient.fileList) {
    if (name.startsWith('../') || path.isAbsolute(name))
      throw new Error('Dependência ARM64 fora do pacote.');
    add(`node_modules/.prisma/client/${name}`, path.join(client, name));
  }
  for (const name of fs.readdirSync(client)) {
    if (name.startsWith('query_compiler_') || name === 'default.js')
      add(`node_modules/.prisma/client/${name}`, path.join(client, name));
  }
  const binding = 'node_modules/bcrypt/prebuilds/linux-arm64/bcrypt.glibc.node';
  add(binding, path.join(base, binding));
  files['index.mjs'] = new TextEncoder().encode(
    `import entry from './dist/src/neon-handler.js';\nexport default entry.default ?? entry;\n`,
  );
  const bytes = Object.values(files).reduce(
    (sum, data) => sum + data.length,
    0,
  );
  if (Object.keys(files).length > 4096 || bytes > 64 * 1024 * 1024)
    throw new Error('Pacote excede os limites gratuitos do runtime.');
  if (!files['node_modules/.prisma/client/query_compiler_bg.wasm'])
    throw new Error('Compilador Prisma JavaScript ausente.');
  const zip = zipSync(files, { level: 9 });
  if (zip.length > 10 * 1024 * 1024)
    throw new Error('ZIP excede o limite de 10 MiB.');
  fs.mkdirSync('dist/neon', { recursive: true });
  fs.writeFileSync('dist/neon/sortex-api.zip', zip);
  console.log(
    JSON.stringify({
      files: Object.keys(files).length,
      uncompressedBytes: bytes,
      zipBytes: zip.length,
      output: 'dist/neon/sortex-api.zip',
    }),
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
