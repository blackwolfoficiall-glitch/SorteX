// Read only the input-free Maestro probe transcript. Never emit raw text,
// IDs, paths or values from it, even if the diagnostic is malformed.
const { readFileSync } = require('node:fs');

const log = readFileSync(0, 'utf8');
let category = 'unclassified';
const inaccessible = /Assertion is false|Element not found|Could not find element|No visible element found/i;
if (/iOS driver not ready in time|IOSDriverTimeoutException/i.test(log)) {
  // Exact cold-start exception from LocalXCTestInstaller in Maestro 2.12.1.
  category = 'ios-driver-startup-timeout';
} else if (/Device [^\r\n]+ was requested, but it is not connected|No devices connected/i.test(log)) {
  category = 'simulator-not-connected';
} else if (/Unable to set permissions|Failed to set permissions/i.test(log)) {
  category = 'ios-driver-permissions-failed';
} else if (/Maestro driver timed out|Timed out while evaluating UI query/i.test(log)) {
  category = 'ios-driver-ui-query-timeout';
} else if (/NoSuchFileException:[^\r\n]*(?:analytics\.json|maestro\.log\.lck)|maestro\.cli\.util\.Unpacker\.createFileIfDoesNotExist/i.test(log)) {
  category = 'maestro-local-storage-unavailable';
} else if (inaccessible.test(log)) {
  const knownSelectors = [
    ['sortex-login-email', 'email-selector-not-found'],
    ['sortex-login-password', 'password-selector-not-found'],
    ['sortex-login-submit', 'submit-selector-not-found'],
  ];
  // A transcript also contains successful assertions. Limit the lookup to the
  // asserted failure, rather than treating a preceding successful ID as missing.
  const failure = log.split(inaccessible).at(-1).split('\n').slice(0, 4).join('\n');
  category = knownSelectors.find(([selector]) => failure.includes(selector))?.[1] ?? 'accessibility-assertion-failed';
} else if (/Unable to start (?:the )?(?:iOS )?driver|Failed to start (?:the )?(?:iOS )?driver|Failed to launch XCTest|XCTest runner .*failed|failed to connect to .*driver/i.test(log)) {
  category = 'ios-driver-startup-failed';
} else if (/Unknown option|Unmatched argument|Invalid value for option|YamlParseException|Error parsing (?:the )?(?:flow|yaml)/i.test(log)) {
  category = 'cli-or-flow-configuration-failed';
}
console.log(category);
