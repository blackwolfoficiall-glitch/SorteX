#!/usr/bin/env node
/** Local, interactive launcher. No server credentials, signing bypass or paid build. */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { installPhysicalQaRelease } from './iphone-release.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const app = path.join(root, 'apps/mobile');
const phase1Api = 'https://sortex-fase1-review.netlify.app/.netlify/functions/sortex-api';
const qaApi = 'https://br-weathered-forest-bccwn49d-sortexqa.compute.c-16.us-east-1.aws.neon.tech';
const usage = 'Uso: node .github/mobile/iphone.mjs check | go [--tunnel|--lan] | xcode | prepare-release | release --device <UDID> [--profile reservations-sandbox|checkout-sandbox]';
const qaBranch = 'homologacao/web-ios-integrada';
const optionalProfiles = ['reservations-sandbox', 'checkout-sandbox'];
const customBundleKeys = ['SKIP_BUNDLING', 'FORCE_BUNDLING', 'BUNDLE_COMMAND', 'ENTRY_FILE', 'CLI_PATH'];
const releaseEnvKeys = new RegExp(`\\b(?:EXPO_PUBLIC_\\w+|EXPO_NO_DOTENV|${customBundleKeys.join('|')})\\b`);
export function parseMode(args) {
  const [mode = 'go', flag, value, ...rest] = args;
  if (mode === 'release' && flag === '--device' &&
      /^(?:[a-f0-9]{8}-[a-f0-9]{16}|[a-f0-9]{40})$/i.test(value ?? '')) {
    if (rest.length === 0) return { mode, udid: value };
    if (rest.length === 2 && rest[0] === '--profile' && optionalProfiles.includes(rest[1]))
      return { mode, udid: value, profile: rest[1] };
    fail(usage);
  }
  if (rest.length) fail(usage);
  if (mode === 'go' && value === undefined && [undefined, '--lan', '--tunnel'].includes(flag))
    return { mode, connection: flag ?? '--tunnel' };
  if (['check', 'xcode', 'prepare-release'].includes(mode) && flag === undefined)
    return { mode };
  fail(usage);
}
export function qaReleaseBuildEnv(profile = 'core') {
  if (profile !== 'core' && !optionalProfiles.includes(profile)) fail('Perfil Release QA inválido.');
  return {
    EXPO_PUBLIC_API_URL: qaApi,
    EXPO_NO_DOTENV: '1',
    EXPO_NO_TELEMETRY: '1',
    EXPO_PUBLIC_ALLOW_LOCAL_API: '0',
    EXPO_PUBLIC_ENABLE_TEST_RESERVATIONS: profile === 'core' ? '0' : '1',
    EXPO_PUBLIC_ENABLE_NATIVE_SANDBOX_PIX: profile === 'checkout-sandbox' ? '1' : '0',
  };
}
export function assertQaRelease(branch, dirty, env = process.env) {
  if (branch !== qaBranch || dirty)
    fail('Release QA exige um clone limpo na branch homologacao/web-ios-integrada. Não altere seu checkout de trabalho.');
  if (env.EXPO_PUBLIC_API_URL && env.EXPO_PUBLIC_API_URL.replace(/\/$/, '') !== qaApi)
    fail('Release QA recusado: a API configurada não é a QA isolada.');
  if (customBundleKeys.some((key) => env[key]))
    fail('Remova os ajustes de empacotamento da sessão antes da Release QA.');
}
export function ensureDevice(devices, udid) {
  const detected = Array.isArray(devices) && devices.find((device) =>
    typeof device?.identifier === 'string' &&
    device.identifier.toUpperCase() === udid.toUpperCase() &&
    device.simulator === false && device.available === true &&
    device.platform === 'com.apple.platform.iphoneos' &&
    /^iPhone/.test(device.modelCode || device.modelName || ''));
  if (!detected)
    fail('O identificador não corresponde a um iPhone físico disponível. Conecte por cabo, desbloqueie e confira o Xcode.');
  const major = Number.parseInt(detected.operatingSystemVersion, 10);
  if (Number.isFinite(major) && major < 17)
    fail('A instalação por devicectl exige iOS 17 ou posterior.');
}
export function qaIsReady(status, body) {
  return status === 200 && body?.status === 'ready' && body.database === 'up';
}
export function canUseNativeSnapshot(contents, revision) {
  try {
    const info = JSON.parse(contents);
    return info.revision === revision && info.api === qaApi;
  } catch {
    return false;
  }
}
export function hasReleaseEnvOverride(contents) {
  return contents.split(/\r?\n/).some((line) =>
    line.trim() && !line.trimStart().startsWith('#') && releaseEnvKeys.test(line));
}
function fail(message) { throw new Error(message); }
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: app, env: process.env, stdio: 'inherit', ...options,
  });
  if (result.error || result.status !== 0) fail(`Falhou: ${command} (código ${result.status ?? 'indisponível'}).`);
  return result;
}
function capture(command, args, options = {}) {
  return spawnSync(command, args, { cwd: app, env: process.env, encoding: 'utf8', ...options });
}

async function main() {
  const { mode, connection, udid, profile } = parseMode(process.argv.slice(2));
  const release = mode === 'release' || mode === 'prepare-release';
  if (release && process.platform !== 'darwin')
    fail('A preparação/instalação Release exige o Mac do proprietário com Xcode.');
  const [major, minor] = process.versions.node.split('.').map(Number);
  const supportedNode = major % 2 === 0 &&
    ((major === 22 && minor >= 13) || (major === 24 && minor >= 3) || major >= 26);
  if (!supportedNode) fail('Use Node 22.13+, 24.3+ ou 26+ de uma linha par suportada pelo Expo SDK 58.');
  const branch = capture('git', ['branch', '--show-current'], { cwd: root });
  const testBranches = ['feat/mobile-expo', 'homologacao/web-ios-integrada'];
  if (branch.status !== 0 || !testBranches.includes(branch.stdout.trim()))
    fail('Use um clone separado na branch feat/mobile-expo ou homologacao/web-ios-integrada; nenhuma branch foi alterada.');
  const branchName = branch.stdout.trim();
  const integrated = branchName === qaBranch;
  const api = integrated ? qaApi : phase1Api;
  const head = capture('git', ['rev-parse', 'HEAD'], { cwd: root });
  if (head.status !== 0) fail('Não foi possível identificar o commit.');
  const revision = head.stdout.trim();
  console.log(`SorteX · teste iPhone · ${revision}`);
  const status = capture('git', ['status', '--porcelain'], { cwd: root });
  if (status.status !== 0) fail('Não foi possível conferir as alterações locais.');
  const dirty = Boolean(status.stdout.trim());
  if (release) assertQaRelease(branchName, dirty);
  else if (dirty) console.log('Há alterações locais: serão preservadas. A sessão executará este checkout.');
  if (process.env.EXPO_PUBLIC_API_URL && process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '') !== api)
    fail('API recusada: este iniciador aceita somente a prévia isolada.');
  // Explicitly override dotenv API values in the child process; never print env contents.
  process.env.EXPO_PUBLIC_API_URL = api;
  if (release) Object.assign(process.env, qaReleaseBuildEnv(profile));
  if (mode !== 'prepare-release') {
    let response;
    try {
      response = await fetch(`${api}/health${integrated ? '/ready' : ''}`, { redirect: 'error', signal: AbortSignal.timeout(30000) });
    } catch {
      fail('API isolada indisponível por HTTPS. Nenhum ambiente alternativo foi usado.');
    }
    const health = response.ok ? await response.json().catch(() => null) : null;
    if (!(integrated ? qaIsReady(response.status, health) : response.ok && health?.status === 'ok'))
      fail(`API isolada indisponível ou sem banco pronto (HTTP ${response.status}). Nenhum ambiente alternativo foi usado.`);
    console.log(integrated
      ? 'PASS: API isolada Web + iOS pronta por HTTPS. Ainda não comprova a rede do iPhone.'
      : 'PASS: prévia Fase 1 acessível por HTTPS. Não comprova a base integrada.');
  } else {
    console.log('Somente preparação local. A API QA será exigida antes da instalação Release.');
  }
  if (!existsSync(path.join(app, 'node_modules/expo/package.json')))
    fail('Dependências ausentes. Execute npm ci em apps/mobile e tente novamente.');
  run('npx', ['--no-install', 'expo', 'install', '--check']);
  if (mode === 'check') return;
  if (!process.stdin.isTTY) fail('Execute o iniciador em um terminal interativo no Mac.');

  if (mode === 'go') {
    // Browser login uses a local PKCE callback. Never ask for passwords in the terminal/chat.
    const identity = capture('npx', ['--no-install', 'expo', 'whoami']);
    if (identity.status !== 0 || /not logged in/i.test(identity.stdout || ''))
      run('npx', ['--no-install', 'expo', 'login', '--browser']);
    console.log('No iPhone, entre no Expo Go com a mesma conta Expo usada neste computador.');
    console.log('Leia o QR com a Câmera. Mantenha este terminal e o Mac ligados; Ctrl+C encerra o acesso.');
    console.log(connection === '--lan' ? 'LAN: Mac e iPhone na mesma rede Wi-Fi.' : 'Túnel: ambos precisam de internet; não exige o mesmo Wi-Fi.');
    run('npx', ['--no-install', 'expo', 'start', '--go', connection, '--port', '8082']);
    return;
  }

  if (process.platform !== 'darwin') fail('Instalação física com Xcode exige executar este comando no Mac.');
  const selection = capture('xcode-select', ['--print-path']);
  if (selection.status !== 0 || !selection.stdout.trim().endsWith('/Contents/Developer'))
    fail('Selecione o Xcode completo em Xcode → Settings → Locations → Command Line Tools. Não use apenas /Library/Developer/CommandLineTools.');
  console.log(`Developer Directory selecionado: ${selection.stdout.trim()}`);
  // DEVELOPER_DIR can override xcode-select; show the tool actually resolved by xcrun.
  run('xcrun', ['--find', 'xcodebuild']);
  const xcode = capture('xcodebuild', ['-version']);
  const xcodeVersion = /Xcode\s+(\d+)\.(\d+)/.exec(xcode.stdout || '');
  if (xcode.status !== 0 || !xcodeVersion ||
      Number(xcodeVersion[1]) < 26 ||
      (Number(xcodeVersion[1]) === 26 && Number(xcodeVersion[2]) < 4))
    fail('Expo SDK 58 requer Xcode 26.4 ou posterior. Confira Command Line Tools e DEVELOPER_DIR.');
  console.log(xcode.stdout.trim());
  run('xcodebuild', ['-checkFirstLaunchStatus']); // Check only. Never accept a license.
  run('pod', ['--version']); // CocoaPods must already be installed by the owner.
  const ios = path.join(app, 'ios');
  const snapshot = path.join(ios, '.sortex-qa-release.json');
  const workspace = path.join(ios, 'SorteXTeste.xcworkspace');
  const hasIos = existsSync(ios);
  if (release && hasIos && (!existsSync(snapshot) || !canUseNativeSnapshot(readFileSync(snapshot, 'utf8'), revision)))
    fail('A pasta ios já existe sem comprovação deste commit QA. Use um novo clone; nada foi sobrescrito.');
  if (mode === 'release' && !hasIos)
    fail('Primeiro execute prepare-release e configure o Personal Team no Xcode.');
  if (!hasIos)
    run('npx', ['--no-install', 'expo', 'prebuild', '--platform', 'ios', '--no-install']);
  else console.log('Projeto ios existente preservado: prebuild não será repetido.');
  run('node', ['scripts/check-native-config.cjs']);
  if (mode === 'prepare-release' && !hasIos)
    writeFileSync(snapshot, JSON.stringify({ revision, api }), { flag: 'wx', mode: 0o600 });
  if (mode !== 'release') {
    // `pod install` preserves locked versions where possible; never use `pod update`.
    run('pod', ['install'], { cwd: ios });
  }
  if (!existsSync(workspace)) fail('SorteXTeste.xcworkspace não encontrado. Termine prepare-release e configure o Personal Team.');
  if (release) {
    for (const file of ['.xcode.env', '.xcode.env.local', '.xcode.env.updates']) {
      const config = path.join(ios, file);
      if (existsSync(config) && hasReleaseEnvOverride(readFileSync(config, 'utf8')))
        fail(`${file} sobrepõe o destino ou o empacotamento da Release QA. Preserve a pasta e use um clone limpo.`);
    }
    if (mode === 'prepare-release') {
      console.log('No target SorteXTeste, ajuste Automatically manage signing e selecione só seu Personal Team.');
      console.log('Conecte o iPhone, selecione-o no Xcode e conclua a assinatura de desenvolvimento. Não inicie Metro.');
      console.log('Após a API QA ficar pronta: node .github/mobile/iphone.mjs release --device <UDID>');
      run('open', [workspace]);
      return;
    }
    const detected = capture('xcrun', ['xcdevice', 'list', '--timeout', '10'], { timeout: 20000 });
    if (detected.error || detected.status !== 0) fail('Falha ao listar iPhones com as ferramentas do Xcode.');
    let devices;
    try { devices = JSON.parse(detected.stdout); } catch { fail('Lista de dispositivos inválida no Xcode. Confira a seleção e o cabo.'); }
    ensureDevice(devices, udid);
    const description = {
      core: 'Perfil Core: reservas e Pix de teste desativados.',
      'reservations-sandbox': 'Perfil Reservas Sandbox: somente cotas sintéticas na QA; Pix desativado.',
      'checkout-sandbox': 'Perfil Checkout Sandbox: somente QA isolada. Não escaneie nem pague Pix.',
    };
    console.log(description[profile ?? 'core']);
    console.log('Compilando a Release QA com a assinatura de desenvolvimento já configurada no Xcode.');
    const installed = installPhysicalQaRelease({ workspace, udid, api, run, capture });
    console.log(`Instalação e lançamento confirmados pelo Xcode: ${installed.bundleId}, build ${installed.build}, JS SHA-256 ${installed.bundleSha256}.`);
    console.log('Confirme no aparelho a abertura pelo ícone com o Mac desconectado, sem iniciar Metro.');
    return;
  }
  console.log('No Xcode: selecione o iPhone físico e seu Personal Team em Signing & Capabilities.');
  console.log('Não selecione simulador, Archive, distribuição de loja nem uma capacidade Apple não configurada.');
  console.log('Em outro terminal: cd apps/mobile && npm run start:dev-client -- --lan --port 8082');
  console.log('Depois use Product → Run no Xcode. Consulte docs/SORTEX_TESTE_IPHONE_FISICO.md.');
  run('open', [workspace]);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => {
  // Do not echo HTTP bodies, environment variables or captured account output.
  console.error(error instanceof Error ? error.message : 'Falha no iniciador.');
  process.exitCode = 1;
});
