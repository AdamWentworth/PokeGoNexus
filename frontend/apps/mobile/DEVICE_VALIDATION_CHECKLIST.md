# Mobile Device Validation Checklist

For the current install/build/Metro state and the latest automated checkpoint,
read `CURRENT_NATIVE_TESTING_STATUS.md` first. The dated APK records below are
historical evidence for those exact binaries, not proof that later Metro-served
changes are present in an installed standalone APK.

This is the release checklist for the React Native parity implementation. The
canonical web application remains the product specification and the stable
default. Native parity is enabled only with
`EXPO_PUBLIC_MOBILE_EXPERIENCE=native-preview` until the physical-device review
at the end of this document is approved.

## Current native-preview scope

The native preview now provides native routes for the complete current product
surface rather than a collection-only lab:

- public Home, Getting Started, Help, FAQ, About, Safety, Terms, Privacy, and
  data-deletion information;
- login, registration, OAuth registration continuation, password recovery, and
  email-change verification;
- signed-in Home, collection, tags, foreign catalogs, Pokémon detail/edit
  workflows, custom tags, search, trainer profiles, friends, settings, and
  account security;
- trade preferences, proposal review, authoritative trade activity, external
  coordination details, and the shareable Trade Board;
- Pokédex, raids, Max Battles, PvP, rankings, and methodology routes;
- native action-menu navigation, deep links, not-found recovery, theme control,
  offline collection cache, Receiver-backed pending sync, retry, and canonical
  reconciliation.

No native-preview route may redirect to the canonical WebView as a substitute
for missing parity. Unknown paths must land on the recoverable native not-found
screen. The default experience must remain the canonical WebView until the
manual approval gate passes.

## Automated evidence

The deterministic Android suite lives in `.maestro/` and is run with:

```bash
npm run device:smoke:android
```

The runner builds and installs the project-owned `com.pokegonexus.app`
development client, starts a fresh project bundle for each fixture, and
supports these matrix controls:

```bash
POKEGONEXUS_SMOKE_COLOR_SCHEME=dark \
POKEGONEXUS_SMOKE_FONT_SCALE=1.3 \
POKEGONEXUS_SMOKE_REDUCE_MOTION=true \
POKEGONEXUS_SMOKE_DENSITY=520 \
npm run device:smoke:android
```

Expo Go is not valid evidence for native-module parity. The separate standalone
release lifecycle gate runs with airplane mode enabled and no Metro dependency:

```bash
npm run device:smoke:android:release-lifecycle
```

Before physical-device approval, retain passing evidence for:

1. all `.maestro/*.yaml` fixtures in light mode;
2. all `.maestro/*.yaml` fixtures in dark mode;
3. the high-risk collection, search, trade, auth, social, settings, Home, and
   action-menu fixtures with enlarged text and reduced motion;
4. collection and action-menu fixtures at narrow phone, wider phone/tablet, and
   desktop-reference logical widths;
5. the sync-resilience fixture covering cached, offline, pending, accepted,
   failed, retried, and canonically confirmed states.

The local static and bundle gates are:

```bash
npm run typecheck
npm run lint
npm run lint:dead-code
npm test
npm run test:browsers:web
npm --workspace apps/mobile exec expo-doctor
npm exec --workspace apps/mobile -- expo export --platform android
npm exec --workspace apps/mobile -- expo export --platform ios
```

Performance-budget tests must be rerun without an emulator, browser suite, or
other CPU-heavy job competing for the host. Resource contention is not valid
performance evidence.

## Browser/static validation baseline — 2026-08-28

The invalid 2026-08-27 record has been superseded. All browser parity captures
below ran with `EXPO_PUBLIC_DEVICE_SMOKE_MODE=true`; unknown fixture routes were
treated as failures rather than redirecting to guest Home.

- Repository type checks, ESLint, Stylelint, dead-code analysis, and diff
  validation passed.
- The shared web suite passed 1,718 tests across 344 files, and the native suite
  passed 733 tests across 146 suites.
- The functional browser matrix passed 730 tests across desktop Chromium,
  Firefox, WebKit, mobile Safari, and mobile Chromium, with 405 intentional
  project/capture skips and no retries. The isolated one-worker performance
  budget also passed.
- Corrected native browser capture passed 366 light/dark screenshots. The
  real-route harness passed 92 route/theme states, and all 82 generated contact
  sheets were inspected against their canonical Vite references.
- The 42 Android Maestro flows passed independently in both light and dark
  mode, with enlarged-text/reduced-motion and density variants. Those runs used
  Expo Go, however, so they are retained only as JavaScript/UI evidence and are
  explicitly excluded from native-module and installable-app parity evidence.
- Expo Doctor passed all 21 checks, and final Android and iOS static exports
  completed successfully.

This baseline does not by itself establish the 99% native-preview target. A
project-owned Android binary, native module, offline process-lifecycle, and
fresh-bundle record must supersede its Expo Go device evidence. It also does
not constitute production approval: the physical Pixel, two-account trade,
and physical iOS/manual approval gates below remain required, and the canonical
WebView remains the default experience.

## Standalone release-candidate evidence — 2026-08-29

The current local implementation meets the automated 99% parity threshold for
the complete current route surface. This record uses project-owned standalone
release APKs, not Expo Go or a Metro-served development client:

- The light release APK (`3974b8df872998abac976fa27dcec83b70303a1352df437ef7b860e4e6569396`)
  passed all 43 Maestro flows with 130% system text and Android animations
  disabled. The artifact contains 43 primary flow directories, zero retry
  directories, zero failed command states, and zero app crash/ANR markers:
  `/tmp/pokegonexus-android-smoke.fSVNJ2`.
- A fresh dark release APK built from the same application source
  (`aed7bf2aeafc3904abbeb52da78e178a80e67ce85d4e27bcec0114bf558720eb`)
  passed all 43 flows. It likewise produced 43 command records, zero retries,
  zero failed command states, and zero app crash/ANR markers:
  `/tmp/pokegonexus-android-smoke.akLkGg`.
- The light APK passed the real SQLite offline/process lifecycle twice without
  retry (`/tmp/pokegonexus-android-smoke.uRmplt` and
  `/tmp/pokegonexus-android-smoke.ucwPEv`). These runs began after `pm clear`
  in airplane mode and proved cache/outbox persistence through process death,
  account isolation, Receiver acknowledgement persistence, canonical outbox
  cleanup, and retained cached collection data.
- The responsive collection/action-menu fixture passed at 520 dpi in the full
  matrices and independently at 420 dpi and 200 dpi without retry
  (`/tmp/pokegonexus-android-smoke.iYKnvR` and
  `/tmp/pokegonexus-android-smoke.Bs1kbX`).
- Dynamic collection filtering, trade-preference editing, location
  autocomplete, account session revocation, and the offline lifecycle were each
  repeated in focused standalone runs after their final hardening changes.
- The complete native Jest suite passed 730 tests across 146 suites. The shared
  Vite suite passed 1,718 tests across 344 files, with only its two explicitly
  opt-in live-catalog cases skipped. TypeScript, ESLint, Stylelint, dead-code
  analysis, all seven Go modules, and Expo Doctor (21/21) passed.
- Clean production-mode Expo exports produced Android and iOS Hermes bundles.
  Android device behavior is covered by the installed APK evidence above; the
  iOS export is build evidence only and does not replace the physical iOS gate.
- Android config introspection proves cleartext traffic is `false` for ordinary
  builds and enabled only for explicit deterministic device-smoke builds.

This closes the local automated parity target; it does not waive the physical
Pixel comparison, real two-account/two-device backend exercise, physical iOS
review, or explicit rollout approval below. Those are production-release gates,
not missing native-preview routes.

## Physical-device preconditions

1. Use a preview or release build with the native-preview flag enabled. Do not
   compare against a stale Expo Go bundle.
2. Point `EXPO_PUBLIC_*_API_URL` values at the intended production or staging
   endpoints.
3. Use an account with collection, custom-tag, friend, profile, search, trade,
   and settings data representative of the canonical application.
4. Keep the canonical PWA/WebView available on the same Pixel for side-by-side
   comparison.
5. Have reproducible online, airplane-mode, and reconnect paths.

## Pixel parity pass

### App shell and navigation

- Every current action-menu destination opens a native route without showing
  the previous route underneath while it loads.
- Android Back closes only the topmost modal, selector, or overlay before
  leaving its route.
- Adjacent Tags/Pokémon/Wishlist, Search modes, and Trades modes preserve the
  canonical slide relationship, swipe behavior, header indicator, and reduced
  motion behavior.
- Returning with Back restores the prior list/tag/search context and scroll
  position.
- The action-menu anchor, close actions, keyboards, and sticky controls respect
  safe areas and gesture navigation.

### Authentication and account

- Email/password and Google, Discord, and Facebook login reach the same account
  when the verified email is the same.
- Registration continuation, duplicate-account behavior, password recovery,
  and verification-link errors provide explicit feedback.
- Account username, email verification, password changes, provider linking and
  unlinking, session revocation, and account-deletion confirmation match the
  canonical workflow.
- An OAuth-only account requires a recent provider sign-in—not a nonexistent
  password field—to disconnect its last provider.
- Relaunch restores the secure session; logout isolates account-scoped cache and
  pending collection mutations.

### Collection and tags

- The default Pokémon view opens the entire catalog rather than a mixed tag
  subset.
- Tags, Pokémon, and Wishlist preserve the canonical header, counts, selected
  tag sublabel, sliding indicator, ordering, search, sort, selection, and
  organizer workflows.
- System and custom tags preserve their semantic colors, memberships, previews,
  reordering, edit/delete/create feedback, and inventory/wishlist ownership.
- The grid shows 3/6/9 columns at the canonical responsive boundaries and stays
  virtualized for a realistically large collection.
- Favorite/For Trade, lucky/trade, Wanted/Most Wanted, custom-tag, create-copy,
  and caught-transition constraints match the shared domain rules.
- Ordinary, shiny, shadow, purified, lucky, location-background, costume, form,
  gender, Mega, fusion, crown, Dynamax, and Gigantamax presentation matches the
  canonical helpers.
- Caught, For Trade, and Wanted overlays preserve every applicable field,
  target grid, editor, child selector, swipe navigation, stacked-close behavior,
  server feedback, and safe-area relationship.

### Search and social

- Pokémon search supports all canonical filters, preview image updates,
  background/costume normalization feedback, list/map modes, matching priority,
  result pagination/scrolling, cached return context, and correct listing
  overlays.
- Trainer search matches both Nexus username and Pokémon GO name.
- Own and foreign profile cards, showcase editing, friendship transitions,
  blocking, privacy, and external coordination fields match the canonical
  behavior without exposing private location data.

### Trades

- Preferences preserve per-Pokémon Wanted/For Trade semantics and every matching
  rule.
- Proposal review always shows the current user on the left, the other trainer
  on the right, and validates ownership, targets, active trades, friendship,
  special-trade, lucky-friend, and five-heart remote-trade rules.
- Accept, deny, cancel, dual confirmation, complete, satisfaction, re-propose,
  delete, and partner-information actions reconcile from canonical server
  responses and provide visible success or failure feedback.
- No trade command is queued offline or presented as successful before commit.

### Home, information, and tools

- Guest and signed-in Home match their canonical content, branding, imagery,
  action-menu hint, workflow links, dashboard states, and footer/legal paths.
- Public information, legal, recovery, not-found, methodology, and help routes
  remain readable and navigable in both themes.
- Pokédex, raid, Max, PvP, rankings, and Trade Board workflows preserve their
  canonical data, controls, result states, and responsive layouts.

### Theme, accessibility, and resilience

- Repeat every high-risk workflow in light and dark mode.
- Repeat with enlarged system text and with Android animations disabled; no
  label may clip, overlap, or become unreachable.
- Screen-reader labels describe every interactive control and state; focus order
  follows visual order; touch targets remain usable.
- Offline startup uses the account-scoped cached collection, pending mutations
  survive restart, retries are idempotent, and reconnect distinguishes Receiver
  acceptance from final canonical confirmation.
- No crash, blank route, stuck loading state, horizontal overflow, silent
  mutation, or cross-account cache leak is acceptable.

## Manual approval gate

Automation does not authorize cutover. Before native becomes the default:

1. Compare the Pixel native build beside the current PWA/WebView from the same
   account, theme, tag, sort, search, overlay, and scroll state.
2. Run the complete checklist in light and dark mode, including errors, offline
   recovery, keyboard entry, system Back, gestures, and process relaunch.
3. Verify that familiar information, actions, terminology, imagery, density,
   colors, and workflow step counts did not noticeably change.
4. Perform a two-account/two-device trade from proposal through dual
   confirmation and canonical collection reconciliation.
5. Perform an iOS simulator/build smoke and a physical iOS review before an iOS
   production release; shared React Native tests and an iOS export are necessary
   but not a substitute for device input and safe-area validation.
6. Record explicit approval before changing the default experience flag.
