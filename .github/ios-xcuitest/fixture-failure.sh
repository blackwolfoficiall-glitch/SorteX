#!/usr/bin/env bash
# On early failures, retain fixed phase names, not fixture logs or credentials.
set -euo pipefail
set +x
umask 077
[[ "${GITHUB_SHA:-}" =~ ^[0-9a-f]{40}$ && "${RUNNER_TEMP:-}" == /* &&
   -d "$RUNNER_TEMP" ]] || exit 64

checkpoint_file="$RUNNER_TEMP/sortex-native-ui-checkpoint"
report="$RUNNER_TEMP/sortex-xcuitest-fixture-failure.txt"
[[ ! -e "$report" && ! -L "$report" ]] || exit 64
last=none
window=fixture-entry
if [[ -f "$checkpoint_file" && ! -L "$checkpoint_file" ]] &&
  IFS= read -r phase < "$checkpoint_file"; then
  # A window means the next expected phase was not recorded; it does not
  # identify a failed operation when checkpoint persistence itself fails.
  case "$phase" in
    fixture-entered) last=fixture-entered; window=postgres-start ;;
    postgres-started) last=postgres-started; window=database-migration ;;
    migrations-applied) last=migrations-applied; window=fixture-seed ;;
    fixture-seeded) last=fixture-seeded; window=api-readiness ;;
    api-ready) last=api-ready; window=launcher-entry ;;
    launcher-validated) last=launcher-validated; window=release-install ;;
    release-installed) last=release-installed; window=driver-or-ui ;;
    signed-out-relaunch-verified) last=signed-out-relaunch-verified; window=server-verification ;;
    server-verification-complete) last=server-verification-complete; window=success-summary ;;
    *) last=unknown; window=unknown ;;
  esac
fi
( set -o noclobber
  printf 'sha=%s\nlast-checkpoint=%s\nnext-unrecorded-window=%s\n' "$GITHUB_SHA" "$last" "$window" > "$report"
)
