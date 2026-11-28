#!/usr/bin/env bash
# No backend, app build, simulator boot, credentials, or UI tests.
set -euo pipefail
set +x
umask 077
base="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
sha_re='^[0-9a-f]{40}$'
[[ "${RUNNER_OS:-}" == macOS && "${GITHUB_REPOSITORY:-}" == blackwolfoficiall-glitch/SorteX &&
   "${GITHUB_REF:-}" == refs/heads/homologacao/web-ios-integrada && "${GITHUB_EVENT_NAME:-}" == push &&
   "${GITHUB_SHA:-}" =~ $sha_re && -d "${RUNNER_TEMP:-}" && "$RUNNER_TEMP" == /* &&
   -z "${DATABASE_URL:-}" && -z "${SORTEX_IOS_UI_BUYER_PASSWORD:-}" &&
   -z "${SORTEX_XCUI_FIXTURE_PASSWORD:-}" ]] || exit 64

report="$RUNNER_TEMP/sortex-xcuitest-driver-preflight.txt"
[[ ! -e "$report" && ! -L "$report" ]] || exit 64
printf 'sha=%s\nmode=driver-only\n' "$GITHUB_SHA" >"$report"
temp="$(mktemp -d "$RUNNER_TEMP/sortex-xcuitest-preflight.XXXXXX")"
trap 'rm -rf -- "$temp"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
if xcrun xcodebuild -version >"$temp/xcode-version" 2>/dev/null; then
  LC_ALL=C grep -E '^(Xcode [0-9]+(\.[0-9]+){0,2}|Build version [0-9A-Za-z]{4,16})$' "$temp/xcode-version" >>"$report" || true
fi
if ! bash "$base/build-driver.sh" "$temp"; then
  printf 'readiness=driver-build-failed\n' >>"$report"
  exit 64
fi
shopt -s nullglob
specs=("$temp"/driver/Build/Products/*.xctestrun)
if [[ "${#specs[@]}" != 1 ]]; then
  printf 'readiness=test-spec-count\n' >>"$report"
  exit 64
fi
python3 "$base/evidence.py" inspect "${specs[0]}" >>"$report"
