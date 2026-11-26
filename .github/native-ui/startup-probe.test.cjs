const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const {
  existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const { delimiter, join, resolve } = require('node:path');
const { test } = require('node:test');

const dir = __dirname;
const probe = resolve(dir, 'startup-probe.sh');
const secretMarker = 'synthetic-password-visible-only-in-parent';

test('startup Maestro probes real login view without typing or receiving credentials', () => {
  const flow = readFileSync(resolve(dir, 'buyer-startup.yaml'), 'utf8');
  assert.match(flow, /extendedWaitUntil:\s+visible:\s+id: sortex-login-submit\s+text: "Entrar com e-mail"/);
  assert.match(flow, /id: sortex-login-email/);
  assert.match(flow, /id: sortex-login-password/);
  assert.doesNotMatch(flow, /tapOn|inputText|runScript|runFlow|BUYER_PASSWORD/);
});

for (const [label, failed, screenshotFails] of [
  ['successful probe', false, false],
  ['failed probe with screenshot', true, false],
  ['failed probe without screenshot', true, true],
]) {
  test(`${label}: only pre-credential screenshot and allowlisted status can persist`, (t) => {
    const tmp = mkdtempSync(join(tmpdir(), 'sortex-startup-probe-test-'));
    t.after(() => rmSync(tmp, { recursive: true, force: true }));
    // The startup CLI child must never receive or be passed either credential.
    writeFileSync(join(tmp, 'maestro'), `#!/bin/sh
set -eu
[ -z "\${SORTEX_IOS_UI_BUYER_PASSWORD-}" ] || exit 90
[ -z "\${BUYER_PASSWORD-}" ] || exit 91
[ -z "\${MAESTRO_CLOUD_API_KEY-}" ] || exit 92
[ "$1" = "--device" ] && [ "$3" = "test" ] && [ "$4" = "--debug-output" ] &&
  [ "$6" = "--test-output-dir" ] && [ "$#" -eq 8 ] || exit 93
case "$8" in */buyer-startup.yaml) ;; *) exit 94 ;; esac
printf 'raw-data-must-not-persist' > "$5/commands.json"
printf 'no-fixture-credentials' > "$PROBE_TRACE"
exit "$PROBE_EXIT"
`, { mode: 0o700 });
    writeFileSync(join(tmp, 'xcrun'), `#!/bin/sh
set -eu
[ -z "\${SORTEX_IOS_UI_BUYER_PASSWORD-}\${BUYER_PASSWORD-}\${MAESTRO_CLOUD_API_KEY-}" ] || exit 96
if [ "$1 $2 $4 $5" = "simctl spawn log show" ]; then
  printf 'securityd: SorteXTeste NSOSStatus code=-34018 sensitive-raw-string\n'
  exit 0
fi
[ "$1 $2 $4" = "simctl io screenshot" ] || exit 95
printf 'synthetic-pixel' > "$5"
exit "$SCREENSHOT_EXIT"
`, { mode: 0o700 });
    const trace = join(tmp, 'probe-trace');
    const r = spawnSync('bash', [probe], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: tmp + delimiter + process.env.PATH,
        BASH_ENV: '',
        MAESTRO_BIN: join(tmp, 'maestro'),
        SORTEX_SIMULATOR_ID: '00000000-0000-0000-0000-000000000001',
        RUNNER_TEMP: tmp,
        GITHUB_SHA: 'a'.repeat(40),
        SORTEX_IOS_UI_BUYER_PASSWORD: secretMarker,
        BUYER_PASSWORD: secretMarker,
        MAESTRO_CLOUD_API_KEY: secretMarker,
        PROBE_TRACE: trace,
        PROBE_EXIT: failed ? '1' : '0',
        SCREENSHOT_EXIT: screenshotFails ? '1' : '0',
      },
    });
    assert.ifError(r.error);
    assert.equal(r.status, failed ? 65 : 0);
    assert.equal(readFileSync(trace, 'utf8'), 'no-fixture-credentials');
    assert.doesNotMatch(r.stdout + r.stderr, new RegExp(secretMarker));
    assert.ok(!readdirSync(tmp).some((path) => path.startsWith('sortex-startup-debug.')));
    const output = join(tmp, 'sortex-native-startup-failure');
    if (!failed) {
      assert.equal(existsSync(output), false);
      return;
    }
    assert.deepEqual(readdirSync(output).sort(),
      screenshotFails ? ['startup.txt'] : ['startup.png', 'startup.txt']);
    assert.match(readFileSync(join(output, 'startup.txt'), 'utf8'), /stage=pre-credential-login-view-not-verified/);
    const diagnostic = readFileSync(join(output, 'startup.txt'), 'utf8');
    assert.match(diagnostic, screenshotFails ? /screenshot=unavailable/ : /screenshot=before-credential-entry/);
    assert.match(diagnostic, /keychain=missing-entitlement-observed/);
    assert.doesNotMatch(diagnostic, /sensitive-raw-string/);
  });
}

for (const [input, expected] of [
  ['securityd: AnotherApp code=-34018', 'not-observed'],
  ['securityd: SorteXTeste code=-340189', 'not-observed'],
  ['secd: br.com.sortex.development errSecInteractionNotAllowed hidden', 'interaction-not-allowed-observed'],
  ['securityd: SorteXTeste NSOSStatus Code=-34018 private event data', 'missing-entitlement-observed'],
]) {
  test(`Keychain diagnostic emits only the expected category: ${expected}`, () => {
    const result = spawnSync(process.execPath, [resolve(dir, 'keychain-status.cjs')], {
      encoding: 'utf8', input,
    });
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), expected);
  });
}
