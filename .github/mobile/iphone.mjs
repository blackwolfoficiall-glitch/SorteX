#!/usr/bin/env node
/** Local, interactive launcher. No server credentials, signing bypass or paid build. */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const app = path.join(root, 'apps/mobile');
const api = 'https://sortex-fase1-review.netlify.app/.netlify/functions/sortex-api';
const mode = process.argv[2] || 'go';
const connection = process.argv[3] || '--tunnel';
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
  if (!['check', 'go', 'xcode'].includes(mode) ||
      !['--tunnel', '--lan'].includes(connection) || process.argv.length > 4)
    fail('Uso: node .github/mobile/iphone.mjs [check|go|xcode] [--tunnel|--lan]');
  const [major, minor] = process.versions.node.split('.').map(Number);
  const supportedNode = major % 2 === 0 &&
    ((major === 22 && minor >= 13) || (major === 24 && minor >= 3) || major >= 26);
  if (!supportedNode) fail('Use Node 22.13+, 24.3+ ou 26+ de uma linha par suportada pelo Expo SDK 58.');
  const branch = capture('git', ['branch', '--show-current'], { cwd: root });
  if (branch.status !== 0 || branch.stdout.trim() !== 'feat/mobile-expo')
    fail('Use um clone separado na branch feat/mobile-expo; nenhuma branch foi alterada.');
  const head = capture('git', ['rev-parse', 'HEAD'], { cwd: root });
  if (head.status !== 0) fail('Não foi possível identificar o commit.');
  console.log(`SorteX · teste iPhone · ${head.stdout.trim()}`);
  const status = capture('git', ['status', '--porcelain'], { cwd: root });
  if (status.status !== 0) fail('Não foi possível conferir as alterações locais.');
  if (status.stdout.trim()) console.log('Há alterações locais: serão preservadas. O QR executará este checkout.');
  if (process.env.EXPO_PUBLIC_API_URL && process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '') !== api)
    fail('API recusada: este iniciador aceita somente a prévia isolada.');
  // Explicitly override dotenv API values in the child process; never print env contents.
  process.env.EXPO_PUBLIC_API_URL = api;
  const response = await fetch(`${api}/health`, { redirect: 'error', signal: AbortSignal.timeout(30000) });
  if (!response.ok || (await response.json()).status !== 'ok') fail(`API isolada indisponível (HTTP ${response.status}).`);
  console.log('PASS: API isolada acessível por HTTPS. Isso ainda não comprova a rede do iPhone.');
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
  if (!existsSync(path.join(app, 'ios')))
    run('npx', ['--no-install', 'expo', 'prebuild', '--platform', 'ios', '--no-install']);
  else console.log('Projeto ios existente preservado: prebuild não será repetido.');
  run('node', ['scripts/check-native-config.cjs']);
  const ios = path.join(app, 'ios');
  // Reconcile native dependencies even when an older workspace already exists.
  // `pod install` preserves locked versions where possible; never use `pod update`.
  run('pod', ['install'], { cwd: ios });
  const workspace = 'SorteXTeste.xcworkspace';
  if (!existsSync(path.join(ios, workspace))) fail('SorteXTeste.xcworkspace não encontrado após pod install; nenhum outro projeto será aberto.');
  console.log('No Xcode: selecione o iPhone físico e seu Personal Team em Signing & Capabilities.');
  console.log('Não selecione simulador, Archive, distribuição de loja nem uma capacidade Apple não configurada.');
  console.log('Em outro terminal: cd apps/mobile && npm run start:dev-client -- --lan --port 8082');
  console.log('Depois use Product → Run no Xcode. Consulte docs/SORTEX_TESTE_IPHONE_FISICO.md.');
  run('open', [path.join(ios, workspace)]);
}
main().catch(error => {
  // Do not echo HTTP bodies, environment variables or captured account output.
  console.error(error instanceof Error ? error.message : 'Falha no iniciador.');
  process.exitCode = 1;
});
