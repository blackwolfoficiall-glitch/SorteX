#!/usr/bin/env bash
# Called only by the guarded Release launcher on the selected disposable simulator.
set -euo pipefail
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
# Maestro needs a writable scratch directory for its private metadata. Do not
# retain it, and never return CLI output, hierarchy or screenshots from these phases.
"$MAESTRO_BIN" --no-ansi --device "$SORTEX_SIMULATOR_ID" test \
  --debug-output "$debug" --test-output-dir "$debug" \
  ${args[@]+"${args[@]}"} "$root/.github/native-ui/$flow" </dev/null >/dev/null 2>&1
