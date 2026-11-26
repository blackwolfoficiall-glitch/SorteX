import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./ios-simulator-release.sh', import.meta.url));
const qaApi = 'https://qa.example.test';
const simulator = '00000000-0000-0000-0000-000000000058';

function run(t, embeddedApi) {
  const root = mkdtempSync(join(tmpdir(), 'sortex-simulator-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = join(root, 'bin');
  const temp = join(root, 'runner-temp');
  const appPath = join(temp, 'sortex-ios-simulator/Build/Products/Release-iphonesimulator/SorteXTeste.app');
  const trace = join(root, 'commands');
  mkdirSync(bin);
  mkdirSync(join(root, 'ios/SorteXTeste.xcworkspace'), { recursive: true });
  for (const name of ['pod', 'xcrun']) {
    writeFileSync(join(bin, name), `#!/usr/bin/env bash
set -eu
echo "${name} $*" >> "$TRACE"
if [[ "\${1:-}" == xcodebuild && -n "$EMBEDDED_API" ]]; then
  mkdir -p "$APP_PATH"
  printf 'synthetic test bundle: %s' "$EMBEDDED_API" > "$APP_PATH/main.jsbundle"
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
      TRACE: trace,
      APP_PATH: appPath,
      EMBEDDED_API: embeddedApi,
    },
  });
  return { result, commands: readFileSync(trace, 'utf8').trim().split('\n'), appPath };
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
