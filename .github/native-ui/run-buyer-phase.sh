#!/usr/bin/env bash
# Called only by the guarded Release launcher on the selected disposable simulator.
set -euo pipefail
umask 077
: "${MAESTRO_BIN:?}" "${SORTEX_SIMULATOR_ID:?}" "${RUNNER_TEMP:?}"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
args=()
case "${1:-}" in
  login)
    [[ "${SORTEX_IOS_UI_BUYER_PASSWORD:-}" =~ ^[0-9a-f]{48}$ ]] || exit 64
    args=(-e "BUYER_PASSWORD=$SORTEX_IOS_UI_BUYER_PASSWORD")
    flow=buyer-session.yaml
    ;;
  campaign|signed-in-relaunch|logout|signed-out-relaunch)
    flow="buyer-$1.yaml"
    ;;
  *) exit 64 ;;
esac
unset SORTEX_IOS_UI_BUYER_PASSWORD BUYER_PASSWORD MAESTRO_CLOUD_API_KEY
export MAESTRO_API_URL=http://127.0.0.1:1
debug="$(mktemp -d "$RUNNER_TEMP/sortex-ui-debug.XXXXXX")"
trap 'rm -rf -- "$debug"' EXIT
# The full transcript stays private and is destroyed even on failure. Only
# the login phase may put two allowlisted classifications in the phase report.
console=/dev/null
if [[ "$1" == login && "${SORTEX_IOS_UI_CHECKPOINTS:-}" == 1 ]]; then
  console="$debug/console"
fi
if "$MAESTRO_BIN" --no-ansi --device "$SORTEX_SIMULATOR_ID" test \
  --debug-output "$debug" --test-output-dir "$debug" \
  ${args[@]+"${args[@]}"} "$root/.github/native-ui/$flow" </dev/null >"$console" 2>&1; then
  exit 0
else
  result=$?
fi

if [[ "$console" != /dev/null ]]; then
  if node "$root/.github/native-ui/login-failure-status.cjs" "$console" \
      "${SORTEX_IOS_UI_API_LOG:-}" > "$debug/summary" 2>/dev/null; then
    mv -f -- "$debug/summary" "$RUNNER_TEMP/sortex-native-ui-login-diagnostic" 2>/dev/null || true
  fi
fi
exit "$result"
