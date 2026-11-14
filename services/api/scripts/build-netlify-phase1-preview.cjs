// Local packaging only. Does not create a service, connect to a DB or deploy.
const fs = require('node:fs');
const path = require('node:path');
const { unzipSync } = require('fflate');
function prepare(webRoot, zipFile = path.resolve(__dirname, '../dist/neon/sortex-api.zip')) {
  const root = path.resolve(webRoot);
  const runtime = path.join(root, '.sortex-preview-runtime');
  const entry = path.join(root, 'netlify/functions/sortex-api.mjs');
  if (fs.existsSync(runtime) || fs.existsSync(entry)) throw new Error('Preview output already exists; preserve it and use a new isolated checkout.');
  const files = unzipSync(fs.readFileSync(zipFile));
  for (const name of Object.keys(files)) if (path.isAbsolute(name) || name.split('/').includes('..') || /(^|\/)\.env($|\.)/.test(name)) throw new Error('Unsafe runtime artifact path.');
  fs.mkdirSync(runtime, { recursive: true });
  for (const [name, bytes] of Object.entries(files)) {
    const target = path.join(runtime, name); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes);
  }
  fs.mkdirSync(path.dirname(entry), { recursive: true });
  fs.copyFileSync(path.resolve(__dirname, '../infra/netlify-preview/sortex-api.mjs'), entry);
  console.log(`Prepared the unchanged NestJS runtime (${Object.keys(files).length} files) outside the public publish directory.`);
}
module.exports = { prepare };
if (require.main === module) {
  if (!process.argv[2]) throw new Error('Provide the web directory of a NEW isolated preview checkout.');
  prepare(process.argv[2]);
}
