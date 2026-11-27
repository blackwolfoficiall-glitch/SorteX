// Read only private diagnostics and emit fixed labels. No excerpts,
// credential values, raw HTTP event, user id, timing or screenshots are output.
const { readFileSync } = require('node:fs');
const { classifications } = require('./login-input.cjs');

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
  if (lastFailure.includes('sortex-ios-ui@example')) return 'email-value';
  if (/sortex-login-email/.test(lastFailure)) return 'email-control';
  if (/sortex-login-password/.test(lastFailure)) return 'password-control';
  if (/sortex-login-submit/.test(lastFailure)) return 'submit-control';
  if (/Olá, CompradorIOS/.test(lastFailure)) return 'signed-in-view';
  return 'unclassified';
}

function responseClass(status) {
  if (!Number.isInteger(status)) return 'unknown';
  if (status === 400) return '400-validation';
  if (status === 401) return '401-unauthorized';
  if (status === 403) return '403-forbidden';
  if (status === 429) return '429-rate-limited';
  return status >= 200 && status <= 299 ? '2xx'
    : status >= 400 && status <= 499 ? '4xx-other'
    : status >= 500 && status <= 599 ? '5xx'
    : 'unknown';
}

function apiObservation(log) {
  if (log === null) return { status: 'unknown', input: 'unknown' };
  let status = 'not-seen';
  let input = 'not-seen';
  for (const line of log.split('\n')) {
    let event;
    try { event = JSON.parse(line); } catch { continue; }
    if (event?.event === 'sortex-ios-fixture-login-shape') {
      input = classifications.has(event.input) ? event.input : 'unknown';
      status = responseClass(event.status);
    } else if (event?.method === 'POST' && event.path === '/auth/login') {
      // Keep status-only fallback if the fixture observer could not see input.
      input = 'unknown';
      status = responseClass(event.status);
    }
  }
  return { status, input };
}

if (require.main === module) {
  console.log('login_cli=' + maestroStatus(read(process.argv[2])));
  const observation = apiObservation(read(process.argv[3]));
  console.log('login_api=' + observation.status);
  console.log('login_input=' + observation.input);
}
module.exports = { maestroStatus, apiObservation };
