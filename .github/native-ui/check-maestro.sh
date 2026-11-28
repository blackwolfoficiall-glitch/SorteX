#!/usr/bin/env bash
set -euo pipefail
: "${MAESTRO_BIN:?}"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
unset SORTEX_IOS_UI_BUYER_PASSWORD BUYER_PASSWORD MAESTRO_CLOUD_API_KEY
export MAESTRO_CLI_NO_ANALYTICS=true
export MAESTRO_DISABLE_UPDATE_CHECK=true
export MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true
# Maestro 2.12.1 exception reports do not honor the analytics opt-out.
export MAESTRO_API_URL=http://127.0.0.1:1

if ! detected="$("$MAESTRO_BIN" --version 2>/dev/null)" || [[ "$detected" != 2.12.1 ]]; then
  echo 'Pinned Maestro 2.12.1 did not start.' >&2
  exit 64
fi
for phase in startup session campaign signed-in-relaunch logout signed-out-relaunch; do
  if ! "$MAESTRO_BIN" check-syntax "$root/.github/native-ui/buyer-$phase.yaml" >/dev/null 2>&1; then
    printf 'Pinned Maestro rejected the %s flow.\n' "$phase" >&2
    exit 64
  fi
done
echo 'Pinned Maestro 2.12.1 accepted all six isolated iOS flows.'
