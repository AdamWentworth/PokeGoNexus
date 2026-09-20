# Android beta distribution

Android only for this phase. No Play Store submission, iOS build, TestFlight
invitation, automatic APK publication, or over-the-air updates are configured.

## Branch and release policy

The native migration has merged into `master`, alongside the Vite website, and
the completed `mobile/native-migration` branch has been retired. Work directly on
`master` for both clients unless the owner explicitly requests a branch. Web,
shared-package, authentication, and mobile CI checks apply to their affected code.

Merging source, deploying the web image through HomeOps, and publishing an Android
beta are separate operations. A merge does not publish an APK. Android candidates
can be tested before the migration merges. The activation script requires their
source commit to be an ancestor of `origin/master` before adding a public website
download. Use a merge commit for the migration so tested source commits retain
their ancestry; a squash requires a new candidate from the resulting master.

## Build a candidate

Prerequisites: Node 24, Expo project access, GitHub CLI authenticated for this
repository, and Android SDK build-tools/Java plus `unzip` for APK verification.
EAS uses the existing project's **managed Android release keystore**. Preserve
and back up that key through Expo credentials management; never replace it between
beta builds. Local manual/device-smoke builds use a debug key and are unsuitable
for website distribution.

1. Increase `expo.android.versionCode` in `app.json` for every distributed build;
   update the human-readable version when appropriate. Commit and push first so
   the candidate has a reproducible source SHA. Versioning is explicitly local.
2. From `frontend/apps/mobile`, run either:

   ```sh
   npx eas-cli@24.7.0 workflow:run .eas/workflows/android-beta.yml
   # Or build directly with the same profile:
   npx eas-cli@24.7.0 build --platform android --profile android-beta
   ```

   The workflow has no push trigger. The profile produces a standalone native APK
   with smoke fixtures disabled, release signing, and the live `pokegonexus.com`
   services. Testers use their real accounts; edits are real. Do not substitute a
   development client, performance build, or default WebView production profile.

   When cloud quota is unavailable, build with the same managed signing key on
   a Linux/macOS machine with Java and the Android SDK configured:

   ```sh
   node scripts/android-beta/build-local.mjs
   ```

   This requires Expo authentication but does not use EAS cloud build quota.
   It records the source commit and APK checksum in a local receipt. Keep the
   working tree unchanged while it runs. On Windows, use the Linux environment
   that already supports this project's Android builds.

3. Write release notes with changes, known limitations, and the device checks
   performed. Use a local file outside tracked source for draft notes.
4. Prepare the exact EAS artifact as a GitHub **draft prerelease**:

   ```sh
   export ANDROID_HOME=/path/to/Android/Sdk
   node scripts/android-beta/prepare.mjs prepare EAS_BUILD_ID /path/to/notes.md
   ```

   The script downloads the build directly from EAS, verifies the package,
   embedded native configuration, production API origins, version, source SHA,
   ARM64 support, and non-debug signing certificate. It rejects changes to the
   signer or non-increasing versions once a beta is active. It attaches the APK,
   SHA-256 checksum, and candidate manifest to the draft without changing the web.

   For a local build, use the receipt printed by the build script instead:

   ```sh
   node scripts/android-beta/prepare.mjs prepare-local /path/to/receipt.json /path/to/notes.md
   ```

   The same APK checks apply. Release notes identify the build as local EAS;
   they do not claim a cloud build ID.

## Verify and publish

Install the exact downloaded candidate from `.artifacts/android-beta/<versionCode>`.
Check cold launch without Metro, sign-in and session restore, collection sync,
core routes, and an install-over update from the previous public beta. Record the
APK checksum and device result in the release notes. Existing debug-signed test
installs cannot be updated in place with the release key: sync pending changes
first and plan that one-time migration explicitly; never silently uninstall them.

Publish the tested draft as a GitHub **prerelease**, leaving “latest” disabled.
GitHub Releases preserves the signed source artifact. Website CI downloads that
exact APK, verifies its size and SHA-256, and includes it in the frontend image.
Nginx serves it directly from `/downloads/android/` with an APK filename, MIME
type, attachment disposition, and byte-range support. The button stays on the
website, and the service worker leaves APK downloads to the browser.
Then enable that exact release on the website:

```sh
node scripts/android-beta/prepare.mjs activate .artifacts/android-beta/VERSION_CODE/android-beta.json
```

Activation checks that the build source has merged to master, the release is
published, the download exists, and its SHA-256 matches the candidate. It writes
`frontend/packages/app-core/src/pages/Download/android-beta.json`. Review and
commit that change, run web checks, and deploy the resulting web image through
the existing HomeOps workflow. The page links an explicit version, never a moving
`latest` URL. Before activation, it explains that the first beta is being prepared
and offers the web app without a broken download button.

For later updates, repeat with a higher versionCode and the same signing key.
Testers return to `/download` and install over the existing app. To pause new
downloads, set only `release` to `null` in the website manifest and deploy that
change; retain its signing fingerprint and highest version to protect upgrades.

## Checks

```sh
node --test scripts/android-beta/release.test.mjs
cd ../web
node --test scripts/stage-android-beta.test.mjs
npm run test:file -- tests/unit/pages/Information/Download.unit.test.tsx
npm run test:browsers:ci -- tests/browser/android-beta.spec.ts --project chromium-desktop --project mobile-chrome
```

Also test the actual browser download through completion and opening the saved
APK in Android's installer; checking only the link or fetching the asset outside
the browser does not cover that handoff.

The complete migration CI gates and outstanding device parity/lifecycle checks
still apply. Preparing distribution does not certify all native routes or iOS.
