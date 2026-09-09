import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type {
  BasePokemon,
  Move,
  PokemonMovesChunk,
} from '@pokemongonexus/shared-contracts/pokemon';
import type {
  CustomTagParent,
  CustomTagsEnvelope,
  PokemonTagOrderKey,
} from '@pokemongonexus/shared-contracts/users';
import { buildPokemonCatalogEntries } from '@pokemongonexus/shared-domain/catalog';
import {
  projectPokemonCollectionSortSource,
  sortPokemonCollectionItems,
  sortPokemonFavoriteTagItems,
  type PokemonCollectionSortProjection,
} from '@pokemongonexus/shared-domain/collection-sort';
import { resolveInstanceCollectionKey } from '@pokemongonexus/shared-domain/instances';
import {
  buildPokemonTypeIconPath,
  getPokemonCrownFormLabel,
  resolvePokemonActiveCrownForm,
  resolvePokemonActiveFusionEntry,
  resolvePokemonActiveMegaEvolution,
  resolvePokemonInstanceImagePath,
} from '@pokemongonexus/shared-domain/pokemon-display';
import {
  resolvePokemonDisplayFusionBackgroundPool,
  resolvePokemonDisplayFusionComboBackground,
} from '@pokemongonexus/shared-domain/fusion-backgrounds';
import {
  buildPokemonMoveTypeIconPath,
  getPokemonMovePower,
} from '@pokemongonexus/shared-domain/moves';
import { normalizeNativeTagsEnvelope } from './nativeTagsEnvelope';
import { normalizeNativeTagIds } from './nativeInstanceNormalization';

export type NativeCollectionFilter =
  | 'all'
  | 'caught'
  | 'trade'
  | 'wanted'
  | 'favorites'
  | 'most-wanted';

export type NativeCollectionRow = {
  id: string;
  pokemonId: number;
  pokedexNumber: number;
  name: string;
  imageUri: string | null;
  locationBackgroundUri: string | null;
  maxKind: 'dynamax' | 'gigantamax' | null;
  purified: boolean;
  lucky: boolean;
  typeIconUris: string[];
  status: 'caught' | 'trade' | 'wanted';
  source?: 'catalog' | 'instance';
  cp: number | null;
  hp?: number | null;
  releaseTimestamp?: number | null;
  favorite: boolean;
  mostWanted: boolean;
  /** Position inside the canonical web variant sequence for this species. */
  variantOrder?: number;
  evolutionFamilyIds?: number[];
  searchTerms?: string[];
  /** Exact canonical web sort keys for this catalog variant or instance. */
  sortProjection?: PokemonCollectionSortProjection;
};

export type NativeTagSummary = {
  key: PokemonTagOrderKey;
  parent: CustomTagParent;
  /** Canonical tag card label (for example, "All Caught"). */
  name: string;
  /** Canonical filter/header identity (for example, "Caught"). */
  filterName?: string;
  color: string;
  tone: 'caught' | 'trade' | 'favorites' | 'wanted' | 'most-wanted' | 'custom';
  rows: NativeCollectionRow[];
};

export type NativeCollectionSort =
  | 'releaseDate'
  | 'favorite'
  | 'number'
  | 'hp'
  | 'name'
  | 'combatPower';
export type NativeCollectionSortDirection = 'ascending' | 'descending';

export type NativeInstanceMoveOption = {
  id: number;
  name: string;
  kind: 'fast' | 'charged';
  legacy: boolean;
  typeName: string;
  typeIconUri?: string;
  raidPower?: number | null;
  pvpPower?: number | null;
};

export type NativeInstanceMoveRow = {
  label: string;
  value: string;
  legacy?: boolean;
  typeName?: string;
  typeIconUri?: string;
  raidPower?: number | null;
  pvpPower?: number | null;
};

export type NativeInstanceBackgroundOption = {
  id: number;
  name: string;
  imageUri: string;
};

export type NativeInstanceDetail = {
  row: NativeCollectionRow;
  instance?: PokemonInstance;
  baseStats?: { attack: number; defense: number; stamina: number };
  targetRows?: NativeCollectionRow[];
  traits: string[];
  stats: { label: string; value: string }[];
  ivs: { label: string; value: number }[];
  moves: NativeInstanceMoveRow[];
  provenance: { label: string; value: string }[];
  preferences: { label: string; value: string }[];
  moveOptions?: NativeInstanceMoveOption[];
  backgroundOptions?: NativeInstanceBackgroundOption[];
  appearanceImageUris?: {
    base?: string | null;
    shadow: string | null;
    purified: string | null;
  };
  megaOptions?: {
    form: string | null;
    imageUri: string | null;
    label: string;
    primal: boolean;
    stats?: { attack: number; defense: number; stamina: number };
    typeIconUris?: string[];
  }[];
  crownOptions?: {
    form: string | null;
    imageUri: string | null;
    label: string;
    moveOptions?: NativeInstanceMoveOption[];
    stats?: { attack: number; defense: number; stamina: number };
    typeIconUris?: string[];
  }[];
  fusionOptions?: {
    id: number;
    imageUri: string | null;
    moveOptions: NativeInstanceMoveOption[];
    name: string;
    stats?: { attack: number; defense: number; stamina: number };
    typeIconUris?: string[];
    partnerPokemonId: number;
    partnerRows: NativeCollectionRow[];
    backgroundOptions: NativeInstanceBackgroundOption[];
    partnerBackgroundIds: Record<string, number | null>;
    comboBackgrounds: {
      ownBackgroundId: number;
      partnerBackgroundId: number;
      option: NativeInstanceBackgroundOption;
    }[];
  }[];
  fusionPartnerRow?: NativeCollectionRow | null;
  specialMaxBaseEligible?: boolean;
  sizeThresholds?: BasePokemon['sizes'];
  rarity?: BasePokemon['rarity'];
};

export const buildCanonicalCollectionInstancePath = (
  instanceId: string,
  status: NativeCollectionRow['status'],
): string => {
  const query = new URLSearchParams({ filter: status, instanceId });
  return `/pokemon?${query.toString()}`;
};

export const resolveNativeInstanceImage = (
  instance: PokemonInstance,
  pokemon: BasePokemon,
): string => resolvePokemonInstanceImagePath(instance, pokemon);

const statusForInstance = (
  instance: PokemonInstance,
): NativeCollectionRow['status'] | null => {
  if (instance.is_wanted) return 'wanted';
  if (instance.is_for_trade) return 'trade';
  if (instance.is_caught) return 'caught';
  return null;
};

const formatVariantLabel = (value: string): string =>
  value
    .trim()
    .split(/[_-]+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(' ');

function activeFusion(instance: PokemonInstance, pokemon: BasePokemon) {
  return resolvePokemonActiveFusionEntry({
    isFused: instance.is_fused,
    fusionForm: instance.fusion_form,
    fusionEntries: pokemon.fusion,
    storedFusion: instance.fusion,
  });
}

function activeMega(instance: PokemonInstance, pokemon: BasePokemon) {
  return resolvePokemonActiveMegaEvolution({
    isMega: instance.is_mega,
    megaForm: instance.mega_form,
    megaEvolutions: pokemon.megaEvolutions,
  });
}

function activeCrown(instance: PokemonInstance, pokemon: BasePokemon) {
  if (!instance.crown) return undefined;
  return resolvePokemonActiveCrownForm(pokemon.crownForms, instance.fusion_form);
}

const displayName = (instance: PokemonInstance, pokemon: BasePokemon): string => {
  if (instance.nickname?.trim()) return instance.nickname.trim();

  const fusion = activeFusion(instance, pokemon);
  if (fusion) return `${instance.shiny ? 'Shiny ' : ''}${fusion.name}`;

  const crown = activeCrown(instance, pokemon);
  if (crown) {
    const label = getPokemonCrownFormLabel(crown);
    return `${instance.shiny ? 'Shiny ' : ''}${label ? `${label} ` : ''}${pokemon.name}`;
  }

  const mega = activeMega(instance, pokemon);
  if (mega) {
    const kind = mega.primal ? 'Primal' : 'Mega';
    const suffix = mega.form?.trim() ? ` ${mega.form.trim()}` : '';
    return `${instance.shiny ? 'Shiny ' : ''}${kind} ${pokemon.name}${suffix}`;
  }

  const costume = instance.costume_id == null
    ? undefined
    : pokemon.costumes?.find((entry) => entry.costume_id === instance.costume_id);
  const traits = [
    instance.shiny ? 'Shiny' : null,
    instance.shadow ? 'Shadow' : null,
    instance.gigantamax ? 'Gigantamax' : null,
    !instance.gigantamax && instance.dynamax ? 'Dynamax' : null,
    costume?.name ? formatVariantLabel(costume.name) : null,
  ].filter(Boolean);
  return [...traits, pokemon.name].join(' ');
};

const resolveTypeIcons = (
  instance: PokemonInstance,
  pokemon: BasePokemon,
): string[] => {
  const fusion = activeFusion(instance, pokemon);
  const crown = activeCrown(instance, pokemon);
  const mega = activeMega(instance, pokemon);
  const variantTypes = fusion
    ? [fusion.type1_name, fusion.type2_name]
    : crown
      ? [crown.type1_name, crown.type2_name]
      : mega
        ? [mega.type1_name, mega.type2_name]
        : null;
  if (!variantTypes) return [pokemon.type_1_icon, pokemon.type_2_icon].filter(Boolean);
  return variantTypes
    .filter((type): type is string => Boolean(type?.trim()))
    .map(buildPokemonTypeIconPath)
    .filter((icon): icon is string => Boolean(icon));
};

const absoluteImageUri = (image: string | null, assetOrigin: string): string | null => {
  if (!image) return null;
  try {
    return new URL(image, assetOrigin).toString();
  } catch {
    return null;
  }
};

const absoluteTypeIconUris = (
  typeNames: (string | null | undefined)[],
  assetOrigin: string,
): string[] => typeNames
  .filter((typeName): typeName is string => Boolean(typeName?.trim()))
  .map(buildPokemonTypeIconPath)
  .map((path) => absoluteImageUri(path ?? null, assetOrigin))
  .filter((uri): uri is string => Boolean(uri));

const GENERATION_LABELS: Record<number, string> = {
  1: 'kanto',
  2: 'johto',
  3: 'hoenn',
  4: 'sinnoh',
  5: 'unova',
  6: 'kalos',
  7: 'alola',
  8: 'galar',
  9: 'paldea',
};

const toTimestamp = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
};

const releaseTimestampForEntry = (
  entryId: string,
  pokemon: BasePokemon,
): number | null => {
  const normalizedId = entryId.toLowerCase();
  if (normalizedId.includes('gigantamax')) {
    return toTimestamp(pokemon.max?.find((entry) => entry.gigantamax)?.gigantamax_release_date)
      ?? toTimestamp(normalizedId.includes('shiny')
        ? pokemon.date_shiny_available
        : pokemon.date_available);
  }
  if (normalizedId.includes('dynamax')) {
    return toTimestamp(pokemon.max?.find((entry) => entry.dynamax)?.dynamax_release_date)
      ?? toTimestamp(normalizedId.includes('shiny')
        ? pokemon.date_shiny_available
        : pokemon.date_available);
  }
  const costume = pokemon.costumes?.find((entry) => normalizedId.includes(entry.name.toLowerCase()));
  if (costume) {
    if (normalizedId.includes('shadow') && costume.shadow_costume) {
      return toTimestamp(costume.shadow_costume.date_available);
    }
    return toTimestamp(normalizedId.includes('shiny')
      ? costume.date_shiny_available ?? costume.date_available
      : costume.date_available);
  }
  if (normalizedId.includes('mega') || normalizedId.includes('primal')) {
    return toTimestamp(pokemon.megaEvolutions?.find((entry) => (
      !entry.form || normalizedId.includes(entry.form.toLowerCase())
    ))?.date_available);
  }
  if (normalizedId.includes('shiny_shadow')) return toTimestamp(pokemon.date_shiny_shadow_available);
  if (normalizedId.includes('shadow')) return toTimestamp(pokemon.date_shadow_available);
  if (normalizedId.includes('shiny')) return toTimestamp(pokemon.date_shiny_available);
  return toTimestamp(pokemon.date_available);
};

const toEvolutionIds = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map(Number)
    .filter((value) => Number.isFinite(value));
};

const buildEvolutionFamilyMap = (catalog: BasePokemon[]): Map<number, number[]> => {
  const adjacency = new Map<number, Set<number>>();
  const connect = (left: number, right: number) => {
    if (!adjacency.has(left)) adjacency.set(left, new Set());
    if (!adjacency.has(right)) adjacency.set(right, new Set());
    adjacency.get(left)?.add(right);
    adjacency.get(right)?.add(left);
  };

  for (const pokemon of catalog) {
    const id = Number(pokemon.pokemon_id);
    if (!Number.isFinite(id)) continue;
    if (!adjacency.has(id)) adjacency.set(id, new Set());
    const relatives = [
      ...toEvolutionIds(pokemon.evolves_to ?? pokemon.evolutionData?.evolves_to),
      ...toEvolutionIds(pokemon.evolves_from ?? pokemon.evolutionData?.evolves_from),
    ];
    relatives.forEach((relative) => connect(id, relative));
  }

  const families = new Map<number, number[]>();
  for (const id of adjacency.keys()) {
    const family = new Set<number>();
    const pending = [id];
    while (pending.length) {
      const current = pending.pop() as number;
      if (family.has(current)) continue;
      family.add(current);
      adjacency.get(current)?.forEach((relative) => {
        if (!family.has(relative)) pending.push(relative);
      });
    }
    families.set(id, [...family]);
  }
  return families;
};

type NativeCollectionCatalogProjection = {
  catalogEntries: ReturnType<typeof buildPokemonCatalogEntries>;
  catalogEntryById: Map<string, ReturnType<typeof buildPokemonCatalogEntries>[number]>;
  catalogOrder: Map<string, number>;
  evolutionFamilies: Map<number, number[]>;
  pokemonById: Map<number, BasePokemon>;
};

// React Query preserves the catalog array while its snapshot is fresh. Keep the
// expensive, immutable catalog projection beside that array so Home, Pokémon,
// and subsequent route mounts do not rebuild the same variant order and
// evolution graph independently.
const nativeCollectionCatalogProjectionCache = new WeakMap<
  BasePokemon[],
  NativeCollectionCatalogProjection
>();
const nativeCatalogRowsCache = new WeakMap<
  BasePokemon[],
  Map<string, NativeCollectionRow[]>
>();
const nativeCollectionRowsCache = new WeakMap<
  Record<string, PokemonInstance>,
  WeakMap<BasePokemon[], Map<string, NativeCollectionRow[]>>
>();
const nativeInstanceDetailCache = new WeakMap<
  Record<string, PokemonInstance>,
  WeakMap<
    BasePokemon[],
    WeakMap<PokemonMovesChunk, Map<string, NativeInstanceDetail | null>>
  >
>();

const getNativeCollectionCatalogProjection = (
  catalog: BasePokemon[],
): NativeCollectionCatalogProjection => {
  const cached = nativeCollectionCatalogProjectionCache.get(catalog);
  if (cached) return cached;

  const catalogEntries = buildPokemonCatalogEntries(catalog);
  const projection = {
    catalogEntries,
    catalogEntryById: new Map(catalogEntries.map((entry) => [entry.id, entry])),
    catalogOrder: new Map(catalogEntries.map((entry, index) => [entry.id, index])),
    evolutionFamilies: buildEvolutionFamilyMap(catalog),
    pokemonById: new Map(catalog.map((pokemon) => [pokemon.pokemon_id, pokemon])),
  };
  nativeCollectionCatalogProjectionCache.set(catalog, projection);
  return projection;
};

const nativeCollectionSortProjection = (
  pokemon: BasePokemon,
  entry: ReturnType<typeof buildPokemonCatalogEntries>[number] | undefined,
  instance?: PokemonInstance,
): PokemonCollectionSortProjection => {
  const variantType = entry?.variantType ?? 'default';

  return projectPokemonCollectionSortSource({
    ...pokemon,
    name: entry?.name ?? pokemon.name,
    species_name: entry?.speciesName ?? pokemon.name,
    variantType,
    form: entry?.form === undefined ? pokemon.form : entry.form,
    stamina: entry?.stamina ?? pokemon.stamina,
    cp50: entry?.cp50 ?? pokemon.cp50,
    instanceData: instance
      ? { cp: instance.cp, favorite: instance.favorite }
      : undefined,
  });
};

const instanceSearchTerms = (instance: PokemonInstance, pokemon: BasePokemon): string[] => {
  const terms = [
    pokemon.name,
    pokemon.type1_name,
    pokemon.type2_name,
    pokemon.rarity,
    GENERATION_LABELS[pokemon.generation],
    instance.shiny ? 'shiny' : null,
    instance.shadow ? 'shadow' : null,
    instance.costume_id != null ? 'costume' : null,
    (pokemon.megaEvolutions?.length ?? 0) > 0 && !instance.shadow ? 'mega' : null,
    instance.dynamax ? 'dynamax' : null,
    instance.gigantamax ? 'gigantamax' : null,
    instance.lucky ? 'lucky' : null,
    instance.attack_iv === 15 && instance.defense_iv === 15 && instance.stamina_iv === 15
      ? '100%'
      : null,
  ];
  return terms.filter((term): term is string => Boolean(term?.trim()));
};

const resolveLocationBackgroundImage = (
  instance: PokemonInstance,
  pokemon: BasePokemon,
  instances: Record<string, PokemonInstance>,
): string | null => {
  if (instance.location_card == null || instance.location_card === '') return null;
  const backgroundId = Number(instance.location_card);
  if (!Number.isFinite(backgroundId)) return null;
  const resolvedPool = resolvePokemonDisplayFusionBackgroundPool({
    pokemon,
    fusion: {
      is_fused: instance.is_fused,
      fusion_form: instance.fusion_form,
      storedFusionObject: instance.fusion,
    },
  });
  const pool = instance.is_fused ? resolvedPool.backgrounds : pokemon.backgrounds ?? [];
  const candidates = pool.filter(
    (background) => Number(background.background_id) === backgroundId,
  );
  if (candidates.length === 0) return null;

  const exactCostume = candidates.find(
    (background) => Number(background.costume_id ?? 0) === Number(instance.costume_id ?? 0),
  );
  // Vite deliberately hides a stored card that does not belong to the
  // instance's exact costume. Do not fall through to a same-ID background for
  // a different form.
  const selected = exactCostume;
  if (!selected) return null;
  if (!instance.is_fused || !instance.fused_with) return selected?.image_url ?? null;
  const partnerKey = resolveInstanceCollectionKey(instances, instance.fused_with);
  const partnerBackgroundId = partnerKey == null
    ? null
    : Number(instances[partnerKey]?.location_card);
  const combo = resolvePokemonDisplayFusionComboBackground({
    pokemonId: pokemon.pokemon_id,
    fusionEntries: pokemon.fusion,
    resolvedFusionId: resolvedPool.fusionId,
    fusionForm: instance.fusion_form,
    ownBackgroundId: selected?.background_id ?? backgroundId,
    partnerBackgroundId: Number.isFinite(partnerBackgroundId) ? partnerBackgroundId : null,
    availableBackgrounds: pool,
  });
  return combo?.image_url ?? selected?.image_url ?? null;
};

export const buildNativeCollectionRows = (
  instances: Record<string, PokemonInstance>,
  catalog: BasePokemon[],
  assetOrigin: string,
): NativeCollectionRow[] => {
  const byCatalog = nativeCollectionRowsCache.get(instances) ?? new WeakMap();
  const byOrigin = byCatalog.get(catalog) ?? new Map();
  const cached = byOrigin.get(assetOrigin);
  if (cached) return cached;

  const { catalogEntryById, catalogOrder, evolutionFamilies, pokemonById } =
    getNativeCollectionCatalogProjection(catalog);

  const rows = Object.entries(instances)
    .flatMap(([key, instance]) => {
      if (instance.disabled) return [];
      const status = statusForInstance(instance);
      const pokemon = pokemonById.get(instance.pokemon_id);
      if (!status || !pokemon) return [];
      const catalogEntry = catalogEntryById.get(instance.variant_id)
        ?? catalogEntryById.get(`${String(instance.pokemon_id).padStart(4, '0')}-default`);
      const sortProjection = nativeCollectionSortProjection(pokemon, catalogEntry, instance);
      const typeIconUris = resolveTypeIcons(instance, pokemon)
        .map((icon) => absoluteImageUri(icon, assetOrigin))
        .filter((icon): icon is string => Boolean(icon));
      return [{
        id: instance.instance_id ?? key,
        pokemonId: instance.pokemon_id,
        pokedexNumber: pokemon.pokedex_number,
        name: displayName(instance, pokemon),
        imageUri: absoluteImageUri(resolveNativeInstanceImage(instance, pokemon), assetOrigin),
        locationBackgroundUri: absoluteImageUri(
          resolveLocationBackgroundImage(instance, pokemon, instances),
          assetOrigin,
        ),
        maxKind: instance.gigantamax
          ? 'gigantamax'
          : instance.dynamax
            ? 'dynamax'
            : null,
        purified: instance.purified,
        lucky: instance.lucky || (
          status === 'wanted' && instance.pref_lucky
        ),
        typeIconUris,
        status,
        source: 'instance',
        cp: instance.cp,
        hp: sortProjection.stamina,
        releaseTimestamp: sortProjection.releaseTimestamp,
        favorite: instance.favorite,
        mostWanted: instance.most_wanted,
        variantOrder: catalogOrder.get(instance.variant_id)
          ?? catalogOrder.get(`${String(instance.pokemon_id).padStart(4, '0')}-default`),
        evolutionFamilyIds: evolutionFamilies.get(instance.pokemon_id) ?? [instance.pokemon_id],
        searchTerms: instanceSearchTerms(instance, pokemon),
        sortProjection,
      } satisfies NativeCollectionRow];
    })
    .sort((left, right) =>
      left.pokedexNumber - right.pokedexNumber || left.name.localeCompare(right.name),
    );
  byOrigin.set(assetOrigin, rows);
  byCatalog.set(catalog, byOrigin);
  nativeCollectionRowsCache.set(instances, byCatalog);
  return rows;
};

export const buildNativeCatalogRows = (
  catalog: BasePokemon[],
  assetOrigin: string,
): NativeCollectionRow[] => {
  const rowsByOrigin = nativeCatalogRowsCache.get(catalog) ?? new Map();
  const cached = rowsByOrigin.get(assetOrigin);
  if (cached) return cached;

  const { catalogEntries, evolutionFamilies, pokemonById } =
    getNativeCollectionCatalogProjection(catalog);
  const rows = catalogEntries.map((entry, variantOrder) => {
    const pokemon = pokemonById.get(entry.pokemonId);
    const costume = pokemon?.costumes?.some((candidate) => entry.id.includes(candidate.name));
    const sortProjection = pokemon
      ? nativeCollectionSortProjection(pokemon, entry)
      : undefined;
    return {
      id: entry.id,
      pokemonId: entry.pokemonId,
      pokedexNumber: entry.pokedexNumber,
      name: entry.name,
      imageUri: absoluteImageUri(entry.imageUri, assetOrigin),
      locationBackgroundUri: null,
      maxKind: entry.maxKind,
      purified: false,
      lucky: false,
      typeIconUris: entry.typeIconUris
        .map((icon) => absoluteImageUri(icon, assetOrigin))
        .filter((icon): icon is string => Boolean(icon)),
      status: 'caught',
      source: 'catalog',
      // Catalog CP50 is a sort key, not recorded instance CP shown on a card.
      cp: null,
      hp: sortProjection?.stamina ?? null,
      releaseTimestamp: sortProjection?.releaseTimestamp
        ?? (pokemon ? releaseTimestampForEntry(entry.id, pokemon) : null),
      favorite: false,
      mostWanted: false,
      variantOrder,
      evolutionFamilyIds: evolutionFamilies.get(entry.pokemonId) ?? [entry.pokemonId],
      searchTerms: [
        entry.name,
        pokemon?.name,
        pokemon?.type1_name,
        pokemon?.type2_name,
        pokemon?.rarity,
        pokemon ? GENERATION_LABELS[pokemon.generation] : null,
        costume ? 'costume' : null,
        (pokemon?.megaEvolutions?.length ?? 0) > 0
          && !entry.variantType?.includes('shadow') ? 'mega' : null,
        entry.maxKind,
      ].filter((term): term is string => Boolean(term?.trim())),
      sortProjection,
    } satisfies NativeCollectionRow;
  });
  rowsByOrigin.set(assetOrigin, rows);
  nativeCatalogRowsCache.set(catalog, rowsByOrigin);
  return rows;
};

const DEFAULT_TAG_ORDER: Record<CustomTagParent, PokemonTagOrderKey[]> = {
  caught: ['system:caught', 'system:favorites', 'system:trade'],
  wanted: ['system:wanted', 'system:most-wanted'],
};

const SYSTEM_TAGS: Record<string, Omit<NativeTagSummary, 'rows'>> = {
  'system:caught': {
    key: 'system:caught',
    parent: 'caught',
    name: 'All Caught',
    filterName: 'Caught',
    color: '#5798ff',
    tone: 'caught',
  },
  'system:favorites': {
    key: 'system:favorites',
    parent: 'caught',
    name: 'Favorites',
    filterName: 'Favorites',
    color: '#ffd45a',
    tone: 'favorites',
  },
  'system:trade': {
    key: 'system:trade',
    parent: 'caught',
    name: 'For Trade',
    filterName: 'Trade',
    color: '#4bc574',
    tone: 'trade',
  },
  'system:wanted': {
    key: 'system:wanted',
    parent: 'wanted',
    name: 'All Wanted',
    filterName: 'Wanted',
    color: '#ef5b72',
    tone: 'wanted',
  },
  'system:most-wanted': {
    key: 'system:most-wanted',
    parent: 'wanted',
    name: 'Most Wanted',
    filterName: 'Most Wanted',
    color: '#ff704d',
    tone: 'most-wanted',
  },
};

type NativeTagMembership = {
  system: Map<PokemonTagOrderKey, NativeCollectionRow[]>;
  custom: Record<CustomTagParent, Map<string, NativeCollectionRow[]>>;
};

const nativeTagMembershipCache = new WeakMap<
  NativeCollectionRow[],
  WeakMap<Record<string, PokemonInstance>, NativeTagMembership>
>();

const buildNativeTagMembership = (
  rows: NativeCollectionRow[],
  instances: Record<string, PokemonInstance>,
): NativeTagMembership => {
  const byInstances = nativeTagMembershipCache.get(rows) ?? new WeakMap();
  const cached = byInstances.get(instances);
  if (cached) return cached;

  const membership: NativeTagMembership = {
    system: new Map(),
    custom: { caught: new Map(), wanted: new Map() },
  };
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const append = <K extends string>(map: Map<K, NativeCollectionRow[]>, key: K, row: NativeCollectionRow) => {
    const bucket = map.get(key);
    if (bucket) bucket.push(row);
    else map.set(key, [row]);
  };

  // Web tag cards preserve instance insertion order. Populate both panels in
  // one pass instead of filtering dex-sorted rows for every system bucket.
  for (const [instanceKey, instance] of Object.entries(instances)) {
    const row = rowById.get(instance.instance_id ?? instanceKey);
    if (!row || instance.disabled) continue;
    if (instance.is_caught) {
      append(membership.system, 'system:caught', row);
      if (instance.favorite) append(membership.system, 'system:favorites', row);
      if (instance.is_for_trade) append(membership.system, 'system:trade', row);
    }
    if (instance.is_wanted) {
      append(membership.system, 'system:wanted', row);
      if (instance.most_wanted) append(membership.system, 'system:most-wanted', row);
    }
    const parent = instance.is_wanted ? 'wanted' : instance.is_caught ? 'caught' : null;
    if (!parent) continue;
    for (const tagId of normalizeNativeTagIds(
      parent === 'caught' ? instance.caught_tags : instance.wanted_tags,
    )) {
      append(membership.custom[parent], tagId, row);
    }
  }
  membership.system.set('system:favorites', sortPokemonFavoriteTagItems(
    membership.system.get('system:favorites') ?? [],
    (row) => ({ favorite: row.favorite, cp: row.cp, pokedex_number: row.pokedexNumber }),
  ));
  byInstances.set(instances, membership);
  nativeTagMembershipCache.set(rows, byInstances);
  return membership;
};

type NativeTagSummaryCacheEntry = {
  envelope: CustomTagsEnvelope | null | undefined;
  instances: Record<string, PokemonInstance>;
  parent: CustomTagParent;
  summaries: NativeTagSummary[];
};

const nativeTagSummariesCache = new WeakMap<
  NativeCollectionRow[],
  NativeTagSummaryCacheEntry[]
>();

export const buildNativeTagSummaries = (
  rows: NativeCollectionRow[],
  instances: Record<string, PokemonInstance>,
  envelope: CustomTagsEnvelope | null | undefined,
  parent: CustomTagParent,
): NativeTagSummary[] => {
  const cachedEntries = nativeTagSummariesCache.get(rows);
  const cached = cachedEntries?.find((entry) => (
    entry.instances === instances
    && entry.envelope === envelope
    && entry.parent === parent
  ));
  if (cached) return cached.summaries;

  const normalizedEnvelope = normalizeNativeTagsEnvelope(envelope);
  const membership = buildNativeTagMembership(rows, instances);
  const customDefinitions = normalizedEnvelope.tags
    .filter((tag) => tag.parent === parent)
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
  const definitionsById = new Map(customDefinitions.map((tag) => [tag.tag_id, tag]));
  const customKeys = customDefinitions.map(
    (tag) => `custom:${tag.tag_id}` as PokemonTagOrderKey,
  );
  const allowed = new Set([...DEFAULT_TAG_ORDER[parent], ...customKeys]);
  const seen = new Set<PokemonTagOrderKey>();
  const orderedKeys = [
    ...normalizedEnvelope.orders[parent],
    ...DEFAULT_TAG_ORDER[parent],
    ...customKeys,
  ].filter((key) => {
    if (!allowed.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const summaries = orderedKeys.flatMap((key) => {
    const system = SYSTEM_TAGS[key];
    if (system && system.parent === parent) {
      return [{ ...system, rows: membership.system.get(key) ?? [] }];
    }
    if (!key.startsWith('custom:')) return [];
    const tagId = key.slice('custom:'.length);
    const definition = definitionsById.get(tagId);
    if (!definition) return [];
    return [{
      key,
      parent,
      name: definition.name,
      filterName: definition.name,
      color: definition.color,
      tone: 'custom',
      rows: membership.custom[parent].get(tagId) ?? [],
    } satisfies NativeTagSummary];
  });
  // Keep the latest summary for each panel; metadata edits must not retain an
  // unbounded history of envelopes while the collection rows stay unchanged.
  const nextCacheEntries = (cachedEntries ?? []).filter((entry) => entry.parent !== parent);
  nextCacheEntries.push({ envelope, instances, parent, summaries });
  nativeTagSummariesCache.set(rows, nextCacheEntries);
  return summaries;
};

const normalizeNativeCollectionSearchValue = (value: string): string => value
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9%]+/g, ' ')
  .trim();

const nativeCollectionSearchProjectionCache = new WeakMap<
  NativeCollectionRow,
  { dexNumber: string; searchable: string[]; words: string[] }
>();

const nativeCollectionSearchProjection = (
  row: NativeCollectionRow,
): { dexNumber: string; searchable: string[]; words: string[] } => {
  const cached = nativeCollectionSearchProjectionCache.get(row);
  if (cached) return cached;
  const searchable = [row.name, ...(row.searchTerms ?? [])]
    .map(normalizeNativeCollectionSearchValue);
  const projection = {
    dexNumber: String(row.pokedexNumber),
    searchable,
    words: searchable.flatMap((candidate) => candidate.split(' ')),
  };
  nativeCollectionSearchProjectionCache.set(row, projection);
  return projection;
};

export const prepareNativeCollectionSearchRows = (
  rows: NativeCollectionRow[],
  startIndex: number,
  limit: number,
): number => {
  const endIndex = Math.min(rows.length, startIndex + Math.max(0, limit));
  for (let index = startIndex; index < endIndex; index += 1) {
    const row = rows[index];
    if (row) nativeCollectionSearchProjection(row);
  }
  return endIndex;
};

type NativeCollectionCompiledSearchTerm = {
  negated: boolean;
  value: string;
};

type NativeCollectionCompiledSearch = NativeCollectionCompiledSearchTerm[][];

const compileNativeCollectionSearch = (
  rawQuery: string,
): NativeCollectionCompiledSearch => rawQuery
  .split(',')
  .map((union) => union
    .split('&')
    .map((rawTerm) => {
      const trimmed = rawTerm.trim();
      const negated = trimmed.startsWith('!');
      return {
        negated,
        value: normalizeNativeCollectionSearchValue(
          negated ? trimmed.slice(1) : trimmed,
        ),
      };
    })
    .filter((term) => Boolean(term.value)))
  .filter((union) => union.length > 0);

const matchesNativeCollectionSearch = (
  row: NativeCollectionRow,
  compiledQuery: NativeCollectionCompiledSearch,
): boolean => compiledQuery.some((union) => union.every(({ negated, value }) => {
  const { dexNumber, searchable, words } = nativeCollectionSearchProjection(row);
  const matched = searchable.some((candidate) => candidate === value)
    || words.some((word) => word.startsWith(value))
    || dexNumber.includes(value);
  return negated ? !matched : matched;
}));

const nativeCollectionFilterCache = new WeakMap<
  NativeCollectionRow[],
  Map<string, NativeCollectionRow[]>
>();
const NATIVE_COLLECTION_FILTER_CACHE_LIMIT = 32;

export const filterNativeCollectionRows = (
  rows: NativeCollectionRow[],
  filter: NativeCollectionFilter,
  query: string,
  options: {
    showEvolutionaryLine?: boolean;
    universeRows?: NativeCollectionRow[];
  } = {},
): NativeCollectionRow[] => {
  const normalizedQuery = query.trim();
  if (filter === 'all' && !normalizedQuery) return rows;
  const universe = options.universeRows ?? rows;
  // The ordinary catalog search is monotonic while a user extends one plain
  // term. Reuse the previous prefix result instead of rescanning the complete
  // catalog on every key, and retain exact results so backspace/re-entry is a
  // reference-stable cache hit. Complex union/family syntax keeps the full
  // canonical evaluation below.
  const cacheEligible = !options.showEvolutionaryLine && universe === rows;
  const filterCache = cacheEligible
    ? nativeCollectionFilterCache.get(rows) ?? new Map<string, NativeCollectionRow[]>()
    : null;
  if (filterCache && !nativeCollectionFilterCache.has(rows)) {
    nativeCollectionFilterCache.set(rows, filterCache);
  }
  const cacheKey = `${filter}:${normalizedQuery}`;
  const cachedResult = filterCache?.get(cacheKey);
  if (cachedResult) return cachedResult;
  const simplePositiveQuery = normalizedQuery.length > 1
    && !/[,&+!]/.test(normalizedQuery);
  const previousPrefixRows = simplePositiveQuery
    ? filterCache?.get(`${filter}:${normalizedQuery.slice(0, -1)}`)
    : undefined;
  const queryGroups = normalizedQuery
    .split(',')
    .map((term) => term.trim())
    .filter(Boolean);
  const explicitFamilyTerms = queryGroups
    .filter((term) => term.startsWith('+'))
    .map((term) => term.slice(1).trim())
    .filter(Boolean);
  const ordinaryQuery = queryGroups
    .filter((term) => !term.startsWith('+'))
    .join(',');
  const familyQuery = options.showEvolutionaryLine
    ? queryGroups.map((term) => term.replace(/^\+/, '')).join(',')
    : explicitFamilyTerms.join(',');
  // Query syntax and Unicode normalization do not vary by row. Compile each
  // expression once so typing does not repeat string splitting and NFKD work
  // thousands of times on Android's JavaScript thread.
  const compiledQuery = compileNativeCollectionSearch(normalizedQuery);
  const compiledOrdinaryQuery = compileNativeCollectionSearch(ordinaryQuery);
  const compiledFamilyQuery = compileNativeCollectionSearch(familyQuery);
  const familyIds = familyQuery
    ? new Set(universe
      .filter((row) => matchesNativeCollectionSearch(row, compiledFamilyQuery))
      .flatMap((row) => row.evolutionFamilyIds ?? [row.pokemonId]))
    : null;
  const matchesSearch = (row: NativeCollectionRow): boolean => {
    if (!normalizedQuery) return true;
    if (options.showEvolutionaryLine) return Boolean(familyIds?.has(row.pokemonId));
    if (explicitFamilyTerms.length > 0) {
      return Boolean(familyIds?.has(row.pokemonId)) || (
        Boolean(ordinaryQuery)
        && matchesNativeCollectionSearch(row, compiledOrdinaryQuery)
      );
    }
    return matchesNativeCollectionSearch(row, compiledQuery);
  };
  const result = (previousPrefixRows ?? rows).filter((row) =>
    (filter === 'all' ||
      row.status === filter ||
      (filter === 'favorites' && row.favorite) ||
      (filter === 'most-wanted' && row.status === 'wanted' && row.mostWanted)) &&
    matchesSearch(row),
  );
  if (filterCache) {
    if (filterCache.size >= NATIVE_COLLECTION_FILTER_CACHE_LIMIT) {
      const oldestKey = filterCache.keys().next().value;
      if (oldestKey !== undefined) filterCache.delete(oldestKey);
    }
    filterCache.set(cacheKey, result);
  }
  return result;
};

const nativeCollectionSortCache = new WeakMap<
  NativeCollectionRow[],
  Map<string, NativeCollectionRow[]>
>();

export const sortNativeCollectionRows = (
  rows: NativeCollectionRow[],
  sort: NativeCollectionSort,
  direction: NativeCollectionSortDirection,
): NativeCollectionRow[] => {
  const cacheKey = `${sort}:${direction}`;
  const cachedBySort = nativeCollectionSortCache.get(rows);
  const cached = cachedBySort?.get(cacheKey);
  if (cached) return cached;
  const sorted = sortPokemonCollectionItems(rows, sort, direction, (row) => (
    row.sortProjection ?? {
      pokedexNumber: row.pokedexNumber,
      sortName: row.name.trim().split(/\s+/).at(-1) ?? row.name,
      variantType: 'default',
      form: null,
      dateAvailable: null,
      costumeId: Number.NaN,
      costumeDateAvailable: null,
      releaseTimestamp: row.releaseTimestamp ?? 0,
      stamina: row.hp ?? 0,
      cp: Number(row.cp),
      favorite: row.favorite,
    }
  ));
  const nextCache = cachedBySort ?? new Map<string, NativeCollectionRow[]>();
  nextCache.set(cacheKey, sorted);
  if (!cachedBySort) nativeCollectionSortCache.set(rows, nextCache);
  return sorted;
};

const formatNumber = (value: number): string =>
  Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);

const findMove = (
  moves: PokemonMovesChunk,
  pokemonId: number,
  moveId: number | null,
): Move | null => {
  if (moveId == null) return null;
  const entry = moves.find((candidate) => candidate.pokemon_id === pokemonId);
  if (!entry) return null;
  const pool = [
    ...entry.moves,
    ...entry.fusion.flatMap((fusion) => fusion.moves ?? []),
    ...entry.crownForms.flatMap((crown) => crown.moves ?? []),
  ];
  return pool.find((move) => move.move_id === moveId) ?? null;
};

const compactRows = <T>(rows: (T | null)[]): T[] =>
  rows.filter((row): row is T => row !== null);

export const buildNativeInstanceDetail = (
  instances: Record<string, PokemonInstance>,
  catalog: BasePokemon[],
  moves: PokemonMovesChunk,
  requestedInstanceId: string,
  assetOrigin: string,
): NativeInstanceDetail | null => {
  const detailCacheKey = `${assetOrigin}\u0000${requestedInstanceId}`;
  const byCatalog = nativeInstanceDetailCache.get(instances);
  const byMoves = byCatalog?.get(catalog);
  const cachedDetails = byMoves?.get(moves);
  if (cachedDetails?.has(detailCacheKey)) {
    return cachedDetails.get(detailCacheKey) ?? null;
  }

  const cacheDetail = (detail: NativeInstanceDetail | null): NativeInstanceDetail | null => {
    const nextByCatalog = byCatalog ?? new WeakMap<
      BasePokemon[],
      WeakMap<PokemonMovesChunk, Map<string, NativeInstanceDetail | null>>
    >();
    const nextByMoves = byMoves ?? new WeakMap<
      PokemonMovesChunk,
      Map<string, NativeInstanceDetail | null>
    >();
    const nextDetails = cachedDetails ?? new Map<string, NativeInstanceDetail | null>();
    nextDetails.set(detailCacheKey, detail);
    nextByMoves.set(moves, nextDetails);
    nextByCatalog.set(catalog, nextByMoves);
    nativeInstanceDetailCache.set(instances, nextByCatalog);
    return detail;
  };

  const collectionKey = resolveInstanceCollectionKey(instances, requestedInstanceId);
  if (!collectionKey) return cacheDetail(null);
  const instance = instances[collectionKey];
  const pokemon = catalog.find((entry) => entry.pokemon_id === instance.pokemon_id);
  if (!pokemon) return cacheDetail(null);
  const collectionRows = buildNativeCollectionRows(instances, catalog, assetOrigin);
  const row = collectionRows.find((candidate) => (
    candidate.id === instance.instance_id || candidate.id === collectionKey
  ));
  if (!row) return cacheDetail(null);

  const traits = compactRows([
    instance.shiny ? 'Shiny' : null,
    instance.shadow ? 'Shadow' : null,
    instance.purified ? 'Purified' : null,
    instance.lucky ? 'Lucky' : null,
    instance.dynamax ? 'Dynamax' : null,
    instance.gigantamax ? 'Gigantamax' : null,
    instance.is_mega ? 'Mega Evolved' : null,
    instance.is_fused ? 'Fused' : null,
    instance.crown ? 'Crowned' : null,
    instance.is_traded ? 'Previously traded' : null,
  ]);

  const stats = compactRows([
    instance.cp == null ? null : { label: 'CP', value: instance.cp.toLocaleString() },
    instance.level == null ? null : { label: 'Level', value: formatNumber(instance.level) },
    instance.gender ? { label: 'Gender', value: instance.gender } : null,
    instance.weight == null ? null : { label: 'Weight', value: `${formatNumber(instance.weight)} kg` },
    instance.height == null ? null : { label: 'Height', value: `${formatNumber(instance.height)} m` },
  ]);

  const ivs = compactRows([
    instance.attack_iv == null ? null : { label: 'Attack', value: instance.attack_iv },
    instance.defense_iv == null ? null : { label: 'Defense', value: instance.defense_iv },
    instance.stamina_iv == null ? null : { label: 'HP', value: instance.stamina_iv },
  ]);

  const buildMoveRow = (label: string, moveId: number | null): NativeInstanceMoveRow | null => {
    if (moveId == null) return null;
    const move = findMove(moves, instance.pokemon_id, moveId);
    const typeName = move?.type_name || move?.type || 'Normal';
    return {
      label,
      value: move?.name ?? `Move #${moveId}`,
      legacy: move?.legacy ?? false,
      typeName,
      typeIconUri: absoluteImageUri(buildPokemonMoveTypeIconPath(typeName), assetOrigin) ?? undefined,
      raidPower: move ? getPokemonMovePower(move, 'raid') : null,
      pvpPower: move ? getPokemonMovePower(move, 'pvp') : null,
    };
  };
  const moveRows = compactRows([
    buildMoveRow('Fast move', instance.fast_move_id),
    buildMoveRow('Charged move', instance.charged_move1_id),
    buildMoveRow('Second charged move', instance.charged_move2_id),
  ]);

  const provenance = compactRows([
    instance.location_caught ? { label: 'Caught near', value: instance.location_caught } : null,
    instance.date_caught ? {
      label: 'Caught on',
      value: new Date(instance.date_caught).toLocaleDateString(),
    } : null,
    instance.original_trainer_name ? {
      label: 'Original trainer',
      value: instance.original_trainer_name,
    } : null,
  ]);

  const preferences = compactRows([
    instance.friendship_level == null ? null : {
      label: 'Friendship',
      value: `${instance.friendship_level}/5 hearts`,
    },
    instance.pref_lucky ? { label: 'Lucky trade', value: 'Requested' } : null,
    instance.mirror ? { label: 'Mirror trade', value: 'Required' } : null,
  ]);

  const excludedTargetIds = instance.is_wanted
    ? instance.not_trade_list
    : instance.not_wanted_list;
  const excluded = excludedTargetIds && typeof excludedTargetIds === 'object'
    ? excludedTargetIds
    : {};
  const targetStatus: NativeCollectionRow['status'] | null = instance.is_wanted
    ? 'trade'
    : instance.is_for_trade
      ? 'wanted'
      : null;
  const targetRows = targetStatus == null
    ? []
    : collectionRows
      .filter((candidate) => (
        candidate.status === targetStatus
        && excluded[candidate.id] !== true
      ));

  const moveEntry = moves.find((candidate) => candidate.pokemon_id === instance.pokemon_id);
  const fusion = activeFusion(instance, pokemon);
  const crown = activeCrown(instance, pokemon);
  const specificMoves = fusion
    ? moveEntry?.fusion.find((entry) => entry.fusion_id === fusion.fusion_id)?.moves
    : crown
      ? moveEntry?.crownForms.find((entry) => entry.id === crown.id)?.moves
      : null;
  const movePool = specificMoves?.length ? specificMoves : moveEntry?.moves ?? [];
  const moveOptions = [...new Map(movePool.map((move) => [move.move_id, {
    id: move.move_id,
    name: move.name,
    kind: move.is_fast ? 'fast' as const : 'charged' as const,
    legacy: move.legacy,
    typeName: move.type_name,
    typeIconUri: absoluteImageUri(
      buildPokemonMoveTypeIconPath(move.type_name || move.type),
      assetOrigin,
    ) ?? undefined,
    raidPower: getPokemonMovePower(move, 'raid'),
    pvpPower: getPokemonMovePower(move, 'pvp'),
  }])).values()];
  const resolvedBackgroundPool = resolvePokemonDisplayFusionBackgroundPool({
    pokemon,
    fusion: {
      is_fused: instance.is_fused,
      fusion_form: instance.fusion_form,
      storedFusionObject: instance.fusion,
    },
  });
  const backgroundOptions = resolvedBackgroundPool.backgrounds
    .filter((background) => (
      instance.is_fused
      || Number(background.costume_id ?? 0) === Number(instance.costume_id ?? 0)
    ))
    .map((background) => ({
      id: background.background_id,
      name: background.location || background.name,
      imageUri: absoluteImageUri(background.image_url, assetOrigin) ?? background.image_url,
    }));
  const appearanceImageUris = {
    base: absoluteImageUri(resolvePokemonInstanceImagePath({
      ...instance,
      crown: false,
      is_mega: false,
      mega: false,
      mega_form: null,
    }, pokemon), assetOrigin),
    shadow: absoluteImageUri(resolvePokemonInstanceImagePath({
      ...instance,
      lucky: false,
      purified: false,
      shadow: true,
    }, pokemon), assetOrigin),
    purified: absoluteImageUri(resolvePokemonInstanceImagePath({
      ...instance,
      purified: true,
      shadow: false,
    }, pokemon), assetOrigin),
  };
  const megaOptions = (pokemon.megaEvolutions ?? []).map((mega) => ({
    form: mega.form ?? null,
    imageUri: absoluteImageUri(
      instance.shiny ? mega.image_url_shiny ?? mega.image_url ?? null : mega.image_url ?? null,
      assetOrigin,
    ),
    label: `${mega.primal ? 'Primal' : 'Mega'}${mega.form?.trim() ? ` ${formatVariantLabel(mega.form)}` : ''}`,
    primal: Boolean(mega.primal),
    stats: mega.attack == null || mega.defense == null || mega.stamina == null
      ? undefined
      : {
          attack: Number(mega.attack),
          defense: Number(mega.defense),
          stamina: Number(mega.stamina),
        },
    typeIconUris: absoluteTypeIconUris([mega.type1_name, mega.type2_name], assetOrigin),
  }));
  const crownOptions = (pokemon.crownForms ?? []).map((crownForm) => ({
    form: getPokemonCrownFormLabel(crownForm),
    imageUri: absoluteImageUri(
      instance.shiny
        ? crownForm.image_url_shiny ?? crownForm.image_url ?? null
        : crownForm.image_url ?? null,
      assetOrigin,
    ),
    label: getPokemonCrownFormLabel(crownForm) ?? crownForm.name ?? 'Crowned',
    moveOptions: (moveEntry?.crownForms.find((candidate) => (
      candidate.id === crownForm.id
    ))?.moves ?? []).map((move) => ({
      id: move.move_id,
      name: move.name,
      kind: move.is_fast ? 'fast' as const : 'charged' as const,
      legacy: move.legacy,
      typeName: move.type_name,
      typeIconUri: absoluteImageUri(
        buildPokemonMoveTypeIconPath(move.type_name || move.type),
        assetOrigin,
      ) ?? undefined,
      raidPower: getPokemonMovePower(move, 'raid'),
      pvpPower: getPokemonMovePower(move, 'pvp'),
    })),
    stats: crownForm.attack == null || crownForm.defense == null || crownForm.stamina == null
      ? undefined
      : {
          attack: Number(crownForm.attack),
          defense: Number(crownForm.defense),
          stamina: Number(crownForm.stamina),
        },
    typeIconUris: absoluteTypeIconUris(
      [crownForm.type1_name, crownForm.type2_name],
      assetOrigin,
    ),
  }));
  const activePartnerKey = instance.fused_with
    ? resolveInstanceCollectionKey(instances, instance.fused_with)
    : null;
  const fusionOptions = (pokemon.fusion ?? [])
    .filter((entry) => (
      entry.base_pokemon_id1 === pokemon.pokemon_id
      && typeof entry.fusion_id === 'number'
    ))
    .map((entry) => {
      const partnerRows = Object.entries(instances).flatMap(([key, candidate]) => {
        const isActivePartner = activePartnerKey === key;
        if (candidate.pokemon_id !== entry.base_pokemon_id2 || !candidate.is_caught) return [];
        if (!isActivePartner && (candidate.is_for_trade || candidate.is_fused || candidate.disabled)) return [];
        const existing = collectionRows.find((row) => (
          row.id === candidate.instance_id || row.id === key
        ));
        if (existing) return [existing];
        return buildNativeCollectionRows({
          [key]: { ...candidate, disabled: false },
        }, catalog, assetOrigin);
      });
      const resolvedFusionBackgrounds = resolvePokemonDisplayFusionBackgroundPool({
        pokemon,
        fusion: {
          is_fused: true,
          fusion_form: entry.name,
          storedFusionObject: { [entry.fusion_id as number]: true },
        },
      });
      const fusionBackgroundOptions = resolvedFusionBackgrounds.backgrounds.map((background) => ({
        id: background.background_id,
        name: background.location || background.name,
        imageUri: absoluteImageUri(background.image_url, assetOrigin) ?? background.image_url,
      }));
      const partnerBackgroundIds = Object.fromEntries(partnerRows.map((partnerRow) => {
        const partnerKey = resolveInstanceCollectionKey(instances, partnerRow.id);
        const rawValue = partnerKey == null ? null : instances[partnerKey]?.location_card;
        const value = rawValue == null || rawValue === '' ? Number.NaN : Number(rawValue);
        return [partnerRow.id, Number.isFinite(value) ? value : null];
      }));
      const comboBackgrounds = partnerRows.flatMap((partnerRow) => {
        const partnerBackgroundId = partnerBackgroundIds[partnerRow.id];
        if (partnerBackgroundId == null) return [];
        return resolvedFusionBackgrounds.backgrounds.flatMap((background) => {
          const combo = resolvePokemonDisplayFusionComboBackground({
            pokemonId: pokemon.pokemon_id,
            fusionEntries: pokemon.fusion,
            resolvedFusionId: resolvedFusionBackgrounds.fusionId,
            fusionForm: entry.name,
            ownBackgroundId: background.background_id,
            partnerBackgroundId,
            availableBackgrounds: resolvedFusionBackgrounds.backgrounds,
          });
          if (!combo) return [];
          return [{
            ownBackgroundId: background.background_id,
            partnerBackgroundId,
            option: {
              id: combo.background_id,
              name: combo.location || combo.name,
              imageUri: absoluteImageUri(combo.image_url, assetOrigin) ?? combo.image_url,
            },
          }];
        });
      });
      return {
        id: entry.fusion_id as number,
        imageUri: absoluteImageUri(
          instance.shiny
            ? entry.image_url_shiny ?? entry.image_url ?? null
            : entry.image_url ?? null,
          assetOrigin,
        ),
        moveOptions: (moveEntry?.fusion.find((candidate) => (
          candidate.fusion_id === entry.fusion_id
        ))?.moves ?? []).map((move) => ({
          id: move.move_id,
          name: move.name,
          kind: move.is_fast ? 'fast' as const : 'charged' as const,
          legacy: move.legacy,
          typeName: move.type_name,
          typeIconUri: absoluteImageUri(
            buildPokemonMoveTypeIconPath(move.type_name || move.type),
            assetOrigin,
          ) ?? undefined,
          raidPower: getPokemonMovePower(move, 'raid'),
          pvpPower: getPokemonMovePower(move, 'pvp'),
        })),
        name: entry.name || `Fusion ${entry.fusion_id}`,
        stats: entry.attack == null || entry.defense == null || entry.stamina == null
          ? undefined
          : {
              attack: Number(entry.attack),
              defense: Number(entry.defense),
              stamina: Number(entry.stamina),
            },
        typeIconUris: absoluteTypeIconUris([entry.type1_name, entry.type2_name], assetOrigin),
        partnerPokemonId: entry.base_pokemon_id2,
        partnerRows,
        backgroundOptions: fusionBackgroundOptions,
        partnerBackgroundIds,
        comboBackgrounds,
      };
    });
  const fusionPartnerRow = activePartnerKey == null
    ? null
    : fusionOptions.flatMap((entry) => entry.partnerRows)
      .find((candidate) => (
        candidate.id === instances[activePartnerKey]?.instance_id
        || candidate.id === activePartnerKey
      )) ?? null;
  const canonicalPokemonId = pokemon.pokemon_id === 2290
    ? 888
    : pokemon.pokemon_id === 2292
      ? 889
      : pokemon.pokemon_id;
  const specialMaxBaseEligible = canonicalPokemonId === 890
    && instance.costume_id == null
    && !instance.dynamax
    && !instance.gigantamax;

  return cacheDetail({
    row,
    instance,
    baseStats: {
      attack: Number(pokemon.attack),
      defense: Number(pokemon.defense),
      stamina: Number(pokemon.stamina),
    },
    targetRows,
    traits,
    stats,
    ivs,
    moves: moveRows,
    provenance,
    preferences,
    moveOptions,
    backgroundOptions,
    appearanceImageUris,
    megaOptions,
    crownOptions,
    fusionOptions,
    fusionPartnerRow,
    specialMaxBaseEligible,
    sizeThresholds: pokemon.sizes,
    rarity: pokemon.rarity,
  });
};
