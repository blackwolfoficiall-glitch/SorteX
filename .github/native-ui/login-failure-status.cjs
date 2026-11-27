// Read only private diagnostic inputs and emit two fixed labels. No excerpts,
// credential values, raw HTTP event, user id, timing or screenshots are output.
const { readFileSync } = require('node:fs');

function read(path) {
  try { return readFileSync(path, 'utf8'); } catch { return null; }
}

function maestroStatus(log) {
  if (!log) return 'unclassified';
  if (/Couldn't hide the keyboard|HideKeyboardFailure/i.test(log))
    return 'keyboard-dismiss-failed';
  if (/iOS driver not ready in time|Device [^\r\n]+ was requested, but it is not connected|Failed to launch XCTest|Maestro driver timed out/i.test(log))
    return 'driver';
  // Successful commands also appear in the transcript. Match only the
  // reported missing element/assertion, not preceding command descriptions.
  const missing = /Assertion is false|Element not found|Could not find element|No visible element found/i;
  if (!missing.test(log)) return 'unclassified';
  const lastFailure = log.split(missing).at(-1).split('\n').slice(0, 4).join('\n');
  if (/sortex-login-email/.test(lastFailure)) return 'email-control';
  if (/sortex-login-password/.test(lastFailure)) return 'password-control';
  if (/sortex-login-submit/.test(lastFailure)) return 'submit-control';
  if (/Olá, CompradorIOS/.test(lastFailure)) return 'signed-in-view';
  return 'unclassified';
}

function apiStatus(log) {
  if (log === null) return 'unknown';
  let result = 'not-seen';
  for (const line of log.split('\n')) {
    let event;
    try { event = JSON.parse(line); } catch { continue; }
    if (event?.method !== 'POST' || event.path !== '/auth/login') continue;
    const status = event.status;
    result = !Number.isInteger(status) ? 'unknown'
      : status >= 200 && status <= 299 ? '2xx'
      : status >= 400 && status <= 499 ? '4xx'
      : status >= 500 && status <= 599 ? '5xx'
      : 'unknown';
  }
  return result;
}

if (require.main === module) {
  console.log('login_cli=' + maestroStatus(read(process.argv[2])));
  console.log('login_api=' + apiStatus(read(process.argv[3])));
}
module.exports = { maestroStatus, apiStatus };
