#!/usr/bin/env bash
set -euo pipefail
refuse() {
  printf 'Native UI launcher refused: %s\n' "$1" >&2
  exit 64
}

# Explicit denial is required; do not rely on errexit for compound tests on
# the system macOS Bash or for callers using different shell options.
[[ "${RUNNER_OS:-}" == macOS && "${GITHUB_REPOSITORY:-}" == blackwolfoficiall-glitch/SorteX &&
  "${GITHUB_REF:-}" == refs/heads/homologacao/web-ios-integrada && "${GITHUB_EVENT_NAME:-}" == push ]] ||
  refuse execution-context
[[ "${SORTEX_IOS_UI_SCOPE:-}" == disposable-loopback && "${SORTEX_IOS_UI_API:-}" == http://127.0.0.1:3338 ]] ||
  refuse fixture-scope
[[ "${EXPO_PUBLIC_API_URL:-}" == "$SORTEX_IOS_UI_API" && "${EXPO_PUBLIC_ALLOW_LOCAL_API:-}" == 1 ]] ||
  refuse api-destination
simulator_id_re='^[[:xdigit:]]{8}(-[[:xdigit:]]{4}){3}-[[:xdigit:]]{12}$'
[[ "${SORTEX_SIMULATOR_ID:-}" =~ $simulator_id_re &&
  "${SORTEX_IOS_UI_BUYER_PASSWORD:-}" =~ ^[0-9a-f]{48}$ ]] ||
  refuse synthetic-inputs
[[ -d "${RUNNER_TEMP:-}" && -n "${GITHUB_SHA:-}" && -x "${MAESTRO_BIN:-}" ]] ||
  refuse runner-prerequisites

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export MAESTRO_CLI_NO_ANALYTICS=true
export MAESTRO_DISABLE_UPDATE_CHECK=true
export MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true
export MAESTRO_DRIVER_STARTUP_TIMEOUT=60000
source "$root/.github/native-ui/checkpoint.sh"
checkpoint launcher-validated
unset MAESTRO_CLOUD_API_KEY
cd "$root/apps/mobile"
plist=ios/SorteXTeste/Info.plist
[[ -f "$plist" ]] || refuse missing-generated-plist
plistbuddy=/usr/libexec/PlistBuddy
[[ "$("$plistbuddy" -c 'Print :NSAppTransportSecurity:NSAllowsArbitraryLoads' "$plist")" == false ]] ||
  refuse unsafe-generated-plist
# Expo prebuild initially allows local networking for its dev launcher. The
# disposable build narrows that to the fixture host; no tracked plist changes.
"$plistbuddy" -c 'Set :NSAppTransportSecurity:NSAllowsLocalNetworking false' "$plist"
"$plistbuddy" -c 'Add :NSAppTransportSecurity:NSExceptionDomains dict' "$plist"
"$plistbuddy" -c 'Add :NSAppTransportSecurity:NSExceptionDomains:127.0.0.1 dict' "$plist"
"$plistbuddy" -c 'Add :NSAppTransportSecurity:NSExceptionDomains:127.0.0.1:NSExceptionAllowsInsecureHTTPLoads bool true' "$plist"
SORTEX_SIMULATOR_KEYCHAIN=1 bash "$root/.github/mobile/ios-simulator-release.sh" || refuse standalone-build
app="$(xcrun simctl get_app_container "$SORTEX_SIMULATOR_ID" br.com.sortex.development app)" ||
  refuse no-installed-app
[[ "$("$plistbuddy" -c 'Print :NSAppTransportSecurity:NSAllowsArbitraryLoads' "$app/Info.plist")" == false &&
  "$("$plistbuddy" -c 'Print :NSAppTransportSecurity:NSAllowsLocalNetworking' "$app/Info.plist")" == false ]] ||
  refuse unsafe-installed-plist
[[ "$("$plistbuddy" -c 'Print :NSAppTransportSecurity:NSExceptionDomains:127.0.0.1:NSExceptionAllowsInsecureHTTPLoads' "$app/Info.plist")" == true ]] ||
  refuse missing-installed-loopback-exception

checkpoint release-installed

# Apply Maestro's password-entry workaround only to the disposable simulator,
# if this runtime has the current configuration-profile schema. The app
# retains its genuine secureTextEntry and SecureStore implementation.
sim_data="$HOME/Library/Developer/CoreSimulator/Devices/$SORTEX_SIMULATOR_ID/data"
for prefs in \
  "$sim_data/Library/UserConfigurationProfiles/EffectiveUserSettings.plist" \
  "$sim_data/Containers/Shared/SystemGroup/systemgroup.com.apple.configurationprofiles/Library/ConfigurationProfiles/UserSettings.plist"
do
  if [[ -f "$prefs" ]] && plutil -extract restrictedBool.allowPasswordAutoFill.value raw "$prefs" >/dev/null 2>&1; then
    plutil -replace restrictedBool.allowPasswordAutoFill.value -bool NO "$prefs"
  fi
done

# Run and capture failures from a separate input-free probe. If it fails,
# never start the flow that has access to synthetic credentials.
bash "$root/.github/native-ui/startup-probe.sh" || refuse login-startup-not-verified
checkpoint startup-controls-verified

# Each flow is strict. They use the same installed app and simulator. A
# non-login flow never receives the synthetic password.
for phase in login campaign signed-in-relaunch logout signed-out-relaunch; do
  bash "$root/.github/native-ui/run-buyer-phase.sh" "$phase" || refuse "${phase}-flow-not-passed"
  checkpoint "${phase}-verified"
done
evidence="$RUNNER_TEMP/sortex-native-ui-evidence"
mkdir -m 700 "$evidence"
xcrun simctl io "$SORTEX_SIMULATOR_ID" screenshot "$evidence/signed-out.png"
{
  printf 'sha=%s\n' "$GITHUB_SHA"
  printf 'signature=local-adhoc-verified\n'
  printf 'scope=ios-simulator; synthetic; loopback API and migrated PostgreSQL; no Metro\n'
  printf 'scenario=buyer login; campaign detail; stop/relaunch; logout; stop/relaunch signed out\n'
  printf 'ios_runtime=%s\n' "$(xcrun simctl list devices available --json | node -e 'let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>{const entry=Object.entries(JSON.parse(s).devices).find(([,rows])=>rows.some(x=>x.udid===process.argv[1]));if(!entry)process.exit(1);console.log(entry[0]);});' "$SORTEX_SIMULATOR_ID")"
  printf 'bundle_sha256=%s\n' "$(shasum -a 256 "$app/main.jsbundle" | cut -d ' ' -f1)"
} > "$evidence/native-ui.txt"
checkpoint signed-out-evidence-saved
