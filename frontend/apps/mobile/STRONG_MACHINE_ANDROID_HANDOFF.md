# Strong-machine Android performance handoff

Last updated: 2026-09-07

## Next manual candidate requested

The installed `PokeGoNexus-manual-2d87ff8e-arm64-v8a.apk` is now the prior
baseline. It includes the location-card correction, fixed Trades transition
hierarchy, reusable Rankings/Max segmented indicator, corrected Pokémon sort
overlay, and smooth explicit Pokédex region navigation. It does not include the
next correction: Raid and PvP still have static workspace controls, while
Rankings and Max move only their indicator and replace the workspace instantly.
The next build puts all four routes on the shared 200 ms native-thread control
and directional content motion. It also removes the eager quadratic Trades
preference projection that can freeze the route for large collections by
sharing preparation and lazily caching only opened listings.

On the stronger machine, pull the latest clean `mobile/native-migration` HEAD
and run the existing normal manual command:

```bash
npm --workspace apps/mobile run build:android:manual
```

Upload exactly its one generated
`PokeGoNexus-manual-<commit>-arm64-v8a.apk` plus checksum to the `public` share.
Do not substitute a device-smoke build and do not put multiple APKs into a new
download/QR bundle. The receiving workstation should verify the embedded
`deviceSmokeMode: false` setting and checksum, then install it in place over
the one existing `com.pokegonexus.app` package so the signed-in session and
single-app identity remain intact.

## Result on the original workstation

The strong-machine build was completed for commit
`5c7f025bec6b8f70e520e550d7b0c9d5eef256f9` and retrieved from the mounted
`public` SMB share as `PokeGoNexus-information-5c7f025b-arm64.apk`. Its SHA-256
is `2dc4b68743319113f30ad3615a72b544394035f3c4975e12c78ea337ea317882`.
The APK is ARM64-only, contains the bundled JavaScript for this commit, has a
non-debuggable manifest, and is locally debug-signed. It is therefore valid as
a standalone performance candidate, not as a production-distribution or
ordinary manual-testing binary. It was compiled with device-smoke mode enabled.

The APK installed on the physical 120 Hz Pixel 8 Pro and completed both the
required five-run workflow and a ten-run repeatability workflow without a
functional failure, retry, or app crash. The strict ten-sample same-phone
comparison did **not** fully pass:

| FAQ action | Vite median / p95 | Native median / p95 | Result |
| --- | ---: | ---: | --- |
| Topic selection | 111.8 / 149.2 ms | 114.0 / 124.0 ms | Median miss by 2.2 ms |
| Expand all answers | 47.25 / 137.1 ms | 60.5 / 76.0 ms | Median miss by 13.25 ms |
| Search | 125.1 / 160.9 ms | 24.0 / 36.0 ms | Pass |
| Clear | 90.85 / 118.5 ms | 61.0 / 75.0 ms | Pass |

Native was more consistent and had a faster p95 for all four actions, but the
project's acceptance rule requires both median and p95. The next implementation
pass should focus only on FAQ topic selection and expand-all median latency,
then produce a new standalone APK and repeat this gate. Do not rebuild or
retest this exact candidate expecting it to qualify unchanged.

The first ordinary logged-in check exposed why a smoke APK must not be handed
to a person as the manual candidate: the test-only 8,000 ms screenshot hold was
also applied to `/native/raid` and `/native/search`. Phone logs showed each
destination commit in under 90 ms followed by the overlay remaining visible for
another 8.16-8.17 seconds. Source after `5c7f025b` scopes that hold to
`/device-smoke/*`, but a normal manual APK must still be built with smoke mode
disabled using the command in “Build the manual candidate” below.

## Objective

Build the current `mobile/native-migration` branch as a standalone,
release-mode, ARM64 Android APK and complete the physical Pixel performance
gate for the public information/FAQ work. The functional, visual, content, and
browser-proxy parity checkpoint is commit `278718da`.

Read `CURRENT_NATIVE_TESTING_STATUS.md` before changing application code. The
canonical Vite application remains the specification, and Native must be no
slower at both median and p95 for every bounded interaction.

## Why this moved to another machine

- Expo rejected the new `performance-android` build because the account's free
  Android quota is exhausted until October 1, 2026.
- No new EAS build was queued. The newest EAS APK is from commit `e77b3c39` and
  is too old to qualify the current source.
- The original workstation has 16 GB RAM and 2 GB swap. It has completed recent
  one-ABI release builds in about five minutes, but previous resource pressure
  crashed VS Code. Do not run another unrestricted local build there.

## Recommended builder

- 32 GB RAM, or 16 GB RAM with at least 8 GB swap;
- 8 or more CPU cores;
- SSD with at least 30 GB free;
- Node 24, npm, JDK 17, Android SDK/platform tools, and Maestro;
- an unlocked, USB-authorized physical ARM64 Android phone.

The checked-in runner uses a 2 GB Gradle heap, at most two Gradle workers, no
persistent Gradle daemon, and automatically selects the connected phone's
`arm64-v8a` ABI. Do not broaden the build to all four Android ABIs for this
test. The focused APK should be roughly 64 MB; old multi-ABI EAS artifacts are
roughly 167 MB.

## Obtain the exact source

From the repository root:

```bash
git fetch origin
git switch mobile/native-migration
git pull --ff-only origin mobile/native-migration
git status --short --branch
git rev-parse HEAD
```

The worktree must be clean. Record the reported commit with the APK and test
reports. Then install dependencies from `frontend/`:

```bash
nvm use
npm ci
```

## Build and collect Native phone evidence

Connect and unlock the phone, then obtain its ID with the Android SDK's
`platform-tools/adb devices`. From `frontend/apps/mobile/`, substitute that ID
for `PGN_ANDROID_DEVICE` and run:

```bash
PGN_ANDROID_DEVICE=<device-id>
POKEGONEXUS_ANDROID_DEVICE_ID="$PGN_ANDROID_DEVICE" \
POKEGONEXUS_ANDROID_REQUIRE_PHYSICAL=true \
POKEGONEXUS_SMOKE_RUNTIME=standalone \
POKEGONEXUS_SMOKE_PERFORMANCE=true \
POKEGONEXUS_PERFORMANCE_SAMPLES=5 \
POKEGONEXUS_SMOKE_COLOR_SCHEME=dark \
POKEGONEXUS_SMOKE_FLOW=.maestro-performance/native-information-performance.yaml \
POKEGONEXUS_SMOKE_ARTIFACT_DIR=.artifacts/performance-parity/native-information-standalone \
bash scripts/run-android-device-smoke.sh
```

This command prebuilds Android, compiles one release ABI, installs the APK, and
runs five isolated FAQ samples. It must not use Metro, Expo Go, a development
client, or `POKEGONEXUS_SMOKE_SKIP_APK_INSTALL=true`.

Expected outputs:

- APK: `frontend/apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
- Native report:
  `frontend/apps/mobile/.artifacts/performance-parity/native-information-standalone/native-android-performance.json`

If a retained copy is useful, name only one canonical file with the short Git
commit, for example
`PokeGoNexus-information-<commit>-arm64.apk`, under the ignored
`.artifacts/performance-parity/candidates/` directory. Never commit APKs or put
several obsolete downloads behind one QR.

## Build the manual candidate

The performance APK above deliberately enables deterministic fixture routes and
instrumentation. Do not install it as the user-facing manual-test build. After
performance evidence is collected, build one normal Native preview APK from
`frontend/`:

```bash
npm --workspace apps/mobile run build:android:manual
```

The checked-in builder explicitly sets `EXPO_PUBLIC_DEVICE_SMOKE_MODE=false`,
uses a production/minified bundled JavaScript runtime, builds only ARM64 by
default, limits Gradle to two workers and a non-persistent daemon, and writes
one ignored artifact named
`frontend/apps/mobile/.artifacts/manual-standalone/PokeGoNexus-manual-<commit>-arm64-v8a.apk`.
Put only that APK in the handback location for manual testing. The receiving
workstation should verify its checksum, replace the smoke APK on the phone, and
confirm from logs that ordinary navigation has no 8,000 ms hold.

Completed on 2026-09-06: the strong machine produced
`PokeGoNexus-manual-0dad5332-arm64-v8a.apk` with SHA-256
`01456399139065e1dd28c961a415cdd0a22fc264f46cc0137abdd11db57b0c1c`.
The receiving workstation verified the embedded `deviceSmokeMode: false`
configuration, installed it in place while preserving the signed-in session,
and matched the installed package checksum to the source APK. A signed-in
Home → Raid → Search sanity flow passed with a two-second visibility guard per
destination and no eight-second loading overlay. This artifact has since been
superseded on the phone.

Completed on 2026-09-07: the strong machine produced
`PokeGoNexus-manual-8fa33311-arm64-v8a.apk` with SHA-256
`aac5842c107d04b3c2627194c60d4ca2ed389684cbc47a84ffb37000786ff758`.
The receiving workstation matched the shared file to Android's installed
`base.apk` exactly and verified `deviceSmokeMode: false`. This is the currently
installed baseline, but it was superseded by the location-card and motion
candidate below.

Completed on 2026-09-07: the strong machine produced
`PokeGoNexus-manual-2d87ff8e-arm64-v8a.apk` with SHA-256
`81d59d5fb7c0860703feb7d43dfcbfb41869fd16a15f21e2e58327ade69fda5a`.
The receiving workstation verified the public-share checksum, package identity,
ARM64 ABI, and Android-installed `base.apk` checksum, then installed it in place
while preserving the app-data lineage. The app launched successfully. This is
the currently installed baseline, but a newer build is required for the four-
route content motion and Trades route-stability correction described at the top
of this handoff.

## Collect the matching Vite phone reference

With the same phone still connected, run from `frontend/`:

```bash
PGN_ANDROID_DEVICE=<device-id>
POKEGONEXUS_ANDROID_DEVICE_ID="$PGN_ANDROID_DEVICE" \
POKEGONEXUS_PERFORMANCE_WORKFLOWS_ONLY=true \
POKEGONEXUS_PERFORMANCE_WORKFLOW_FILTER=information \
POKEGONEXUS_PERFORMANCE_SAMPLES=5 \
POKEGONEXUS_PERFORMANCE_REPORT=.artifacts/performance-parity/vite-information-physical-android.json \
npm --workspace apps/web run performance:parity:report:android
```

Compare only the four public-information interactions:

```bash
node scripts/performance-parity/compare.mjs \
  --reference .artifacts/performance-parity/vite-information-physical-android.json \
  --candidate apps/mobile/.artifacts/performance-parity/native-information-standalone/native-android-performance.json \
  --profile physical-android \
  --scenario-prefix interaction.information. \
  --output .artifacts/performance-parity/information-physical-android-result.json
```

## Acceptance and handback

The gate passes only when all five Native flows complete on the physical phone
and Native is no slower than Vite at both median and p95 for FAQ topic
selection, expand-all, search, and clear. A Maestro Android text-injection
device-server death is harness instability; preserve its logs and retry, but do
not report it as an app crash without matching logcat evidence.

After a valid pass, update `CURRENT_NATIVE_TESTING_STATUS.md` with the APK
commit/hash, phone model and refresh rate, exact median/p95 values, report
paths, and any genuine failures. Commit and push that evidence on
`mobile/native-migration`. Do not promote the native experience to production
as part of this task.
