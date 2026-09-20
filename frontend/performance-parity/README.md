# Performance parity

Performance parity is a differential requirement: the native implementation
must be no slower than the canonical Vite implementation for the same user
operation. A standalone native budget is useful as a safety ceiling, but it is
not evidence of parity.

The repository uses two complementary comparisons because no browser wrapper
can stand in for Android's renderer and scheduler:

1. `browser-proxy` runs the Vite app and the React Native Web preview in the
   same Chromium environment with deterministic API fixtures. It measures
   client-side transitions after each app has booted, rather than charging the
   native candidate for Expo's unrelated web-document bundle on every route.
   It covers every comparable route and shared interaction and catches
   JavaScript, data-projection, React, and workload regressions in CI. It is a
   deliberately strict diagnostic: React Native Web failures require review,
   but only the installed app can settle native performance. The workflow
   therefore uploads and summarizes browser-proxy failures without turning
   React Native Web renderer variance into a failed Android release verdict.
2. `physical-android` runs the shared Vite interactions in Chrome and the
   dedicated native interaction flows from a standalone release APK on the
   same Android phone, with the same real image assets. It is the release
   authority for input response, frame pacing, memory, and native rendering.
   The comparator rejects emulators, development clients, different devices,
   and different fixture sizes.

Reports use `report.schema.json`. The comparator is deliberately strict:

- every required scenario and metric must exist in both reports;
- every required scenario, including the global frame and memory metrics, must
  contain at least the declared repetition count, so a one-off observation
  cannot masquerade as a median or p95 result;
- lower-is-better metrics require both the native median and p95 to be no
  greater than Vite;
- higher-is-better metrics use the inverse rule;
- no percentage allowance is silently added for noise;
- intentional animation durations are contract values, not speed targets.

Run `npm run performance:parity:compare -- --reference <vite.json> --candidate
<native.json> --profile browser-proxy` from `frontend/` to compare reports.
The command writes a human-readable Markdown table next to the JSON result and
exits non-zero on slower, missing, or invalid evidence.

For a focused audit, add `--scenario-prefix interaction.pokedex.`. The same
strict median, p95, environment, and minimum-sample rules apply, but unrelated
routes and interactions are intentionally excluded from that result.

The reports and device artifacts are generated evidence and remain ignored by
Git. CI should upload them as workflow artifacts so a result is auditable
without growing the repository.

## Automated runs

From `frontend/`:

- `npm run performance:parity:browser` builds both web targets, measures every
  contracted route in guest/signed-in and light/dark states, exercises every
  shared interaction, and writes the reports and comparison under
  `.artifacts/performance-parity/`.
- `npm run performance:parity:android -- --apk <performance.apk>` installs the
  purpose-built release APK, drives Vite in Chrome and native with the same
  deterministic workload on one authorized physical phone, and writes the
  authoritative comparison. Set `POKEGONEXUS_PERFORMANCE_SAMPLES` to override
  the default five repetitions. Each native flow runs in a fresh app process;
  a failed attempt is retried once but only the successful attempt contributes
  evidence.

Native performance events are streamed from logcat for the duration of each
flow instead of relying on Maestro's end-of-flow ring-buffer dump. This keeps
early search and sort measurements intact during long collection flows. Frame
pacing comes from Android SurfaceFlinger FrameTimeline while both runtimes
perform the same warmed six-cycle physical scroll on the PvP IV result. This
captures Chrome's real child content surface, which `dumpsys gfxinfo` omits,
and uses Android's own jank classification for both implementations. The
runner downloads the pinned, checksum-verified Perfetto v58.2 Trace Processor
once under `frontend/.artifacts/`. Chrome memory is the summed PSS of its
browser, renderer, GPU/privileged, and zygote processes; native memory is
sampled at that same PvP endpoint instead of pooling unrelated pages.

The second command is the hard release gate: it exits non-zero if any required
native median or p95 is slower than Vite, or if evidence is missing or invalid.

The APK for the second command is built with the EAS
`performance-android` profile. It is an internal, standalone APK with native
preview and deterministic device-smoke instrumentation compiled in; it is not
the development-client APK and must not be distributed as the production app.
Only connecting/authorizing the phone and installing this generated APK need
manual device involvement. The runner performs the taps, captures evidence,
compares it, and cleans up its ADB forwarding.

## Interpretation

The browser route metric starts immediately before client-side navigation and
ends after fixture network activity, loading surfaces, and two paint frames
have settled. One-time installation, download, and document bootstrap are kept
separate from in-app navigation. Diagnostic route fields also retain main
thread blocking, maximum frame gap, transferred bytes, DOM nodes, and JS heap.

The physical profile currently gates the operations that can be defined the
same way in Chrome and React Native: handler-to-visible interaction latency,
SurfaceFlinger frame p95, Android-classified janky-frame percentage, and
process PSS. Route-transition
diagnostics remain exhaustive in the browser proxy; Android route startup is
not mislabeled as parity evidence because `am start`, Expo Router path commit,
and fully populated screen paint are three different milestones. A future
release Macrobenchmark may add fully-drawn route timings once each asynchronous
screen reports that final milestone consistently.
