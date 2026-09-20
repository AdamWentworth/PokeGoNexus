import {
  getRegistrationSlots, getComboRootSlots, getComboRootKeyForSlot,
  getRegistrationCombos, getComboSearchText,
  type PokedexRegistrationSlot, type PokedexRegistrationCombo,
} from '@pokemongonexus/app-core/pokedex-detail-model';
import { getFusionId } from '@pokemongonexus/app-core/pokedex-detail-pokemon';
import type { BasePokemon, Move } from '@pokemongonexus/shared-contracts/pokemon';
import {
  buildNativePokedexRegistrationId,
  type NativePokedexEntry,
  type NativePokedexManualRegistration,
  type NativePokedexRegistrationFacets,
} from './nativePokedexModel';

export type NativePokedexDetailSectionKey =
  | 'registered'
  | 'costume'
  | 'shadow'
  | 'mega'
  | 'max'
  | 'fusion'
  | 'special';

export type NativePokedexComboFilter =
  | 'registered'
  | 'missing'
  | 'pokemon'
  | 'shiny'
  | 'male'
  | 'female'
  | 'xxs'
  | 'xs'
  | 'xl'
  | 'xxl'
  | 'lucky'
  | 'perfect';

export type NativePokedexRegistrationSlot = {
  canonical: PokedexRegistrationSlot;
  entry: NativePokedexEntry;
  facets: NativePokedexRegistrationFacets;
  icon: string | null;
  id: string;
  label: string;
  lockedByInstance: boolean;
  registered: boolean;
  registration: NativePokedexManualRegistration;
  releaseDate: string | null;
  section: NativePokedexDetailSectionKey;
};

export type NativePokedexCombination = {
  canonical: PokedexRegistrationCombo;
  entry: NativePokedexEntry;
  facets: NativePokedexRegistrationFacets;
  id: string;
  label: string;
  lockedByInstance: boolean;
  registered: boolean;
  registration: NativePokedexManualRegistration;
};

export type NativePokedexCombinationSection = {
  slot: NativePokedexRegistrationSlot;
  combinations: NativePokedexCombination[];
  entries: NativePokedexEntry[];
  id: string;
  label: string;
  registeredCount: number;
};

const TYPE_NAMES = [
  'Normal', 'Fire', 'Water', 'Electric', 'Grass', 'Ice', 'Fighting', 'Poison', 'Ground',
  'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy',
] as const;

const ATTACK_TYPE_CHART: Record<string, { resisted: string[]; strong: string[] }> = {
  bug: { strong: ['grass', 'psychic', 'dark'], resisted: ['fire', 'fighting', 'poison', 'flying', 'ghost', 'steel', 'fairy'] },
  dark: { strong: ['psychic', 'ghost'], resisted: ['fighting', 'dark', 'fairy'] },
  dragon: { strong: ['dragon'], resisted: ['steel', 'fairy'] },
  electric: { strong: ['water', 'flying'], resisted: ['electric', 'grass', 'dragon', 'ground'] },
  fairy: { strong: ['fighting', 'dragon', 'dark'], resisted: ['fire', 'poison', 'steel'] },
  fighting: { strong: ['normal', 'ice', 'rock', 'dark', 'steel'], resisted: ['poison', 'flying', 'psychic', 'bug', 'ghost', 'fairy'] },
  fire: { strong: ['grass', 'ice', 'bug', 'steel'], resisted: ['fire', 'water', 'rock', 'dragon'] },
  flying: { strong: ['grass', 'fighting', 'bug'], resisted: ['electric', 'rock', 'steel'] },
  ghost: { strong: ['psychic', 'ghost'], resisted: ['dark', 'normal'] },
  grass: { strong: ['water', 'ground', 'rock'], resisted: ['fire', 'grass', 'poison', 'flying', 'bug', 'dragon', 'steel'] },
  ground: { strong: ['fire', 'electric', 'poison', 'rock', 'steel'], resisted: ['grass', 'bug', 'flying'] },
  ice: { strong: ['grass', 'ground', 'flying', 'dragon'], resisted: ['fire', 'water', 'ice', 'steel'] },
  normal: { strong: [], resisted: ['rock', 'ghost', 'steel'] },
  poison: { strong: ['grass', 'fairy'], resisted: ['poison', 'ground', 'rock', 'ghost', 'steel'] },
  psychic: { strong: ['fighting', 'poison'], resisted: ['psychic', 'steel', 'dark'] },
  rock: { strong: ['fire', 'ice', 'flying', 'bug'], resisted: ['fighting', 'ground', 'steel'] },
  steel: { strong: ['ice', 'rock', 'fairy'], resisted: ['fire', 'water', 'electric', 'steel'] },
  water: { strong: ['fire', 'ground', 'rock'], resisted: ['water', 'grass', 'dragon'] },
};

const evolutionIds = (pokemon: BasePokemon, key: 'evolves_from' | 'evolves_to'): number[] => {
  const direct = pokemon[key];
  const nested = pokemon.evolutionData?.[key];
  const value = Array.isArray(direct) ? direct : nested;
  return Array.isArray(value)
    ? value.map(Number).filter((candidate) => Number.isFinite(candidate))
    : [];
};

export const buildNativePokedexEvolutionLine = (
  catalog: BasePokemon[],
  pokemon: BasePokemon,
): BasePokemon[] => {
  const byId = new Map(catalog.map((candidate) => [candidate.pokemon_id, candidate]));
  if (!byId.has(pokemon.pokemon_id)) byId.set(pokemon.pokemon_id, pokemon);
  const adjacency = new Map<number, Set<number>>();
  const connect = (left: number, right: number) => {
    if (!byId.has(left) || !byId.has(right)) return;
    adjacency.set(left, new Set([...(adjacency.get(left) ?? []), right]));
    adjacency.set(right, new Set([...(adjacency.get(right) ?? []), left]));
  };
  byId.forEach((candidate) => {
    [...evolutionIds(candidate, 'evolves_from'), ...evolutionIds(candidate, 'evolves_to')]
      .forEach((linkedId) => connect(candidate.pokemon_id, linkedId));
  });
  const family = new Set<number>();
  const pending = [pokemon.pokemon_id];
  while (pending.length > 0) {
    const current = pending.pop() as number;
    if (family.has(current)) continue;
    family.add(current);
    adjacency.get(current)?.forEach((linkedId) => pending.push(linkedId));
  }
  const depthCache = new Map<number, number>();
  const depth = (candidate: BasePokemon, trail = new Set<number>()): number => {
    const cached = depthCache.get(candidate.pokemon_id);
    if (cached != null) return cached;
    const parents = evolutionIds(candidate, 'evolves_from').filter((id) => byId.has(id) && !trail.has(id));
    if (parents.length === 0) return 0;
    const nextTrail = new Set(trail).add(candidate.pokemon_id);
    const result = 1 + Math.min(...parents.map((id) => depth(byId.get(id) as BasePokemon, nextTrail)));
    depthCache.set(candidate.pokemon_id, result);
    return result;
  };
  return [...family]
    .map((id) => byId.get(id))
    .filter((candidate): candidate is BasePokemon => Boolean(candidate))
    .sort((left, right) => depth(left) - depth(right) || Number(left.pokedex_number ?? left.pokemon_id) - Number(right.pokedex_number ?? right.pokemon_id));
};

export const getNativePokedexTypeEffectiveness = (
  pokemon: Pick<BasePokemon, 'type1_name' | 'type2_name'>,
): { resistantTo: string[]; weakTo: string[] } => {
  const defendingTypes = [pokemon.type1_name, pokemon.type2_name]
    .map((type) => String(type ?? '').trim().toLocaleLowerCase())
    .filter(Boolean);
  const resistantTo: string[] = [];
  const weakTo: string[] = [];
  TYPE_NAMES.forEach((typeName) => {
    const attack = ATTACK_TYPE_CHART[typeName.toLocaleLowerCase()];
    const multiplier = defendingTypes.reduce((current, defendingType) => {
      if (attack.strong.includes(defendingType)) return current * 1.6;
      if (attack.resisted.includes(defendingType)) return current * 0.625;
      return current;
    }, 1);
    if (multiplier > 1.01) weakTo.push(typeName);
    else if (multiplier < 0.99) resistantTo.push(typeName);
  });
  return { resistantTo, weakTo };
};

export const getNativePokedexMoveEnergyBarCount = (move: Move): number => {
  const energy = Math.abs(Number(move.pvp_energy || move.raid_energy || 0));
  if (energy >= 100) return 1;
  if (energy >= 50) return 2;
  if (energy > 0) return 3;
  return 0;
};

const facetOrder: (keyof NativePokedexRegistrationFacets)[] = [
  'gender', 'size', 'purified', 'lucky', 'appraisal',
];

const facetsEqual = (
  left: NativePokedexRegistrationFacets,
  right: NativePokedexRegistrationFacets,
): boolean => facetOrder.every((key) => left[key] === right[key]);

const stateFor = (
  entry: NativePokedexEntry,
  facets: NativePokedexRegistrationFacets,
): { lockedByInstance: boolean; registered: boolean } => {
  const id = buildNativePokedexRegistrationId(entry.id, facets);
  const manual = entry.manualRegistrationIds.includes(id);
  // Caught copies imply every subset of their qualities. Manual marks remain exact.
  // Match subsets on demand to avoid exponentially expanding an entire collection.
  const instanceFacets = entry.instanceFacets ?? (entry.instanceRegistered ? entry.registeredFacets : []);
  const caught = instanceFacets.some((candidate) => facetOrder.every((key) => facets[key] === undefined || facets[key] === candidate[key]));
  const registered = manual || caught || entry.registeredFacets.some((candidate) => facetsEqual(candidate, facets));
  return { lockedByInstance: caught && !manual, registered };
};

const registrationFor = (
  entry: NativePokedexEntry,
  facets: NativePokedexRegistrationFacets,
): NativePokedexManualRegistration => ({
  entryId: entry.id,
  facets,
  registrationId: buildNativePokedexRegistrationId(entry.id, facets),
});

const variantFor = (entry: NativePokedexEntry) => entry.variant ?? ({
  pokemon_id: entry.pokemonId,
  pokedex_number: entry.pokedexNumber,
  variant_id: entry.id,
  variantType: entry.id.slice(entry.id.indexOf('-') + 1),
  name: entry.name.replace(/^Shiny /, ''),
  species_name: entry.name,
  gender_rate: entry.supportedGenders?.length === 0 ? 'GENDERLESS' : 'M/F',
  costumes: [],
} as unknown as PokedexRegistrationSlot['pokemon']);

const nativeSlot = (slot: PokedexRegistrationSlot, entries: NativePokedexEntry[]): NativePokedexRegistrationSlot => {
  const entry = entries.find(({ id }) => id === slot.pokemon.variant_id)!;
  const facets = (slot.facets ?? {}) as NativePokedexRegistrationFacets;
  const registration = registrationFor(entry, facets);
  return {
    canonical: slot, entry, facets, registration, id: registration.registrationId,
    label: slot.label, section: slot.section === 'primary' ? 'registered' : slot.section,
    icon: slot.icon ?? null, releaseDate: slot.releaseDate ?? null,
    ...stateFor(entry, facets),
  };
};

export const buildNativePokedexRegistrationSlots = (
  allEntries: NativePokedexEntry[], pokemonId: number,
): NativePokedexRegistrationSlot[] => {
  const entries = allEntries.filter((entry) => entry.pokemonId === pokemonId);
  const variants = entries.map(variantFor);
  return variants[0] ? getRegistrationSlots(variants[0], variants, []).map((slot) => nativeSlot(slot, entries)) : [];
};

export const buildNativePokedexCombinationSections = (
  allEntries: NativePokedexEntry[], pokemon: BasePokemon,
): NativePokedexCombinationSection[] => {
  const entries = allEntries.filter((entry) => entry.pokemonId === pokemon.pokemon_id);
  const variants = entries.map((entry) => entry.variant ?? { ...pokemon, ...variantFor(entry), gender_rate: pokemon.gender_rate ?? variantFor(entry).gender_rate });
  if (!variants[0]) return [];
  const roots = getComboRootSlots(getRegistrationSlots(variants[0], variants, []));
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  return roots.map((root) => {
    const slot = nativeSlot(root, entries);
    const combinations = getRegistrationCombos({ selectedSlot: root, variants, registrations: [] }).map((combo) => {
      const entry = byId.get(combo.pokemon.variant_id)!;
      const facets = combo.facets as NativePokedexRegistrationFacets;
      const registration = registrationFor(entry, facets);
      return { canonical: combo, entry, facets, registration, id: registration.registrationId,
        label: combo.label, ...stateFor(entry, facets) };
    });
    return { slot, combinations, entries: [...new Set(combinations.map(({ entry }) => entry))],
      id: slot.id, label: slot.label, registeredCount: combinations.filter(({ registered }) => registered).length };
  });
};

export const getNativePokedexComboSectionForSlot = (
  slot: NativePokedexRegistrationSlot | undefined, sections: NativePokedexCombinationSection[],
): NativePokedexCombinationSection | undefined => {
  const key = getComboRootKeyForSlot(slot?.canonical, sections.map(({ slot }) => slot.canonical));
  return sections.find(({ slot }) => slot.canonical.key === key);
};

export const getNativePokedexMoves = (pokemon: BasePokemon | PokedexRegistrationSlot['pokemon'] | null | undefined): Move[] => {
  if (!pokemon) return [];
  const fusionId = getFusionId(pokemon as PokedexRegistrationSlot['pokemon']);
  return (pokemon.moves ?? []).filter((move) => fusionId === null || move.fusion_id == null || Number(move.fusion_id) === fusionId);
};

const isShiny = (entry: NativePokedexEntry) => entry.category.includes('shiny');

const FILTER_GROUPS: Record<NativePokedexComboFilter, string> = {
  registered: 'status', missing: 'status', pokemon: 'variant', shiny: 'variant',
  male: 'gender', female: 'gender', xxs: 'size', xs: 'size', xl: 'size', xxl: 'size',
  lucky: 'quality', perfect: 'quality',
};

const matchesFilter = (combo: NativePokedexCombination, filter: NativePokedexComboFilter): boolean => {
  if (filter === 'registered') return combo.registered;
  if (filter === 'missing') return !combo.registered;
  if (filter === 'pokemon') return !isShiny(combo.entry);
  if (filter === 'shiny') return isShiny(combo.entry);
  if (filter === 'male' || filter === 'female') return combo.facets.gender?.toLocaleLowerCase() === filter;
  if (filter === 'xxs' || filter === 'xs' || filter === 'xl' || filter === 'xxl') return combo.facets.size === filter;
  if (filter === 'lucky') return combo.facets.lucky === true;
  return combo.facets.appraisal === '4-star';
};

export const filterNativePokedexCombinations = (
  combinations: NativePokedexCombination[],
  query: string,
  filters: NativePokedexComboFilter[],
): NativePokedexCombination[] => {
  const tokens = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const groups = filters.reduce<Record<string, NativePokedexComboFilter[]>>((result, filter) => {
    const group = FILTER_GROUPS[filter];
    result[group] = [...(result[group] ?? []), filter];
    return result;
  }, {});
  return combinations.filter((combo) => {
    const text = getComboSearchText({ ...combo.canonical, registered: combo.registered });
    if (!tokens.every((token) => text.includes(token))) return false;
    return Object.entries(groups).every(([group, groupFilters]) => group === 'quality'
      ? groupFilters.every((filter) => matchesFilter(combo, filter))
      : groupFilters.some((filter) => matchesFilter(combo, filter)));
  });
};

export const toggleNativePokedexComboFilter = (
  current: NativePokedexComboFilter[],
  filter: NativePokedexComboFilter,
): NativePokedexComboFilter[] => {
  if (current.includes(filter)) return current.filter((candidate) => candidate !== filter);
  const group = FILTER_GROUPS[filter];
  const exclusive = group !== 'quality';
  return [...(exclusive ? current.filter((candidate) => FILTER_GROUPS[candidate] !== group) : current), filter];
};
