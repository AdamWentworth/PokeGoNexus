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

## Tool workspace follow-up — 2026-09-13

Raid, Community Rankings, Max Battles and all four PvP tools now put a retained
horizontal content track beneath their stationary heading and workspace buttons.
The selected button and full content track use the same native animation clock.
Unvisited expensive tools open on first use; subsequent visits retain drafts,
expanded details, pagination and vertical position. PvP opens its tool panels
together on first use so a direct Rankings-to-IV-Rank jump traverses real panels.

Each Pokémon's Pokédex entry keeps Vite's vertical document scrolling, with the
hero and section bar above the sliding body. Registered, Info, Battle and More
remain mounted, including More's combination search and filters. A minimum body
height keeps short sections from pulling the hero and tabs down during a slide.
The section bar scrolls with the document as it does in Vite; it is stationary
during the horizontal transition.

Community Rankings derives separate wanted/rarest row arrays, so changing mode
cannot replace the outgoing page's rows. Max's ranking search and pagination
survive a Boss teams visit; that saved search does not filter the boss panel.
Raid setup/log drafts and Max simulator selections stay mounted across visits.
PvP keeps teams and battle setup rather than resetting them on a workspace tap.
Opening any public PvP tool now requests both the catalog and move mechanics.
Previously, visiting IV Rank on a fresh process could hydrate moves with incomplete
catalog data and leave Battle Lab unavailable until another route loaded moves.
A route regression checks that public tools request those dependencies without
requesting the personal collection.

Collection tag press-in now reserves background work without changing the grid,
filter or scroll position. A canceled press or drag keeps the existing Pokémon
visible. A confirmed tag tap commits its rows before starting the slide; confirmed
Favorites taps still apply Favorite descending. Search, Trades and the shared
horizontal pager implementation are unchanged.

Focused regression coverage includes shared indicator progress halfway through a
slide, first-use retention, non-adjacent PvP navigation, real team/setup state,
distinct ranking rows, and confirmed versus canceled tag presses. Device results
and APK identity are recorded in the current status and Android handoff documents.

## Profile/Friends workspace follow-up — 2026-09-13

The user's requested interaction supersedes separate owner Profile/Friends route
visits. `e24708c6` keeps both panels mounted in one screen, with the trainer header
and workspace bar stationary. A single gradient selection background moves with
the entire panel below through the same native animation clock. Friends keeps
its independent four-tab slider. Profile drafts, search drafts, selected sub-tabs
and scroll positions survive workspace switches; Edit is on the trainer card.
The bar and action menu update workspace parameters without growing Back history.
Existing Friends links retain their sub-tab when entering the shared workspace.
The earlier native screen ownership fix remains required and is retained.

The normal-account regression passes five round trips, all Friends tabs, Back
and old Friends notification links, with no native rendering errors. Direct
mid-transition PNG captures verify the shared motion; screenrecord video capture
frames are not accepted as clean presentation media. Light/dark screenshots and
unsaved draft retention were checked on the real account. No account edits were
submitted. Full evidence and automation limitations are in the current status.

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
