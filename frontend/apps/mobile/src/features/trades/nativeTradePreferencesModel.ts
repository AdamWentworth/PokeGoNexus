import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type { BasePokemon } from '@pokemongonexus/shared-contracts/pokemon';
import {
  filterTradePreferenceCandidates,
  TRADE_PREFERENCE_RULE_KEYS,
  type TradePreferenceCandidate,
  type TradePreferenceFilters,
  type TradePreferenceRuleKey,
} from '@pokemongonexus/shared-domain/trade-preferences';
import { resolveInstanceCollectionKey } from '@pokemongonexus/shared-domain/instances';
import {
  buildNativeCollectionRows,
  type NativeCollectionRow,
} from '../collection/collectionModel';

export type NativeTradePreferenceMode = 'trade' | 'wanted';

export type NativeTradePreferenceCandidate = {
  collectionKey: string;
  instance: PokemonInstance;
  row: NativeCollectionRow;
  allowed: boolean;
  excludedByRule: boolean;
  manuallyExcluded: boolean;
  traits: TradePreferenceCandidate;
  displayName?: string;
};

export type NativeTradePreferenceEntry = {
  activeRuleCount: number;
  allowedCount: number;
  candidates: NativeTradePreferenceCandidate[];
  collectionKey: string;
  filters: TradePreferenceFilters;
  instance: PokemonInstance;
  mirror: boolean;
  mode: NativeTradePreferenceMode;
  row: NativeCollectionRow;
  displayName?: string;
  nickname?: string | null;
};

export type NativeTradePreferencePatch = Partial<Pick<
  PokemonInstance,
  | 'mirror'
  | 'not_trade_list'
  | 'not_wanted_list'
  | 'trade_filters'
  | 'wanted_filters'
>>;

export type NativeTradePreferencePatchPlan = {
  patches: Record<string, NativeTradePreferencePatch>;
  selectedCollectionKey: string;
  updatedExcludedIds: string[];
};

type InstanceReference = {
  collectionKey: string;
  instance: PokemonInstance;
};

const truthyBooleanMap = (value: unknown): Record<string, boolean> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([key, enabled]) => (
    enabled === true ? [[key, true]] : []
  )));
};

const normalizeFilters = (value: unknown): TradePreferenceFilters => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(TRADE_PREFERENCE_RULE_KEYS.flatMap((key) => (
    (value as Record<string, unknown>)[key] === true ? [[key, true]] : []
  ))) as TradePreferenceFilters;
};

const referenceFor = (
  instances: Record<string, PokemonInstance>,
  requestedId: string,
): InstanceReference | null => {
  const collectionKey = resolveInstanceCollectionKey(instances, requestedId);
  if (!collectionKey) return null;
  const instance = instances[collectionKey];
  return instance ? { collectionKey, instance } : null;
};

const normalizeReferenceMap = (
  instances: Record<string, PokemonInstance>,
  value: unknown,
): Record<string, boolean> => Object.fromEntries(
  Object.keys(truthyBooleanMap(value)).map((reference) => [
    resolveInstanceCollectionKey(instances, reference) ?? reference,
    true,
  ]),
);

const resolveVariantType = (instance: PokemonInstance): string => {
  const traits: string[] = [];
  if (instance.shiny) traits.push('shiny');
  if (instance.shadow) traits.push('shadow');
  if (instance.costume_id != null) traits.push('costume');
  if (instance.gigantamax) traits.push('gigantamax');
  else if (instance.dynamax) traits.push('dynamax');
  if (instance.is_mega || instance.mega) traits.push('mega');
  if (instance.is_fused) traits.push('fusion');
  if (instance.crown) traits.push('crown');
  return traits.length ? traits.join('_') : 'default';
};

const preferenceCandidateFor = (
  instance: PokemonInstance,
  pokemon: BasePokemon | undefined,
): TradePreferenceCandidate => ({
  location_card: instance.location_card,
  rarity: pokemon?.rarity,
  shiny_rarity: pokemon?.shiny_rarity,
  variantType: resolveVariantType(instance),
});

const compareRows = (
  left: Pick<NativeTradePreferenceCandidate, 'collectionKey' | 'row'>,
  right: Pick<NativeTradePreferenceCandidate, 'collectionKey' | 'row'>,
): number => left.row.pokedexNumber - right.row.pokedexNumber
  || (left.row.variantOrder ?? Number.MAX_SAFE_INTEGER)
    - (right.row.variantOrder ?? Number.MAX_SAFE_INTEGER)
  || left.row.name.localeCompare(right.row.name)
  || left.collectionKey.localeCompare(right.collectionKey);

const entryCompare = (
  left: NativeTradePreferenceEntry,
  right: NativeTradePreferenceEntry,
): number => left.row.pokedexNumber - right.row.pokedexNumber
  || (left.row.variantOrder ?? Number.MAX_SAFE_INTEGER)
    - (right.row.variantOrder ?? Number.MAX_SAFE_INTEGER)
  || left.row.name.localeCompare(right.row.name)
  || left.collectionKey.localeCompare(right.collectionKey);

type PreparedNativeTradePreferences = {
  instances: Record<string, PokemonInstance>;
  pokemonById: Map<number, BasePokemon>;
  rowByCollectionKey: Map<string, NativeCollectionRow>;
  speciesRowByCollectionKey: Map<string, NativeCollectionRow>;
};

const prepareNativeTradePreferences = ({
  assetOrigin,
  catalog,
  instances,
}: {
  assetOrigin: string;
  catalog: BasePokemon[];
  instances: Record<string, PokemonInstance>;
}): PreparedNativeTradePreferences => {
  const rows = buildNativeCollectionRows(instances, catalog, assetOrigin);
  const speciesRows = buildNativeCollectionRows(
    Object.fromEntries(Object.entries(instances).map(([key, instance]) => [
      key,
      { ...instance, nickname: null },
    ])),
    catalog,
    assetOrigin,
  );
  const rowByCollectionKey = new Map<string, NativeCollectionRow>();
  const speciesRowByCollectionKey = new Map<string, NativeCollectionRow>();
  for (const row of rows) {
    const collectionKey = resolveInstanceCollectionKey(instances, row.id);
    if (collectionKey) rowByCollectionKey.set(collectionKey, row);
  }
  for (const row of speciesRows) {
    const collectionKey = resolveInstanceCollectionKey(instances, row.id);
    if (collectionKey) speciesRowByCollectionKey.set(collectionKey, row);
  }
  const pokemonById = new Map(catalog.map((pokemon) => [pokemon.pokemon_id, pokemon]));
  return { instances, pokemonById, rowByCollectionKey, speciesRowByCollectionKey };
};

const buildNativeTradePreferenceEntriesFromPrepared = (
  prepared: PreparedNativeTradePreferences,
  mode: NativeTradePreferenceMode,
): NativeTradePreferenceEntry[] => {
  const {
    instances,
    pokemonById,
    rowByCollectionKey,
    speciesRowByCollectionKey,
  } = prepared;
  const selectedStatus = mode === 'trade' ? 'trade' : 'wanted';
  const candidateStatus = mode === 'trade' ? 'wanted' : 'trade';
  const candidatePool = Object.entries(instances).flatMap(([
    collectionKey,
    candidateInstance,
  ]) => {
    const row = rowByCollectionKey.get(collectionKey);
    if (!row || row.status !== candidateStatus || candidateInstance.disabled) return [];
    return [{
      collectionKey,
      displayName: speciesRowByCollectionKey.get(collectionKey)?.name ?? row.name,
      instance: candidateInstance,
      row,
      traits: preferenceCandidateFor(
        candidateInstance,
        pokemonById.get(candidateInstance.pokemon_id),
      ),
    }];
  }).sort(compareRows);
  const candidateTraits = Object.fromEntries(candidatePool.map((candidate) => [
    candidate.collectionKey,
    candidate.traits,
  ]));

  return Object.entries(instances).flatMap(([collectionKey, instance]) => {
    const row = rowByCollectionKey.get(collectionKey);
    if (!row || row.status !== selectedStatus || instance.disabled) return [];

    const filters = normalizeFilters(
      mode === 'trade' ? instance.wanted_filters : instance.trade_filters,
    );
    const manuallyExcluded = normalizeReferenceMap(
      instances,
      mode === 'trade' ? instance.not_wanted_list : instance.not_trade_list,
    );
    const filterMode = mode === 'trade' ? 'wanted-targets' : 'trade-offers';
    let cachedAllowedCount: number | null = null;
    let cachedCandidates: NativeTradePreferenceCandidate[] | null = null;
    const entry: NativeTradePreferenceEntry = {
      activeRuleCount: TRADE_PREFERENCE_RULE_KEYS.filter((key) => filters[key]).length,
      get allowedCount() {
        if (cachedAllowedCount != null) return cachedAllowedCount;
        if (cachedCandidates) {
          cachedAllowedCount = cachedCandidates.filter((candidate) => candidate.allowed).length;
          return cachedAllowedCount;
        }
        const matchingTraits = filterTradePreferenceCandidates(candidateTraits, filterMode, filters);
        cachedAllowedCount = candidatePool.reduce((count, candidate) => (
          matchingTraits[candidate.collectionKey] != null
          && manuallyExcluded[candidate.collectionKey] !== true
            ? count + 1
            : count
        ), 0);
        return cachedAllowedCount;
      },
      get candidates() {
        if (cachedCandidates) return cachedCandidates;
        const matchingTraits = filterTradePreferenceCandidates(candidateTraits, filterMode, filters);
        cachedCandidates = candidatePool.map((candidate) => {
          const excludedByRule = matchingTraits[candidate.collectionKey] == null;
          const isManuallyExcluded = manuallyExcluded[candidate.collectionKey] === true;
          return {
            ...candidate,
            allowed: !excludedByRule && !isManuallyExcluded,
            excludedByRule,
            manuallyExcluded: isManuallyExcluded,
          };
        });
        cachedAllowedCount = cachedCandidates.filter((candidate) => candidate.allowed).length;
        return cachedCandidates;
      },
      collectionKey,
      filters,
      instance,
      mirror: mode === 'trade' && instance.mirror,
      mode,
      row,
      displayName: speciesRowByCollectionKey.get(collectionKey)?.name ?? row.name,
      nickname: instance.nickname?.trim() || null,
    };
    return [entry];
  }).sort(entryCompare);
};

export const buildNativeTradePreferenceEntries = ({
  assetOrigin,
  catalog,
  instances,
  mode,
}: {
  assetOrigin: string;
  catalog: BasePokemon[];
  instances: Record<string, PokemonInstance>;
  mode: NativeTradePreferenceMode;
}): NativeTradePreferenceEntry[] => buildNativeTradePreferenceEntriesFromPrepared(
  prepareNativeTradePreferences({ assetOrigin, catalog, instances }),
  mode,
);

export const buildNativeTradePreferenceEntrySets = ({
  assetOrigin,
  catalog,
  instances,
}: {
  assetOrigin: string;
  catalog: BasePokemon[];
  instances: Record<string, PokemonInstance>;
}): Record<NativeTradePreferenceMode, NativeTradePreferenceEntry[]> => {
  const prepared = prepareNativeTradePreferences({ assetOrigin, catalog, instances });
  return {
    trade: buildNativeTradePreferenceEntriesFromPrepared(prepared, 'trade'),
    wanted: buildNativeTradePreferenceEntriesFromPrepared(prepared, 'wanted'),
  };
};

export const resolveNativeTradePreferenceDraftCandidates = ({
  entry,
  filters,
  manuallyExcludedIds,
  mirror = false,
}: {
  entry: NativeTradePreferenceEntry;
  filters: TradePreferenceFilters;
  manuallyExcludedIds: ReadonlySet<string>;
  mirror?: boolean;
}): NativeTradePreferenceCandidate[] => {
  const candidatesById = Object.fromEntries(entry.candidates.map((candidate) => [
    candidate.collectionKey,
    candidate.traits,
  ]));
  const matching = filterTradePreferenceCandidates(
    candidatesById,
    entry.mode === 'trade' ? 'wanted-targets' : 'trade-offers',
    filters,
  );
  return entry.candidates.map((candidate) => {
    const excludedByMirror = mirror && (
      candidate.instance.pokemon_id !== entry.instance.pokemon_id
      || candidate.instance.variant_id !== entry.instance.variant_id
    );
    const excludedByRule = matching[candidate.collectionKey] == null || excludedByMirror;
    // Mirror mode is authoritative: the canonical editor clears ordinary
    // per-target exclusions and limits the listing to the matching variant.
    const manuallyExcluded = mirror ? false : manuallyExcludedIds.has(candidate.collectionKey);
    return {
      ...candidate,
      allowed: !excludedByRule && !manuallyExcluded,
      excludedByRule,
      manuallyExcluded,
    };
  });
};

const patchReciprocalList = ({
  instances,
  candidateKey,
  selectedKey,
  field,
  add,
}: {
  instances: Record<string, PokemonInstance>;
  candidateKey: string;
  selectedKey: string;
  field: 'not_trade_list' | 'not_wanted_list';
  add: boolean;
}): NativeTradePreferencePatch | null => {
  const candidate = instances[candidateKey];
  if (!candidate) return null;
  const next = normalizeReferenceMap(instances, candidate[field]);
  if (add) next[selectedKey] = true;
  else delete next[selectedKey];
  return { [field]: next };
};

/**
 * Plans the exact symmetric list updates used by the canonical web editor.
 * It is pure: neither the collection snapshot nor any nested preference map is
 * mutated. The caller persists every returned patch in one Receiver batch.
 */
export const buildNativeTradePreferencePatchPlan = ({
  filteredOutIds,
  filters,
  instances,
  manuallyExcludedIds,
  mirror = false,
  mode,
  selectedInstanceId,
}: {
  filteredOutIds: readonly string[];
  filters: TradePreferenceFilters;
  instances: Record<string, PokemonInstance>;
  manuallyExcludedIds: readonly string[];
  mirror?: boolean;
  mode: NativeTradePreferenceMode;
  selectedInstanceId: string;
}): NativeTradePreferencePatchPlan => {
  const selected = referenceFor(instances, selectedInstanceId);
  if (!selected) throw new Error('The selected trade preference entry no longer exists.');
  if (mode === 'trade' && !selected.instance.is_for_trade) {
    throw new Error('The selected Pokémon is no longer listed For Trade.');
  }
  if (mode === 'wanted' && !selected.instance.is_wanted) {
    throw new Error('The selected Pokémon is no longer Wanted.');
  }

  const previous = normalizeReferenceMap(
    instances,
    mode === 'trade' ? selected.instance.not_wanted_list : selected.instance.not_trade_list,
  );
  const updated = mode === 'trade' && mirror
    ? {}
    : Object.fromEntries(
        [...manuallyExcludedIds, ...filteredOutIds].flatMap((reference) => {
          const key = resolveInstanceCollectionKey(instances, reference);
          return key ? [[key, true]] : [];
        }),
      );
  const previousKeys = new Set(Object.keys(previous));
  const updatedKeys = new Set(Object.keys(updated));
  const removed = [...previousKeys].filter((key) => !updatedKeys.has(key));
  const added = [...updatedKeys].filter((key) => !previousKeys.has(key));
  const reciprocalField = mode === 'trade' ? 'not_trade_list' : 'not_wanted_list';
  const patches: Record<string, NativeTradePreferencePatch> = {};

  for (const candidateKey of removed) {
    const patch = patchReciprocalList({
      instances,
      candidateKey,
      selectedKey: selected.collectionKey,
      field: reciprocalField,
      add: false,
    });
    if (patch) patches[candidateKey] = patch;
  }
  for (const candidateKey of added) {
    const patch = patchReciprocalList({
      instances,
      candidateKey,
      selectedKey: selected.collectionKey,
      field: reciprocalField,
      add: true,
    });
    if (patch) patches[candidateKey] = patch;
  }

  patches[selected.collectionKey] = mode === 'trade'
    ? {
        not_wanted_list: updated,
        wanted_filters: mirror ? {} : normalizeFilters(filters),
        mirror,
      }
    : {
        not_trade_list: updated,
        trade_filters: normalizeFilters(filters),
      };

  return {
    patches,
    selectedCollectionKey: selected.collectionKey,
    updatedExcludedIds: Object.keys(updated).sort(),
  };
};

export const getNativeTradePreferenceRuleState = (
  filters: TradePreferenceFilters,
  key: TradePreferenceRuleKey,
): boolean => filters[key] === true;
