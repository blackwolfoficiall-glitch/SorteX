#!/usr/bin/env bash
# Called only after run-ios.sh installs and validates the local simulator app.
set -euo pipefail
: "${MAESTRO_BIN:?}" "${SORTEX_SIMULATOR_ID:?}" "${RUNNER_TEMP:?}" "${GITHUB_SHA:?}"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
debug="$(mktemp -d "$RUNNER_TEMP/sortex-startup-debug.XXXXXX")"
trap 'rm -rf -- "$debug"' EXIT

# This phase neither receives a fixture password nor runs commands to enter
# credentials. Strip them from this entire probe subprocess, including any
# screenshot command, and keep the raw Maestro output off public artifacts.
unset SORTEX_IOS_UI_BUYER_PASSWORD BUYER_PASSWORD MAESTRO_CLOUD_API_KEY
[[ "$GITHUB_SHA" =~ ^[0-9a-f]{40}$ ]] || exit 64
if "$MAESTRO_BIN" --device "$SORTEX_SIMULATOR_ID" test \
   --debug-output "$debug" --test-output-dir "$debug" \
   "$root/.github/native-ui/buyer-startup.yaml"; then
  exit 0
fi

out="$RUNNER_TEMP/sortex-native-startup-failure"
mkdir -m 700 "$out"
capture=unavailable
if xcrun simctl io "$SORTEX_SIMULATOR_ID" screenshot "$out/startup.png"; then
  capture=before-credential-entry
else
  rm -f "$out/startup.png"
fi
# Query only this app's recent Keychain errors and export an allowlisted
# category. A lack of correlated log lines is not proof of a healthy Keychain.
keychain=not-observed
if observed="$(
  xcrun simctl spawn "$SORTEX_SIMULATOR_ID" log show --last 3m --style compact \
    --predicate '(process == "securityd" OR process == "secd") AND (eventMessage CONTAINS "SorteXTeste" OR eventMessage CONTAINS "br.com.sortex.development")' \
    2>/dev/null | node "$root/.github/native-ui/keychain-status.cjs"
)"; then
  keychain="$observed"
fi
printf 'sha=%s\nstage=pre-credential-login-view-not-verified\nscreenshot=%s\nkeychain=%s\n' \
  "$GITHUB_SHA" "$capture" "$keychain" > "$out/startup.txt"
exit 65
