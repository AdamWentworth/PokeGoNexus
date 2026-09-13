# Native route parity review — 2026-09-12

This review compares the native migration with the canonical Vite application
using the signed-in account on a physical Pixel 8 Pro and fresh Vite references.
It is a route and presentation audit, not a whole-app performance qualification.
The current code candidate is `a6155531` on `mobile/native-migration`.
The original route audit and the follow-up evidence below have distinct scopes.

## Repairs from this review

- `1ab77bff`: scrolled content stays behind an opaque, route/theme-matched
  native status-bar surface. Existing safe-area content spacing is retained.
- `0aff1ad5`: the shared bearer client refreshes once for the services' exact
  legacy `403 {error: "Authentication failed"}` response as well as a 401.
  Other permission-denied responses do not trigger refresh. A transient refresh
  outage no longer causes the transport to discard a recoverable session;
  session retention belongs to the host provider. Settings had displayed the
  authentication error on the old phone build and loads the account's privacy
  controls after the repair. Expiry/outage behavior is covered by regression
  tests; a one-hour physical expiry soak was not performed.
- `a501f03c`: light-mode PvP scope buttons use a light background, and Max card
  stat values use dark text. Trainer showcase slots have explicit equal widths
  in view mode, preserving three columns on phones and six on wide layouts.
  The trainer's start date preserves its calendar date when the API serializes
  it as a timestamp, matching Vite instead of shifting back one day in Vancouver.

## Evidence and scope

The normal standalone build has device-smoke mode disabled. Installation uses
the existing package/signing identity and `adb install -r`, preserving app data.
Account interactions were read-only; no profile, collection, privacy, or trade
changes were submitted. Fixture/reset phone runners were not used.

The broad phone pass on `0aff1ad5` loaded all 27 audited routes without an
observed error screen: Home; caught collection; catalog detail; Pokédex overview
and detail; Raid; Max; PvP; rankings; search; trades; trade-board; own profile;
friends; settings; account; getting started; help; FAQ; about; safety; privacy;
terms; data deletion; Raid methodology; PvP methodology; and not-found.
Both top and scrolled states were captured on content routes. This proves
route loading and sampled presentation, not every nested interaction.

The initial physical All/My workflow passed Raid, Max, and Master League PvP
with the actual account. Its historical counts below are superseded by the
follow-up repair: Raid's personal roster shows 190 eligible entries from 2249
active caught copies and Shiny Mega Rayquaza among its leading attackers.
Max reports 15 eligible entries from 63 caught Max copies and renders 13 ranked
results for the reviewed damage view. PvP switches between catalog and owned
rosters successfully.

The isolated native browser suite passed 98 route/theme states and its workflow
checks at `1ab77bff`. Fresh Vite captures contain 14 account flows and 70
screenshots per theme, with zero reported runtime errors. Dark references use
`1ab77bff`; light references use `0aff1ad5`. They cover public/catalog and personal
tools, owned detail/edit inspection without saving, teams/Battle Lab/IV views,
search/map, trades/board, profile/friends, settings, and information/auth routes.
They are audit references, not new native presentation footage.

Targeted automated checks passed:

- 18 native route-surface tests.
- 23 shared-client/session tests, including four regressions that failed before
  the authentication repair.
- 30 profile/PvP/Max/model tests. Two new timestamp cases reproduced the date
  error before repair under `TZ=America/Vancouver`.
- Mobile and web TypeScript for the authentication change; mobile TypeScript
  and targeted ESLint for the final display changes.

Final candidate installation and targeted physical revalidation are recorded
in `STRONG_MACHINE_ANDROID_HANDOFF.md`.

On the final `a501f03c` APK, Max, PvP, profile, and Settings were recaptured in
light mode; Pokédex detail, Raid, Max, PvP, and profile were recaptured in dark
mode. All loaded without observed error text. Reviewed screenshots confirm
readable tool values/controls, the regular trainer grid and correct start date,
and opaque status-bar coverage while scrolling in both themes.

The final read-only account workflow passes 2249 caught, 167 Favorites, automatic
Favorite descending, CP 4713/4689/4688 first, and no collection-sync warning.
The light theme was restored and the phone left on Favorites. Sampled
current-process logs have no fatal/JS/ANR/released-database markers; this is
limited functional evidence and does not replace lifecycle or performance tests.

One theme automation attempt selected the underlying Settings switch because
it shared a label with the open action-menu switch. Its assertion failed;
inspection identified both controls in the accessibility tree. Tapping the
visible menu switch worked, and theme helpers now start from Profile to avoid
that ambiguity. This was not treated as a successful automation run.

## Follow-up repairs — 2026-09-13 UTC

`0fb69dab` fixes the data and presentation discrepancies identified above:

- Native tool hydration omitted fusion and crown move pools. Using the full
  canonical web hydration exposed two missing owned crowned attackers. Shared
  move hydration now restores them: both Raid summaries report 192 eligible
  entries from 2249 active caught copies, with 42 projected forms. The earlier
  comparison that returned 190 in both hosts reused native's incomplete input;
  it did not establish correct catalog parity.
- A direct signed-in Vite Max visit used a compact catalog without the Hero
  bases needed to resolve owned crowned Zacian/Zamazenta. It now loads full
  base identities and supplemental moves/Max profiles. Guest loading remains
  compact, with separate request caches. Both hosts produce exactly identical
  damage, tank, and healing rankings for the account: 15 entries from 63 caught
  Max copies, including both crowned attackers. A browser check without a
  preloaded variant catalog confirms 15 owned rows on a direct Max visit.
- Home's differing count came from local summary code including disabled
  partners, not a server summary. Both hosts now share active-only counts.
  Vite tag/ownership projections also exclude disabled copies and resolve
  three legacy display identities using recorded species/costume/qualities.
  Active caught count and visible caught rows now agree at 2249; Favorites
  remain 167. The resolver does not change saved account records or guess a
  substitute for an unknown costume/variant.
- Native Raid/Max explanations are accessibility hints, matching Vite's
  compact visible layout. Scope controls use a selected gradient and count
  pill. Max role tabs share the type-filter frame and use canonical role
  colours. First/second/third ranking medals use gold/silver/bronze. Raid move
  icons accept the actual API type field.
- Native stores now retain a shared recoverable database facade. An exact
  released-handle rejection during native prepare/exec argument conversion
  reopens the existing file and retries once. Concurrent old failures cannot
  discard a newer connection. Execute/finalize, SQL, and ambiguous write
  failures are never replayed. Twenty database/store tests pass, including
  bounded recovery, concurrent operations, retained parameters, ordinary
  failures, and potentially committed writes. No account data is cleared.

The database guard addresses the observed failure path; the underlying Expo
lifetime issue is not proven fixed. A related upstream Android shared-object
report and proposed fix remain tracked in [Expo #49799](https://github.com/expo/expo/issues/49799)
and [PR #49807](https://github.com/expo/expo/pull/49807). These are supporting
investigation context, not proof of this app's precise native root cause.

FAQ sections, topic controls, and search indexing avoid redundant renders.
`a6155531` also retains unchanged answer content during expansion. Opt-in
`EXPO_PUBLIC_NATIVE_UI_PERFORMANCE=true` allows timing normal account routes
without enabling fixtures. Manual delivery builds have that probe disabled.
Switching compiled flags requires a fresh Metro bundle; Gradle/Expo CI caches
can otherwise reuse the previous flag. Both probe and normal APK identities
are retained separately.

Validation also includes 38 web tag/Home/roster/helper tests, six Max-loading
and move-merging tests, 15 native Home/battle-model tests, 17 native tool/FAQ
screen tests, mobile/web TypeScript, and targeted ESLint. Fresh account browser
captures cover Raid, Max, collection, and Home in both themes (34 screenshots)
at a 448-pixel width matching the phone's logical width (`90fb42fe`; later
changes affect only native FAQ rendering). They remain private
audit references and do not update the presentation package.

The final normal `a6155531` APK passes light Home/Raid/Max/FAQ captures, FAQ
search/clear/direct links, three cold-start/resume cycles, and the final
2249-caught/167-Favorites ordering check. The phone is left on Favorites in
light mode. Installed identity and exact timing limits are in the handoff
and current-status documents.

## Remaining qualification

Controlled collection/tag scrolling and whole-app motion comparisons still
need matched, repeated evidence. The current focused FAQ timing result and
final APK phone checks are recorded in `CURRENT_NATIVE_TESTING_STATUS.md`.
Further typography/spacing differences require per-page visual review;
this batch does not assert pixel identity across the whole app. Long lifecycle
soaks, two-account trade mutations, and physical iOS coverage remain separate
approval gates. No further wholly missing main route was found in the audit.
Native presentation videos and Phlosion changes remain subsequent work. One
initial scope automation attempt after installation remained on Home and failed
its Raid assertion; the subsequent run reached Raid and passed. The failed
attempt is retained and is not counted as a successful route check.

## Local evidence

- Native builds, installation identities, phone route captures, All/My flows,
  contact sheets, and same-input model comparison:
  `.artifacts/route-parity-2026-09-12/`.
- Follow-up models, captures, tests, timing runs, and APK identities:
  `.artifacts/parity-followup-2026-09-13/` and
  `.artifacts/parity-followup-final-2026-09-13/`.
- Native browser route evidence: `.artifacts/native-real-routes/`.
- Vite dark reference:
  `../web/.artifacts/native-route-review/2026-09-13T05-22-48-871Z/package/`.
- Vite light reference:
  `../web/.artifacts/native-route-review/2026-09-13T05-39-55-763Z/package/`.

These ignored local artifacts include private account inspection data and are
not committed or published. The real presentation-package pointer was retained.
