import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  assertQaRelease,
  canUseNativeSnapshot,
  ensureDevice,
  hasReleaseEnvOverride,
  parseMode,
  qaIsReady,
  qaReleaseBuildEnv,
} from './iphone.mjs';

const qa = 'https://br-weathered-forest-bccwn49d-sortexqa.compute.c-16.us-east-1.aws.neon.tech';
const udid = '00000000-0000000000000000';

test('the no-Metro build requires an explicit device; legacy modes stay separate', () => {
  assert.deepEqual(parseMode(['prepare-release']), { mode: 'prepare-release' });
  assert.deepEqual(parseMode(['release', '--device', udid]), { mode: 'release', udid });
  assert.deepEqual(parseMode(['go', '--lan']), { mode: 'go', connection: '--lan' });
  assert.deepEqual(parseMode(['xcode']), { mode: 'xcode' });
  for (const args of [['release'], ['release', '--device', 'generic'], ['release', '--device', 'John’s iPhone'], ['prepare-release', '--lan']])
    assert.throws(() => parseMode(args), /Uso:/);
});

test('Release does not accept a legacy branch, dirty source or a different API', () => {
  assert.doesNotThrow(() => assertQaRelease('homologacao/web-ios-integrada', false, { EXPO_PUBLIC_API_URL: qa + '/' }));
  assert.throws(() => assertQaRelease('feat/mobile-expo', false, {}), /clone limpo/);
  assert.throws(() => assertQaRelease('homologacao/web-ios-integrada', true, {}), /clone limpo/);
  assert.throws(() => assertQaRelease('homologacao/web-ios-integrada', false, { EXPO_PUBLIC_API_URL: 'https://another.example' }), /API configurada/);
  assert.throws(() => assertQaRelease('homologacao/web-ios-integrada', false, { SKIP_BUNDLING: '1' }), /empacotamento/);
});

test('release profiles keep plain QA reservations separate from Pix', () => {
  assert.deepEqual(parseMode(['release', '--device', udid, '--profile', 'checkout-sandbox']), {
    mode: 'release', udid, profile: 'checkout-sandbox',
  });
  assert.deepEqual(parseMode(['release', '--device', udid, '--profile', 'reservations-sandbox']), {
    mode: 'release', udid, profile: 'reservations-sandbox',
  });
  for (const args of [
    ['release', '--device', udid, '--profile', 'production'],
    ['release', '--device', udid, '--profile', 'checkout-sandbox', '--lan'],
    ['prepare-release', '--profile', 'checkout-sandbox'],
    ['prepare-release', '--profile', 'reservations-sandbox'],
    ['release', '--device', udid, '--profile', 'reservations-sandbox', '--lan'],
    ['go', '--profile', 'checkout-sandbox'],
  ])
    assert.throws(() => parseMode(args), /Uso:/);
  const core = qaReleaseBuildEnv();
  const checkout = qaReleaseBuildEnv('checkout-sandbox');
  const reservations = qaReleaseBuildEnv('reservations-sandbox');
  for (const env of [core, reservations, checkout]) {
    assert.equal(env.EXPO_PUBLIC_API_URL, qa);
    assert.equal(env.EXPO_PUBLIC_ALLOW_LOCAL_API, '0');
    assert.equal(env.EXPO_NO_DOTENV, '1');
  }
  for (const key of ['EXPO_PUBLIC_ENABLE_TEST_RESERVATIONS', 'EXPO_PUBLIC_ENABLE_NATIVE_SANDBOX_PIX']) {
    assert.equal(core[key], '0');
    assert.equal(checkout[key], '1');
  }
  assert.equal(reservations.EXPO_PUBLIC_ENABLE_TEST_RESERVATIONS, '1');
  assert.equal(reservations.EXPO_PUBLIC_ENABLE_NATIVE_SANDBOX_PIX, '0');
  assert.throws(() => qaReleaseBuildEnv('production'), /Perfil Release QA inválido/);
});

test('device preflight rejects unavailable, simulator and non-iOS targets', () => {
  const device = { identifier: udid, available: true, simulator: false, platform: 'com.apple.platform.iphoneos', modelCode: 'iPhone14,8' };
  assert.doesNotThrow(() => ensureDevice([device], udid));
  for (const override of [{ available: false }, { simulator: true }, { platform: 'com.apple.platform.macosx' }, { modelCode: 'iPad8,5' }, { identifier: 'other' }])
    assert.throws(() => ensureDevice([{ ...device, ...override }], udid), /iPhone físico/);
});

test('install requires HTTP ready and an initialized QA database', () => {
  assert.equal(qaIsReady(200, { status: 'ready', database: 'up' }), true);
  assert.equal(qaIsReady(404, { status: 'ready', database: 'up' }), false);
  assert.equal(qaIsReady(200, { status: 'ready', database: 'uninitialized' }), false);
  assert.equal(qaIsReady(200, null), false);
});

test('native folder must carry the exact QA target and Git revision', () => {
  assert.equal(canUseNativeSnapshot(JSON.stringify({ api: qa, revision: 'current' }), 'current'), true);
  assert.equal(canUseNativeSnapshot(JSON.stringify({ api: qa, revision: 'stale' }), 'current'), false);
  assert.equal(canUseNativeSnapshot(JSON.stringify({ api: 'https://another.example', revision: 'current' }), 'current'), false);
  assert.equal(canUseNativeSnapshot('null', 'current'), false);
});

test('Xcode env files cannot override API selection or JS bundling', () => {
  assert.equal(hasReleaseEnvOverride('# Comment EXPO_PUBLIC_API_URL\nexport NODE_BINARY=$(command -v node)'), false);
  assert.equal(hasReleaseEnvOverride('export EXPO_PUBLIC_API_URL=another'), true);
  assert.equal(hasReleaseEnvOverride('  export SKIP_BUNDLING=1'), true);
  assert.equal(hasReleaseEnvOverride('export EXPO_NO_DOTENV=0'), true);
  assert.equal(hasReleaseEnvOverride('export EXPO_PUBLIC_ENABLE_NATIVE_SANDBOX_PIX=1'), true);
});
