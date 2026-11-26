/** Local device-only Release; invoked after iphone.mjs validates QA, Git and the physical iPhone. */
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const scheme = 'SorteXTeste';
const bundleId = 'br.com.sortex.development';

const provisioningHelp =
  'No Xcode, selecione o iPhone físico e prepare a assinatura de desenvolvimento com seu Personal Team. Se aparecer Register ou outro pedido de confiança, resolva no Xcode/iPhone.';

export function installPhysicalQaRelease({ workspace, udid, api, run, capture }) {
  const work = mkdtempSync(path.join(tmpdir(), 'sortex-physical-release-'));
  const derived = path.join(work, 'DerivedData');
  const builtApp = path.join(derived, 'Build/Products/Release-iphoneos', `${scheme}.app`);
  const timeout = 120_000;

  function checked(command, args, message, options = {}) {
    const result = capture(command, args, { timeout, ...options });
    if (result.error || result.status !== 0) throw new Error(message);
    return result.stdout;
  }

  function deviceCommand(action, value, name, failure) {
    const output = path.join(work, `${name}.json`);
    checked('xcrun', ['devicectl', 'device', ...action, '--device', udid, value, '--json-output', output], failure);
    try {
      const receipt = JSON.parse(readFileSync(output, 'utf8'));
      if (receipt.info?.outcome === 'success') return receipt.result;
    } catch {
      // Never echo device identifiers, installed paths or raw CoreDevice output.
    }
    throw new Error(failure);
  }

  try {
    checked('xcrun', ['--find', 'devicectl'], 'Não encontrei devicectl no Xcode ativo. Confira o Xcode completo.');
    try {
      run('xcrun', [
        'xcodebuild', '-workspace', workspace, '-scheme', scheme,
        '-configuration', 'Release', '-sdk', 'iphoneos', '-destination', `id=${udid}`,
        '-derivedDataPath', derived, 'build',
      ]);
    } catch {
      // No -allowProvisioningUpdates or -allowProvisioningDeviceRegistration.
      throw new Error(`Falha ao compilar a Release local. Confira o erro do Xcode acima. ${provisioningHelp}`);
    }

    const manifest = path.join(builtApp, 'Info.plist');
    const jsBundle = path.join(builtApp, 'main.jsbundle');
    if (!existsSync(jsBundle)) throw new Error('Release sem main.jsbundle: nenhuma instalação foi iniciada.');
    const bundle = readFileSync(jsBundle);
    if (!bundle.length || !bundle.includes(Buffer.from(api)))
      throw new Error('Release sem JavaScript válido para a API QA: nenhuma instalação foi iniciada.');

    function plistValue(key) {
      return checked('/usr/bin/plutil', ['-extract', key, 'raw', '-o', '-', manifest],
        'Não foi possível validar o Info.plist da Release: nenhuma instalação foi iniciada.').trim();
    }

    if (plistValue('CFBundleIdentifier') !== bundleId || plistValue('DTPlatformName') !== 'iphoneos')
      throw new Error('A Release não corresponde ao app de desenvolvimento iOS da SorteX: nenhuma instalação foi iniciada.');
    const build = plistValue('CFBundleVersion');
    if (!/^\d+(?:\.\d+){0,2}$/.test(build)) throw new Error('Identificação de build da Release inválida.');

    const invalidSigning = `Release sem assinatura local de desenvolvimento válida. ${provisioningHelp}`;
    if (!existsSync(path.join(builtApp, 'embedded.mobileprovision'))) throw new Error(invalidSigning);
    checked('/usr/bin/codesign', ['--verify', '--strict', builtApp], invalidSigning);
    const entitlements = checked('/usr/bin/codesign', ['--display', '--entitlements', ':-', builtApp], invalidSigning);
    const mayDebug = checked('/usr/bin/plutil', ['-extract', 'get-task-allow', 'raw', '-o', '-', '-'],
      invalidSigning, { input: entitlements });
    if (mayDebug.trim() !== 'true') throw new Error(invalidSigning);

    const installed = deviceCommand(['install', 'app'], builtApp, 'installed',
      `O iPhone não confirmou a instalação da Release. Confira cabo, desbloqueio, modo de desenvolvedor e assinatura. ${provisioningHelp}`);
    if (!Array.isArray(installed?.installedApplications) ||
        !installed.installedApplications.some((item) => item?.bundleID === bundleId))
      throw new Error('O recibo da instalação não confirma o identificador de desenvolvimento esperado. Confira os apps no Xcode; nenhum lançamento foi pedido.');

    const launched = deviceCommand(['process', 'launch'], bundleId, 'launched',
      'O iPhone confirmou a instalação, mas não a abertura. Desbloqueie e abra o app pelo ícone para conferir; não inicie Metro.');
    if (!Number.isInteger(launched?.process?.processIdentifier) || launched.process.processIdentifier <= 0)
      throw new Error('O iPhone confirmou a instalação, mas não retornou o processo do app. Confira pelo ícone.');

    return { bundleId, build, bundleSha256: createHash('sha256').update(bundle).digest('hex') };
  } finally {
    // Only our fresh build and receipts; never erase a checkout, an app or user data.
    rmSync(work, { recursive: true, force: true });
  }
}
