#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';
import { setTimeout as wait } from 'node:timers/promises';

const repo = 'https://github.com/blackwolfoficiall-glitch/SorteX.git';
const branch = 'homologacao/web-ios-integrada';
const api = 'https://br-weathered-forest-bccwn49d-sortexqa.compute.c-16.us-east-1.aws.neon.tech';
const windowMs = 30 * 60_000;
const checkUntil = 100_000;
const children = new Set();
let stopping = false;

export const eligibleEmail = value => value.length <= 254 &&
  /^[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+$/i.test(value);
export const isSha = value => /^[a-f0-9]{40}$/.test(value ?? '');
export const ownTunnel = value => /^https:\/\/[a-z0-9][a-z0-9-]+\.trycloudflare\.com$/i.test(value) &&
  !['api.trycloudflare.com', 'login.trycloudflare.com'].includes(new URL(value).hostname);

export function cloudflaredReady(version, help) {
  const m = /cloudflared version (\d{4})\.(\d{1,2})\.(\d+)/i.exec(version);
  if (!m || !help.includes('--allowed-mail')) return false;
  const [year, month, patch] = m.slice(1).map(Number);
  return year > 2026 || (year === 2026 && (month > 11 || (month === 11 && patch >= 2)));
}

export function validGate(status, location, cache, origin) {
  if (status !== 302 || !/(?:^|[,\s])no-store(?:$|[,\s])/i.test(cache ?? '')) return false;
  try {
    const dest = new URL(location);
    return dest.origin === 'https://login.trycloudflare.com' && dest.pathname === '/authorize' &&
      dest.searchParams.get('hostname') === new URL(origin).hostname &&
      Boolean(dest.searchParams.get('state'));
  } catch { return false; }
}

function start(program, args, { cwd, env, output } = {}) {
  if (stopping) throw new Error('Prévia encerrada.');
  const c = spawn(program, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  children.add(c);
  let buffer = '', status = null;
  const record = data => {
    buffer = (buffer + data.toString()).slice(-24_000);
    if (output) output(data.toString());
  };
  c.stdout.on('data', record);
  c.stderr.on('data', record);
  const done = new Promise(resolveStatus => {
    c.once('error', () => { status = -1; children.delete(c); resolveStatus(-1); });
    c.once('close', code => { status = code ?? -1; children.delete(c); resolveStatus(status); });
  });
  return { child: c, done, buffer: () => buffer, status: () => status };
}

function stopChildren() {
  for (const c of children) {
    try { process.kill(-c.pid, 'SIGTERM'); } catch {}
  }
}
function hardStopChildren() {
  for (const c of children) {
    try { process.kill(-c.pid, 'SIGKILL'); } catch {}
  }
}

async function run(program, args, options, label) {
  const p = start(program, args, options);
  if (await p.done !== 0) throw new Error(label);
  return p.buffer();
}

async function retry(check, maxMs, fail, live = () => true) {
  const until = Date.now() + maxMs;
  while (Date.now() < until && live()) {
    try { if (await check()) return; } catch {}
    await wait(1_400);
  }
  throw new Error(fail);
}

async function getJson(url) {
  const response = await fetch(url, {
    headers: { 'Cache-Control': 'no-store' },
    redirect: 'error',
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error('Serviço indisponível.');
  return response.json();
}

export async function verifyGate(origin, request = fetch) {
  const v = await Promise.all(['/','/api/health/ready','/robots.txt'].map(async path => {
    const response = await request(origin + path, { redirect: 'manual', signal: AbortSignal.timeout(8_000) });
    const ok = validGate(response.status, response.headers.get('location'), response.headers.get('cache-control'), origin);
    await response.body?.cancel();
    return ok;
  }));
  if (!v.every(Boolean)) return false;
  const post = await request(origin + '/api/auth/login', {
    method: 'POST', redirect: 'manual',
    body: '{}', headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(8_000),
  });
  const denied = post.status === 401;
  await post.body?.cancel();
  return denied;
}

async function reserveCanary() {
  const server = createServer((_, res) => {
    res.writeHead(503, { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain' });
    res.end('SorteX QA: origem ainda não iniciada.');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { port: server.address().port, close: () => new Promise(r => server.close(r)) };
}

async function main() {
  const [expectedWebSha, expectedApiSha] = process.argv.slice(2);
  if (process.platform !== 'darwin') throw new Error('Execute este iniciador no Terminal do Mac, não na nuvem.');
  if (!isSha(expectedWebSha) || !isSha(expectedApiSha) || process.argv.length !== 4)
    throw new Error('Uso: node sortex-pin-preview.mjs <SHA_WEB_40_CARACTERES> <SHA_API_40_CARACTERES>');
  if (Number(process.versions.node.split('.')[0]) < 22)
    throw new Error('Use Node 22+ (recomendado Node 24 ou 26).');

  // Avoid user cloudflared, npm and git configs; carry no inherited keys or session secrets.
  const work = await mkdtemp(join(tmpdir(), 'sortex-pin-'));
  const home = join(work, 'home');
  await mkdir(home, { mode: 0o700 });
  const env = {
    PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin',
    HOME: home, TMPDIR: work, LANG: 'en_US.UTF-8',
    CI: '1', NEXT_TELEMETRY_DISABLED: '1', GIT_TERMINAL_PROMPT: '0',
    NO_PROXY: 'localhost,127.0.0.1',
  };
  const cf = { env, cwd: work };
  let canary, cleanupPromise;
  function cleanup() {
    if (!cleanupPromise) {
      stopping = true;
      cleanupPromise = (async () => {
        // Stop the network-facing connector before cleanup. No public fallback.
        stopChildren();
        await wait(600);
        hardStopChildren();
        if (canary) await canary.close();
        await rm(work, { recursive: true, force: true });
      })();
    }
    return cleanupPromise;
  }
  function terminate(signal) {
    const code = signal === 'SIGINT' ? 130 : 143;
    void cleanup().then(() => process.exit(code), () => process.exit(code));
  }
  process.once('SIGINT', () => terminate('SIGINT'));
  process.once('SIGTERM', () => terminate('SIGTERM'));
  try {
    // No tunnel or checkout while the upstream is unavailable or points to a different revision.
    const [health, ready] = await Promise.all([getJson(api + '/health'), getJson(api + '/health/ready')]);
    if (health.version !== expectedApiSha || ready.status !== 'ready' || ready.database !== 'up')
      throw new Error('A API exclusiva do Neon não confirmou o SHA e o banco esperados.');
    const version = await run('cloudflared', ['--version'], cf, 'cloudflared não instalado.');
    const help = await run('cloudflared', ['tunnel', '--help'], cf, 'Não consegui validar o suporte ao PIN.');
    if (!cloudflaredReady(version, help)) throw new Error('Use cloudflared 2026.11.2+ com suporte a --allowed-mail.');

    const clone = join(work, 'candidata');
    await run('git', ['-c','credential.helper=','clone','--single-branch','--branch',branch,'--depth','1',repo,clone], cf, 'Não consegui baixar a branch candidata.');
    const actualWebSha = await run('git', ['rev-parse','HEAD'], { cwd: clone, env }, 'Branch inacessível.');
    if (actualWebSha.trim() !== expectedWebSha)
      throw new Error('A branch mudou e não corresponde ao SHA autorizado. Nenhum túnel foi iniciado.');
    const cwd = join(clone, 'apps', 'web');
    console.log('API de teste e revisão da candidata confirmadas. Instalando dependências do frontend isolado.');
    await run('npm', ['ci','--no-audit','--no-fund'], { cwd, env }, 'Falhou o npm ci da candidata.');

    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    const email = (await prompt.question('Digite um único e-mail pessoal autorizado para receber PIN: ')).trim();
    prompt.close();
    if (!eligibleEmail(email)) throw new Error('Endereço único inválido. Não são permitidos domínios, curingas ou listas.');

    const config = join(work, 'cloudflared-qa.yml');
    await writeFile(config, '{}\n', { mode: 0o600 });
    canary = await reserveCanary();
    const port = canary.port;
    const tunnel = start('cloudflared', [
      'tunnel', '--config', config, '--no-autoupdate',
      '--url', `http://127.0.0.1:${port}`, '--allowed-mail', email,
    ], cf);
    const on = () => tunnel.status() === null;
    let origin = '';
    // No product traffic yet. Accept only the explicit authenticated startup banner.
    await retry(async () => {
      const ring = tunnel.buffer();
      if (!ring.includes('protected quick Tunnel has been created') ||
          !ring.includes('Authentication: One-Time PIN') ||
          !ring.includes('Allowed recipients: 1 email address')) return false;
      const links = [...ring.matchAll(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/gi)]
        .map(x => x[0]).filter(ownTunnel);
      if (new Set(links).size !== 1) return false;
      origin = links[0];
      return verifyGate(origin);
    }, checkUntil, 'Cloudflare não comprovou o PIN e a negação de acesso anônimo. Nenhum conteúdo foi disponibilizado.', on);

    const expectedEnv = {
      ...env, NODE_ENV: 'production',
      SORTEX_HOMOLOGATION_API_URL: api, API_INTERNAL_URL: api, API_URL: api,
      NEXT_PUBLIC_APP_URL: origin, WEB_URL: origin, OAUTH_WEB_ORIGIN: origin,
    };
    console.log('Proteção de PIN verificada antes de iniciar a SorteX. Preparando o frontend.');
    const next = join(cwd, 'node_modules', 'next', 'dist', 'bin', 'next');
    await run(process.execPath, [next,'build'], { cwd, env: expectedEnv }, 'O build da candidata falhou.');
    if (!on() || !(await verifyGate(origin))) throw new Error('A proteção do PIN não foi reconfirmada. Abortando.');
    await canary.close();
    canary = null;
    const site = start(process.execPath, [next,'start','--hostname','127.0.0.1','--port',String(port)], { cwd, env: expectedEnv });
    await retry(async () => {
      const h = await getJson(`http://127.0.0.1:${port}/api/health`);
      const r = await getJson(`http://127.0.0.1:${port}/api/health/ready`);
      return h.version === expectedApiSha && r.status === 'ready' && r.database === 'up';
    }, 45_000, 'Next e BFF não confirmaram a mesma API de teste.', () => on() && site.status() === null);
    if (!(await verifyGate(origin))) throw new Error('A proteção externa falhou após iniciar a SorteX.');

    console.log(`Prévia privada, válida por até 30 minutos nesta sessão: ${origin}`);
    console.log('Abra no Safari, use o e-mail permitido e informe o PIN só na página oficial da Cloudflare.');
    console.log('Mantenha o Mac ligado; finalize com Ctrl+C. Use apenas dados fictícios e não efetue pagamentos.');
    const life = new AbortController();
    try {
      await Promise.race([
        tunnel.done.then(() => { throw new Error('O túnel foi encerrado.'); }),
        site.done.then(() => { throw new Error('O frontend foi encerrado.'); }),
        wait(windowMs, null, { signal: life.signal }),
      ]);
    } finally { life.abort(); }
  } finally {
    await cleanup();
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(e => {
    console.error(e instanceof Error ? e.message : 'Falha durante a prévia.');
    process.exitCode = 1;
  });
}
