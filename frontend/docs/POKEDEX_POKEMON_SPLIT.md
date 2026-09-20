# Pokedex And Pokemon Split

This document captures the intended split between the Pokedex and Pokemon
surfaces, plus the registration taxonomy needed for collectors who want more
complete coverage than Pokemon GO currently exposes.

## Problem

The current `/pokemon` page is doing too much at once:

- Browse the catalog of available Pokemon variants.
- Track what the user has registered.
- Create owned Pokemon instances.
- Edit caught, trade, wanted, tag, and instance details.
- Show tag dashboards and collection filters.

That makes the page visually busy and conceptually muddy. The missing product
boundary is:

- **Pokedex** answers: what exists, what have I registered, and what completion
  goals am I chasing?
- **Pokemon** answers: what owned instances do I have, what do I want, what am I
  trading, and what details belong to those instances?

Some catalog redundancy is intentional. Both surfaces need Pokemon catalog
cards, but they use them for different jobs:

- **Pokedex catalog**: exhaustive, toggleable, and optimized around registration
  booleans.
- **Pokemon catalog**: compact and instance-oriented, optimized around creating
  and editing caught, trade, and wanted entries.

## Source Notes

Pokemon GO already separates these ideas:

- Niantic's Pokedex help page says the Pokedex tracks Pokemon seen and caught,
  and also has special categories such as Shiny, Lucky, Gigantamax, Mega, and
  Shadow Pokedex views. It also notes that catching an unregistered Pokemon for
  a specific Pokedex category can trigger a new-category registration animation.
  Source: https://niantic.helpshift.com/hc/en/6-pokemon-go/faq/124-viewing-the-pokedex/
- Niantic's inventory search help page treats owned Pokemon as a filterable
  inventory and lists terms for shiny, shadow, purified, lucky, costume,
  dynamax, gigantamax, fusion, background, locationbackground, xxs, xs, xl, xxl,
  appraisal, traded, favorite, moves, CP, HP, tags, and more.
  Source: https://niantic.helpshift.com/hc/en/6-pokemon-go/faq/1486-searching-filtering-your-pokemon-inventory/
- Pokemon GO's XXS/XXL announcement says the Pokedex tracks sizes and records
  for the Pokemon a trainer catches.
  Source: https://pokemongolive.com/post/different-sized-pokemon-in-pokemon-go-xxl-xxs/
- Niantic's Max Pokemon help page says Max Pokemon are a special type of
  Pokemon, Dynamax and Gigantamax are battle phenomena, Gigantamax can change
  appearance, and caught Max Pokemon return to normal storage form while
  retaining Max capability.
  Source: https://niantic.helpshift.com/hc/en/6-pokemon-go/faq/4795-what-are-max-pokemon-1729886792/
- Niantic's Mega Evolution help page says Mega Evolution temporarily transforms
  a Pokemon, changes appearance and stats, has a Mega Pokedex, and marks Mega
  forms caught only after the trainer Mega Evolves them.
  Source: https://niantic.helpshift.com/hc/en/6-pokemon-go/faq/3328-what-is-mega-evolution/
- Niantic's trading help page says special trades include unregistered Pokemon,
  shiny Pokemon, forms not already in the Pokedex, costumed Pokemon, regional
  forms, and Pokemon with unique or special features like Location Cards.
  Source: https://niantic.helpshift.com/hc/en/6-pokemon-go/faq/96-trading-pokemon/

## Product Principle

Pokémon Go Nexus should support a stricter collector model than Pokemon GO.

Pokemon GO may consider "XXL Bulbasaur" registered once the trainer catches any
XXL Bulbasaur. Pokémon Go Nexus users want the expanded collector view:

- XXL default Bulbasaur
- XXL shiny Bulbasaur
- XXL shadow Bulbasaur
- XXL shiny shadow Bulbasaur
- XXL costumed Bulbasaur
- XXL shiny costumed Bulbasaur
- etc.

So the Pokedex must support **full-combo registrations**. A registration is not
only `{ species, category }`; it can be `{ species/form, variant facets, quality
facets }`.

At the same time, the Pokemon page should not become a cartesian-product catalog
of every possible combination. Users should still create an instance from a
human-scale catalog variant, then fill in quality details on the instance.

## Vocabulary

- **Species/form**: The base catalog identity, such as Bulbasaur, Alolan
  Raichu, Castform Sunny, Furfrou Dandy Trim, Origin Forme Giratina, or Dusk
  Mane Necrozma.
- **Variant facet**: A major collectible visual or gameplay category that can
  seed instance creation. Examples: shiny, shadow, costume, Mega, Primal,
  Dynamax, Gigantamax, fusion, crown.
- **Quality facet**: A per-instance property that may be registration-worthy
  but should not multiply the normal Pokemon creation catalog. Examples: XXS,
  XS, XL, XXL, background, location background, lucky, purified, gender, IV
  appraisal, move provenance, ball, catch location.
- **Registration**: A specific Pokedex completion slot. This can be a simple
  slot like shiny Bulbasaur, or a full-combo slot like XXL shiny shadow
  Bulbasaur with a specific location background.
- **Instance**: A concrete owned/wanted/trade Pokemon entry with CP, IVs, moves,
  size, location card, ball, tags, favorite state, trade filters, and other
  details.

## Registration Axes

These axes should be available to the Pokedex registration engine.

### Species And Forms

Use the server catalog as the base. This includes:

- Species and Pokedex number.
- Regional forms such as Alolan, Galarian, Hisuian, and Paldean.
- Named forms such as Origin, Altered, Therian, Incarnate, Defense, Attack,
  Speed, Sunny, Rainy, Snowy, East Sea, West Sea, trims, patterns, colors,
  styles, sizes that are actual named forms, and any other `form` records.
- Evolutions and family navigation.
- Gender-specific visual forms where the app has distinct assets or data.

### Major Variant Facets

These should generally be visible from the Pokedex and available as creation
starting points in Pokemon:

- Default
- Shiny
- Shadow
- Shiny shadow
- Costume
- Shiny costume
- Shadow costume
- Mega
- Shiny Mega
- Primal
- Shiny Primal
- Dynamax
- Shiny Dynamax
- Gigantamax
- Shiny Gigantamax
- Fusion
- Shiny fusion
- Crown or other special battle/form variants already present in catalog data

### Registration-Worthy Quality Facets

These should be Pokedex-completable and instance-editable. They should not all
be top-level cards in the normal Pokemon inventory catalog.

- Size: XXS, XS, normal, XL, XXL. Exact height and weight remain on the
  instance; size class can be derived when exact values exist, and should also
  be manually selectable when the user only knows the class.
- Backgrounds: rare background, location background, and specific background
  IDs from catalog data.
- Lucky: obtained through trade and visible in the Pokedex/summary.
- Purified: purified state is a real Pokemon GO inventory/search category. It
  should become registration-worthy even though it is not currently a generated
  catalog variant in Pokémon Go Nexus.
- Gender: especially for species with distinct male/female visual data.
- Appraisal: 0*, 1*, 2*, 3*, 4*, plus optional nundo/hundo-style collector
  shortcuts derived from IVs.
- Moves: special, legacy, purified Return, shadow/apex moves, adventure-effect
  moves, and exclusive moves. These are better treated as optional advanced
  registration facets, not default Pokedex clutter.
- Ball: normal Poke Ball, Great Ball, Ultra Ball, Premier Ball, Master Ball,
  Beast Ball, Safari Ball, etc. Ball is instance-first; make it an optional
  collector facet.
- Provenance: traded, hatched, caught date/year, catch location, original
  trainer, distance, and similar details should remain instance/search-first.
  Only promote them to Pokedex registration facets if a product view explicitly
  needs them.

## Full-Combo Registration Model

The recommended data model is a registration projection, not a giant static
variant table.

The Pokedex should support two layers at the same time:

- **Exact registrations**: the deepest known combination, such as XXL shiny
  shadow Bulbasaur with a specific location background.
- **Derived coverage**: broader views that can be satisfied by exact
  registrations, such as shiny shadow Bulbasaur, XXL Bulbasaur, or any
  registered Bulbasaur.

That keeps the collector-complete model precise without making every view feel
like a spreadsheet. A single instance can produce multiple derived
registrations for progress views, while the exact registration remains the
source of truth for completion depth.

Example registration IDs:

```text
species:1|form:normal|variant:default
species:1|form:normal|variant:shiny
species:1|form:normal|variant:shadow
species:1|form:normal|variant:shiny_shadow
species:1|form:normal|variant:shiny_shadow|size:xxl
species:1|form:normal|variant:shiny_shadow|size:xxl|background:location-go-fest-2026
species:1|form:normal|variant:shiny_shadow|size:xxl|background:location-go-fest-2026|gender:female
```

Implementation shape:

```ts
type RegistrationFacetKind =
  | 'variant'
  | 'size'
  | 'background'
  | 'lucky'
  | 'purified'
  | 'gender'
  | 'appraisal'
  | 'move'
  | 'ball'
  | 'provenance';

interface PokedexRegistrationEntry {
  registration_id: string;
  pokemon_id: number;
  base_variant_id: string;
  species_name: string;
  form: string | null;
  variant_type: string;
  facets: Record<string, string | number | boolean | null>;
  registered_at: string;
  source_instance_id?: string | null;
}
```

The important part is that `registration_id` is deterministic and generated
from facets. We do not need to store every possible unregistered combo
immediately. We can generate possible slots on demand for whichever Pokedex
view the user opens.

## Combo Rules

Full-combo registration cannot be an unrestricted cartesian product. The
registration engine should only generate combinations that are possible or
useful.

Rules:

- Start from a real `PokemonVariant` or real server catalog form.
- Only generate shiny slots where shiny is available.
- Only generate shadow slots where shadow is available.
- Only generate costume slots for actual costume IDs.
- Only generate shiny costume slots when that costume has shiny availability.
- Only generate shadow costume slots when that costume has shadow data.
- Only generate Mega/Primal slots from actual Mega data.
- Only generate Dynamax/Gigantamax slots from actual Max data.
- Only generate fusion slots from actual fusion data.
- Only generate background slots from known `backgrounds` data or from a
  manually entered background when the user has an instance proving it exists.
- Only generate gender slots for allowed genders, and prioritize distinct
  visual gender slots when the catalog has female-specific data.
- Treat Mega and Max as separate registration axes. A Max Pokemon can be
  eligible for Mega Evolution in Pokemon GO, but active Mega and active Max
  battle transformations should not be represented as one normal inventory
  state.
- Let quality facets be opt-in per Pokedex view. Size and background are core;
  moves, balls, appraisal, and provenance should be advanced views.

Example: if Bulbasaur supports default, shiny, shadow, shiny shadow, and sizes,
the Size view can show:

```text
Bulbasaur / default / XXS
Bulbasaur / default / XS
Bulbasaur / default / XL
Bulbasaur / default / XXL
Bulbasaur / shiny / XXS
Bulbasaur / shiny / XS
Bulbasaur / shiny / XL
Bulbasaur / shiny / XXL
Bulbasaur / shadow / XXS
Bulbasaur / shadow / XS
Bulbasaur / shadow / XL
Bulbasaur / shadow / XXL
Bulbasaur / shiny shadow / XXS
Bulbasaur / shiny shadow / XS
Bulbasaur / shiny shadow / XL
Bulbasaur / shiny shadow / XXL
```

If a costume exists, that costume gets its own comparable set. If a background
facet is selected too, the view can deepen further, but only when the user asks
for that depth.

## UI Split

### `/pokedex`

The Pokedex should become a standalone route and navigation item.

Core jobs:

- Browse species/forms and generated variant slots.
- Show completion by category and by full-combo facets.
- Stay performant by showing focused boolean completion states first:
  registered or unregistered.
- Let users opt into more exhaustive layers with toggles rather than showing
  every possible combination by default.
- Register/unregister slots without opening the full instance editor.
- Drill into a species/form detail page that shows:
  - base, shiny, shadow, costume, Max, Mega, fusion, etc.
  - full-combo progress for selected quality facets
  - owned instances that satisfy each registration
  - a call to create a Pokemon instance from a chosen variant slot
- Offer a completion mode switch:
  - **Pokemon GO style**: category-level registration, e.g. one XXL Bulbasaur.
  - **Collector-complete**: full-combo registration, e.g. XXL shiny shadow
    Bulbasaur and XXL default Bulbasaur are different slots.

Useful first filters:

- All
- Shiny
- Shadow
- Costume
- Mega/Primal
- Max
- Fusion
- Size
- Background
- Lucky/Purified
- Unregistered

### `/pokemon`

The Pokemon page should become the owned/wanted/trade inventory workspace.

Core jobs:

- Browse and manage concrete instances.
- Create a new instance from a compact catalog picker.
- Edit CP, IVs, moves, size, background, gender, ball, caught date/location,
  lucky, purified, favorite, tags, trade state, wanted state, and filters.
- Sort, search, tag, favorite, and filter instances.
- Keep the current useful card density and collection feel, but remove the
  embedded Pokedex/category dashboard pressure.

Recommended tabs after the split:

- Pokemon
- Wishlist
- Tags

Naming note: the data model can continue to use `is_wanted`, `wanted_tags`, and
`wanted_filters`, but the user-facing label should probably be **Wishlist** if
the goal is clarity for new users. "Wanted" is accurate for the current code and
trade matching language, while "Wishlist" is friendlier and less overloaded.

The old Pokedex panel in the slider should be replaced by a compact entry point
for creating instances and a link or summary card pointing to `/pokedex`.

### Instance Creation After The Split

The reason the Pokedex lived inside `/pokemon` was legitimate: users need an
easy way to create instances from catalog cards. The split should preserve that
workflow without keeping the full Pokedex in the inventory page.

Recommended creation flow:

- From `/pokedex`: choose a registration/catolog slot, then create a Pokemon
  instance from that slot and optionally jump to `/pokemon`.
- From `/pokemon`: open a compact catalog picker that looks like the current
  Pokemon grid, create the instance, then edit qualities in the instance
  overlay.
- From `/wishlist`: open the same compact picker, but default the new instance
  to wishlist/wanted state.
- From `/tags`: allow tag maintenance and filtered entry points, but avoid
  making Tags the primary creation surface.

Tags should be scoped enough that users can separate what they have from what
they want:

- Collection tags: attached to caught/owned Pokemon.
- Trade tags: attached to Pokemon offered for trade.
- Wishlist tags: attached to wanted/wishlist entries.

The UI can still reuse the same underlying tag model, but it should present
these scopes separately so "things I have" and "things I want" do not blur
together.

## Current Code Fit

The repo is already close:

- `PokemonVariant` is the catalog identity, generated from base Pokemon,
  shiny/shadow/costumes/Max/Mega/fusion.
- `PokemonInstance` already stores most quality facets: shiny, costume, lucky,
  shadow, purified, weight, height, gender, mega, dynamax, gigantamax, crown,
  fusion, trade/provenance flags, tags, ball, location card, caught location,
  and caught date.
- `registrationsDB` currently keys only by `variant_id`. That is the main
  limitation for full-combo registrations.
- `POKEDEX_STORES` currently lists variant categories but not quality facets
  like size, background, lucky, purified, gender, appraisal, ball, or move.
- `/pokemon` currently owns Pokedex, Pokemon, and Tags through one slider.

## Recommended Implementation Plan

1. Add a pure registration projection module.
   - Input: `PokemonVariant`, optional `PokemonInstance`.
   - Output: one or more deterministic `PokedexRegistrationEntry` records.
   - Include tests for default, shiny, shadow, costume, size, background,
     purified, lucky, and gender.

2. Add `registrationsDB` v2.
   - Keep legacy `variant_id` migration.
   - Add `registration_id`, `base_variant_id`, `facets`, and optional
     `source_instance_id`.
   - Backfill legacy registrations as simple `{ variant }` registrations.

3. Add `/pokedex` as a standalone route.
   - Start by reusing the current Pokedex list data and card rendering.
   - Add category navigation and the collector mode concept.
   - Keep create-instance affordances, but navigate to `/pokemon` or open the
     existing instance creation flow from the selected variant.

4. Simplify `/pokemon`.
   - Remove or hide the full Pokedex panel from the slider.
   - Keep a compact catalog picker for creating instances.
   - Keep Tags and all instance editing workflows.

5. Add advanced collector facets gradually.
   - Size first, because it is high-value and already backed by threshold data.
   - Background second, because trading treats special/location features as
     meaningful and the catalog already has background data.
   - Lucky/purified/gender/appraisal next.
   - Moves/ball/provenance last as optional advanced facets.

## Decision

Use **full-combo registrations** in the Pokedex, but keep **guided instance
creation** in Pokemon.

This gives collectors the deep checklist they want without making the everyday
Pokemon page unusable.
