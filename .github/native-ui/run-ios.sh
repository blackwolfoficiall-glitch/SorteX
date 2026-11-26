#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
[[ "${RUNNER_OS:-}" == macOS && "${GITHUB_REPOSITORY:-}" == blackwolfoficiall-glitch/SorteX &&
  "${GITHUB_REF:-}" == refs/heads/homologacao/web-ios-integrada && "${GITHUB_EVENT_NAME:-}" == push ]]
[[ "${SORTEX_IOS_UI_SCOPE:-}" == disposable-loopback && "${SORTEX_IOS_UI_API:-}" == http://127.0.0.1:3338 ]]
[[ "${EXPO_PUBLIC_API_URL:-}" == "$SORTEX_IOS_UI_API" && "${EXPO_PUBLIC_ALLOW_LOCAL_API:-}" == 1 ]]
[[ "${SORTEX_SIMULATOR_ID:-}" =~ ^[0-9A-Fa-f-]{36}$ && "${SORTEX_IOS_UI_BUYER_PASSWORD:-}" =~ ^[0-9a-f]{48}$ ]]
: "${RUNNER_TEMP:?}"
: "${GITHUB_SHA:?}"
: "${MAESTRO_BIN:?}"
# The password is for this disposable localhost account, never the QA account.
# Mask it anyway; retain no CLI logs or screenshots captured at the login fields.
printf '::add-mask::%s\n' "$SORTEX_IOS_UI_BUYER_PASSWORD"
export MAESTRO_CLI_NO_ANALYTICS=true
export MAESTRO_DISABLE_UPDATE_CHECK=true
export MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true
export MAESTRO_DRIVER_STARTUP_TIMEOUT=60000
unset MAESTRO_CLOUD_API_KEY
cd "$root/apps/mobile"
plist=ios/SorteXTeste/Info.plist
[[ -f "$plist" ]]
plistbuddy=/usr/libexec/PlistBuddy
[[ "$("$plistbuddy" -c 'Print :NSAppTransportSecurity:NSAllowsArbitraryLoads' "$plist")" == false ]]
# Expo prebuild initially allows local networking for its dev launcher. The
# disposable build narrows that to the fixture host; no tracked plist changes.
"$plistbuddy" -c 'Set :NSAppTransportSecurity:NSAllowsLocalNetworking false' "$plist"
"$plistbuddy" -c 'Add :NSAppTransportSecurity:NSExceptionDomains dict' "$plist"
"$plistbuddy" -c 'Add :NSAppTransportSecurity:NSExceptionDomains:127.0.0.1 dict' "$plist"
"$plistbuddy" -c 'Add :NSAppTransportSecurity:NSExceptionDomains:127.0.0.1:NSExceptionAllowsInsecureHTTPLoads bool true' "$plist"
bash "$root/.github/mobile/ios-simulator-release.sh"
app="$(xcrun simctl get_app_container "$SORTEX_SIMULATOR_ID" br.com.sortex.development app)"
[[ "$("$plistbuddy" -c 'Print :NSAppTransportSecurity:NSAllowsLocalNetworking' "$app/Info.plist")" == false ]]
[[ "$("$plistbuddy" -c 'Print :NSAppTransportSecurity:NSExceptionDomains:127.0.0.1:NSExceptionAllowsInsecureHTTPLoads' "$app/Info.plist")" == true ]]

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

debug="$(mktemp -d "$RUNNER_TEMP/sortex-ui-debug.XXXXXX")"
trap 'rm -rf -- "$debug"' EXIT
# Only this selected local iPhone simulator; no cloud commands or upload.
"$MAESTRO_BIN" --device "$SORTEX_SIMULATOR_ID" test \
  --debug-output "$debug" --test-output-dir "$debug" \
  -e "BUYER_PASSWORD=$SORTEX_IOS_UI_BUYER_PASSWORD" "$root/.github/native-ui/buyer-session.yaml"
evidence="$RUNNER_TEMP/sortex-native-ui-evidence"
mkdir -m 700 "$evidence"
xcrun simctl io "$SORTEX_SIMULATOR_ID" screenshot "$evidence/signed-out.png"
{
  printf 'sha=%s\n' "$GITHUB_SHA"
  printf 'scope=ios-simulator; synthetic; loopback API and migrated PostgreSQL; no Metro\n'
  printf 'scenario=buyer login; campaign detail; stop/relaunch; logout; stop/relaunch signed out\n'
  printf 'ios_runtime=%s\n' "$(xcrun simctl list devices available --json | node -e 'let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>{const entry=Object.entries(JSON.parse(s).devices).find(([,rows])=>rows.some(x=>x.udid===process.argv[1]));if(!entry)process.exit(1);console.log(entry[0]);});' "$SORTEX_SIMULATOR_ID")"
  printf 'bundle_sha256=%s\n' "$(shasum -a 256 "$app/main.jsbundle" | cut -d ' ' -f1)"
} > "$evidence/native-ui.txt"
