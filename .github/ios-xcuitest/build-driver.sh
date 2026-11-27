#!/usr/bin/env bash
# Shared exact Xcode invocation for preflight and the later full test.
set -euo pipefail
set +x
umask 077
base="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
sim_re='^[[:xdigit:]]{8}(-[[:xdigit:]]{4}){3}-[[:xdigit:]]{12}$'
[[ "${RUNNER_OS:-}" == macOS && "${GITHUB_REPOSITORY:-}" == blackwolfoficiall-glitch/SorteX &&
   "${GITHUB_REF:-}" == refs/heads/homologacao/web-ios-integrada && "${GITHUB_EVENT_NAME:-}" == push &&
   "${SORTEX_SIMULATOR_ID:-}" =~ $sim_re && -d "${RUNNER_TEMP:-}" && "$RUNNER_TEMP" == /* &&
   -z "${SORTEX_IOS_UI_BUYER_PASSWORD:-}" && -z "${SORTEX_XCUI_FIXTURE_PASSWORD:-}" &&
   -z "${DATABASE_URL:-}" ]] || exit 64
[[ "$#" == 1 && "$1" == "$RUNNER_TEMP/"* && -d "$1" && ! -L "$1" ]] || exit 64
derived="$1/driver"
xcrun xcodebuild -project "$base/SortexFixtureUI.xcodeproj" -scheme SortexFixtureUITests \
  -configuration Debug -sdk iphonesimulator -destination "platform=iOS Simulator,id=$SORTEX_SIMULATOR_ID" \
  -derivedDataPath "$derived" -parallel-testing-enabled NO CODE_SIGNING_ALLOWED=NO build-for-testing \
  >"$1/test-build.log" 2>&1
