const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');

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

for (const [name, ref, api, event] of [
  ['main', 'main', 'http://127.0.0.1:3338', 'push'],
  ['pull_request', 'homologacao/web-ios-integrada', 'http://127.0.0.1:3338', 'pull_request'],
  ['remote app API', 'homologacao/web-ios-integrada', 'https://example.test', 'push'],
]) {
  test(`native launcher rejects ${name} before executing Xcode or UI tests`, () => {
    const r = spawnSync('bash', [build], {
      env: {
        ...process.env, RUNNER_OS: 'macOS', GITHUB_REPOSITORY: 'blackwolfoficiall-glitch/SorteX',
        GITHUB_REF: 'refs/heads/' + ref, GITHUB_EVENT_NAME: event,
        SORTEX_IOS_UI_SCOPE: 'disposable-loopback', SORTEX_IOS_UI_API: 'http://127.0.0.1:3338',
        EXPO_PUBLIC_API_URL: api, EXPO_PUBLIC_ALLOW_LOCAL_API: '1',
        SORTEX_IOS_UI_BUYER_PASSWORD: 'a'.repeat(48),
        SORTEX_SIMULATOR_ID: '00000000-0000-0000-0000-000000000001',
        BASH_ENV: '',
      },
      encoding: 'utf8',
    });
    assert.equal(r.status, 1);
    assert.equal(r.stdout, '');
    assert.equal(r.stderr, '');
  });
}
