# Native Collection Parity Contract

This document is the release contract for replacing any part of the canonical
`/pokemon` experience with React Native.

The canonical web application is the specification. It is not merely a source
of inspiration. A native implementation may use platform-native primitives,
but it must preserve the information, visual hierarchy, ordering, density,
terminology, imagery, colors, interaction model, and outcomes that a user can
observe. The migration is not an opportunity to redesign or simplify the
collection experience.

The default mobile application must continue to open the canonical WebView
experience until every item in the relevant milestone is complete and approved.
An incomplete native screen may exist only behind an explicit development-only
route. It must never be presented as the replacement experience.

## What “users will not notice” means

The target is perceptual and behavioral parity, not identical DOM/CSS or a
literal pixel checksum. A regular user moving between the PWA/WebView and native
application should not discover that controls moved, information disappeared,
terminology changed, cards became materially larger or smaller, workflows gained
or lost steps, or familiar visual signals changed meaning.

Permitted implementation differences are limited to:

- native safe-area handling;
- native keyboard avoidance and focus behavior;
- platform accessibility semantics;
- native scrolling physics and system text rasterization;
- tiny spacing adjustments required to avoid clipping at a supported device
  inset or font scale.

These differences may not change content order, usable density, touch-target
placement, color meaning, or the number of actions required to complete a task.

## Canonical source map

The following web sources define the behavior to preserve:

- `packages/app-core/src/pages/Pokemon/Pokemon.tsx`
- `packages/app-core/src/pages/Pokemon/Pokemon.css`
- `packages/app-core/src/pages/Pokemon/components/Header/`
- `packages/app-core/src/pages/Pokemon/components/PokemonViewSlider.tsx`
- `packages/app-core/src/pages/Pokemon/components/Menus/PokemonMenu/`
- `packages/app-core/src/pages/Pokemon/components/Menus/TagsMenu/`
- `packages/app-core/src/pages/Pokemon/components/PokemonPageOverlays.tsx`
- `packages/app-core/src/pages/Pokemon/features/instances/`
- `packages/app-core/src/features/tags/`
- the shared display helpers under
  `packages/app-core/src/features/pokemonDisplay/`;
- the shared UI tokens under `packages/shared-ui-tokens/` and the app-core
  theme/token styles.

If this contract and the canonical implementation diverge, stop the native
cutover and update the contract deliberately. Do not silently choose whichever
behavior is easier to reproduce natively.

## Page shell and navigation invariants

- Preserve the three coordinated views and their order: **Tags**, **Pokémon**,
  **Wishlist**.
- Preserve the horizontal left/right relationship and the familiar slide
  transition between adjacent views.
- Preserve swipe navigation where it does not conflict with an active nested
  horizontal gesture.
- Long swipes past the peek limit must settle to an exactly aligned page in
  both directions. Later tab/tag taps must not retain a sideways displacement
  or expose the neighboring panel.
- Preserve the three equal-width header controls, active white underline, count
  below Pokémon, and selected-tag sublabel below Tags or Wishlist.
- Preserve own-catalog and foreign-catalog behavior. A foreign catalog must
  always have a valid tag selected; users cannot clear into an unstable,
  unscoped catalog.
- Preserve the foreign trainer context and return-to-search/catalog navigation.
- Preserve browser/system back semantics: close only the topmost overlay or
  workflow state before leaving the route when that state has history context.
- Preserve the bottom Poké Ball action-menu affordance and avoid obscuring it
  with native controls.
- Preserve scroll position when returning to a previously visited collection
  or tag context.
- Preserve light mode, dark mode, safe-area insets, reduced motion, and dynamic
  text without horizontal overflow.

## Pokémon view invariants

### Catalog form additions

- Adding Mega/Primal catalog forms must offer an eligible caught copy or an
  explicitly requested new copy. Preserve the selected copy's identity, stats,
  moves, favorite, and existing tags.
- Adding fusion forms must show both component choices, including creation of
  either component. Preserve the base's shiny appearance; either partner
  appearance is eligible. Save reciprocal links and disable the partner in the
  same retained batch. Unfusing must release the partner again.
- Validate current eligibility and prevent reuse of one copy across multiple
  selected forms before queueing anything. Cancelling the picker must create
  no records, including when new components have been selected.
- The bulk organizer and individual catalog route must use the same validated
  creation path; neither may create a fused record without a partner.
- Applying a bulk creation result must index existing instance keys once,
  avoiding a full collection scan for every new copy. Newly created copies
  retain their creation order through increasing timestamps within the batch.
- Connection loss, sync failure with retry, and recovery must be visible across
  native routes, including signed-out connectivity feedback. Status notices must
  leave Save and Cancel controls accessible.

### Search and active context

- Preserve the centered white search pill in its idle state.
- Preserve the focused/searching state: back affordance, clear affordance,
  entered term, and evolutionary-line option.
- Preserve search filtering and the relationship between search terms, forms,
  variants, instances, and the selected tag.
- Preserve the active tag chip below search. System colors remain semantic:
  Favorites is gold, For Trade is green, Caught is blue, Wanted is red, and
  Most Wanted uses its reddish-orange priority treatment.
- Preserve the user-selected color for custom tags.
- Preserve the fact that a required foreign-catalog tag has no clear action.

### Grid and density

- Preserve the responsive density: 3 columns below 480 px, 6 columns from
  481–1023 px, and 9 columns at 1024 px and above unless a later canonical web
  change deliberately updates both implementations.
- Preserve compact, minimally framed cards. Do not replace them with large
  dashboard cards, status banners, or a two-column native list.
- Preserve ordering, sort controls, all supported sort modes, and stable keys.
- Preserve `PokemonMenu/CustomScrollbar`: the original `/images/scroll.png`
  thumb is 40 × 60 px on the right, travels over 85% of the grid viewport,
  appears while scrolling, and fades over 500 ms after one second idle.
  Dragging it must seek the actual virtualized list, clamp at both ends, and
  stay synchronized with ordinary scrolling, restored offsets, tag resets,
  filters, and viewport changes. Hide it for non-scrollable results and while
  search controls cover the grid; it must not steal horizontal page gestures
  or card taps outside its visible thumb. Native scroll tracking must not add
  a recurring JS listener or per-frame collection/session updates.
- Selecting the Favorites tag automatically selects Favorite descending
  (highest CP first), including reopening Favorites after a manual sort.
  A cancelled tag press must not change sorting. Other tags preserve the
  selected sort, and users may change sorting after opening Favorites.
- Preserve fast/multi-select, highlighted-card treatment, selection count, and
  the organizer action that appears for a non-empty selection.
- Preserve loading, empty, offline/cached, refresh, and error states without
  allowing them to shift primary controls out of reach.
- Preserve large-collection performance. A native port must virtualize the list
  and must not render the complete collection at once.

### Card information and visual signals

Every applicable state below must have a fixture and screenshot case. Signals
must occupy the same perceived place relative to the Pokémon image—not merely
the enclosing card.

- CP at the top when present; preserve layout stability when it is absent.
- Favorite star for caught Pokémon and Most Wanted star for wanted Pokémon.
- Pokémon image and variant-specific image selection.
- Pokémon number, wrapped name, and type icons.
- Caught, For Trade, Wanted, selected, and disabled visual treatments.
- Shiny and shadow indicators.
- Purified indicator.
- Lucky background.
- Location/special background, including valid background/costume pairing.
- Dynamax and Gigantamax badges at the image’s top-right reference point.
- Costume and form-specific imagery.
- Gender-specific imagery.
- Mega, fusion, crown, and other supported transformation imagery.
- Any combinations currently accepted by the canonical display resolver.

Do not independently reconstruct image URLs or badge placement in native UI.
The native presentation must consume shared domain/presentation decisions or
fixture outputs derived from the same canonical helpers.

## Tags view invariants

- Preserve separate inventory and wishlist tag families while keeping them part
  of the same three-view collection experience.
- Preserve system tags and meanings:
  - inventory: Caught, Favorites, For Trade;
  - wishlist: Wanted, Most Wanted.
- Preserve custom tags as children of either caught or wanted, with their saved
  names, colors, counts, and membership.
- Preserve tag preview imagery and counts.
- Preserve custom-tag creation, editing, deletion, and validation.
- Preserve drag/touch reordering, floating drag preview, visible insertion
  feedback, cancellation, persistence, and error feedback.
- Preserve system/custom mixed ordering as saved by the user.
- Preserve tag-selection chips and the selected tag’s header sublabel.
- Preserve the organizer workflows for assigning newly generated and existing
  instances to custom tags.

## Collection organizer and status rules

The native workflow must use the same domain rules and feedback as the canonical
application. In particular:

- Base variants can generate caught, For Trade, or wanted instances through the
  organizer workflow.
- Existing caught instances can move among valid caught/custom tags.
- Creating a wanted entry from a caught selection creates a wanted copy; it does
  not silently mutate the caught record into an incompatible shape.
- A wanted entry becoming caught follows the canonical transition and custom-tag
  assignment behavior.
- Favorite and For Trade are mutually exclusive.
- Lucky Pokémon cannot be listed For Trade and should be excluded from invalid
  candidate lists, with specific feedback when relevant.
- Most Wanted is a priority state within wanted; it is not a caught/favorite
  instance type.
- Status/tag changes show confirmation, progress, success, partial-failure, and
  failure feedback. A user must never have to infer whether an operation ran.
- Receiver-accepted Pokémon changes and final server reconciliation remain
  distinguishable where the canonical workflow makes that distinction.

## Overlay and motion invariants

- Opening an instance or organizer overlay slides it up from the bottom; closing
  returns it downward.
- Only the topmost stacked overlay closes for a single tap, gesture, Escape, or
  back action.
- Closing a child editor returns to the exact parent overlay and selection.
- Preserve the left/right previous/next instance controls and their boundaries.
- Preserve the current relationship among Pokémon image, background, information
  panel, close control, and bottom safe area at narrow and wide widths.
- Preserve editing affordances in the canonical top-left convention unless a
  canonical workflow intentionally places a secondary control elsewhere.
- Do not expose a native detail screen until its complete caught, For Trade, or
  wanted workflow is present. A read-only approximation is not a replacement.

## Caught instance parity

The caught overlay must preserve display and edit behavior for all applicable
fields and sections:

- nickname, CP, level, gender, weight, height;
- type display and form-dependent type changes;
- fast and charged moves, move types, bonuses, and IV values;
- favorite, lucky, traded, shadow, and purified constraints;
- caught location autocomplete, caught date, Poké Ball, original trainer, and
  traded metadata;
- location/special background selection;
- level arc and calculated CP behavior;
- Dynamax/Gigantamax state and Max moves;
- Mega, fusion, crown, purification, and other conditional controls;
- validation and save failure feedback;
- view-mode omission of empty metadata without removing its edit control.

## For Trade instance parity

The For Trade overlay must remain a caught instance that is listed for trade,
not a generic listing card. Preserve:

- canonical Pokémon imagery and supported caught-instance details;
- the top-left listing-detail edit action, distinct from preference editing;
- compact view-mode omission of non-useful empty fields;
- special/lucky/background/Max presentation rules;
- wanted-target preview grid and target count;
- wrapped target names, Pokémon numbers, and all target badges;
- edit-preferences navigation to the canonical Trades preference workflow;
- proposal launch from a foreign catalog without redirecting the user away from
  the listing unnecessarily;
- ownership, target, lucky, active-trade, friendship, special-trade, and remote
  trade validation;
- proposal review with the current user’s Pokémon on the left and the other
  trainer’s Pokémon on the right;
- five-heart remote-trade and four-heart-plus lucky-friend semantics;
- explicit canonical success or error feedback after the server-authoritative
  proposal command.

## Wanted instance parity

The wanted overlay is a set of wanted conditions, not a caught instance and not
the inverse of the For Trade card. Preserve:

- Wanted/Most Wanted identity and reddish visual theme;
- editable friendship requirement from zero through five hearts;
- lucky-trade preference independent of five-heart remote eligibility;
- desired gender, size categories (XXS, XS, any, XL, XXL), and move requirements;
- location/special background conditions and valid background/costume pairing;
- omission of unspecified conditions in view mode while retaining edit controls;
- For Trade Pokémon preview grid and count using the mirrored terminology chosen
  by the canonical UI;
- proposal flow in which a selected wanted listing already identifies what the
  current user offers and the user chooses what the other trainer offers;
- Most Wanted behaving identically to Wanted except for its priority toggle and
  visual marker.

## Data, caching, and synchronization parity

- MySQL/server responses remain authoritative for account, tag, friend, profile,
  and trade state.
- Pokémon instance writes retain the existing Receiver/Kafka synchronization
  model and its idempotency semantics.
- Native cached collection data may support fast startup and offline display but
  must not invent a successful server state.
- Pending mutations must survive process restart, retry safely, reconcile with
  canonical snapshots, and surface conflicts instead of silently overwriting
  newer server state.
- Sign-out must isolate or clear account-scoped cache and outbox data.
- Foreign catalog data must never be written into the signed-in user’s local
  collection cache as owned data.

## Required state matrix

Each migrated milestone must exercise the applicable cross-product below. It is
acceptable to use representative fixtures for combinatorial visual states, but
every behavioral row requires a direct test.

| Dimension | Required cases |
| --- | --- |
| Theme | light, dark |
| Width | narrow Pixel/PWA, wider phone, tablet, desktop reference |
| Font/accessibility | default, enlarged text, reduced motion, screen reader labels |
| Connectivity | first online load, cached load, offline mutation, reconnect, server conflict |
| Catalog owner | self, other trainer, private/blocked/not found |
| View | Tags, Pokémon, Wishlist |
| Tag | every system tag, caught custom tag, wanted custom tag, required foreign tag |
| Search | idle, focused, query, evolutionary line, zero results, clear/return |
| Selection | none, one, many, catalog variants, existing instances, mixed invalid selection |
| Card | ordinary, selected, favorite, For Trade, wanted, Most Wanted, lucky, location, Max |
| Overlay | caught, For Trade, wanted; view, edit, validation error, save error, saved |
| Stack | instance only, child selector, confirmation, organizer, Mega/fusion selector |

## Automated gates

No native collection milestone is eligible for user review until all of these
gates pass:

1. Mobile TypeScript, ESLint, and unit tests.
2. Shared-domain and shared-contract package tests affected by the milestone.
3. Canonical frontend unit/component tests for the same domain rules.
4. Native behavior tests for navigation, selection, mutation, error, offline,
   retry, and reconciliation states.
5. Deterministic screenshot captures for the state matrix at agreed Pixel and
   desktop reference sizes in light and dark themes.
6. Side-by-side visual review against canonical screenshots. Any unexplained
   change in hierarchy, spacing, typography, color, iconography, wrapping, or
   density fails the gate.
7. Accessibility checks for labels, focus order, target size, contrast, font
   scaling, and reduced motion.
8. Performance checks using a realistically large collection and tag set.

Screenshot tooling may use tolerance for native font rasterization and subpixel
antialiasing. Tolerance must not conceal moved controls, changed dimensions,
missing content, different wrapping, or incorrect images.

## Manual approval gate

Automation does not authorize cutover. Before a native milestone becomes the
default, it must be reviewed on the Google Pixel beside the current PWA/WebView:

1. Start from the same account, tag, sort, search, and scroll state.
2. Compare every screen in light and dark mode.
3. Run the complete workflow, including errors and back/close behavior.
4. Verify no familiar information or action moved or disappeared.
5. Verify the native version does not add explanatory scaffolding, alternate
   dashboards, or migration choices to the user experience.
6. Obtain explicit approval for that complete workflow.

If a difference is noticeable and was not requested, the native implementation
must change. “More native,” “cleaner,” or “simpler” is not sufficient reason to
depart from the canonical app.

## Incremental migration and rollback

Each commit must leave the default application stable:

1. Shared domain/presentation extraction with no visible web change.
2. Hidden native implementation and fixtures.
3. Automated parity and behavior coverage.
4. Pixel side-by-side approval.
5. A narrowly scoped feature flag that enables one complete workflow.
6. Production observation with the WebView route retained as an immediate
   fallback.
7. Removal of the old route only after an explicit later decision.

Do not cut over the collection shell without its instance workflows merely
because the grid renders. Do not cut over an instance type with missing editing,
organizer, proposal, or child-modal behavior. The unit of migration is a complete
user workflow, not a component or a screen.

## Current collection milestone boundary

The obsolete read-only collection lab has been removed. The development-only
native preview now contains the complete collection candidate: live snapshot and
cache hydration, virtualized responsive catalog, tags and wishlist, organizer
mutations, caught/For Trade/Wanted overlays, preference and proposal handoffs,
offline outbox status, Receiver acceptance, and canonical reconciliation.

That broader implementation does not relax this contract. It remains behind the
native-preview flag until the entire required state matrix passes and the Pixel
side-by-side review approves it as one complete workflow. If any child selector,
mutation, responsive state, theme, or error path is incomplete, the collection
candidate is incomplete; the presence of a working grid is never sufficient for
cutover.
