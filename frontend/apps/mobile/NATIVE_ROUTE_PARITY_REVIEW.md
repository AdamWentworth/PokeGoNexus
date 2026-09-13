# Native route parity review — 2026-09-12

This review compares the native migration with the canonical Vite application
using the signed-in account on a physical Pixel 8 Pro and fresh Vite references.
It is a route and presentation audit, not a whole-app performance qualification.
The final code candidate is `a501f03c` on `mobile/native-migration`.

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

The physical All/My workflow passes Raid, Max, and Master League PvP with the
actual account. Raid's personal roster shows 190 eligible entries from 2249
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

## Remaining discrepancies and investigations

1. Raid and Max show their roster explanation paragraphs visibly in native.
   Vite keeps that content as an accessible description without occupying
   visible layout space. This adds height before the native results. PvP's
   explanation is visible in Vite too, so it should not receive the same change.
2. Count semantics are inconsistent between views. A direct server read has
   2255 caught records including disabled copies, 2249 active caught, and 167
   active Favorites. Native collection matches the active count; Home's server
   summary uses the raw count. The Vite collection reference displays 2252.
   Vite tag initialization includes disabled instances and drops unmapped
   variants. Do not change native to include disabled partners just to match
   that display. Reconcile the projections and define a shared visible count.
3. The captured Vite Raid badge displays 192 versus native's 190. With identical
   server instances and hydrated catalog inputs, both Raid models produce
   exactly the same summary, including 190 eligible entries. The difference
   therefore still needs investigation at the capture/catalog/state boundary;
   it is not evidence of a native Raid calculation error. Max's 15-versus-13
   eligible badge difference also needs an equivalent input-level comparison.
4. Spacing, font sizes, gradients, small icons, ranking decorations, and some
   light-mode card surfaces remain visually different on the compared main
   pages. These are polish findings, not evidence of omitted routes. Screenshots
   use different effective viewport widths (phone 448, Vite reference 412), so
   viewport and safe-area differences must be normalized before pixel comparison.
5. Controlled collection/tag scrolling and whole-app motion/performance
   comparisons remain open. The earlier FAQ median misses and intermittent
   released-SQLite-handle investigation are not closed by this functional pass.
   Final two-account trade mutations and physical iOS coverage are also outside
   this account-preserving audit.

No further wholly missing main route was found in this pass. New native videos
and Phlosion presentation changes remain a subsequent task after choosing which
remaining presentation differences to resolve.

## Local evidence

- Native builds, installation identities, phone route captures, All/My flows,
  contact sheets, and same-input model comparison:
  `.artifacts/route-parity-2026-09-12/`.
- Native browser route evidence: `.artifacts/native-real-routes/`.
- Vite dark reference:
  `../web/.artifacts/native-route-review/2026-09-13T05-22-48-871Z/package/`.
- Vite light reference:
  `../web/.artifacts/native-route-review/2026-09-13T05-39-55-763Z/package/`.

These ignored local artifacts include private account inspection data and are
not committed or published. The real presentation-package pointer was retained.
