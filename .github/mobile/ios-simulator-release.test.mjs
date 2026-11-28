import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./ios-simulator-release.sh', import.meta.url));
const qaApi = 'https://qa.example.test';
const loopback = 'http://127.0.0.1:3338';
const keychain = {
  SORTEX_SIMULATOR_KEYCHAIN: '1',
  RUNNER_OS: 'macOS',
  GITHUB_REPOSITORY: 'blackwolfoficiall-glitch/SorteX',
  GITHUB_REF: 'refs/heads/homologacao/web-ios-integrada',
  GITHUB_EVENT_NAME: 'push',
  SORTEX_IOS_UI_SCOPE: 'disposable-loopback',
  EXPO_PUBLIC_ALLOW_LOCAL_API: '1',
  SORTEX_IOS_UI_API: loopback,
  EXPO_PUBLIC_API_URL: loopback,
};
const simulator = '00000000-0000-0000-0000-000000000058';

function run(t, embeddedApi, overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'sortex-simulator-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = join(root, 'bin');
  const temp = join(root, 'runner-temp');
  const appPath = join(temp, 'sortex-ios-simulator/Build/Products/Release-iphonesimulator/SorteXTeste.app');
  const trace = join(root, 'commands');
  mkdirSync(bin);
  mkdirSync(join(root, 'ios/SorteXTeste.xcworkspace'), { recursive: true });
  for (const name of ['pod', 'xcrun', 'codesign']) {
    writeFileSync(join(bin, name), `#!/usr/bin/env bash
set -eu
echo "${name} $*" >> "$TRACE"
if [[ "\${1:-}" == xcodebuild && -n "$EMBEDDED_API" ]]; then
  mkdir -p "$APP_PATH"
  printf 'synthetic test bundle: %s' "$EMBEDDED_API" > "$APP_PATH/main.jsbundle"
fi
if [[ "\${0##*/}" == codesign ]]; then
  if [[ "$1" == --verify ]]; then exit "\${VERIFY_EXIT:-0}"; fi
  echo 'Identifier=br.com.sortex.development' >&2
  printf 'Signature=%s\n' "\${SIGNATURE_KIND:-adhoc}" >&2
fi
`, { mode: 0o700 });
  }
  const result = spawnSync('bash', [script], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      RUNNER_TEMP: temp,
      SORTEX_SIMULATOR_ID: simulator,
      EXPO_PUBLIC_API_URL: qaApi,
      SORTEX_SIMULATOR_KEYCHAIN: '0',
      VERIFY_EXIT: '0',
      SIGNATURE_KIND: 'adhoc',
      ...overrides,
      TRACE: trace,
      APP_PATH: appPath,
      EMBEDDED_API: embeddedApi,
    },
  });
  return { result, commands: existsSync(trace) ? readFileSync(trace, 'utf8').trim().split('\n') : [], appPath };
}

test('QA builds Release for the selected simulator and launches the installed bundle ID', (t) => {
  const { result, commands, appPath } = run(t, qaApi);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(commands.length, 4);
  assert.equal(commands[0], 'pod install --project-directory=ios');
  assert.match(commands[1], /xcodebuild.*-scheme SorteXTeste -configuration Release -sdk iphonesimulator/);
  assert.ok(commands[1].includes(`id=${simulator}`));
  assert.match(commands[1], /CODE_SIGNING_ALLOWED=NO build$/);
  assert.equal(commands[2], `xcrun simctl install ${simulator} ${appPath}`);
  assert.equal(commands[3], `xcrun simctl launch --terminate-running-process ${simulator} br.com.sortex.development`);
  assert.ok(commands.every((command) => !/expo|openurl|8081/.test(command)));
});

for (const [name, embeddedApi] of [
  ['missing', ''],
  ['not the configured QA destination', 'https://different.example.test'],
]) {
  test(`QA never installs or launches a bundle that is ${name}`, (t) => {
    const { result, commands } = run(t, embeddedApi);
    assert.notEqual(result.status, 0);
    assert.equal(commands.length, 2);
    assert.match(commands[1], /xcodebuild/);
  });
}

test('isolated UI runner uses verified ad-hoc simulator signing before installation', (t) => {
  const { result, commands, appPath } = run(t, loopback, keychain);
  assert.equal(result.status, 0, result.stderr);
  assert.match(commands[1], /-sdk iphonesimulator.* CODE_SIGNING_ALLOWED=YES CODE_SIGNING_REQUIRED=YES CODE_SIGN_IDENTITY=- DEVELOPMENT_TEAM= PROVISIONING_PROFILE_SPECIFIER= build$/);
  assert.equal(commands[2], `codesign --verify --strict ${appPath}`);
  assert.equal(commands[3], `codesign -dv ${appPath}`);
  assert.equal(commands[4], `xcrun simctl install ${simulator} ${appPath}`);
});

for (const [setting, value] of [
  ['RUNNER_OS', 'Linux'], ['GITHUB_REPOSITORY', 'other/SorteX'], ['GITHUB_REF', 'refs/heads/main'],
  ['GITHUB_EVENT_NAME', 'pull_request'], ['SORTEX_IOS_UI_SCOPE', 'another'],
  ['EXPO_PUBLIC_API_URL', qaApi], ['SORTEX_IOS_UI_API', qaApi],
  ['EXPO_PUBLIC_ALLOW_LOCAL_API', '0'], ['SORTEX_SIMULATOR_KEYCHAIN', 'bad'],
]) {
  test(`the Keychain mode fails before all tools when ${setting} is out of scope`, (t) => {
    const { result, commands } = run(t, loopback, { ...keychain, [setting]: value });
    assert.equal(result.status, 64, result.stderr);
    assert.deepEqual(commands, []);
  });
}

for (const overrides of [{ VERIFY_EXIT: '1' }, { SIGNATURE_KIND: 'other' }]) {
  test(`invalid simulator signature ${JSON.stringify(overrides)} cannot be installed`, (t) => {
    const { result, commands } = run(t, loopback, { ...keychain, ...overrides });
    assert.equal(result.status, 64, result.stderr);
    assert.ok(commands.some((command) => command.startsWith('codesign --verify --strict ')));
    assert.ok(!commands.some((command) => command.includes('simctl install')));
  });
}
