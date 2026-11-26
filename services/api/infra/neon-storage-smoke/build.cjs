/* Offline package: include the existing object-storage adapter and AWS SDK dependencies. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { nodeFileTrace } = require('@vercel/nft');
const { zipSync } = require('fflate');

async function build() {
  const base = path.resolve(__dirname, '../..');
  const entry = 'infra/neon-storage-smoke/handler.mjs';
  const { fileList } = await nodeFileTrace([path.join(base, entry)], {
    base,
    processCwd: base,
  });
  if (!fileList.has('dist/src/organizers/object-storage.js'))
    throw Error('Compile a API antes do smoke.');
  const files = {
    'index.mjs': Buffer.from(`export { default } from './${entry}';\n`),
  };
  let total = files['index.mjs'].length;
  for (const file of fileList) {
    if (
      file !== entry &&
      file !== 'dist/src/organizers/object-storage.js' &&
      file !== 'package.json' &&
      !file.startsWith('node_modules/')
    )
      throw Error('Arquivo inesperado.');
    if (
      file.split('/').some((part) => part === '..' || part.startsWith('.env'))
    )
      throw Error('Arquivo recusado.');
    const source = path.join(base, file);
    if (!fs.statSync(source).isFile()) continue;
    files[file] = fs.readFileSync(source);
    total += files[file].length;
  }
  if (total > 64 * 1024 * 1024 || Object.keys(files).length > 4096)
    throw Error('Pacote fora dos limites.');
  const zip = zipSync(files, { level: 9 });
  if (zip.length > 10 * 1024 * 1024) throw Error('Pacote fora dos limites.');
  fs.mkdirSync(path.join(base, 'dist/neon'), { recursive: true });
  fs.writeFileSync(path.join(base, 'dist/neon/sortex-storage-smoke.zip'), zip);
  console.log(
    'Bundle isolado verificado:',
    Object.keys(files).length,
    'arquivos.',
  );
}
build().catch(() => {
  console.error('Pacote do smoke não pôde ser verificado.');
  process.exitCode = 1;
});
