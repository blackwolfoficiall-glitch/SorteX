import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { installPhysicalQaRelease } from './iphone-release.mjs';
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
  assert.throws(() => assertQaRelease('homologacao/web-ios-integrada', false, { BUNDLE_COMMAND: 'start' }), /empacotamento/);
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
  assert.throws(() => ensureDevice([{ ...device, operatingSystemVersion: '16.7.2 (20H115)' }], udid), /iOS 17/);
  assert.doesNotThrow(() => ensureDevice([{ ...device, operatingSystemVersion: '17.6 (21G80)' }], udid));
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
  assert.equal(hasReleaseEnvOverride('export ENTRY_FILE=index.debug.js'), true);
});

const appId = 'br.com.sortex.development';

function simulatePhysical(overrides = {}) {
  const commands = [];
  const bundle = 'synthetic iOS bundle: ' + (overrides.url ?? qa);
  let work;
  function run(command, args) {
    commands.push([command, ...args]);
    const derived = args[args.indexOf('-derivedDataPath') + 1];
    work = path.dirname(derived);
    if (overrides.buildFailure) throw new Error('synthetic build failure');
    const product = path.join(derived, 'Build/Products/Release-iphoneos/SorteXTeste.app');
    mkdirSync(product, { recursive: true });
    if (!overrides.missingBundle) writeFileSync(path.join(product, 'main.jsbundle'), bundle);
    if (!overrides.missingProfile) writeFileSync(path.join(product, 'embedded.mobileprovision'), 'synthetic fixture');
  }
  function capture(command, args, options) {
    commands.push([command, ...args]);
    let stdout = '';
    if (command.endsWith('/plutil')) {
      stdout = {
        CFBundleIdentifier: overrides.manifestId ?? appId,
        CFBundleVersion: '17',
        DTPlatformName: overrides.platform ?? 'iphoneos',
        'get-task-allow': overrides.productionSignature ? 'false' : 'true',
      }[args[1]];
      if (args[1] === 'get-task-allow') assert.equal(options.input, 'synthetic entitlements');
    }
    if (command.endsWith('/codesign') && args[0] === '--display') stdout = 'synthetic entitlements';
    if (args[0] === 'devicectl' && args[1] === 'device') {
      const install = args[2] === 'install';
      const result = install
        ? { installedApplications: [{ bundleID: overrides.receiptId ?? appId }] }
        : { process: { processIdentifier: overrides.launchFailed ? 0 : 123 } };
      writeFileSync(args.at(-1), JSON.stringify({ info: { outcome: 'success' }, result }));
    }
    return { status: 0, stdout };
  }
  return {
    commands,
    bundle,
    work: () => work,
    start: () => installPhysicalQaRelease({ workspace: '/local/SorteXTeste.xcworkspace', udid, api: qa, run, capture }),
  };
}

test('physical Release validates the bundle and launches only by the verified dev bundle ID', () => {
  const device = simulatePhysical();
  assert.deepEqual(device.start(), {
    bundleId: appId, build: '17',
    bundleSha256: createHash('sha256').update(device.bundle).digest('hex'),
  });
  const [find, build] = device.commands;
  const [install, launch] = device.commands.slice(-2);
  assert.deepEqual(find, ['xcrun', '--find', 'devicectl']);
  assert.deepEqual(build.slice(0, -3), [
    'xcrun', 'xcodebuild', '-workspace', '/local/SorteXTeste.xcworkspace', '-scheme',
    'SorteXTeste', '-configuration', 'Release', '-sdk', 'iphoneos', '-destination', `id=${udid}`,
  ]);
  assert.deepEqual(install.slice(0, 7), ['xcrun', 'devicectl', 'device', 'install', 'app', '--device', udid]);
  assert.deepEqual(launch.slice(0, -2), ['xcrun', 'devicectl', 'device', 'process', 'launch', '--device', udid, appId]);
  assert.equal(device.commands.flat().some((arg) => /openurl|expo|8081|allowProvisioning|license|archive/i.test(arg)), false);
  assert.equal(existsSync(device.work()), false);
});

test('physical Release never installs after local validation or signing failure', () => {
  for (const [overrides, message] of [
    [{ missingBundle: true }, /sem main.jsbundle/],
    [{ url: 'https://wrong.example.test' }, /API QA/],
    [{ manifestId: 'br.com.sortex.production' }, /app de desenvolvimento/],
    [{ platform: 'iphonesimulator' }, /app de desenvolvimento/],
    [{ missingProfile: true }, /assinatura local/],
    [{ productionSignature: true }, /assinatura local/],
    [{ buildFailure: true }, /Personal Team/],
  ]) {
    const device = simulatePhysical(overrides);
    assert.throws(device.start, message);
    assert.ok(device.commands.every((args) => args[2] !== 'device'));
    assert.equal(existsSync(device.work()), false);
  }
});

test('physical Release requires matching device install receipt and launch confirmation', () => {
  const badReceipt = simulatePhysical({ receiptId: 'br.com.sortex.production' });
  assert.throws(badReceipt.start, /recibo da instalação/);
  assert.equal(badReceipt.commands.at(-1)[3], 'install');
  const badLaunch = simulatePhysical({ launchFailed: true });
  assert.throws(badLaunch.start, /não retornou o processo/);
  assert.equal(badLaunch.commands.at(-1)[3], 'process');
  assert.equal(existsSync(badLaunch.work()), false);
});
