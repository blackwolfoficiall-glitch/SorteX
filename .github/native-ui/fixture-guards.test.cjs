const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawnSync } = require('node:child_process');
const { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { delimiter, join, resolve } = require('node:path');

const fixture = resolve(__dirname, 'fixture.cjs');
const build = resolve(__dirname, 'run-ios.sh');
const pg = 'postgresql://sortex_ios_ui:' + 'a'.repeat(48) + '@127.0.0.1:55478/sortex_ios_ui';
for (const [name, url] of [
  ['remote host', pg.replace('127.0.0.1', 'example.test')],
  ['unexpected port', pg.replace('55478', '5432')],
  ['unexpected DB', pg.replace(/\/sortex_ios_ui$/, '/database')],
  ['unexpected user', pg.replace('sortex_ios_ui:', 'user:')],
  ['URL overrides', pg + '?schema=other'],
]) {
  test(`fixture fails explicitly before connecting when pointed at ${name}`, () => {
    const r = spawnSync(process.execPath, [fixture, 'seed'], {
      env: { ...process.env, DATABASE_URL: url, SORTEX_IOS_UI_SCOPE: 'disposable-loopback' },
      encoding: 'utf8',
    });
    assert.match(r.stderr, /^Native UI fixture failed/);
    assert.ok(!r.stderr.includes(url));
    assert.equal(r.status, 1);
  });
}

const runner = {
  RUNNER_OS: 'macOS',
  GITHUB_REPOSITORY: 'blackwolfoficiall-glitch/SorteX',
  GITHUB_REF: 'refs/heads/homologacao/web-ios-integrada',
  GITHUB_EVENT_NAME: 'push',
  GITHUB_SHA: '0'.repeat(40),
  SORTEX_IOS_UI_SCOPE: 'disposable-loopback',
  SORTEX_IOS_UI_API: 'http://127.0.0.1:3338',
  EXPO_PUBLIC_API_URL: 'http://127.0.0.1:3338',
  EXPO_PUBLIC_ALLOW_LOCAL_API: '1',
  SORTEX_IOS_UI_BUYER_PASSWORD: 'a'.repeat(48),
  SORTEX_SIMULATOR_ID: '00000000-0000-0000-0000-000000000001',
  BASH_ENV: '',
};
for (const [name, changes, reason] of [
  ['main', { GITHUB_REF: 'refs/heads/main' }, 'execution-context'],
  ['pull_request', { GITHUB_EVENT_NAME: 'pull_request' }, 'execution-context'],
  ['other repository', { GITHUB_REPOSITORY: 'another/SorteX' }, 'execution-context'],
  ['non-macOS', { RUNNER_OS: 'Linux' }, 'execution-context'],
  ['wrong fixture scope', { SORTEX_IOS_UI_SCOPE: 'hosted' }, 'fixture-scope'],
  ['remote fixture API', { SORTEX_IOS_UI_API: 'https://example.test' }, 'fixture-scope'],
  ['remote app API', { EXPO_PUBLIC_API_URL: 'https://example.test' }, 'api-destination'],
  ['absent local opt-in', { EXPO_PUBLIC_ALLOW_LOCAL_API: '' }, 'api-destination'],
  ['invalid simulator ID', { SORTEX_SIMULATOR_ID: '-'.repeat(36) }, 'synthetic-inputs'],
  ['non-synthetic password', { SORTEX_IOS_UI_BUYER_PASSWORD: '' }, 'synthetic-inputs'],
  ['absent Maestro tool', { MAESTRO_BIN: '' }, 'runner-prerequisites'],
]) {
  test(`native launcher rejects ${name} before executing build or simulator tools`, (t) => {
    const dir = mkdtempSync(join(tmpdir(), 'sortex-native-guard-'));
    t.after(() => rmSync(dir, { force: true, recursive: true }));
    const trace = join(dir, 'tools-invoked');
    const evidence = join(dir, 'sortex-native-ui-evidence');
    const bin = join(dir, 'bin');
    mkdirSync(bin);
    for (const tool of ['xcrun', 'pod', 'plutil', 'maestro']) {
      writeFileSync(join(bin, tool), `#!/bin/sh
printf '%s\n' "${tool}" >> "$SORTEX_TEST_TRACE"
exit 90
`, { mode: 0o700 });
    }
    const r = spawnSync('bash', [build], {
      env: {
        ...process.env,
        ...runner,
        PATH: bin + delimiter + process.env.PATH,
        RUNNER_TEMP: dir,
        MAESTRO_BIN: join(bin, 'maestro'),
        SORTEX_TEST_TRACE: trace,
        ...changes,
      },
      encoding: 'utf8',
    });
    assert.ifError(r.error);
    assert.equal(r.status, 64);
    assert.ok(r.stderr.split(/\r?\n/).includes(`Native UI launcher refused: ${reason}`));
    assert.doesNotMatch(r.stdout, /::add-mask::/);
    assert.equal(existsSync(trace), false);
    assert.equal(existsSync(evidence), false);
  });
}
