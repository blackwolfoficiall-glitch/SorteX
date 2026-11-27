#!/usr/bin/env bash
# Called once in CI. Nothing is emitted as evidence until the server verifies.
set -euo pipefail
umask 077
base="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$base/../.." && pwd)"
if bash "$root/.github/native-ui/with-fixture.sh" bash "$base/run.sh"; then
  :
else
  result=$?
  # Preserve the target's failed result regardless of optional diagnostics.
  bash "$base/fixture-failure.sh" >/dev/null 2>&1 || true
  exit "$result"
fi
[[ "${GITHUB_SHA:-}" =~ ^[0-9a-f]{40}$ && -d "${RUNNER_TEMP:-}" ]]
IFS= read -r stage < "$RUNNER_TEMP/sortex-native-ui-checkpoint"
[[ "$stage" == server-verification-complete ]]
printf 'sha=%s\nengine=xcuitest\nscope=ios-simulator-disposable-loopback\nui=buyer-login,campaign,restored-session,logout,signed-out-relaunch\nserver=exact-login-2xx,campaign-read,session-revoked\n' \
  "$GITHUB_SHA" > "$RUNNER_TEMP/sortex-xcuitest-summary.txt"
