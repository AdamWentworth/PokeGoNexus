# Native slide and gender parity review — 2026-09-13

Vite remains the interaction reference. This review covers the reported native
page slides, the instance move-mode switch, and species gender eligibility.
It does not certify every animation or close the existing whole-app performance
and lifecycle gates.

Follow-up: the `fdf94ecb` APK was not safe for repeated Profile/Friends route
navigation. The user reported an app-wide blank screen after this review. The
phone logs and a normal-account regression reproduce native screen reordering
errors without a fatal exception. `82f3070b` removes the stack's singular screen
reuse; the new navigation checker includes Fabric soft errors and actual return
navigation. See the current status and handoff documents for that correction.

## Implementation

- Pokémon/Tags/Wishlist, Search, Trades, and Friends use the shared 300ms page
  track. Every Android caller now uses native gesture events, including callers
  without an explicit drag value. Search/Trades/Friends share drag progress with
  their indicators. A delayed interrupted-animation reply cannot overwrite a
  subsequent tab selection. Embedded tracks measure their actual viewport.
- Read-only and editable moves keep both full-width pages mounted. They use
  Vite's 220ms CSS-ease equivalent; the measured underline moves over 300ms.
  Inactive controls are excluded from accessibility and input. Battle mode
  persists across opening the editor, and the editor includes Shadow bonuses
  and legacy move markers. Purified instances do not receive Shadow bonuses.
- Pokédex region summaries and region-index lists retain the outgoing category
  until the incoming list finishes moving on one native-driven track. The
  incoming native layout and two paint frames precede the animation start; the
  animated transform node remains stable when outgoing pages are removed. During
  motion, one stationary copy of the shared header covers the hidden in-list
  headers. Normal scrolling still uses the original in-list header. The current
  offset is carried to the destination list, subject to its available height.
  Only current/in-flight category lists are retained.
- Raid, Max, PvP and Rankings no longer add an unsupported sideways workspace
  nudge on tool-mode changes. Their segmented indicators remain animated. Max
  separately preserves Vite's 220ms entrance when switching All/My rosters;
  its product header and roster controls remain stationary.
- Vite and native share catalog gender parsing, including suffixed rates such
  as `100M_0F_0GL`. Fixed-gender and genderless instances cannot cycle gender;
  unknown eligibility is not editable. Mixed caught/trade instances cycle Male
  and Female; Wanted requirements retain Any. The mutation layer rejects new
  impossible values before queueing or sending, while preserving existing
  species/gender mismatches during unrelated edits.

Instance-to-instance navigation retains its shared swipe contract. Menu, sheet
and route animations are outside this batch's physical motion qualification.
Pokédex detail's Registered/Info/Battle/More content changes are conditional in
Vite too, so this repair does not invent full-page slides for those tabs.

## Candidate history and evidence

`7cbac5b8` was rejected during physical verification. Its extra gesture host was
a plain View, which could not consume a native Animated event and crashed on
hub drags. Its initial per-page category transforms also failed to produce the
required Android motion. The follow-up `6adf1126` uses an Animated gesture host
and a single translated category track. Physical recordings then required
waiting for incoming native layout/paint (`7384a97b`) and retaining the same
animation node while old pages retire (`fdf94ecb`). Do not rebuild the rejected
candidate.

Private initial evidence and Vite move references are under
`.artifacts/slides-gender-2026-09-13/`. The four hub tap/drag recordings and all
five instance editor checks on
`6adf1126` are under `.artifacts/slides-gender-final-2026-09-13/`. Final
build/install and device evidence are under
`.artifacts/slides-gender-release-2026-09-13/`. Captures contain real
account data and are intentionally excluded from Git and presentation assets.

The Vite reference uses the existing local production bundle with real account
reads and blocks writes except normal session refresh. Its Moves animation
source matches the reference inspected in this review; its older caught-ribbon
colors are not a reference for the already-corrected white date text.

## Validation

The repair has 152 passing targeted native tests and 11 Vite Moves/Gender tests.
Affected tests were rerun after the Android follow-ups. Both app typechecks and
changed-file lint pass. The Rankings suite emits an existing asynchronous
VirtualizedList `act` warning; its assertions pass.

Device checks on `6adf1126` record all four hub tab/drag paths without restarting
the app. The fresh log window has no fatal exceptions. Real-account editor
checks pass Mewtwo (genderless), Gallade (male only), Latias (female only),
Salamence (Male/Female), and Castform Wanted requirements (Any/Male/Female).
Read-only and editable Shadow move recordings show the two moving pages and
correct mode powers/bonuses. All drafts were closed without saving. The final
follow-ups change only Pokédex rendering and the Max roster-stage spacing.

Final installed candidate and account checks are recorded in
`CURRENT_NATIVE_TESTING_STATUS.md` and `STRONG_MACHINE_ANDROID_HANDOFF.md`.
The final `fdf94ecb` films show intermediate region/index frames, rapid reversal
settling, Max roster entrances, collection drags and instance navigation. Its
light/dark captures retain the prior ribbon, recorded-ball and full-screen fixes;
its fresh log window contains no fatal exceptions. The repeated account check
encountered a retained Favorites filter when reopening the same Caught deep link;
that navigation follow-up is recorded separately from the passing earlier counts.
Screen recordings are visual evidence, not matched frame-time benchmarks.
Existing performance, long-session, offline and expiry gates remain open.
