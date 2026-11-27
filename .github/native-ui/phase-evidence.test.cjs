const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawnSync } = require('node:child_process');
const {
  existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { maestroStatus, apiObservation } = require('./login-failure-status.cjs');
const { observeLogin } = require('./login-input.cjs');
const { EventEmitter } = require('node:events');

const source = (file) => readFileSync(resolve(__dirname, file), 'utf8');
const credential = 'd'.repeat(48);
const otherSecrets = 'must-not-escape-the-fixture';
const sha = 'b'.repeat(40);
const phases = {
  login: 'buyer-session.yaml',
  campaign: 'buyer-campaign.yaml',
  'signed-in-relaunch': 'buyer-signed-in-relaunch.yaml',
  logout: 'buyer-logout.yaml',
  'signed-out-relaunch': 'buyer-signed-out-relaunch.yaml',
};
const checkpointFile = 'sortex-native-ui-checkpoint';
const workflow = source('../workflows/mobile-native-ui.yml');
const block = workflow.match(/name: Guardar etapa da falha sem expor dados do cenário[\s\S]*?run: \|\n((?: {10}[^\n]*\n)+)/);
assert.ok(block);
const report = block[1].replace(/^ {10}/gm, '');
const workflowOutcomes = Object.fromEntries(
  ['CHECKOUT', 'NODE', 'JAVA', 'GUARDS', 'TOOLS', 'MAESTRO_PREFLIGHT', 'API', 'APP', 'SIMULATOR', 'SCENARIO', 'EVIDENCE']
    .map((phase) => [phase + '_OUTCOME', 'success']),
);

function tmp(t) {
  const dir = mkdtempSync(join(tmpdir(), 'sortex-phase-evidence-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('the strict split flows retain every interaction and explicit process relaunch', () => {
  const files = Object.values(phases).map(source);
  files.forEach((flow) => {
    assert.match(flow, /^appId: br\.com\.sortex\.development\n/);
    assert.doesNotMatch(flow, /optional:|point:|clear(?:State|Keychain):/);
  });
  files.slice(1).forEach((flow) => assert.doesNotMatch(flow, /inputText|BUYER_PASSWORD/));
  assert.doesNotMatch(files[0], /launchApp|stopApp/);
  assert.match(files[0], /sortex-login-email[\s\S]*sortex-login-password[\s\S]*BUYER_PASSWORD[\s\S]*sortex-login-submit[\s\S]*Olá, CompradorIOS/);
  assert.match(files[1], /stopApp: false[\s\S]*Campanhas[\s\S]*Campanha sintetica iOS[\s\S]*Ver campanha[\s\S]*Prêmio: Premio sintetico iOS[\s\S]*Regulamento sintetico da campanha iOS/);
  assert.match(files[2], /stopApp: br\.com\.sortex\.development\n- launchApp\n[\s\S]*Olá, CompradorIOS[\s\S]*assertNotVisible:[\s\S]*sortex-login-email/);
  assert.match(files[3], /stopApp: false[\s\S]*Perfil[\s\S]*tapOn: "Sair da conta"\n[\s\S]*sortex-login-email/);
  assert.match(files[4], /stopApp: br\.com\.sortex\.development\n- launchApp\n[\s\S]*sortex-login-email[\s\S]*assertNotVisible: "Olá, CompradorIOS"/);
  assert.match(source('run-ios.sh'), /for phase in login campaign signed-in-relaunch logout signed-out-relaunch; do\n[^\n]*run-buyer-phase\.sh[^\n]*\|\| refuse[^\n]*\n\s*checkpoint "\$\{phase\}-verified"/);
  assert.match(source('with-fixture.sh'), /"\$@"\n[^\n]*fixture\.cjs" verify[^\n]*\ncheckpoint server-verification-complete/);
});

for (const [phase, filename] of Object.entries(phases)) {
  test(`Maestro ${phase}: correct flow, segregated inputs, no transcript or screenshots retained`, (t) => {
    const dir = tmp(t);
    const maestro = join(dir, 'maestro');
    writeFileSync(maestro, `#!/bin/bash
set -eu
[ -z "\${SORTEX_IOS_UI_BUYER_PASSWORD-}\${BUYER_PASSWORD-}\${MAESTRO_CLOUD_API_KEY-}" ] || exit 61
[ "$MAESTRO_API_URL" = http://127.0.0.1:1 ] || exit 67
[ "$1" = "--no-ansi" ] && [ "$2" = "--device" ] && [ "$4" = "test" ] &&
[ "$5" = "--debug-output" ] && [ "$7" = "--test-output-dir" ] && [ "$6" = "$8" ] || exit 62
printf 'raw credential: %s\n' "$EXPECTED_CREDENTIAL" > "$6/private-screen.png"
printf 'private-metadata' > "$6/private-transcript.txt"
shift 8
if [ "$EXPECTED_PHASE" = login ]; then
  [ "$#" = 3 ] && [ "$1" = -e ] && [ "$2" = "BUYER_PASSWORD=$EXPECTED_CREDENTIAL" ] || exit 63
  shift 2
fi
[ "$#" = 1 ] && [ "\${1##*/}" = "$EXPECTED_FILE" ] || exit 65
printf 'raw password: %s\n' "$EXPECTED_CREDENTIAL"
printf 'raw authentication data: %s\n' "$EXPECTED_DATA" >&2
exit "$MAESTRO_EXIT"
`, { mode: 0o700 });
    for (const maestroExit of [0, 19]) {
      const r = spawnSync('bash', [resolve(__dirname, 'run-buyer-phase.sh'), phase], {
        env: {
          ...process.env, RUNNER_TEMP: dir, MAESTRO_BIN: maestro,
          SORTEX_SIMULATOR_ID: '00000000-0000-0000-0000-000000000001',
          SORTEX_IOS_UI_BUYER_PASSWORD: credential, BUYER_PASSWORD: otherSecrets,
          MAESTRO_CLOUD_API_KEY: otherSecrets, EXPECTED_CREDENTIAL: credential,
          MAESTRO_API_URL: 'https://should-not-reach.invalid',
          EXPECTED_DATA: otherSecrets, EXPECTED_PHASE: phase, EXPECTED_FILE: filename,
          MAESTRO_EXIT: String(maestroExit), BASH_ENV: '', SORTEX_IOS_UI_CHECKPOINTS: '0',
        }, encoding: 'utf8',
      });
      assert.ifError(r.error);
      assert.equal(r.status, maestroExit);
      assert.equal(r.stdout + r.stderr, '');
      assert.deepEqual(readdirSync(dir), ['maestro']);
    }
  });
}

test('immutable failure summary works even before checkout and ignores unknown values', (t) => {
  const dir = tmp(t);
  const scenarios = [
    { step: 'checkout', outcomes: { CHECKOUT_OUTCOME: 'failure' }, phase: '', last: 'none' },
    { step: 'tools', outcomes: { TOOLS_OUTCOME: 'failure' }, phase: '', last: 'none' },
    { step: 'maestro-preflight', outcomes: { MAESTRO_PREFLIGHT_OUTCOME: 'failure' }, phase: '', last: 'none' },
    { step: 'evidence-upload', outcomes: { EVIDENCE_OUTCOME: 'failure' }, phase: 'server-verification-complete\n', last: 'server-verification-complete' },
    { step: 'scenario', outcomes: { SCENARIO_OUTCOME: 'failure' }, phase: 'fixture-entered\n', last: 'fixture-entered' },
    { step: 'scenario', outcomes: { SCENARIO_OUTCOME: 'failure' }, phase: 'campaign-verified\n' + otherSecrets, last: 'campaign-verified' },
    { step: 'scenario', outcomes: { SCENARIO_OUTCOME: 'failure' }, phase: otherSecrets + '\n', last: 'none' },
  ];
  for (const { step, outcomes, phase, last } of scenarios) {
    const checkpoint = join(dir, checkpointFile);
    if (phase) writeFileSync(checkpoint, phase);
    else rmSync(checkpoint, { force: true });
    const expected = `sha=${sha}\nfailed_step=${step}\nlast_completed=${last}\n`;
    const result = spawnSync('bash', ['-c', report], {
      env: { ...process.env, ...workflowOutcomes, ...outcomes, RUNNER_TEMP: dir, GITHUB_SHA: sha, BASH_ENV: '' },
      encoding: 'utf8', cwd: dir,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, expected);
    assert.equal(readFileSync(join(dir, 'sortex-native-ui-failure.txt'), 'utf8'), expected);
  }
});

test('login diagnostics retain no raw local API or Maestro data and preserve failure status', (t) => {
  const dir = tmp(t);
  const api = join(dir, 'private-api.log');
  const maestro = join(dir, 'maestro');
  writeFileSync(api, [
    JSON.stringify({ method: 'GET', path: '/auth/login', status: 418 }),
    JSON.stringify({ method: 'POST', path: '/auth/login/other', status: 429 }),
    JSON.stringify({ method: 'POST', path: '/auth/login', status: 201, password: credential }),
    JSON.stringify({ event: 'sortex-ios-fixture-login-shape', input: 'matches', status: 201, password: credential }),
  ].join('\n'));
  writeFileSync(maestro, `#!/bin/bash
set -eu
printf '%s\n' "$EXPECTED_CREDENTIAL" > "$6/private-screen.png"
printf 'tapOn sortex-login-email passed\nAssertion is false: Olá, CompradorIOS\n%s\n' "$EXPECTED_CREDENTIAL" >&2
exit 25
`, { mode: 0o700 });
  const result = spawnSync('bash', [resolve(__dirname, 'run-buyer-phase.sh'), 'login'], {
    env: {
      ...process.env, RUNNER_TEMP: dir, MAESTRO_BIN: maestro, BASH_ENV: '',
      SORTEX_SIMULATOR_ID: '00000000-0000-0000-0000-000000000001',
      SORTEX_IOS_UI_CHECKPOINTS: '1', SORTEX_IOS_UI_BUYER_PASSWORD: credential,
      SORTEX_IOS_UI_API_LOG: api, EXPECTED_CREDENTIAL: credential,
    }, encoding: 'utf8',
  });
  assert.ifError(result.error);
  assert.equal(result.status, 25);
  assert.equal(result.stdout + result.stderr, '');
  assert.deepEqual(readdirSync(dir), ['maestro', 'private-api.log', 'sortex-native-ui-login-diagnostic']);
  assert.equal(readFileSync(join(dir, 'sortex-native-ui-login-diagnostic'), 'utf8'), 'login_cli=signed-in-view\nlogin_api=2xx\nlogin_input=matches\n');
});

test('login diagnostic reports only exact route, input category and status class', () => {
  assert.equal(maestroStatus("Couldn't hide the keyboard.\n" + otherSecrets), 'keyboard-dismiss-failed');
  assert.equal(maestroStatus('iOS driver not ready in time'), 'driver');
  assert.equal(maestroStatus('Assertion is false: id sortex-login-email and text "^sortex-ios-ui@example.test$"'), 'email-value');
  assert.equal(maestroStatus('Element not found: id: sortex-login-password'), 'password-control');
  assert.equal(maestroStatus('sortex-login-email passed\n' + otherSecrets), 'unclassified');
  assert.deepEqual(apiObservation(null), { status: 'unknown', input: 'unknown' });
  assert.deepEqual(apiObservation('{"method":"POST","path":"/auth/login?other","status":201}'), { status: 'not-seen', input: 'not-seen' });
  for (const [status, label] of [[400, '400-validation'], [401, '401-unauthorized'], [403, '403-forbidden'], [429, '429-rate-limited'], [418, '4xx-other'], [503, '5xx'], ['401', 'unknown']]) {
    const log = [
      { method: 'POST', path: '/auth/login', status: 201 },
      { method: 'POST', path: '/auth/login', status },
    ].map(JSON.stringify).join('\n');
    assert.deepEqual(apiObservation(log), { status: label, input: 'unknown' });
  }
  const log = JSON.stringify({ event: 'sortex-ios-fixture-login-shape', input: otherSecrets, status: 401 });
  assert.deepEqual(apiObservation(log), { status: '401-unauthorized', input: 'unknown' });
});

test('disposable login observer preserves request, only handles exact route, and records no field values', () => {
  const email = 'sortex-ios-ui@example.test';
  const records = [];
  const middleware = observeLogin(credential, (record) => records.push(record));
  for (const [body, input, status] of [
    [{ email, password: credential }, 'matches', 201],
    [{ email: otherSecrets, password: credential }, 'email-mismatch', 401],
    [{ email, password: otherSecrets }, 'password-mismatch', 401],
    [{ email: otherSecrets, password: otherSecrets }, 'both-mismatch', 401],
    [{ email, password: '' }, 'missing-field', 400],
  ]) {
    const req = Object.freeze({ method: 'POST', originalUrl: '/auth/login', body: Object.freeze(body) });
    const res = new EventEmitter();
    let turns = 0;
    middleware(req, res, () => { turns++; });
    assert.equal(turns, 1);
    res.statusCode = status;
    res.emit('finish');
    assert.deepEqual(records.pop(), { event: 'sortex-ios-fixture-login-shape', input, status });
  }
  for (const [method, originalUrl] of [['POST', '/auth/login?other'], ['POST', '/auth/admin-login'], ['GET', '/auth/login']]) {
    const res = new EventEmitter();
    let turns = 0;
    middleware({ method, originalUrl }, res, () => { turns++; });
    res.emit('finish');
    assert.equal(turns, 1);
    assert.equal(records.length, 0);
  }
});

test('the published phase report revalidates login categories and never forwards extra lines', (t) => {
  const dir = tmp(t);
  const run = (value) => {
    writeFileSync(join(dir, checkpointFile), 'startup-controls-verified\n');
    writeFileSync(join(dir, 'sortex-native-ui-login-diagnostic'), value);
    const result = spawnSync('bash', ['-c', report], {
      env: { ...process.env, ...workflowOutcomes, SCENARIO_OUTCOME: 'failure', RUNNER_TEMP: dir, GITHUB_SHA: sha, BASH_ENV: '' },
      encoding: 'utf8', cwd: dir,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  const base = `sha=${sha}\nfailed_step=scenario\nlast_completed=startup-controls-verified\n`;
  assert.equal(run(`login_cli=keyboard-dismiss-failed\nlogin_api=not-seen\nlogin_input=not-seen\n${otherSecrets}\n`), base + 'login_cli=keyboard-dismiss-failed\nlogin_api=not-seen\nlogin_input=not-seen\n');
  assert.equal(run(`login_cli=${otherSecrets}\nlogin_api=${credential}\n`), base);
});

test('early fixture error emits a checkpoint before requiring PostgreSQL', (t) => {
  const dir = tmp(t);
  const result = spawnSync('bash', [resolve(__dirname, 'with-fixture.sh'), 'true'], {
    env: {
      ...process.env, RUNNER_TEMP: dir, GITHUB_SHA: sha, SORTEX_IOS_UI_PG_BIN: '',
      SORTEX_IOS_UI_CHECKPOINTS: '1', BASH_ENV: '',
    },
    encoding: 'utf8',
  });
  assert.ifError(result.error);
  assert.notEqual(result.status, 0);
  assert.equal(readFileSync(join(dir, checkpointFile), 'utf8'), 'fixture-entered\n');
});

test('checkpoint refuses arbitrary values and workflow publishes only exact named files', (t) => {
  const dir = tmp(t);
  const result = spawnSync('bash', ['-c', 'source "$1"; checkpoint "$2"', 'bash', resolve(__dirname, 'checkpoint.sh'), otherSecrets], {
    env: { ...process.env, RUNNER_TEMP: dir, SORTEX_IOS_UI_CHECKPOINTS: '1', BASH_ENV: '' },
    encoding: 'utf8',
  });
  assert.ifError(result.error);
  assert.equal(result.status, 64);
  assert.equal(existsSync(join(dir, checkpointFile)), false);
  assert.doesNotMatch(result.stdout + result.stderr, new RegExp(otherSecrets));
  assert.match(workflow, /name: sortex-ios-phase-diagnostic-\$\{\{ github.sha \}\}\n\s*path: \$\{\{ runner.temp \}\}\/sortex-native-ui-failure\.txt/);
  assert.doesNotMatch(workflow, /sortex-ui-debug|\*\.log|commands\.json/);
});
