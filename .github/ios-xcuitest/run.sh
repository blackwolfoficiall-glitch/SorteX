#!/usr/bin/env bash
# Only run inside the reviewed, public repository's no-cost macOS PR-branch job.
set -euo pipefail
set +x
umask 077

refuse() {
  printf 'XCUITest stopped: %s\n' "$1" >&2
  exit 64
}
[[ "${RUNNER_OS:-}" == macOS && "${GITHUB_REPOSITORY:-}" == blackwolfoficiall-glitch/SorteX &&
   "${GITHUB_REF:-}" == refs/heads/homologacao/web-ios-integrada && "${GITHUB_EVENT_NAME:-}" == push ]] ||
  refuse execution-context
[[ "${SORTEX_IOS_UI_SCOPE:-}" == disposable-loopback && "${SORTEX_IOS_UI_API:-}" == http://127.0.0.1:3338 &&
   "${EXPO_PUBLIC_API_URL:-}" == "$SORTEX_IOS_UI_API" && "${EXPO_PUBLIC_ALLOW_LOCAL_API:-}" == 1 &&
   "${EXPO_PUBLIC_ENABLE_TEST_RESERVATIONS:-}" == 0 && -z "${DATABASE_URL:-}" ]] ||
  refuse fixture-scope
sha_re='^[0-9a-f]{40}$'
sim_re='^[[:xdigit:]]{8}(-[[:xdigit:]]{4}){3}-[[:xdigit:]]{12}$'
[[ "${GITHUB_SHA:-}" =~ $sha_re && "${SORTEX_SIMULATOR_ID:-}" =~ $sim_re &&
   "${SORTEX_IOS_UI_BUYER_PASSWORD:-}" =~ ^[0-9a-f]{48}$ &&
   -d "${RUNNER_TEMP:-}" && "$RUNNER_TEMP" == /* ]] || refuse runner-prerequisites

runner_temp="$RUNNER_TEMP"
temp="$(mktemp -d "$runner_temp/sortex-xcuitest.XXXXXX")"
trap 'rm -rf -- "$temp"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
unset password
password="$SORTEX_IOS_UI_BUYER_PASSWORD"
unset SORTEX_IOS_UI_BUYER_PASSWORD SORTEX_XCUI_FIXTURE_PASSWORD
base="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$base/../.." && pwd)"
source "$root/.github/native-ui/checkpoint.sh"
checkpoint launcher-validated

# Retain the same local-only ATS exception as the established Maestro fixture.
cd "$root/apps/mobile"
plist=ios/SorteXTeste/Info.plist
[[ -f "$plist" ]] || refuse generated-plist
pb=/usr/libexec/PlistBuddy
[[ "$("$pb" -c 'Print :NSAppTransportSecurity:NSAllowsArbitraryLoads' "$plist")" == false ]] ||
  refuse unsafe-generated-plist
{
  "$pb" -c 'Set :NSAppTransportSecurity:NSAllowsLocalNetworking false' "$plist"
  "$pb" -c 'Add :NSAppTransportSecurity:NSExceptionDomains dict' "$plist"
  "$pb" -c 'Add :NSAppTransportSecurity:NSExceptionDomains:127.0.0.1 dict' "$plist"
  "$pb" -c 'Add :NSAppTransportSecurity:NSExceptionDomains:127.0.0.1:NSExceptionAllowsInsecureHTTPLoads bool true' "$plist"
} >"$temp/plist.log" 2>&1 || refuse local-transport

# Use the established Release build and verified ad-hoc simulator signature.
RUNNER_TEMP="$temp" SORTEX_SIMULATOR_KEYCHAIN=1 bash "$root/.github/mobile/ios-simulator-release.sh" \
  >"$temp/release-build.log" 2>&1 || refuse release-build
app="$temp/sortex-ios-simulator/Build/Products/Release-iphonesimulator/SorteXTeste.app"
[[ "$("$pb" -c 'Print :NSAppTransportSecurity:NSAllowsArbitraryLoads' "$app/Info.plist")" == false &&
   "$("$pb" -c 'Print :NSAppTransportSecurity:NSAllowsLocalNetworking' "$app/Info.plist")" == false &&
   "$("$pb" -c 'Print :NSAppTransportSecurity:NSExceptionDomains:127.0.0.1:NSExceptionAllowsInsecureHTTPLoads' "$app/Info.plist")" == true ]] ||
  refuse unsafe-release-plist
checkpoint release-installed

# Build the driver without the password. Only the private run specification
# passes it to the distinct test host; nothing is injected into the SorteX app.
derived="$temp/driver"
dest="platform=iOS Simulator,id=$SORTEX_SIMULATOR_ID"
xcrun xcodebuild -project "$base/SortexFixtureUI.xcodeproj" -scheme SortexFixtureUITests \
  -configuration Debug -sdk iphonesimulator -destination "$dest" -derivedDataPath "$derived" \
  -parallel-testing-enabled NO CODE_SIGNING_ALLOWED=NO build-for-testing \
  >"$temp/test-build.log" 2>&1 || refuse driver-build
shopt -s nullglob
specs=("$derived"/Build/Products/*.xctestrun)
[[ "${#specs[@]}" == 1 ]] || refuse test-spec-count
spec="$derived/Build/Products/fixture-private.xctestrun"
printf '%s' "$password" | python3 "$base/evidence.py" prepare "${specs[0]}" "$spec" "$app" ||
  refuse test-spec-guard
unset password

result="$temp/Test.xcresult"
xcrun xcodebuild -xctestrun "$spec" -destination "$dest" -parallel-testing-enabled NO \
  -resultBundlePath "$result" test-without-building >"$temp/test.log" 2>&1 || refuse ui-steps
xcrun xcresulttool get test-results tests --path "$result" 2>"$temp/result-errors.log" |
  python3 "$base/evidence.py" verify || refuse result-guard
checkpoint signed-out-relaunch-verified
# The caller separately performs the strict API, campaign and database checks.
