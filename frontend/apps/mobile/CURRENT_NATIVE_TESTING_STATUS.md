# Current Native Testing Status

Last targeted revalidation: 2026-09-12 (Pokédex detail and region-index parity)

This is the short source of truth for continuing the Vite-to-native migration.
The canonical Vite application defines user-visible behavior. Native may use
different implementation details, but it must preserve the same content,
navigation outcomes, interaction order, terminology, and perceived motion.

The current strong-machine standalone Android build, artifact identity, and
public-information performance result are documented in
`STRONG_MACHINE_ANDROID_HANDOFF.md`.

## Pokédex detail and region-index parity — 2026-09-12

Vite and native now consume the same pure registration-slot, combination-family,
release-order, and search-alias model. Native retains the canonical selected
variant for Info/Battle stats, CP, types, sizes, and moves, including the fusion
move filter. The hero title uses the species name once, with the selected form
identified by its badge.

Caught copies imply every subset of their registration qualities; native checks
these on demand instead of expanding all subsets for the entire collection.
Manual marks retain their exact-registration semantics. A caught male, Lucky,
15/15/15 Bulbasaur now registers Lucky and 100% and counts 8/60 base combinations,
matching Vite. Purified combinations and paired normal/shiny costume families
have 120 entries, and Pikachu's costumes begin Santa, Party Hat, Ash, Witch Hat,
with each shiny version beside its original family.

More starts as a collapsed index, retains search/filters across tab switches,
and changes the hero when a group is selected. Guest registrations are stored
locally under a separate guest scope and never copied into an account. Index
save errors have a dismissible registration message separate from loading errors.

The region index now uses four columns on phones, a larger dex number above the
name, neutral summary frames, gradient count pills, unboxed totals, and chevrons.
Stat bars use Vite's Attack/Defense/Stamina scales. Category changes slide over
300ms without an explicit scroll reset; native region collapse uses a 260ms
layout animation. Both honor reduced motion. Android Back closes a region index
before leaving the route, and the handler is removed while another route or the
action menu is active. It is not installed in the browser.

Validation: 32 focused native tests and 7 Vite detail tests pass. Mobile/web
TypeScript and targeted lint pass. Both Pokédex routes pass the native web parity
smoke in light/dark themes at 360px, 412px, and desktop widths. A real-route browser
fixture verifies Mega Charizard X (273 Attack, 213 Defense, 4,353 CP50, Fire/Dragon),
Shiny group hero selection, retained hundo search, four-column alignment, and
guest registration persistence. Missing-card artwork is dimmed independently of
text so status labels retain accessible contrast. The production Android/Hermes
bundle exports successfully with device-smoke mode disabled.

Audit captures and model comparisons are under `.artifacts/pokedex-parity-audit/`;
the Android export is under `.artifacts/pokedex-parity-android/`. No Android device
is attached. These source changes still need a rebuilt APK and physical verification
of Back handling, motion, and the real account; the previously installed APK has
not been updated by this work.

## Pokédex region card framing — 2026-09-12

The native region overview cards now use Vite's neutral outer frame, regional
diagonal color panel, grid treatment, and bottom-aligned three-column previews.
The backdrop uses measured card bounds instead of fitting a fixed 400×132 SVG,
which previously left dark bands above and below the artwork. Preview columns
retain empty positions for categories with fewer than three available Pokémon.
Narrow layouts keep region names on one line; light-mode badges and text use
the corresponding Vite palette.

The existing five Pokédex screen tests, TypeScript, and lint pass (generated
`.artifacts/` diagnostics excluded). The targeted native web parity smoke passed
in dark/light themes at 360px, 412px, and desktop widths, including accessibility,
overflow, filtering, and registration-dialog cancellation. Follow-up rendered
checks verify all ten region names fit at 360px and 412px, region navigation and
collapse/return work, and the sparse Mega Kalos preview retains its first slot.
Actual Vite and native artwork captures are under
`.artifacts/pokedex-region-framing/`; general smoke captures are under
`.artifacts/native-web-parity/`.

No Android device was attached during this review. This source fix still needs
a rebuilt APK and physical-phone verification; the installed candidate documented
in the handoff remains the earlier catalog-workflow build.

## Omitted catalog workflows and global status — 2026-09-09

Native now offers existing/new copy selection when adding Mega/Primal forms,
and both component choices when adding a fusion. The organizer and individual
catalog route use the same validated mutation path. Existing copies retain
their identity, stats, moves, favorite, and tags. New fusion components use base
variant identities so the existing unfuse workflow can restore them correctly.
Both reciprocal links and the disabled partner are queued in one retained
batch. Cancel creates nothing; stale/ineligible choices and reuse of a copy
across selected forms reject the entire batch before queueing.

The native navigator now presents offline, retry-sync, and four-second recovery
notices across its routes, including connectivity feedback when signed out.
The notice reserves space rather than covering Save/Cancel controls. Collection
pending/accepted progress remains available without duplicating global errors.

All 104 focused tests across ten suites pass, along with mobile TypeScript and
lint (excluding generated `.artifacts/` bundles). Coverage includes the real
organizer-to-picker interaction, both existing/new choices, Primal and shiny
forms, mixed creation/reuse, cancellation,
duplicate submissions, stale eligibility, atomic offline retention, and the
fusion/unfusion round trip. Global status tests cover recovery expiry, offline
priority, retries, connection-check failures, and signed-out isolation.

Physical Pixel 8 Pro review of `bb2888cc` passed the actual bulk Add path and
individual Mega/Primal/fusion pickers using the signed-in account's Pokémon.
Existing and new choices were cancelled without saving account changes. The
Raid page showed the global offline notice and Check again, followed by Back
online on reconnection and automatic expiry. Both network settings were
restored. Final counts remained 2249 caught and 167 Favorites, with Favorite
descending and CP 4713/4689/4688 first. No fatal/JS/ANR markers appeared in the
captured current-process log. Evidence and corrected automation selectors are
under `.artifacts/catalog-forms/android-bb2888cc/`.

Follow-up `d1e06fc2` replaces a per-addition collection scan with one index when
applying queued snapshots, preserving legacy instance keys without duplicating
records. It also preserves creation order with increasing timestamps for new
copies. A 1,000-addition regression verifies bounded collection enumeration.
The final `PokeGoNexus-manual-d1e06fc2-arm64-v8a.apk` was installed in place
on the Pixel, and its installed checksum matches the built file. It is the
normal native preview with smoke mode disabled. The complete Mega/Primal/fusion
picker flow and the Raid offline/Check again/reconnection/notice-expiry checks
passed again on this exact APK. Final account checks again confirmed 2249 caught,
167 Favorites, and Favorite descending with CP 4713/4689/4688 first. Wi-Fi and
mobile data were restored; the captured process log had no fatal/JS/ANR markers.
Evidence is under
`.artifacts/catalog-forms/android-d1e06fc2/`; its checksum is recorded in
`STRONG_MACHINE_ANDROID_HANDOFF.md`. Physical picker checks deliberately cancel
before committing changes; save, offline retention, and unfusion behavior are
covered by the isolated automated tests.

## Collection scrollbar restoration — 2026-09-09

Commit `116c9eff` restores the missing native equivalent of the canonical
`PokemonMenu/CustomScrollbar` component. It uses the same `/images/scroll.png`
artwork, 40 × 60 thumb, 85% viewport track, and one-second idle/500 ms fade.
Dragging seeks the actual FlatList, clamps at the ends, and saves the offset
on release or cancellation. Native Animated tracks ordinary scrolling without
a JS listener; the one-shot position read at grab time also handles momentum.
The control handles restored offsets, tag resets, changed content/viewport
sizes, short or empty results, and the search overlay. Hidden thumbs do not
accept touches, and accessible actions move the list by a page.

Validation: 62 targeted native scrollbar, fixture, collection-screen, and hub
tests passed, plus mobile TypeScript and lint. The contract now explicitly
includes the draggable scrollbar. Physical thumb drags on the `116c9eff`
standalone build reached the middle of the 4,255-entry catalog, its final
Hydrapple entry, and Bulbasaur back at the top; the idle fade also worked.

That phone review exposed an additional existing page-slider defect after a
long horizontal swipe: sorting assertions passed, but the entire Pokémon
panel stayed displaced sideways, revealing Wishlist. `b600f024` replaces the
stateful `Animated.diffClamp` with a clamped absolute interpolation. The new
regression fails in both directions before the fix and verifies exact page
alignment after resetting a drag and selecting another page. All 39 targeted
slider, hub, and scrollbar tests pass, plus mobile TypeScript and lint.

The combined normal standalone `b600f024` APK is installed on the Pixel 8 Pro,
with its installed checksum verified and account data retained. The final
phone run passed full-catalog thumb drags to the middle, Hydrapple at the
bottom, and Bulbasaur back at the top. Favorites thumb drags also reached both
ends; opening a Pokémon from the middle and closing its detail retained the
same visible card identities at their exact prior positions. The auto-Favorite
sort sequence passed again, including manual NUMBER followed by reopening and
repeated tag taps. Long horizontal swipes in both directions now leave the
Pokémon page aligned across the complete 1344-pixel viewport.

Search filters and empty results hide the scrollbar, and clearing the query
restores Favorites with the correct sort. The catalog has 4255 entries, with
2249 caught and 167 Favorites retained. The final phone view is the full
catalog at Bulbasaur in NUMBER ascending. No fatal exception, JS error, or app
ANR marker appeared in the captured current-process log. Scripts, screenshots,
the catalog drag video, and installation evidence are retained under
`.artifacts/collection-scrollbar/android-b600f024/`. This is targeted functional
validation; the controlled performance comparison below remains open.

Separate observation: the first launch after the `116c9eff` update showed a
sync error from `NativeDatabase.prepareAsync` reporting an already-released
native shared database object. It cleared after restarting and did not appear
on the following checked launches, including the combined build. No persistence
code changed here. Retain this
as an unresolved lifecycle investigation; do not count it as a fixed defect or
assume it was caused by the scrollbar. Initial evidence is retained under
`.artifacts/collection-scrollbar/android-116c9eff/`.

## Favorites tag selection — 2026-09-09

Commit `d8ede733` makes tapping Favorites automatically select FAVORITE
descending, with highest CP first, in both native and Vite. Reopening the same
tag restores that sort after a manual change; repeated taps do not toggle it
ascending. Users can still choose another sort while viewing Favorites.
Other tags preserve the chosen sort, and cancelled presses do not alter it.
The native grid commits the new ordering before the page slide reveals it,
and the selected sort is saved in the collection session.

The earlier `44c02d98` and `1eea14cb` checks verified preview and form ordering
while preserving the current grid sort. They did not verify the requested
automatic Favorite-sort selection. Those builds are superseded for this
interaction. Regression coverage now taps the Favorites card directly from
Number, Name, and Favorite ascending; checks the actual ordered rows and sort
control; and repeats the tap after a manual sort change. The web controller
test exercises real sort state, and the collection Maestro flows now assert
FAVORITE descending after selecting the tag.

Validation: 60 focused native tests, 40 web/controller/sort tests, both hosts'
TypeScript checks and lint passed. Native lint excludes generated `.artifacts/`
diagnostic bundles.

The normal standalone `d8ede733` APK has been installed in place on the Pixel
8 Pro and its installed checksum verified. After the phone was unlocked, the
direct-tap Maestro flow passed without retry. It started in NUMBER ascending,
tapped Favorites directly, and verified FAVORITE descending with the CP
4713/4689/4688 Mewtwo first. Choosing NUMBER manually and reopening Favorites
restored Favorite descending; another Favorites tap kept it descending.
The initial and final screenshots were visually reviewed. The account still
has 2249 caught and 167 Favorites, and no fatal exception, JS error, or app ANR
marker appeared in the current-process log. The phone is left on Favorites
with the corrected sort. The flow, four screenshots, checksum evidence, and
log are retained under `.artifacts/favorites-auto-sort/android-d8ede733/`.

## Tag preview parity repair — 2026-09-09

Native tag cards now preserve the web instance order, with Favorites sorted by
CP descending using the same shared function as Vite. Custom tags honor saved
sort/name order when explicit order keys are absent. Stale memberships cannot
leak wanted Pokémon into caught custom tags or Favorites. That initial repair
preserved the grid sort on tag selection; Favorites now applies the automatic
sort described above.

Both native tag panels share one membership pass per collection snapshot.
Metadata edits reuse those memberships, and the summary cache retains only the
latest entry for each panel. Vite also memoizes its Favorites input so unrelated
renders do not repeat the sort.

Visible native tag panels start image admission after pending interactions,
without the background panel's 1.2-second delay. Admission counts actual visible
sprites instead of eighteen slots per card, skips missing artwork, and preserves
the revealed count when tag data changes. Native keeps the one-sprite admission
batch and interaction scheduler; the browser uses its own image scheduler.

Validation: 62 focused native tests, 52 web tag/sort tests, 33 performance-contract
tests, both hosts' TypeScript and lint checks, and the real-route collection
browser workflow passed. That browser run painted the For Trade result in
485 ms against the existing 750 ms budget.

The subsequent physical Pixel 8 Pro check installed the normal standalone
`1fdef284` APK in place, preserving the signed-in session and account data.
Its 167-Favorites preview starts with the expected CP 4713/4689/4688 Mewtwo,
matching the saved web account snapshot. Read-only checks covered preserved
grid sorting, explicit Favorite sorting, detail open/close, Shadow Shinies,
For Trade, All Wanted, Most Wanted, All Caught, and returning to tag previews.
Maestro needed CP-label and floating-menu targeting corrections; a final
All Caught scroll-centering failure was resolved by completing selection and
return navigation in a focused follow-up flow. This was targeted account
validation, not a complete run of the fixture-based release gate.

The Favorites grid ordering discrepancy found in that phone run is repaired
in `44c02d98`. Vite builds the grid from instance-ordered tag membership,
whereas native was feeding it the CP-sorted Favorites preview. Some forms
compare equal, so their input order affects Pokédex, Name, and HP results.
Native now keeps original membership in `rows` and separate CP-sorted artwork
in `previewRows`. Both arrays are cached with the membership snapshot. Other
tag previews keep their existing order. The later Favorites selection change
above applies its default sort without coupling membership to preview order.

The new cross-host regression uses the captured Venusaur, Charizard, and
Blastoise form/CP sequence with synthetic instance IDs. It reproduced the
incorrect Charizard Shadow/Gigantamax and Blastoise Gigantamax/costume order
before the fix. All six sorts in both directions now match Vite's actual
bucket/filter pipeline; a native screen test verifies the preview artwork
and the membership passed to the grid. Validation: 57 native tests, 42 web
tests including 14 new ordering checks, both hosts' TypeScript checks, and
native/new-test lint passed. Native lint excluded generated `.artifacts/`
diagnostic bundles from the prior investigation.

The normal standalone `44c02d98` APK then passed the targeted signed-in Pixel
8 Pro flow without a retry. Visual review of its screenshots confirms the
captured Charizard Shadow-before-Gigantamax and Blastoise
Gigantamax-before-sunglasses order, both on opening Favorites and after a
NUMBER → FAVORITE → NUMBER round trip. The CP-descending grid starts with
4713/4689/4688 Mewtwo; the tag preview retains the same first twelve sprites.
Counts remain 2249 caught and 167 Favorites. The install used the same signing
certificate and preserved app data. No fatal exception, JS error, or app ANR
marker appeared in the captured current-process log. The flow, four reviewed
screenshots, checksum evidence, and logs are retained under
`.artifacts/tag-ordering/android-44c02d98/`. This closes the reported ordering
issue; it does not replace the outstanding controlled performance comparison.

The separate performance finding still limits parity sign-off:

- The physical scrolling report used `PERCENTILE(duration_ms, 0.95)` even
  though Perfetto expects a percentage from 0 to 100. The query now uses `95`,
  has a known-value SQL regression test, and marks its percentile explicitly.
  The native report builder rejects old unmarked FrameTimeline JSON. Historical
  FrameTimeline-derived p95 values must be recomputed from their saved traces;
  this does not invalidate separately measured JS interaction timings.

Across two old-build and four updated-build scrolling samples, corrected p95
ranged from 9.50–11.66 ms on `2d87ff8e` and 9.77–11.74 ms on `1fdef284`.
All-jank rates ranged from 0.90–12.97% and 0–15.33%, respectively. Reversing the
build order reproduced high variability on the old APK too; the final restored
current-build run recorded 783 frames with zero jank flags. The extra flags in
the slower runs were predominantly Buffer Stuffing and remain included in
those rates. These limited, sequential account samples do not establish a
performance pass or isolate a regression from the tag change. Preserve this
concern for a controlled comparison against Vite on the same phone.

Raw videos, 11 checkpoint screenshots across the account flows, installation
checksum evidence, corrected traces, and automation logs are retained under
`.artifacts/tag-parity/android-1fdef284/`. The measurement repair's 36 performance
contract/report tests pass.

## Which Android workflow to use

| Workflow | What is installed | Where the JavaScript comes from | QR behavior |
| --- | --- | --- | --- |
| Development client + Metro | The project-owned development-client APK, installed once | The currently running Metro server | Opens the installed client and loads the current bundle; it does not install an APK |
| Standalone preview/release APK | A specific APK build | Bundled inside that APK | An artifact link may download one APK; no Metro server is used |
| Expo Go | The generic Expo Go app | Metro | Not valid for this project because native-module behavior is part of parity |

A development client is the fastest path for testing JS, TypeScript, layout,
navigation, and animation changes through Metro. That workflow needs a new APK
only when the native dependency set, Android project, Expo config plugin output,
or other compiled native code changes. The current phone candidate above is a
standalone APK: its JavaScript is bundled, so application changes require a new
build and in-place installation.

Use `start:native-preview` while instrumenting or using Fast Refresh. Use
`start:native-preview:performance` for release-like perceived-performance
checks on the same installed development client: it serves a production-mode,
minified bundle without compiling an APK. Development-only performance traces
are intentionally unavailable in that mode.

`parity:routes:web:performance` applies that same production/minified mode to
the real-route browser harness. It remains a browser proxy rather than Android
frame evidence, but prevents React development overhead from being mistaken
for release-bundle latency.

Never describe a Metro QR as installing an APK. Never combine multiple Android
artifacts behind one QR without explicitly identifying which single file the
user should install.

For repeated emulator-only JS measurements, the smoke runner accepts
`POKEGONEXUS_SMOKE_SKIP_APK_INSTALL=true` after verifying that the expected app
ID is already installed. The default remains a real APK install; the opt-in
exists only to avoid retransferring the same 268 MB development client between
unchanged-native-code runs.

## Current artifact truth

The current phone has the normal standalone ARM64 manual candidate for commit
`d8ede733` installed. It was built locally using the bounded manual builder as
`PokeGoNexus-manual-d8ede733-arm64-v8a.apk`, with SHA-256
`0ea172ec1e658182081dab63d624a15c4992e710129f6aa3a147559ae816f7ee`.
The existing signing certificate was verified before the in-place install on
2026-09-09. This build includes automatic Favorite descending selection when
tapping Favorites.
The checksum of Android's installed `base.apk` matches exactly. Its embedded
configuration reports `experienceMode: native-preview`, `appEnv: preview`, and
`deviceSmokeMode: false`; it uses bundled production/minified JavaScript and
does not require Metro. No app-data reset was performed.

The preceding other-machine build, retrieved from the `public` share as
`PokeGoNexus-manual-1eea14cb-arm64-v8a.apk`, had SHA-256
`dd8d39461a2844007c6040394df5d5f2b3de183e001e9afbe3c1d252d9394628`.
That APK passed the earlier targeted account flow without a retry: 2249
caught, 167 Favorites, CP-ordered preview sprites, and the corrected Charizard
and Blastoise order under NUMBER ascending. Both screenshots were visually
reviewed. Checksum evidence and the flow artifacts are retained under
`.artifacts/public-installs/android-1eea14cb/`.
The prior installed `2d87ff8e` APK was retained as
`.artifacts/tag-parity/android-1fdef284/original-installed.apk` for rollback.
The intermediate `1fdef284` manual APK is also retained in
`.artifacts/manual-standalone/`; it contains the earlier tag preview repair
but predates the Favorites grid ordering fix.
The locally built `44c02d98` ordering-repair APK remains in that directory too.

The prior `PokeGoNexus-information-5c7f025b-arm64.apk` remains retained only as
performance evidence. It was compiled with device-smoke mode enabled and must
not be reinstalled for ordinary manual testing.

An ordinary signed-in check of this smoke candidate found an exact 8,000 ms
test-only loader hold leaking into `/native/raid` and `/native/search`. The
destinations committed in under 90 ms, but the overlay remained for another
8.16-8.17 seconds. This invalidates the earlier statement that the installed
candidate was ready for real manual route testing. The source now scopes the
screenshot hold to `/device-smoke/*`, and
`scripts/build-android-manual-standalone.sh` creates the replacement with
`EXPO_PUBLIC_DEVICE_SMOKE_MODE=false`. The replacement was installed on
2026-09-06. A signed-in Home → Raid → Search automation pass completed under a
two-second route-visibility guard for both destinations, and the final Search
screen rendered without the eight-second overlay. This closes the configuration
regression; it is a functional sanity check rather than formal Vite/native
performance evidence. The current manual APK is now the correct artifact for
ordinary phone review.

The standalone APK evidence dated 2026-08-29 in
`DEVICE_VALIDATION_CHECKLIST.md` remains historical evidence for that earlier
source snapshot. Do not confuse it with the current candidate.

Do not run an unrestricted Gradle build on this workstation: previous resource
pressure crashed VS Code. Build the next candidate on the stronger machine, or
use the cloud when quota is available. Use a development client and Metro only
for iteration that does not need standalone-binary authority.

## Current automated checkpoint

### Real-account web media refresh — 2026-09-08

`capture:demo:account` completed all 56 scenarios across 34 web routes using a
real trainer account and live API reads, producing 52 videos, 52 posters, and
280 screenshots in dark/light desktop/mobile layouts. Raid, Max, and PvP pair
overall recommendations with My Pokémon; public trainer, collection, and Trade
Board pages use a separate visitor context. Account email addresses and private
trainer-card fields are hidden, and account/data mutations are blocked.

The recorder supports terminal sign-in and verified resume, keeps browser request
handling active during encoding, and waits for completed personal PvP evaluations
before capturing them. All four PvP variants include complete teams, matchup
results, Battle Lab, and comparable catalog/caught Zacian IV examples.

All 52 videos passed a 10 fps blank-frame scan, with no flagged frames. Phlosion
imported the complete package in commit `3006681`; its production build and all
8 browser media checks passed. See
[`ACCOUNT_MEDIA_CAPTURE.md`](../web/ACCOUNT_MEDIA_CAPTURE.md) for reproduction.
This remains responsive web evidence; native release gates are unchanged.

### Capture automation repair — 2026-09-07

The capture-readiness investigation repaired the real-route browser harness:
Home collection cards now use their current link semantics, Search explicitly
selects a location, and the profile fixture implements the authentication update
response and retains the saved trainer level. The profile workflow verifies the
refetched level, and Trade Board verifies that hiding the trainer name changes
the rendered board. Runtime errors are now tracked across workflow pages as well
as individual route assertions; session seeding skips opaque `about:blank` pages.

The browser proxy also exposed native-only `setNativeProps` calls in collection
filter dismissal and Trade Board theme/name controls. Their React Native Web
paths now use React state; Android and iOS retain the existing native update path.
The organizer also skips the unsupported hardware-Back subscription on web,
matching the platform guard already used by the other native dialogs.

The WebKit spinner failure came from probing a detached video: it reported loaded
data without painting frames. The probe now attaches the video to the document
and keeps the decoded-pixel assertions. Back navigation exposed a separate race:
a link could navigate before the scroll event delivered the outgoing position.
Vite now saves it on link activation and rejects delayed writes to another history
entry, including the initial entry with no stored router key. Two regression tests
cover these timing cases.

Passing evidence for this repair:

- native Jest: 165 suites / 942 tests, followed by 4 focused organizer tests
  after adding its web hardware-Back guard;
- web and mobile TypeScript and ESLint, plus web stylelint;
- shared performance-parity contracts: 33 tests;
- route-scroll unit tests: 4 tests, including the two new regressions;
- repeated Chromium and desktop/mobile WebKit scroll checks: 9 passes;
- Chromium and WebKit desktop/mobile spinner and Back-navigation checks:
  26 passes, with 2 expected desktop skips for the mobile-only Back case;
- canonical Vite screenshot capture: all 5 scenarios;
- the full native browser matrix: 98 guest/signed-in route/theme states and
  the complete signed-in workflow set, with no recorded runtime errors or
  unhandled API requests.

Validation logs are retained under `.artifacts/capture-readiness/`.
This is browser-proxy and capture evidence; it does not complete the standalone
Android, real two-account trade, physical iOS, or performance approval gates.

### Branch web media refresh — 2026-09-07

`capture:demo:branch` now builds the current checkout with fixture APIs and local
repository artwork, captures all 34 web route declarations, and packages 13 feature
clips plus reference screens in dark/light desktop/mobile layouts. The completed
run passed all 56 scenarios with no runtime/console errors or unhandled fixture
API requests. It exported 52 WebM clips, 52 WebP posters, and 228 WebP screenshots.
The manifest records source and build fingerprints, route coverage, video edit
segments, viewport dimensions, and asset checksums. See
[`BRANCH_MEDIA_CAPTURE.md`](../web/BRANCH_MEDIA_CAPTURE.md) for reproduction.

Visual review also found unauthenticated CARTO tiles displaying an API-key
watermark. Both web map surfaces now support a CARTO project key and fall back to
attributed OpenStreetMap tiles when no key is configured. All 9 map source/view
tests, the existing 5 capture scenarios, web typecheck, and web ESLint passed.

This package uses the responsive web renderer and synthetic demo data. It is
presentation evidence for the migration branch, not physical native footage or
approval to change the production mobile default.

The 2026-09-07 location-card correction pins Native instance overlays to the
Vite renderer's exact backdrop geometry: 86 viewport-percent width capped at
447 px, a 20 px top extension, top-aligned cover crop, the same 57% by 94%
elliptical fade and stops, and the same subtle center-brightness layer. Caught,
Trade, and all three responsive Wanted stage sizes now use that contract. A
stored background is no longer replaced with a same-ID image belonging to the
wrong costume. Cross-renderer contract tests and 48 focused Native tests cover
the geometry, masking, costume selection, and instance editor integration.

The same checkpoint restores the Vite Trades transition hierarchy. Native now
renders one shared Trades product header and Preferences/Activity control above
the horizontal page slider; only the two lower workspaces move. The control's
indicator continues to consume the slider's shared native animation value, so
it tracks the lower transition without moving the header itself. A
cross-renderer structure contract and 23 focused Trades tests protect this
boundary.

Native now has one reusable sliding segmented control corresponding to Vite's
shared `SegmentedControl`. Raid, PvP, Rankings, and Max Battles all consume it
instead of replacing page-specific static active backgrounds. Its native-driven
indicator starts on press before a parent recomputes or swaps a potentially
expensive workspace and uses Vite's 200 ms fast-motion duration. The content
beneath the shared product header and control now enters directionally on that
same native-thread clock, while the header/control remain stationary. Reduced-
motion preferences still resolve both pieces immediately. Focused component and
screen suites plus a four-route structure/motion contract pin the behavior.

The next manual candidate also removes the main freeze risk found while opening
Trades with a large collection. Native previously built and retained every
listing-by-candidate pair for both For Trade and Wanted when the route opened.
The route now prepares collection presentation data once for both modes, defers
per-listing matching and candidate row creation until that listing is rendered,
and caches only listings actually opened. Matching, ordering, counts, reciprocal
updates, and editor behavior remain covered by the full Native suite. Android's
system crash and ANR stores contained no matching process record for the reported
failure, which is consistent with the observed JavaScript-thread stall; the new
standalone candidate still requires manual repetition on the phone.

The Pokémon sort overlay now reproduces the complete Vite animation rather
than only approximating its durations. The entire gradient, controls, and close
button share the canonical 250 ms CSS ease-in-out fade; each option travels
from one real viewport height with Vite's exact 150 ms CSS `ease` curve and
50 ms stagger. The animations stay on the native driver without reserving JS
interaction handles, rapid dismissal cancels the entrance cleanly, and all
small menu assets are prefetched when the collection screen mounts. A shared
motion contract plus focused Vite, Native, hub-hosting, and cross-renderer tests
pin those details.

Pokédex category filters now preserve the current viewport. Selecting Shiny,
Shadow, or another category no longer re-targets the previously opened region
and instantly jumps past the filter header. Explicitly opening a region still
scrolls to that region, but both Vite and Native do so smoothly; the only
intentional immediate behavior is the operating-system reduced-motion path.
Focused renderer tests and the Pokédex cross-renderer contract prohibit a
non-animated category-triggered scroll from returning.

The 2026-09-06 Pokémon collection correction moves all six ordering modes onto
one renderer-independent implementation consumed by both Vite and Native.
Native now uses Vite's exact release-date, Favorite grouping, null/recorded CP,
catalog CP50, species-name, form-stamina, dex tie-break, and within-species form
rules. Sort press-in no longer changes the collection behind the menu; the
cached result is committed only by selection, as in Vite. A production-like
5 MB catalog fixture verifies every generated catalog ID and sort projection
against its Vite variant.

Mega registration and current Mega form are separate again throughout shared
artwork, Native collection cards/details, editor drafts, normalization, and
persistence. `mega: true, is_mega: false` displays and sorts as the current base
form while retaining registration. Cycling out of a Mega form preserves that
registration and clears only `is_mega` and `mega_form`.

Instance Edit acknowledges the tap before mounting the expensive caught editor
tree on the following frame. Save exits edit mode immediately after validation,
durably queues and optimistically projects the complete snapshot, then lets the
serialized collection-sync provider contact Receiver in the background. A
failed local queue operation restores the draft and error. Vite and physical
Android now record like-for-like edit-visible and save-visible timings, with a
150 ms Native hard ceiling for each interaction. The full Native
suite passes 164 suites / 940 tests; the affected Vite Pokémon, overlay,
variant, and sort surface passes 81 files / 414 tests; TypeScript, ESLint,
stylelint, Vite production build, and Metro Android production export pass.

The currently installed `8fa33311` APK includes the sort, Mega, and edit/save
corrections, but predates the 2026-09-07 location-card, Trades transition,
Rankings transition, Max Battles transition, and corrected Pokémon sort-menu
motion, as well as the Pokédex filter-scroll correction. Build and install one
new normal manual candidate from current HEAD before judging those changes on
the phone.

The current branch has shared Vite/native behavior contracts for Home
collection links, collection tabs and slide motion, tag clearing, action-menu
destinations and timing, theme-switch timing and geometry, and loader release
timing. Both implementations and their tests consume those contracts. Heavy
primary routes are single-instance in the native stack, and Home no longer
mounts complete collection and Pokédex route trees in the background.

Passing evidence for this checkpoint:

- native Jest: 164 suites, 940 tests;
- mobile and web TypeScript and ESLint;
- native real-route smoke: 92 guest/signed-in, light/dark route states;
- focused Vite mobile-Chromium browser coverage: 10 tests;
- all signed-in native real-route workflows, including Home summary links to
  Caught, Favorites, For Trade, and Wanted collection states, plus enforcement
  that repeated action-menu navigation cannot accumulate duplicate Home or
  collection screens;
- affected Home and collection visual/accessibility smoke in light and dark
  themes at phone and desktop widths.

The Home workflow requires the loader to clear and an interactive collection
card image to render within two seconds. This protects against the broken,
unresponsive filtered navigation previously seen on the phone, but it is not a
substitute for physical-device performance review.

The 2026-08-31 responsiveness pass also caches collection filtering/sorting,
virtualizes the trainer showcase picker, defers expensive battle/ranking/search
projections until controls can paint, removes Android's default image fade from
all 192 native image surfaces, and makes the action-menu close control respond
during its reveal. The real rendered collection workflow now enforces a 750 ms
tag-to-interactive-card ceiling. The 2026-09-01 transition-parity pass replaced
the competing ScrollView/body and indicator animations with one native-driven
three-panel track, keeps all three Vite-equivalent panels warm, and explicitly
slides from either side tag page back to Pokémon. Its final full-matrix run
measured 528 ms, including the canonical 300 ms page slide.

The follow-up tag-swap pass removed the offscreen layout/readiness wait because
the canonical Vite handler commits the selected filter and Pokémon destination
together. Native now does the same, starts the native-driven slide immediately
after that commit, keeps both tag galleries memoized, reuses card projections
for rows shared across tags, keeps card callbacks stable, and retains a
Vite-sized three-screen list window. Ownership glows use one precomputed tinted
bitmap per card instead of rebuilding a multi-node SVG gradient. The focused
real-route workflow measured 519 ms including the canonical 300 ms slide.

The final 2026-09-01 `/pokemon` architecture audit found that the previous
native optimization had moved away from Vite in an expensive direction. Vite
mounts three page panels but only one virtualized Pokémon grid. Native had begun
mounting as many as twelve independent image grids to prepaint tag results.
Because FlatList's multi-column batch counts represent rows rather than cards,
that could retain hundreds of hidden card/image views and make Android compose
them during every page slide. Native now mirrors Vite again: one grid receives
a cached immutable tag projection before the native-driven track starts moving.
No background timer can add hidden grids later.

Filtering, sorting, tag summaries, per-visible-row cards, and image source
objects remain cached. The canonical collection rows now enter FlatList
directly; Native no longer projects all 3,285 catalog entries into duplicate
card objects or constructs a full row-ID lookup map before virtualization can
take effect. Background work warms only the first eighteen plain card
projections and waits for the app-owned interaction scheduler; it never mounts
an offscreen list. The tag gallery loads the twelve phone-visible preview
images and, like Vite's eighteen-source preview, prefetches the six CSS-hidden
sources without mounting hidden native image views. The active FlatList keeps
a Vite-sized three-viewport window and six-row initial/batch budget. React
Native applies that budget after grouping columns, so this pins 18 rather than
the previous 36 phone cards while still covering a tall viewport. It also uses
a stable key extractor, stable card renderer, and React Native 0.86's renderer
memoization flag. The search/tag controls now sit outside the virtualized list,
matching Vite's fixed-header topology and keeping header cells out of every
data reconciliation. Tag changes reset the offscreen grid before changing its
data, while ordinary vertical movement persists session state only after drag
or momentum settles. Remote image source objects are reused across theme,
selection, and tag updates, use Android's force-cache policy, and downsample
only genuinely oversized badges and tiny type glyphs. The multi-column
FlatList keys its outer native rows by stable absolute slots, matching Vite's
`row-${row}` reconciliation instead of tearing down every visible row when
Pokémon IDs change during a tag swap. Static card layers and search/sort
controls are memoized, and tag cards no longer apply the non-Vite shrink
transform or alpha fade on press. The ownership glow now stays mounted on every
visible card, as Vite's pseudo-element does, and toggles opacity instead of
mounting an image layer during a catalog-to-tag transition. The delayed
Tags/Wishlist sublabel clock starts with the actual native-driven slide rather
than with the preceding data commit, keeping that header update off the final
motion frame.

The collection route now also preserves its navigation, retry, organizer, and
tag-mutation callback identities, while the Hub and three-panel slider are
memoized. The Hub passes a stable keyed panel array, so ordinary JSX child-array
allocation no longer defeats that memo. Cache-to-network query bookkeeping,
the action menu, notices, and unrelated dialog state can no longer invalidate
the active Pokémon grid or make all three panels reconcile.
Tag-mutation pending state still updates the controls that need it without
recreating the card renderer. A dedicated hook regression test pins those
callback identities across route rerenders.

The three-panel collection swipe continues to stream finger movement directly
from Gesture Handler into the native Animated graph, uses Vite's shared 30%
peek limit and 100 px threshold, and hands the exact drag position to the
settling animation so the current page cannot flash or reload first. The
Pokémon result and selected tab commit together before the canonical 300 ms
slide; only the offscreen Tags/Wishlist sublabel waits until that slide ends,
matching Vite. The track uses React Native's native hardware display-list
composition rather than allocating bitmap copies of its full-height pages.
React Native 0.86's deprecated InteractionManager is a stub, so an app-owned
scheduler tied to this real slider lifecycle protects animation frames from
projection warming.

Route entry is now cache-first and network-authoritative. A durable collection
snapshot, including retained offline edits, can paint while the canonical
network refresh continues. A slower SQLite read can never overwrite an already
completed network response, and writing a replaceable refreshed snapshot no
longer delays the first interactive grid. This closes a separate cold/open
latency gap with Vite's already-populated client store.

The real-route collection budget measures the first interactive destination
card before separately asserting the deliberately delayed header sublabel. The
latest complete matrix passed all 92 route/theme states and measured 509 ms for
the For Trade workflow, including the canonical 300 ms slide.

The next transition-frame pass now supplies FlatList with the exact deterministic
card-row geometry, mirroring Vite's explicit virtualizer row-height model rather
than waiting for Yoga measurements. It starts the native-driven track from the
destination grid's layout commit instead of inserting another animation frame;
development traces moved touch-to-motion from roughly 81–85 ms to 57–71 ms.
Card dimensions, image-stage styles, theme text styles, and ownership-glow styles
are stable objects across data swaps, and the CP label/value use one native text
surface. Tag previews also warm the first result window's type glyphs, while a
tag reset no longer emits a redundant session update when the grid is already
at the top.

The production/minified harness now measures from the browser-dispatched pointer
event separately from Playwright's pre-click actionability wait. Its focused For
Trade run painted the first destination result in 72 ms, began track movement in
4 ms, produced 20 distinct sampled positions, and kept its largest sampled frame
gap to 33.3 ms. The harness enforces 150 ms response/start ceilings, at least 12
visual steps, and no sampled gap above 80 ms. These generous CI thresholds catch
regressions without pretending a headless browser proves physical Android fps.

The latest input-latency pass found another native-only lifecycle mismatch:
focusing search unmounted its TextInput and FlatList, then the first character
rebuilt both. The search control now remains mounted like Vite's SearchUI, owns
an urgent local value, and sends the collection update through one React
transition rather than transition plus deferred-value commits. The grid remains
warm and inaccessible beneath the filter overlay. Search expressions are
compiled once per update and normalized row tokens/words are cached instead of
repeating that string work for every Pokémon. A new production guardrail
requires a dispatched catalog search to paint its matching card within 150 ms;
repeat runs measured 88–120 ms, down from the initial measured 231 ms.

An Android development-client A/B run exposed a composition bottleneck the web
proxy could not see. Forcing the current and destination pages into bitmap
textures allocated about 56 MB of scratch render targets at Pixel 8 Pro smoke
density and produced six missed-deadline frames, including a 113 ms frame.
Leaving the same native-driven transform on Android's existing hardware display
lists removed that allocation. The corresponding tab slide produced two
missed-deadline frames with a 40 ms maximum, while an actual tag-data swap plus
slide produced one missed-deadline frame with a 36 ms maximum. This keeps the
Vite timing and one-track architecture without paying a synchronous full-screen
snapshot cost at touch time. SurfaceFlinger independently recorded exactly 18
presented frames for each 300 ms motion: the plain slide's largest presentation
gap was 20.99 ms and the tag-data slide's largest in-motion gap was 21.7 ms.

The follow-up interaction pass removes the remaining redundant work on common
paths. Tapping the already-selected tab is now a true no-op, matching React's
same-state behavior in Vite instead of scheduling another 300 ms animation.
After the visible tag-card window is prepared, the
idle interaction scheduler also warms normalized search projections in bounded
128-row slices. Exact searches reuse reference-stable results, while ordinary
positive typing narrows the preceding prefix result rather than rescanning all
3,285 catalog rows for every key. The production guard now sends real sequential
key events through that path. It measured the final-key-to-Charizard paint at
81 ms. The filtered count is committed with the visible result window before
paint, restoring Vite's count behavior without adding state work to the
empty-query tag-swap path. The same run began track motion in 2.5 ms, painted the
tag result in 92 ms, produced 19 sampled positions, and kept the largest sampled
gap to 33.3 ms.

A production-mode Android timing split then identified the last post-release
tag hesitation. Even with cached data, reconciling the hidden grid after
`onPress` delayed motion by 60 ms. Tag cards now use their otherwise idle
finger-down interval to stage the destination grid without changing the visible
selection; release adopts that already-committed page and starts the same Vite
slide. A 32 ms direction window lets vertical tag-list drags cancel before any
staging work, and a cancelled press restores the hidden grid without navigation.
On the 3,285-row Pixel smoke catalog this reduced release-to-motion from 60 ms
to 6 ms and release-to-painted-result from 92 ms to 64 ms. The reusable
minified Android performance smoke now enforces respective 32 ms and 150 ms
budgets from device logcat rather than relying on the browser proxy.

The search-filter follow-up applies the same preparation model to the Vite tile
menu. Press-in stages the immutable filtered rows without adopting the query;
a cancelled drag restores the catalog, while release keeps the staged result
and updates the input/query without rebuilding the result. The menu is retained
invisibly and accessibly, so release does not delete and rebuild its roughly
forty native image controls. Android keyboard dismissal
begins after the result frame instead of synchronously resizing the window in
front of it. Because React Native's legacy Android Image view decodes on the
render thread, the correct destination card content paints first and its cached
images are revealed one card per frame across FlatList's three-viewport window,
matching Vite's asynchronous lazy-image pipeline without a final all-at-once
decode burst. The latest production-mode Pixel run measured 47 ms from release
to result, 849 ms for the first eighteen images, and 2,054 ms for all fifty-four
window images. Device logcat now enforces 120 ms, 1,200 ms, and 3,000 ms budgets
for those stages respectively. The separate production browser proxy measured
93.7 ms sequential search, 76.3 ms dispatched tag response, 7.5 ms to first
motion, twenty distinct positions, and a 33.4 ms maximum sampled gap; all 92
route/theme states also passed.

The same preparation model now covers every expensive collection projection,
not only filter tiles. Sort options and the evolutionary-line checkbox build
their destination rows during press-in, cancel that preview on an abandoned
press, and adopt the already-painted result on release. Typed search also keeps
its urgent local input and destination image release in a single interaction,
so Android never has to reconcile card content and decode a complete viewport
in the release frame. The expanded production-mode Pixel smoke exercises a
filter, sorting by name, sequentially typing Ivysaur, enabling its evolutionary
line, and the existing tag slide. Sorting improved from the initially measured
763 ms to 55–72 ms, while the evolutionary-line toggle improved from 173 ms to
39–52 ms. Its latest complete run painted the filter in 53 ms, the final typed
query in 120 ms, sort in 72 ms, and the evolutionary-line result in 39 ms. The
first destination image window completed in at most 877 ms and the full retained
window in at most 2,432 ms. Device logcat enforces 150 ms result ceilings for
typed search, sort, and evolutionary-line changes in addition to the existing
filter, tag, motion, and progressive-image budgets.

The first-focus audit then measured a separate 263 ms stall before any filter
was selected: Android was creating and decoding all forty filter controls on
the search tap. Native now creates those controls in four-tile hidden batches
after the active grid has painted and retains their memoized callbacks. The
first opening fell to 54 ms in the latest production-mode Pixel run and the
repeat opening to 31 ms. Filter release now hides that retained surface through
Fabric first, reveals the already-staged card window, and adopts the matching
React/accessibility/query state on the following frame. This keeps bookkeeping
out of the visible release without creating a second source of truth. The same
run revealed the filter result in 48 ms, committed its count/query in 93 ms,
painted the final sequential input in 65 ms, sorted in 52 ms, and expanded the
evolutionary line in 53 ms. The Android guard independently enforces 150 ms for
opening search, 100 ms for the visible filter release, and 150 ms for the
resulting query/count commit.

The retained-search and instance-overlay pass then caught an Android Fabric
hit-testing bug that was invisible in component tests: after search closed, its
transparent retained ScrollView could still receive a Pokémon-card press. The
warm menu now stays laid out but is translated fully offscreen while hidden, in
addition to disabling pointer events and accessibility. This preserves both
correct card activation and the prewarmed first-open path; the latest minified
Pixel run opened search in 114 ms cold and 62 ms warm, and then opened the exact
Charizard card rather than re-triggering its hidden Shiny tile. The same smoke
now exercises the instance overlay and its next-Pokémon control. Native
Animated starts the incoming slide directly when the new detail commits instead
of waiting for a browser-style reflow frame that React Native does not require.
The target committed in 175 ms, incoming motion began one millisecond later,
and the complete canonical exit/swap/entry sequence finished in 445 ms. Device
logcat enforces 200 ms, 220 ms, and 500 ms ceilings for those stages.

The exhaustive interaction pass extends that Android workflow through both
directions of a real instance-card swipe, tag clearing and cancellation,
long-press selection, and opening and closing the organizer. The overlay now
streams swipe displacement through Gesture Handler's native animated event
instead of crossing to JavaScript on every finger-move frame. Its shared
Vite/native visual clocks remain 120 ms out and 220 ms in; component tests pin
those exact durations and native-driver use. The latest workflow measured the
three overlay transitions at 433--505 ms end to end, including the deliberate
exit, content swap, and entrance. The clear dialog painted in 26 ms, selection
in 53 ms, and organizer in 36 ms. Sort-menu animation likewise consumes the
shared 250 ms Vite/native contract and is pinned to the native driver.

Native confirmation and organizer surfaces now remain inside the collection
screen's absolute overlay tree rather than creating separate Android Modal
windows. This removes a window handoff from their first response while
preserving focus, dismissal, and accessibility behavior. Image-release work is
also admitted only through the app-owned interaction scheduler, so queued
projection warming cannot start a React update inside an active page or overlay
animation. When an animation ends, a backlog from the visible collection,
retained tag panels, cache warming, and realtime updates is now admitted one
source per 16 ms frame instead of all callbacks bursting into the first frame.
The rapid four-tag Android run retained 0--1 ms slide starts, 56--95 ms result
commits, and 80 ms for its latest typed query with that post-animation pacing.
Long press consumes the same shared 300 ms threshold in Vite and Native.

The complete minified Android probe currently reports: 53--82 ms to open
search, 65 ms to open sort, 52 ms for filter release, 9--10 ms to begin a tag
slide, 75--98 ms to paint the tag result, 58 ms to sort 3,285 cards, 137 ms to
expand an evolutionary line, and 214 ms for the final sequential typed result.
The corresponding enforced ceilings are 150, 150, 100, 32, 150, 150, 150, and
250 ms. First-viewport image release ranged from 95 to 645 ms and the retained
three-viewport window from 96 to 943 ms, within the respective 1,200 and 3,000
ms safety budgets.

Those measurements came from the Pixel 8 Pro API 36 AVD at 1344x2992, whose
runtime identifies its renderer as the Android Emulator OpenGL translator over
Google SwiftShader. The smoke runner now records that renderer and explicitly
labels gfxinfo as diagnostic when software rendering is detected. Functional
and event-latency assertions remain valid there, but emulator frame-rate data
must not be presented as physical-phone GPU evidence.

The next image-scheduling pass removes a Native-only source of recurring list
work. Vite's stable virtual rows do not rerender when each lazy image becomes
eligible; the browser resolves each image independently. Native previously
stored a reveal counter in the collection screen and changed FlatList's props
once per image, repeatedly reconciling the whole visible window. A stable
per-card external reveal coordinator now notifies only the one-to-three cards
whose eligibility changed. Tests pin that the FlatList instance, `extraData`,
and renderer callback remain reference-identical throughout image release.
The latest software-AVD run painted sorted content in 98 ms; post-initial
destination viewport releases ranged from 97 to 576 ms and every complete
retained window stayed below 773 ms. Result content remains inside its 150 ms
target while decode work no longer invalidates the parent list.

Static card bitmaps now join that same per-slot coordinator. Real
caught/trade/wanted glows enter with a slot's first image slice and remain
mounted across later tag projections, avoiding both a cold decode burst and a
second card commit. Catalog cards no longer allocate an opacity-zero glow
Image at all: Vite's inactive pseudo-element is visually absent, while Android
was still decoding and exposing hundreds of useless invisible image nodes to
Fabric. The production smoke continues to preserve the three visible ownership
glows and now verifies the inactive path without paying that native-only cost.

That coordinator also gates cold collection images in three-card slices, so
text and controls can paint before Android begins remote-image decoding. Both
retained tag panels keep their full structure and touch targets mounted, but
their remote preview sprites now enter independently after the visible
collection and retained search controls have had priority. This recreates
Vite's asynchronous image settling without deleting the offscreen pages needed
for an immediate slide. Background preview and cache tasks are held for the
entire filter-tile and tag-card press/release frame. Tag press-in begins after a
16 ms direction window, down from 32 ms, while vertical drags can still cancel;
production traces prove both tested tags were committed before release. Across
the latest two complete workflows, tag motion began in 7--16 ms and results
painted in 38--98 ms.

The interaction workflow now also performs a repeated Trade → Favorites →
Trade → Most Wanted sequence instead of measuring only one inventory and one
wishlist selection. That exposed a remaining one-to-three-frame wait in the
parent selected-tag commit even though press-in had already reconciled the
destination grid. A prepared destination now starts the shared native-driver
track synchronously on release and lets identical header/session bookkeeping
commit behind the UI-thread animation. All four rapid slides began in 0--1 ms
in the latest production-mode run, while their result commits remained 71--113
ms and the canonical 300 ms motion contract stayed unchanged.

Direct TAGS / POKÉMON / WISHLIST header taps use the same visual-first order:
the native-driver track and its shared underline clock start before session
persistence or parent state bookkeeping. A call-order test prevents that work
from returning in front of the animation. The full-screen sort window is also
explicitly hardware accelerated; its six-option Vite-parity motion retained the
250 ms contract and opened in 120 ms in the latest Android workflow, after a
software-emulator window-handoff outlier had exposed the missing flag.

The collection action menu now follows Vite's retained-overlay lifecycle too.
After the active grid settles, its complete native view tree is prepared behind
the page while the existing anchor prefetches its image assets. A tap therefore
only promotes the retained surface and begins its native-driver fan instead of
constructing controls, SVGs, and layout in the input update. The Android probe
now gates that first visible frame; the latest full workflow measured 71 ms and
kept every collection result budget intact.

The rendering-cadence audit also found a compiled-Android gap that JavaScript
changes cannot repair in the currently installed development client. Chrome can
present the Vite PWA at a phone's 90/120 Hz mode, while React Native still leaves
some Android windows at the ordinary 60 Hz preference. The Expo config plugin
now asks Android for a 120 Hz window preference and the Android 15 high frame-rate
category, allowing the OS to choose the closest supported rate or lower it for
battery and thermal policy. This is preserved through future Expo prebuilds but
requires the next APK before it can affect physical-phone motion or the spinner.

The Android parser now distinguishes desired performance targets from
software-emulator hard ceilings for callback measurements that have shown
isolated SwiftShader/Hermes dispatch jitter. Sort-menu and committed-query
paint still target 150 ms with 200 ms ceilings, filter reveal targets 100 ms
with a 200 ms ceiling, and overlay completion targets 550 ms with a 600 ms
ceiling. It
prints a warning when a target is missed and still fails a genuine ceiling
breach. In the latest run, filter reveal was 96 ms, tag slides 14--16 ms, tag
results 56--98 ms, sort result 98 ms, evolutionary expansion 40 ms, and all
three overlay transitions 478--509 ms. The sole warning was a 161 ms sort-menu
callback; its canonical 250 ms native-driver visual contract remains pinned by
component tests.

The loading animation no longer relies on GIF scheduling. A physical-phone
comparison exposed that the first WebP extraction had sampled Vite's 30 fps
video on presentation boundaries: 12 of its 36 slots were accidental adjacent
duplicates, leaving only 24 distinct native images in the 1.2-second loop.
Native's asset generator now decodes the two canonical Vite WebMs in Chromium
at the middle of every presentation interval. All 36 Vite frames are retained,
and alpha-correct intermediate frames produce a 72-frame, lossless animated
WebP with a 17/17/16 ms cadence. Both runtime assets therefore have 72 encoded
pages and an exact 1,200 ms loop instead of stretching 24 images across it.

`expo-image` owns playback natively, and both theme resources remain mounted
and decoded with autoplay disabled. Hidden playback is stopped rather than
unmounted; the application-root loading surface also remains laid out at zero
opacity. Action-menu navigation reveals that single retained root surface
before destination work instead of starting a local spinner and handing off to
a second phase-resetting instance. Unit tests reject a canonical source with
fewer than 35 distinct frames, regenerate the alpha-correct intermediate
pixels, compare every decoded WebP page, pin the exact 1,200 ms timeline, and
require native start/stop without React remounts. The dedicated device-smoke
route can deliberately block JavaScript for one second while playback remains
visible. Production Android export includes only the two 301/133 KB WebPs, and
the complete suite remains 160 suites and 855 tests with typecheck and lint
clean.

The header underline now follows the actual Vite lifecycle instead of an
invented shared-track behavior. Vite changes the selected tab and runs the
underline's own 300 ms CSS `ease`; its underline does not follow the finger
during a drag and does not share the page body's custom cubic Bézier. Native
previously derived both body and underline from the same page offset. The
underline now owns a native-driver `ease` animation and stays on the settled
tab until a swipe releases. Waiting for the parent React commit initially put
that animation 22--65 ms behind the already-prepared page track on the
software AVD, so the Hub now starts it through an imperative visual handle in
the same release path as the page. The next repeated-tag run reduced that gap
to 0--2 ms after the page marker; all four page starts remained 1--4 ms and
their destination result commits were 94--118 ms. A separate 32 ms Android
budget now prevents the indicator handoff from drifting back behind session
or selected-tag bookkeeping. The full suite is now 159 suites and 845 tests.

The sort overlay now matches Vite's portal architecture instead of opening a
new Android system window on every tap. The Pokémon page owns the sort state,
but hands the visible overlay to the already-mounted Hub root; that root covers
the complete edge-to-edge route just like the action menu, including the camera
and gesture-bar regions. Standalone fixtures retain the Modal fallback. Tests
pin all three boundaries: inline presentation creates no `Modal`, the Pokémon
screen delegates presentation and dismissal, and the Hub renders the overlay
as its own full-screen descendant. On the first complete Android workflow after
the change, the sort menu painted in 105 ms (down from the preceding 246 ms
system-window outlier), the selected sort result painted in 48 ms, all four tag
slides began in 0--1 ms, and their results painted in 102--116 ms. The workflow
completed every UI assertion; its overall parser failed only because one
instance-overlay target/entrance sample reached 286/287 ms against the existing
280 ms hard budget. The full suite is now 159 suites and 848 tests.

Background native work now yields to the same gestures Vite leaves to the
browser compositor. Both the collection grid and retained tag lists reserve the
foreground from drag start through momentum end, including an 80 ms end-drag
grace so queued image/search work cannot slip into Android's momentum handoff.
The action menu similarly holds the custom queue for its complete native-driver
open/close animation, and the search overlay holds it through its first paint.
Hidden filter controls no longer mount four Android Image views on every rAF;
their small batches use an interaction-aware task mode that pauses immediately
for input but completes promptly instead of starving behind repeated idle
callbacks. The confirming Android workflow measured search opens at 86/35 ms,
sort open at 80 ms, filter reveal at 45 ms, all four tag slides at 0--1 ms, all
four tag result commits at 70--104 ms, and the action menu at 91 ms. Every
collection budget passed; that workflow's overall parser failed only on a
separate first instance-overlay sample (316/318/609 ms). The full suite is now
160 suites and 851 tests.

Instance-detail navigation now retains the same prepared-data advantage as the
Vite overlay. The browser overlay receives its neighboring Pokémon as existing
objects, while the native route was rebuilding the complete detail projection
after every parameter change: collection resolution, move metadata, targets,
forms, and background choices. Native detail projections are now cached by the
immutable React Query snapshot, and the previous/next projections are prepared
through the interaction-aware idle queue while the current overlay is open.
The cache invalidates naturally whenever instances, catalog, or moves receive a
new query snapshot, so mutations cannot expose stale details. Focused model
tests pin both reuse and invalidation; typecheck and the complete lint pass are
clean.

The shared horizontal page slider no longer registers its 300 ms compositor
motion as a React Native framework interaction. That framework handle made
`VirtualizedList` postpone destination cell batches until the animation ended,
even though the app's narrower interaction-aware scheduler was already holding
unrelated cache/decode work. Vite continues filling its virtualized grid during
the CSS transform, so native now does the same while retaining the UI-thread
animation and custom foreground reservation. Tests pin `isInteraction: false`.
The confirming minified Android workflow passed every budget: four tag slides
started in 0--1 ms, their result windows committed in 83--136 ms, typed search
committed in 100 ms, all three instance targets committed in 176--241 ms, and
the action menu painted in 85 ms.

Tag performance now has an end-to-end touch guardrail in addition to the
release-callback timing. The new measurement begins at Pressable press-in,
includes preparation of the concealed destination grid, and ends when the
native page slide starts. This prevents synchronous work under the finger from
making a tap feel delayed while an onPress-only metric still reports zero. The
confirming Android workflow measured all four full touch paths at 79--91 ms;
the post-release slides themselves still began in 0--1 ms.

Instance overlays now split their incoming commit at the same presentation
boundary the user can see. At a settled top position, the outgoing read-only
moves, IV, provenance, and target subtree remains memoized while the incoming
art/name/stats stage commits and starts its native-driver entrance. The lower
subtree adopts the incoming detail on the following frame; a component test
pins that exact ordering, and scrolled or editing overlays retain the complete
eager detail path. The repeated Android overlay targets improved from the
preceding 222/234/298 ms run to 183/179/205 ms, with complete transitions at
464/455/547 ms. The workflow passed every budget. The full suite is now 160
suites and 853 tests, with typecheck and the complete lint pass clean.

The Android performance flow no longer mistakes the action menu's intentional
perpetual cloud/star motion for an unresponsive close button. Maestro's
selector tap spent as long as 116 seconds waiting for that animated hierarchy
to settle even though the app's own trace showed a 68 ms open paint and 407 ms
completed fan. The probe now taps the exact shared bottom-centre geometry used
by both the closed anchor and open close button, then retains its visible/not-
visible accessibility assertions. The next workflow completed those steps
normally and passed, with tag touch paths at 71--90 ms and instance targets at
158--240 ms.

The retained tag galleries now admit one remote preview bitmap per panel and
frame instead of three. Vite can finish independent browser image decodes
without putting a synchronous burst on its compositor, while React Native's
legacy Android image path can perform that decode work on HWUI's render path.
The galleries remain mounted and warm before selection, but the two offscreen
panels can no longer introduce a combined six-bitmap background spike into one
display frame. A component test pins the one-source cadence. The confirming
minified Android workflow passed every collection budget: four tag releases
started the page track in 0--1 ms, their complete touch paths measured
67--101 ms, and the action menu painted in 84 ms. The full suite is now 160
suites and 854 tests, with typecheck and the complete lint pass clean.

The 2026-09-05 Home pass now covers both the signed-out landing page and the
signed-in trainer dashboard. Native restores Vite's trade-story-before-feature-
directory order, exact guest destinations and CTA copy, link semantics, loading
states in the collection and recent-Pokémon panels, icon treatments, and the
same action-menu-hint acknowledgement behavior. Home links no longer wait for
two idle animation frames before navigating. Focused tests pin every guest and
signed-in destination plus the onboarding and loading branches. Five production-
mode browser-proxy repetitions passed the strict no-slower-than-Vite gate:
hint dismissal measured 11.7 ms versus 17.0 ms, the animated feature-directory
jump 658.4 ms versus 909.6 ms, and onboarding dismissal 36.1 ms versus 49.7 ms
(Native versus Vite medians). Ten focused Home browser cases also pass across
desktop and phone-sized Chromium. The shared proxy fixture now supplies the
same 62-entry PvP workload to both implementations; the earlier five-entry
Native fixture made cross-implementation environment claims invalid.

The matching 2026-09-05 physical pass ran five repetitions of those three Home
interactions on the same 120 Hz Pixel 8 Pro, using the current minified native
bundle in the project development client and Vite in physical Chrome. Native
beat Vite at both the median and worst observed sample: hint dismissal was
46/58 ms versus 92/139 ms, the guest feature-directory interaction was
291/293 ms versus 1,017/1,019 ms, and onboarding dismissal was 78/127 ms versus
131/273 ms (median/maximum). The initial native onboarding implementation
failed the median gate because it mounted and laid out the complete dashboard
after the tap. The dashboard now remains fully laid out and inaccessible behind
an independent onboarding overlay, so dismissal reveals the prepared surface
without a route transition, spinner, or dashboard relayout. All five physical
flows passed their visibility and accessibility assertions, and their captured
guest and signed-in screens preserved edge-to-edge camera and gesture-bar
painting. Native runtime diagnostics recorded a 9 ms median touch-to-next-frame
delay, 12.19 ms median frame-time p95, and 3.33% median janky frames across the
workflow. The complete native checkpoint remains green at 161 suites and 903
tests, with mobile typecheck and lint clean.

The 2026-09-05 authentication and session-lifecycle pass now covers login,
email registration, Google/Discord/Facebook registration completion, password
recovery, password-reset confirmation, cold session restoration, refresh-token
rotation, logout, and post-logout relaunch. Native password recovery is again an
in-place modal like Vite rather than a separate request page; a missing reset
token remains an incomplete-link state, while a successful reset uses Vite's
exact confirmation and 2.5-second return-to-login lifecycle. Registration now
includes Vite's username-as-Pokémon-GO-name choice, exact location privacy
semantics, device coordinates, reverse-geocoded broad-place selection, and a
native MapLibre picker. The registration route stays behind the protected
session gate while restoration is unresolved, preventing signed-in users from
seeing a registration flash.

Issued password, registration, OAuth-login, and OAuth-registration sessions now
share one persistence boundary. If SecureStore cannot save an issued refresh
token, Native attempts immediate server logout before surfacing the error;
refresh requests are coalesced, remote logout failure still clears the local
session, and local-clear failure cannot leave React in a falsely signed-in
state. The physical lifecycle fixture proved sign-in and secure save, process
death and relaunch, refresh rotation, logout, a second process death and
relaunch, and a still-signed-out result. Separate phone workflows passed email
registration, all three OAuth registration paths, recovery and confirmation,
and actual Android location permission through native map selection. During
that pass a Fast Refresh MapLibre double-registration crash was found and
removed by accessing the already-linked location TurboModule without
reevaluating the package's native view registry.

Authentication now has the same interaction-to-painted-result probes as the
feature pages. Five repetitions on the same 120 Hz Pixel 8 Pro put Native ahead
of physical Vite Chrome at median, p95, and worst observed sample for every
measured interaction. Native/Vite medians were 22/118.2 ms for password reveal,
127/272.8 ms for opening recovery, 79/293.8 ms for the privacy-safe recovery
result, 79/194.8 ms for choosing email registration, 78/184.0 ms across twenty
registration step changes, 52/191.0 ms for synchronizing the Pokémon GO name,
and 44/170.3 ms for password-reset success. Native worst cases were respectively
30, 138, 90, 114, 124, 58, and 50 ms; each remained below Vite's corresponding
p95 and worst case. These Native measurements use a production-mode minified
bundle in the installed development client and therefore remain diagnostic,
not standalone-release authority.

The 2026-09-05 trainer-workspace pass covers Profile, Friends, Settings, and
Account end to end. The Profile editor now uses the trainer card itself, like
Vite, rather than mounting a separate editor below it. Identity, level, team,
XP, dates, location, trainer code, six featured-Pokémon slots, drag reordering,
picker search/clear/selection, all play-style choices, cancel, save, setup,
collection links, and relationship confirmations are covered. The showcase
picker is inline, reveals the same initial 48 candidates in small post-paint
batches, and its physical fixture now supplies the canonical 180 instances
rather than the invalid seven-candidate shortcut found during the audit.

Friends covers all three workspace views, search, profile navigation, incoming
and outgoing requests, removal, blocking, and server-result feedback. Settings
covers every visibility/coordination choice, exact switches, theme behavior,
device preferences, and save feedback. Account covers editable identity,
password validation, every provider state, sensitive confirmations, OAuth-only
accounts, session revocation, and destructive account actions. The focused
physical workflows for all four areas passed, as did their native-web phone and
desktop light/dark/accessibility matrix and their real API-route workflows.

Five repetitions on the same 120 Hz Pixel 8 Pro put Native ahead of physical
Vite Chrome at both median and p95 for all 18 bounded trainer interactions.
The six realistic 180-instance Profile medians were 196 ms to edit, 38 ms to
select a title, 229 ms to open the showcase picker, 95 ms to select a showcase
Pokémon, 94 ms to reorder it, and 176 ms to save. Vite measured 249.9, 55.3,
301.2, 121.3, 178.2, and 478.8 ms respectively. Friends medians were 329 ms or
less, Settings 85 ms or less, Account 141 ms or less, and relationship actions
97 ms or less; each corresponding Vite median and p95 was slower. The native
numbers use a minified bundle in the installed development client, so they are
strong same-device diagnostics but not standalone-release authority.

The final checkpoint passes 162 native suites / 926 tests, all 13 focused Vite
mobile-Chromium auth/lifecycle cases, the complete 1,720-test Vite unit and
integration suite, 28 focused Vite trainer tests, six focused trainer browser
lifecycle tests, TypeScript, ESLint, stylelint, and all 21 performance-report
contract tests. The physical functional and performance workflows completed
without an app crash; timing-only fixtures pre-seed valid text so repeated
measurements do not depend on Maestro's intermittent Android keyboard injection.
The ordinary functional workflows continue to exercise real typing and form
validation.

The 2026-09-05 public-profile and Trade Board pass restores signed-out access
to `/profile/:username`, keeps owner-only relationship and editing actions
private, resolves public showcase artwork without loading another trainer's
collection as viewer-owned data, and carries public collection links through
to read-only filtered collection and instance routes. Read-only showcase slots
no longer mount six unnecessary pan handlers. Profile facts, collection stats,
play-style icons, and commands paint progressively without an artificial
below-fold delay. The signed-out physical flow passed trainer identity,
showcase, play styles, collection navigation, guest action-menu labels, and
edge-to-edge presentation on the Pixel 8 Pro.

Trade Board now matches Vite's owner/public headers, privacy and empty states,
section rules, Pokémon GO identity option, three export themes, live links,
QR semantics, canonical filenames, collection/profile destinations, and guest
calls to action. Theme canvases and artwork are retained and memoized so theme
selection is an immediate compositor operation; the identity option updates
only its trainer-name native node; and copy acknowledgement paints before the
clipboard bridge completes. Five physical repetitions on the same 120 Hz
Pixel put Native ahead of Vite for every bounded Trade Board interaction at
both median and p95: section visibility measured 49/53 ms versus 59.5/100.9
ms, theme selection 39/53 versus 92/119.7 ms, identity visibility 43/52 versus
49.1/116.9 ms, and copy feedback 23/25 versus 107/139.5 ms. Native frame-time
p95 had a 10.71 ms median and median Android-classified jank was 0.83%.

The Vite Trade Board and trainer-profile browser suites pass all six focused
cases. Native phone/desktop, light/dark, accessibility, deterministic API-route,
owner/public, and physical functional flows also pass. The React Native Web
diagnostic remains stricter than the Android evidence: its latest Trade Board
run beats Vite for section, theme, and identity but its synthetic copy median
is about 3 ms slower, while public-profile and public-board route-settle
measurements still include Expo/RNW document and catalog work that Vite has
already cached. Those proxy failures remain visible and must not be described
as Android failures or as passing route evidence. A standalone release APK
remains the final authority for compiled-native route cadence.

The 2026-09-05 public, legal, and edge-route pass covers Getting Started, Help,
FAQ, About, Safety, Privacy, Terms, Data Deletion, incomplete email verification,
and unknown-route recovery. Native now uses the canonical Vite copy for every
audited information page, including the complete four-point proposal workflow
and independent-project disclosure. The email-verification action uses Vite's
exact `Continue to login` label. Unknown routes preserve the attempted path and
offer the same recovery destinations.

FAQ links now preserve `/faq#answer-id` across web URLs and the native URL
scheme, open the matching category and answer, and scroll directly to it. Every
answer exposes the canonical self-link. Collapsed answer content stays mounted
inside a clipped, inaccessible layout surface so expanding a category does not
construct its answer tree on the input frame. Category, answer, search, and
clear results are now explicit shared performance-contract interactions.

All 16 information-page route/theme states, both email-verification states, and
both not-found states passed the deterministic real-route matrix. The focused
Vite mobile-Chromium suite passed all 16 public-information, FAQ, legal/auth, and
Home-footer cases. Both physical Pixel workflows passed end to end, including
FAQ category filtering, answer expansion, direct answer links, self-links,
legal navigation, path-preserving 404 recovery, and edge-to-edge rendering.

The final ten-sample React Native Web interaction diagnostic passes the strict
no-slower-at-median-and-p95 gate for all four shared FAQ actions. Native/Vite
median and p95 were 24.1/31.5 versus 26.95/44.2 ms for topic selection,
15.45/22.2 versus 17.9/24.5 ms for expanding all seven Trading answers,
9.75/11.8 versus 16.0/19.1 ms for search, and 16.5/24.8 versus 20.4/26.1 ms for
clear. Avoiding ordinary FAQ layout-measurement callbacks was material; only a
direct-answer route now subscribes to the measurements needed for its automatic
scroll. Static route-startup and frame-gap browser proxies remain mixed because
they include Expo/RNW document mounting and are not physical-native authority.

The strong-machine standalone APK for commit `5c7f025b` completed five required
physical FAQ repetitions and a separate ten-run repeatability pass without a
functional failure, retry, or app crash. In the ten-sample same-Pixel comparison,
Native/Vite median and p95 were 114.0/124.0 versus 111.8/149.2 ms for topic
selection, 60.5/76.0 versus 47.25/137.1 ms for expanding all seven Trading
answers, 24.0/36.0 versus 125.1/160.9 ms for search, and 61.0/75.0 versus
90.85/118.5 ms for clear. Native beat Vite at p95 for every action and passed
both measures for search and clear, but it missed the strict median gate by
2.2 ms for topic selection and 13.25 ms for expand-all. Public-page physical
performance is therefore repeatable and functionally healthy, but not yet
approved under the no-slower rule.

## Remaining approval gate

Home now has both browser-proxy and physical-phone approval. Its existing phone
numbers still came through the development client, so Home and the action menu,
loading spinner, theme switch, collection swipe, and Home-to-filtered-collection
links remain in the final whole-app standalone sweep.

For public information pages, optimize and remeasure only the FAQ topic-selection
and expand-all median paths. The current `5c7f025b` standalone candidate already
establishes functional stability, faster p95 behavior for all four FAQ actions,
and full median/p95 wins for search and clear; it must not be described as a
complete performance-parity pass until the two median misses are removed in a
new build.
