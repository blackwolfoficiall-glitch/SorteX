#!/usr/bin/env bash
# Source from the two CI wrappers. Persist only fixed phase codes, never logs.
checkpoint() {
  [[ "${SORTEX_IOS_UI_CHECKPOINTS:-}" == 1 ]] || return 0
  case "$1" in
    fixture-entered|postgres-started|migrations-applied|fixture-seeded|api-ready|\
    launcher-validated|release-installed|startup-controls-verified|\
    login-verified|campaign-verified|signed-in-relaunch-verified|logout-verified|\
    signed-out-relaunch-verified|signed-out-evidence-saved|server-verification-complete) ;;
    *) return 64 ;;
  esac
  local status
  status="$(mktemp "${RUNNER_TEMP:?}/sortex-ui-phase.XXXXXX")" || return
  printf '%s\n' "$1" > "$status" || return
  mv -f -- "$status" "$RUNNER_TEMP/sortex-native-ui-checkpoint"
}
