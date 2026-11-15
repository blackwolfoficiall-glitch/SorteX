const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { zipSync } = require('fflate');
const { prepare } = require('./build-netlify-phase1-preview.cjs');

test('Netlify package uses x64 bcrypt and verifies existing hashes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sortex-netlify-x64-'));
  const web = path.join(root, 'web');
  prepare(web);
  const runtime = path.join(web, '.sortex-preview-runtime');
  const bcrypt = require(path.join(runtime, 'node_modules/bcrypt'));
  const original = require('bcrypt');
  const hash = original.hashSync('Synthetic-existing-hash', 4);
  assert.equal(bcrypt.compareSync('Synthetic-existing-hash', hash), true);
  assert.equal(bcrypt.compareSync('different', hash), false);
  assert.deepEqual(fs.readdirSync(path.join(runtime, 'node_modules/bcrypt/prebuilds')), ['linux-x64']);
  assert.throws(() => prepare(web), /already exists/);
});

test('unsafe archive paths and environment files are rejected before writing', () => {
  for (const name of ['../outside', '.env', 'nested/.env.local']) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sortex-netlify-unsafe-'));
    const archive = path.join(root, 'unsafe.zip');
    fs.writeFileSync(archive, zipSync({ [name]: Buffer.from('synthetic') }));
    assert.throws(() => prepare(path.join(root, 'web'), archive), /Unsafe/);
    assert.equal(fs.existsSync(path.join(root, 'web')), false);
  }
});
