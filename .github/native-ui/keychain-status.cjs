// Read one app's Keychain system-log query; never echo any raw log content.
const readline = require('node:readline');
let missingEntitlement = false;
let interactionNotAllowed = false;
const logs = readline.createInterface({ input: process.stdin });
logs.on('line', (line) => {
  if (!/\b(?:SorteXTeste|br\.com\.sortex\.development)\b/.test(line)) return;
  if (/(?:^|[^\d])-34018(?![\d])|errSecMissingEntitlement/.test(line))
    missingEntitlement = true;
  if (/(?:^|[^\d])-25308(?![\d])|errSecInteractionNotAllowed/.test(line))
    interactionNotAllowed = true;
});
logs.on('close', () => {
  console.log(missingEntitlement ? 'missing-entitlement-observed'
    : interactionNotAllowed ? 'interaction-not-allowed-observed' : 'not-observed');
});
