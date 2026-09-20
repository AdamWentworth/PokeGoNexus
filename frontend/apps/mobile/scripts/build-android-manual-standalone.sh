#!/usr/bin/env bash

set -euo pipefail

script_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mobile_directory="$(cd "${script_directory}/.." && pwd)"
frontend_directory="$(cd "${mobile_directory}/../.." && pwd)"
repository_directory="$(cd "${frontend_directory}/.." && pwd)"
artifact_directory="${POKEGONEXUS_ANDROID_MANUAL_ARTIFACT_DIR:-${mobile_directory}/.artifacts/manual-standalone}"
android_architectures="${POKEGONEXUS_ANDROID_ARCHITECTURES:-arm64-v8a}"

case "${android_architectures}" in
  arm64-v8a|armeabi-v7a|x86|x86_64) ;;
  *)
    echo "Unsupported POKEGONEXUS_ANDROID_ARCHITECTURES: ${android_architectures}" >&2
    exit 2
    ;;
esac

mkdir -p "${artifact_directory}"
commit="$(git -C "${repository_directory}" rev-parse --short=8 HEAD)"
apk_name="PokeGoNexus-manual-${commit}-${android_architectures}.apk"
apk_source="${mobile_directory}/android/app/build/outputs/apk/release/app-release.apk"
apk_destination="${artifact_directory}/${apk_name}"

echo "Building normal standalone Native APK for manual testing at commit ${commit}."
echo "Device-smoke fixtures, forced theme, and timing holds are disabled."

env \
  NODE_ENV=production \
  EXPO_PUBLIC_APP_ENV=preview \
  EXPO_PUBLIC_MOBILE_EXPERIENCE=native-preview \
  EXPO_PUBLIC_DEVICE_SMOKE_MODE=false \
  CI=1 \
  nice -n 10 npx expo prebuild --platform android --no-install \
    >"${artifact_directory}/expo-prebuild.log" 2>&1

env \
  NODE_ENV=production \
  EXPO_PUBLIC_APP_ENV=preview \
  EXPO_PUBLIC_MOBILE_EXPERIENCE=native-preview \
  EXPO_PUBLIC_DEVICE_SMOKE_MODE=false \
  CI=1 \
  nice -n 10 "${mobile_directory}/android/gradlew" \
    -p "${mobile_directory}/android" app:assembleRelease \
    -PreactNativeArchitectures="${android_architectures}" \
    --no-daemon \
    --max-workers=2 \
    >"${artifact_directory}/gradle-build.log" 2>&1

if [[ ! -f "${apk_source}" ]]; then
  echo "Android APK was not produced: ${apk_source}" >&2
  exit 1
fi

cp "${apk_source}" "${apk_destination}"
chmod 0644 "${apk_destination}"

echo "Manual standalone APK: ${apk_destination}"
sha256sum "${apk_destination}"
