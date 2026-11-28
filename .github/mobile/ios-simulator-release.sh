#!/usr/bin/env bash
# Run from apps/mobile after the workflow's Expo prebuild and capability check.
set -euo pipefail

: "${EXPO_PUBLIC_API_URL:?Set the isolated QA API before the build}"
: "${RUNNER_TEMP:?Set the temporary build directory}"
: "${SORTEX_SIMULATOR_ID:?Select an available booted iPhone simulator}"
scheme=SorteXTeste
bundle_id=br.com.sortex.development
derived_data="$RUNNER_TEMP/sortex-ios-simulator"
app_path="$derived_data/Build/Products/Release-iphonesimulator/$scheme.app"
signing=(CODE_SIGNING_ALLOWED=NO)
keychain_mode="${SORTEX_SIMULATOR_KEYCHAIN:-0}"
case "$keychain_mode" in
  0) ;;
  1)
    # This is Xcode's local simulator signing, never an Apple team credential,
    # physical provisioning profile or app distribution signature.
    [[ "${RUNNER_OS:-}" == macOS && "${GITHUB_REPOSITORY:-}" == blackwolfoficiall-glitch/SorteX &&
      "${GITHUB_REF:-}" == refs/heads/homologacao/web-ios-integrada && "${GITHUB_EVENT_NAME:-}" == push &&
      "${SORTEX_IOS_UI_SCOPE:-}" == disposable-loopback && "${EXPO_PUBLIC_ALLOW_LOCAL_API:-}" == 1 &&
      "${SORTEX_IOS_UI_API:-}" == http://127.0.0.1:3338 && "$EXPO_PUBLIC_API_URL" == "$SORTEX_IOS_UI_API" ]] || {
      echo 'Native Keychain signing requires the isolated loopback UI runner.' >&2
      exit 64
    }
    signing=(CODE_SIGNING_ALLOWED=YES CODE_SIGNING_REQUIRED=YES CODE_SIGN_IDENTITY=- DEVELOPMENT_TEAM= PROVISIONING_PROFILE_SPECIFIER=)
    ;;
  *)
    echo 'Unknown simulator signing mode.' >&2
    exit 64
    ;;
esac

# Reuse the prebuild and install the Pods; do not call Expo run:ios here.
# In SDK 58 its dev-client launcher can route into a Metro URL even without
# starting a bundler. A standalone Release opens by its installed bundle ID.
pod install --project-directory=ios
test -d "ios/$scheme.xcworkspace"
xcrun xcodebuild \
  -workspace "ios/$scheme.xcworkspace" \
  -scheme "$scheme" \
  -configuration Release \
  -sdk iphonesimulator \
  -destination "platform=iOS Simulator,id=$SORTEX_SIMULATOR_ID" \
  -derivedDataPath "$derived_data" \
  "${signing[@]}" \
  build

test -s "$app_path/main.jsbundle"
grep -aFq -- "$EXPO_PUBLIC_API_URL" "$app_path/main.jsbundle"
if [[ "$keychain_mode" == 1 ]]; then
  codesign --verify --strict "$app_path" || exit 64
  signature="$(codesign -dv "$app_path" 2>&1)" || exit 64
  if ! grep -Fx "Identifier=$bundle_id" <<< "$signature" >/dev/null ||
    ! grep -Fx 'Signature=adhoc' <<< "$signature" >/dev/null; then
    echo 'Refusing to install a simulator app without matching local ad-hoc signing.' >&2
    exit 64
  fi
  echo 'Local ad-hoc signature verified for the iOS simulator bundle.'
fi
xcrun simctl install "$SORTEX_SIMULATOR_ID" "$app_path"
xcrun simctl launch --terminate-running-process "$SORTEX_SIMULATOR_ID" "$bundle_id"
