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
  CODE_SIGNING_ALLOWED=NO \
  build

test -s "$app_path/main.jsbundle"
grep -aFq -- "$EXPO_PUBLIC_API_URL" "$app_path/main.jsbundle"
xcrun simctl install "$SORTEX_SIMULATOR_ID" "$app_path"
xcrun simctl launch --terminate-running-process "$SORTEX_SIMULATOR_ID" "$bundle_id"
