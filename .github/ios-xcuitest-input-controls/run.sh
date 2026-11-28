#!/usr/bin/env bash
# Explicit isolated workflow only: actual Release sign-in field, no account/API.
set -euo pipefail
set +x
umask 077

[[ "${RUNNER_OS:-}" == macOS && "${GITHUB_REPOSITORY:-}" == blackwolfoficiall-glitch/SorteX &&
  "${GITHUB_REF:-}" == refs/heads/homologacao/web-ios-integrada && "${GITHUB_EVENT_NAME:-}" == push &&
  "${SORTEX_IOS_INPUT_CONTROL:-}" == 1 &&
  "${EXPO_PUBLIC_API_URL:-}" == http://127.0.0.1:3338 && "${EXPO_PUBLIC_ALLOW_LOCAL_API:-}" == 1 &&
  "${EXPO_PUBLIC_ENABLE_TEST_RESERVATIONS:-}" == 0 && "${EXPO_NO_DOTENV:-}" == 1 &&
  -z "${DATABASE_URL:-}" && -z "${SORTEX_IOS_UI_BUYER_PASSWORD:-}" && -z "${SORTEX_XCUI_FIXTURE_PASSWORD:-}" &&
  "${GITHUB_SHA:-}" =~ ^[0-9a-f]{40}$ && "${RUNNER_TEMP:-}" == /* && -d "$RUNNER_TEMP" ]] || exit 64

base="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$base/../.." && pwd)"
report="$RUNNER_TEMP/sortex-native-input-control.txt"
[[ ! -e "$report" && ! -L "$report" ]] || exit 64
( set -o noclobber
  printf 'sha=%s\nscope=native-signed-out-input-only\n' "$GITHUB_SHA" >"$report"
)
stop() {
  printf 'phase=%s\ncomparison=indeterminate\n' "$1" >> "$report"
  exit 64
}

temp="$(mktemp -d "$RUNNER_TEMP/sortex-input-control.XXXXXX")"
sim=
cleanup() {
  # Never shut down/delete a pre-existing or unverified target.
  if [[ -n "$sim" ]]; then
    xcrun simctl shutdown "$sim" >/dev/null 2>&1 || true
    xcrun simctl delete "$sim" >/dev/null 2>&1 || true
  fi
  rm -rf -- "$temp"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

export DEVELOPER_DIR=/Applications/Xcode_26.6.app/Contents/Developer
[[ "$(uname -m)" == arm64 && -d "$DEVELOPER_DIR" ]] || stop xcode-unavailable
version="$(xcrun xcodebuild -version 2>/dev/null)" || stop xcode-unavailable
[[ "$version" == $'Xcode 26.6\nBuild version 17F113' ]] || stop xcode-unavailable
if ! xcrun simctl list runtimes --json 2>/dev/null | python3 -B "$base/control.py" runtime; then
  stop runtime-unavailable
fi
if ! xcrun simctl list devicetypes --json 2>/dev/null | python3 -B "$base/control.py" model; then
  stop model-unavailable
fi
# Assert the exact loopback port has no listener. There is no backend/fixture
# to authenticate against, even if an unexpected UI action were attempted.
node -e 'const s=require("node:net").createConnection({host:"127.0.0.1",port:3338});
s.setTimeout(2000,()=>{s.destroy();process.exitCode=1});
s.on("connect",()=>{s.destroy();process.exitCode=1});
s.on("error",e=>{process.exitCode=e.code==="ECONNREFUSED"?0:1})' >/dev/null 2>&1 ||
  stop loopback-not-closed

type=com.apple.CoreSimulator.SimDeviceType.iPhone-17
runtime=com.apple.CoreSimulator.SimRuntime.iOS-26-5
created="$(xcrun simctl create SortexInputControl "$type" "$runtime" 2>/dev/null)" || stop clean-device-unavailable
[[ "$created" =~ ^[A-Fa-f0-9]{8}(-[A-Fa-f0-9]{4}){3}-[A-Fa-f0-9]{12}$ ]] || stop clean-device-unavailable
sim="$created"
export SORTEX_SIMULATOR_ID="$sim"
xcrun simctl boot "$sim" >"$temp/sim-boot.log" 2>&1 || stop clean-device-unavailable
xcrun simctl bootstatus "$sim" -b >"$temp/sim-ready.log" 2>&1 || stop clean-device-unavailable
if ! xcrun simctl list devices --json 2>/dev/null | python3 -B "$base/control.py" device "$sim"; then
  stop clean-device-verification
fi
if xcrun simctl get_app_container "$sim" br.com.sortex.development app >/dev/null 2>&1; then
  stop app-already-installed
fi
printf 'xcode=26.6-17F113\nmodel=iphone-17\nruntime=ios-26.5\nclean-device=verified\n' >>"$report"

# Build/install the real standalone candidate, using the existing simulator-
# only ad-hoc signing with no password or Apple developer credentials.
(cd "$root/apps/mobile"
  RUNNER_TEMP="$temp" SORTEX_SIMULATOR_KEYCHAIN=1 SORTEX_IOS_UI_SCOPE=disposable-loopback \
    SORTEX_IOS_UI_API=http://127.0.0.1:3338 bash "$root/.github/mobile/ios-simulator-release.sh"
) >"$temp/release.log" 2>&1 || stop release-build
app="$temp/sortex-ios-simulator/Build/Products/Release-iphonesimulator/SorteXTeste.app"

# Reuse the already-proven Xcode project structure, but compile only the
# credential-free probe source. The existing login runner is not copied.
mkdir -m 700 "$temp/driver-source"
cp -R "$root/.github/ios-xcuitest/SortexFixtureUI.xcodeproj" "$temp/driver-source/"
cp "$root/.github/ios-xcuitest/build-driver.sh" "$temp/driver-source/"
cp "$base/BuyerEmailInputControls.swift" "$temp/driver-source/BuyerJourneys.swift"
bash "$temp/driver-source/build-driver.sh" "$temp" || stop driver-build
shopt -s nullglob
specs=("$temp"/driver/Build/Products/*.xctestrun)
[[ "${#specs[@]}" == 1 ]] || stop driver-specification
spec="$temp/driver/Build/Products/input-control-private.xctestrun"
python3 -B "$base/control.py" spec "${specs[0]}" "$spec" "$app" || stop driver-specification

result="$temp/Control.xcresult"
code=zero
xcrun xcodebuild -xctestrun "$spec" -destination "platform=iOS Simulator,id=$sim" \
  -parallel-testing-enabled NO -resultBundlePath "$result" test-without-building \
  >"$temp/test.log" 2>&1 || code=nonzero
printf 'phase=control-completed-or-stopped\nxcode-test-exit=%s\n' "$code" >>"$report"
python3 -B "$base/control.py" report "$result" >>"$report" 2>/dev/null || exit 64
[[ "$code" == zero ]]
