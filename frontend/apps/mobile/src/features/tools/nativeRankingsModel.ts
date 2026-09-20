import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type { PokemonCommunityRankingsPayload } from '@pokemongonexus/shared-contracts/search';
import type { PokemonCatalogEntry } from '@pokemongonexus/shared-domain/catalog';

export type NativeRankingMode = 'wanted' | 'rarest';
export type NativeRankingCategory = 'all' | 'shiny' | 'costume' | 'shadow' | 'max';
export type NativeRankingCollectionFilter = 'all' | 'owned' | 'trade' | 'wanted' | 'missing';
export type NativeRankingPersonalStatus = { caughtCount: number; registered: boolean; tradeCount: number; wanted: boolean };
export type NativeRankingRow = {
  caughtUsers: number;
  entry: PokemonCatalogEntry;
  mostWantedUsers: number | null;
  personal: NativeRankingPersonalStatus;
  rank: number;
  wantedUsers: number | null;
};

export const getNativeRankingsErrorMessage = (error: string, online = true): string => {
  if (!online) {
    return 'You appear to be offline. Check your connection and try again.';
  }
  const normalized = error.toLocaleLowerCase();
  if (normalized.includes('timeout') || normalized.includes('timed out')) {
    return 'The rankings service took too long to respond. Try again in a moment.';
  }
  if (normalized.includes('503') || normalized.includes('502') || normalized.includes('service unavailable')) {
    return 'The community rankings service is temporarily unavailable.';
  }
  return 'Community rankings could not be refreshed. Try again in a moment.';
};

const emptyPersonalStatus = (): NativeRankingPersonalStatus => ({ caughtCount: 0, registered: false, tradeCount: 0, wanted: false });
const canBeTraded = (instance: PokemonInstance): boolean => Boolean(
  instance.is_caught && !instance.shadow && !instance.lucky && !instance.mega
  && !instance.is_mega && !instance.is_fused && ![2270, 2271].includes(Number(instance.pokemon_id)),
);

const personalStatusCache = new WeakMap<
  Record<string, PokemonInstance>,
  Map<string, NativeRankingPersonalStatus>
>();

export const buildNativeRankingPersonalStatuses = (
  instances: Record<string, PokemonInstance>,
): Map<string, NativeRankingPersonalStatus> => {
  const cached = personalStatusCache.get(instances);
  if (cached) return cached;
  const statuses = new Map<string, NativeRankingPersonalStatus>();
  Object.values(instances).forEach((instance) => {
    const variantId = String(instance.variant_id ?? '').trim();
    if (!variantId || instance.disabled) return;
    const status = statuses.get(variantId) ?? emptyPersonalStatus();
    status.registered ||= Boolean(instance.registered || instance.is_caught);
    status.wanted ||= Boolean(instance.is_wanted && !variantId.toLocaleLowerCase().includes('shadow'));
    if (instance.is_caught) status.caughtCount += 1;
    if (instance.is_for_trade && canBeTraded(instance)) status.tradeCount += 1;
    statuses.set(variantId, status);
  });
  personalStatusCache.set(instances, statuses);
  return statuses;
};

const variantSuffix = (entry: PokemonCatalogEntry): string => (
  entry.id.slice(entry.id.indexOf('-') + 1).toLocaleLowerCase()
);

const inferredVariantType = (entry: PokemonCatalogEntry): string => {
  if (entry.variantType) return entry.variantType.toLocaleLowerCase();
  const suffix = variantSuffix(entry);
  if (
    ['default', 'shiny', 'shadow', 'shiny_shadow', 'dynamax', 'shiny_dynamax', 'gigantamax', 'shiny_gigantamax', 'primal', 'shiny_primal'].includes(suffix)
    || suffix.startsWith('mega')
    || suffix.startsWith('shiny_mega')
    || suffix.startsWith('fusion_')
    || suffix.startsWith('shiny_fusion_')
  ) return suffix;
  return `costume_${suffix}`;
};

export const matchesNativeRankingCategory = (
  entry: PokemonCatalogEntry,
  category: NativeRankingCategory,
): boolean => {
  if (category === 'all') return true;
  const variantType = inferredVariantType(entry);
  if (category === 'shiny') return variantType.includes('shiny');
  if (category === 'costume') return variantType.includes('costume');
  if (category === 'shadow') return variantType.includes('shadow');
  return variantType.includes('dynamax') || variantType.includes('gigantamax');
};

export const getNativeRankingCatalogSearch = (entry: PokemonCatalogEntry): string => {
  const terms = [entry.speciesName || entry.name];
  const variantType = inferredVariantType(entry);
  if (variantType.includes('shiny')) terms.push('shiny');
  if (variantType.includes('shadow')) terms.push('shadow');
  if (variantType.includes('costume')) terms.push('costume');
  if (variantType.includes('gigantamax')) terms.push('gigantamax');
  else if (variantType.includes('dynamax')) terms.push('dynamax');
  return terms
    .map((term) => term.trim().toLocaleLowerCase())
    .filter(Boolean)
    .join('&');
};

const formatFormName = (value: string): string => value
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toLocaleUpperCase());

export const getNativeRankingDisplayName = (entry: PokemonCatalogEntry): string => {
  const form = String(entry.form ?? '').trim();
  if (!form) return entry.name;
  const escapedForm = form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const formAlreadyNamed = new RegExp(`(?:^|[\\s(_-])${escapedForm}(?:$|[\\s)_-])`, 'i')
    .test(entry.name);
  return formAlreadyNamed ? entry.name : `${entry.name} ${formatFormName(form)}`;
};

export const getNativeRankingCollectionDestination = (
  row: Pick<NativeRankingRow, 'entry' | 'personal'>,
): { filter?: 'caught' | 'trade' | 'wanted'; search?: string } => {
  const filter = row.personal.tradeCount > 0
    ? 'trade'
    : row.personal.wanted
      ? 'wanted'
      : row.personal.registered
        ? 'caught'
        : null;
  return filter
    ? { filter, search: getNativeRankingCatalogSearch(row.entry) }
    : {};
};
const matchesCollection = (personal: NativeRankingPersonalStatus, filter: NativeRankingCollectionFilter): boolean => {
  if (filter === 'owned') return personal.registered;
  if (filter === 'trade') return personal.tradeCount > 0;
  if (filter === 'wanted') return personal.wanted;
  if (filter === 'missing') return !personal.registered;
  return true;
};

export const filterNativeRankingRowsByCollection = (
  rows: NativeRankingRow[],
  filter: NativeRankingCollectionFilter,
): NativeRankingRow[] => rows.filter((row) => matchesCollection(row.personal, filter));

export const countNativeRankingCollectionFilters = (
  rows: NativeRankingRow[],
): Record<NativeRankingCollectionFilter, number> => ({
  all: rows.length,
  owned: filterNativeRankingRowsByCollection(rows, 'owned').length,
  trade: filterNativeRankingRowsByCollection(rows, 'trade').length,
  wanted: filterNativeRankingRowsByCollection(rows, 'wanted').length,
  missing: filterNativeRankingRowsByCollection(rows, 'missing').length,
});

const collapseRarestEvolutionFamilies = <T extends { entry: PokemonCatalogEntry }>(
  rows: T[],
  catalog: PokemonCatalogEntry[],
): T[] => {
  const species = new Map<number, PokemonCatalogEntry>();
  catalog.forEach((entry) => {
    if (!species.has(entry.pokemonId)) species.set(entry.pokemonId, entry);
  });
  const adjacency = new Map<number, Set<number>>();
  const connect = (left: number, right: number) => {
    if (!species.has(left) || !species.has(right)) return;
    if (!adjacency.has(left)) adjacency.set(left, new Set());
    if (!adjacency.has(right)) adjacency.set(right, new Set());
    adjacency.get(left)?.add(right);
    adjacency.get(right)?.add(left);
  };
  species.forEach((entry, pokemonId) => {
    [...(entry.evolvesFrom ?? []), ...(entry.evolvesTo ?? [])]
      .forEach((linkedId) => connect(pokemonId, Number(linkedId)));
  });
  const familyByPokemon = new Map<number, number>();
  species.forEach((_entry, pokemonId) => {
    if (familyByPokemon.has(pokemonId)) return;
    const family = new Set<number>();
    const pending = [pokemonId];
    while (pending.length > 0) {
      const current = pending.pop() as number;
      if (family.has(current)) continue;
      family.add(current);
      adjacency.get(current)?.forEach((linked) => pending.push(linked));
    }
    const key = Math.min(...family);
    family.forEach((member) => familyByPokemon.set(member, key));
  });
  const depthCache = new Map<number, number>();
  const depth = (pokemonId: number, trail = new Set<number>()): number => {
    const cached = depthCache.get(pokemonId);
    if (cached != null) return cached;
    const entry = species.get(pokemonId);
    const parents = (entry?.evolvesFrom ?? []).filter((parent) => species.has(parent) && !trail.has(parent));
    if (parents.length === 0) {
      depthCache.set(pokemonId, 0);
      return 0;
    }
    const nextTrail = new Set(trail).add(pokemonId);
    const value = 1 + Math.min(...parents.map((parent) => depth(parent, nextTrail)));
    depthCache.set(pokemonId, value);
    return value;
  };
  const selected = new Map<string, T>();
  rows.forEach((row) => {
    const variantType = inferredVariantType(row.entry);
    if (variantType.includes('costume')) {
      selected.set(`variant:${row.entry.id}`, row);
      return;
    }
    const family = familyByPokemon.get(row.entry.pokemonId) ?? row.entry.pokemonId;
    const form = String(row.entry.form ?? '').trim().toLocaleLowerCase();
    const key = `${family}:${variantType}:${form}`;
    const current = selected.get(key);
    if (!current || depth(row.entry.pokemonId) < depth(current.entry.pokemonId)) {
      selected.set(key, row);
    }
  });
  const selectedIds = new Set([...selected.values()].map((row) => row.entry.id));
  return rows.filter((row) => selectedIds.has(row.entry.id));
};

export const buildNativeRankingRows = ({ catalog, collectionFilter = 'all', instances = {}, category = 'all', mode, payload, query = '' }: {
  catalog: PokemonCatalogEntry[];
  collectionFilter?: NativeRankingCollectionFilter;
  instances?: Record<string, PokemonInstance>;
  category?: NativeRankingCategory;
  mode: NativeRankingMode;
  payload: PokemonCommunityRankingsPayload | null | undefined;
  query?: string;
}): NativeRankingRow[] => {
  if (!payload) return [];
  const byId = new Map(catalog.map((entry) => [entry.id, entry]));
  const statuses = buildNativeRankingPersonalStatuses(instances);
  const normalized = query.trim().toLocaleLowerCase();
  const source = mode === 'wanted' ? payload.most_wanted : payload.rarest;
  const joined = source.flatMap((ranking) => {
    const entry = byId.get(ranking.variant_id);
    if (!entry) return [];
    return [{ entry, ranking }];
  });
  const prepared = mode === 'rarest'
    ? collapseRarestEvolutionFamilies(joined, catalog)
    : joined;
  return prepared.flatMap(({ entry, ranking }, index) => {
    if (mode === 'wanted' && entry.id.toLocaleLowerCase().includes('shadow')) return [];
    if (!matchesNativeRankingCategory(entry, category)) return [];
    if (normalized && !entry.name.toLocaleLowerCase().includes(normalized)
      && !String(entry.pokedexNumber).includes(normalized)
      && !(entry.speciesName ?? '').toLocaleLowerCase().includes(normalized)
      && !inferredVariantType(entry).includes(normalized)) return [];
    const personal = statuses.get(entry.id) ?? emptyPersonalStatus();
    if (!matchesCollection(personal, collectionFilter)) return [];
    return [{ caughtUsers: ranking.caught_users, entry, mostWantedUsers: ranking.most_wanted_users, personal, rank: index + 1, wantedUsers: ranking.wanted_users }];
  });
};
