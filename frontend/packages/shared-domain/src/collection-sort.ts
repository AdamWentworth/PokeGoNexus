/**
 * Renderer-independent collection ordering.
 *
 * The web collection established these rules first. Keeping their data
 * projection and comparators here lets web and native share the exact same
 * ordering semantics instead of maintaining subtly different approximations.
 */

export type PokemonCollectionSortType =
  | 'releaseDate'
  | 'favorite'
  | 'number'
  | 'hp'
  | 'name'
  | 'combatPower';

export type PokemonCollectionSortDirection = 'ascending' | 'descending';

type SortCostume = {
  costume_id: number;
  date_available?: string | null;
  date_shiny_available?: string | null;
  shadow_costume?: { date_available?: string | null } | null;
};

type SortMega = { form?: string | null; date_available?: string | null };
type SortFusion = { fusion_id?: number | null; date_available?: string | null };
type SortMax = {
  dynamax_release_date?: string | null;
  gigantamax_release_date?: string | null;
};

export type PokemonCollectionSortSource = {
  pokedex_number: number;
  name?: string | null;
  species_name?: string | null;
  variantType: string;
  form?: string | null;
  date_available?: string | null;
  date_shiny_available?: string | null;
  date_shadow_available?: string | null;
  date_shiny_shadow_available?: string | null;
  stamina?: number | null;
  cp50?: number | null;
  costumes?: SortCostume[] | null;
  megaEvolutions?: SortMega[] | null;
  fusion?: SortFusion[] | null;
  max?: SortMax[] | null;
  instanceData?: {
    cp?: number | null;
    favorite?: boolean | null;
  } | null;
};

export type PokemonCollectionSortProjection = {
  pokedexNumber: number;
  sortName: string;
  variantType: string;
  form?: string | null;
  dateAvailable: string | null;
  costumeId: number;
  costumeDateAvailable: string | null;
  releaseTimestamp: number;
  stamina: number;
  cp: number;
  favorite: boolean;
};

const projectionCache = new WeakMap<object, PokemonCollectionSortProjection>();

const toValidTimestamp = (value: string | null | undefined): number => {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const toComparableDate = (value: string | null | undefined): number =>
  new Date(value ?? '').getTime();

const getBaseName = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const lastSpaceIndex = trimmed.lastIndexOf(' ');
  return lastSpaceIndex >= 0 ? trimmed.slice(lastSpaceIndex + 1) : trimmed;
};

export const resolvePokemonCollectionReleaseTimestamp = (
  pokemon: PokemonCollectionSortSource,
): number => {
  const variantType = pokemon.variantType;
  const maxData = pokemon.max?.[0];

  if (variantType.startsWith('costume')) {
    const costumeId = Number.parseInt(variantType.match(/\d+/)?.[0] ?? '0', 10);
    const costume = pokemon.costumes?.find((candidate) => candidate.costume_id === costumeId);
    if (costume) {
      return toValidTimestamp(
        variantType.includes('shiny')
          ? costume.date_shiny_available ?? costume.date_available
          : costume.date_available,
      );
    }
  }

  if (variantType.includes('shadow_costume')) {
    const costumeId = Number.parseInt(variantType.match(/\d+/)?.[0] ?? '0', 10);
    const costume = pokemon.costumes?.find((candidate) => candidate.costume_id === costumeId);
    if (costume?.shadow_costume?.date_available) {
      return toValidTimestamp(costume.shadow_costume.date_available);
    }
  }

  if (variantType.includes('fusion')) {
    const parts = variantType.split('_');
    const fusionId = Number.parseInt(parts[parts.length - 1] ?? '', 10);
    const fusion = pokemon.fusion?.find((candidate) => candidate.fusion_id === fusionId);
    if (fusion) return toValidTimestamp(fusion.date_available);
  }

  if (variantType.includes('mega') || variantType.includes('primal')) {
    const selectedMega = pokemon.megaEvolutions?.find(
      (candidate) => candidate.form === pokemon.form,
    ) ?? pokemon.megaEvolutions?.[0];
    if (selectedMega) return toValidTimestamp(selectedMega.date_available);
  }

  switch (variantType) {
    case 'default':
      return toValidTimestamp(pokemon.date_available);
    case 'shiny':
      return toValidTimestamp(pokemon.date_shiny_available);
    case 'shadow':
      return toValidTimestamp(pokemon.date_shadow_available);
    case 'shiny_shadow':
      return toValidTimestamp(pokemon.date_shiny_shadow_available);
    case 'dynamax':
    case 'shiny_dynamax':
      return toValidTimestamp(
        maxData?.dynamax_release_date
          ?? (variantType === 'shiny_dynamax'
            ? pokemon.date_shiny_available
            : pokemon.date_available),
      );
    case 'gigantamax':
    case 'shiny_gigantamax':
      return toValidTimestamp(
        maxData?.gigantamax_release_date
          ?? (variantType === 'shiny_gigantamax'
            ? pokemon.date_shiny_available
            : pokemon.date_available),
      );
    default:
      return toValidTimestamp(pokemon.date_available);
  }
};

export const projectPokemonCollectionSortSource = (
  pokemon: PokemonCollectionSortSource,
): PokemonCollectionSortProjection => {
  const cached = projectionCache.get(pokemon);
  if (cached) return cached;
  const costumeId = Number.parseInt(pokemon.variantType.split('_')[1] ?? '', 10);
  const costume = pokemon.costumes?.find((candidate) => candidate.costume_id === costumeId);
  const rawCp = pokemon.instanceData
    ? pokemon.instanceData.cp ?? null
    : pokemon.cp50 ?? 0;
  const numericCp = Number(rawCp);

  const projection = {
    pokedexNumber: pokemon.pokedex_number,
    sortName: getBaseName(pokemon.species_name ?? pokemon.name ?? ''),
    variantType: pokemon.variantType,
    form: pokemon.form,
    dateAvailable: pokemon.date_available ?? null,
    costumeId,
    costumeDateAvailable: costume?.date_available ?? null,
    releaseTimestamp: resolvePokemonCollectionReleaseTimestamp(pokemon),
    stamina: Number(pokemon.stamina ?? 0),
    cp: Number.isNaN(numericCp) ? -1 : numericCp,
    favorite: Boolean(pokemon.instanceData?.favorite),
  };
  projectionCache.set(pokemon, projection);
  return projection;
};

const compareNumber = (
  a: PokemonCollectionSortProjection,
  b: PokemonCollectionSortProjection,
  direction: PokemonCollectionSortDirection,
): number => {
  const pokedexComparison = direction === 'ascending'
    ? a.pokedexNumber - b.pokedexNumber
    : b.pokedexNumber - a.pokedexNumber;
  if (pokedexComparison !== 0) return pokedexComparison;

  if (a.form === null && b.form !== null) return -1;
  if (a.form !== null && b.form === null) return 1;

  if (a.form !== null && b.form !== null) {
    const dateA = toComparableDate(a.dateAvailable);
    const dateB = toComparableDate(b.dateAvailable);
    if (dateA < dateB) return -1;
    if (dateA > dateB) return 1;
  }

  const isDefaultA = a.variantType === 'default';
  const isDefaultB = b.variantType === 'default';
  const isShinyA = a.variantType === 'shiny';
  const isShinyB = b.variantType === 'shiny';
  if (isDefaultA && !isDefaultB) return -1;
  if (!isDefaultA && isDefaultB) return 1;
  if (isShinyA && !isShinyB) return -1;
  if (!isShinyA && isShinyB) return 1;

  const isCostumeA = a.variantType.includes('costume');
  const isCostumeB = b.variantType.includes('costume');
  const isMegaA = a.variantType.includes('mega');
  const isMegaB = b.variantType.includes('mega');
  if (isCostumeA && isMegaB) return -1;
  if (isMegaA && isCostumeB) return 1;

  if (isCostumeA && isCostumeB) {
    const dateA = toComparableDate(a.costumeDateAvailable);
    const dateB = toComparableDate(b.costumeDateAvailable);
    if (dateA < dateB) return -1;
    if (dateA > dateB) return 1;
    if (a.costumeId < b.costumeId) return -1;
    if (a.costumeId > b.costumeId) return 1;
    const shinyA = a.variantType.includes('shiny');
    const shinyB = b.variantType.includes('shiny');
    if (!shinyA && shinyB) return -1;
    if (shinyA && !shinyB) return 1;
  }

  const orderedPairs: Array<[string, string]> = [
    ['shadow', 'shiny_shadow'],
    ['mega_x', '*'],
    ['mega_y', '*'],
    ['shiny_mega_x', '*'],
    ['shiny_mega_y', '*'],
  ];
  for (const [first, second] of orderedPairs) {
    if (second === '*') {
      const firstA = a.variantType === first;
      const firstB = b.variantType === first;
      if (firstA && !firstB) return -1;
      if (!firstA && firstB) return 1;
    } else {
      if (a.variantType === first && b.variantType === second) return -1;
      if (a.variantType === second && b.variantType === first) return 1;
    }
  }
  return 0;
};

export const comparePokemonCollectionSortProjections = (
  a: PokemonCollectionSortProjection,
  b: PokemonCollectionSortProjection,
  sort: PokemonCollectionSortType,
  direction: PokemonCollectionSortDirection,
): number => {
  const multiplier = direction === 'ascending' ? 1 : -1;
  switch (sort) {
    case 'releaseDate': {
      const comparison = multiplier * (a.releaseTimestamp - b.releaseTimestamp);
      return comparison !== 0
        ? comparison
        : multiplier * (a.pokedexNumber - b.pokedexNumber);
    }
    case 'favorite': {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      const cpComparison = multiplier * (a.cp - b.cp);
      return cpComparison !== 0 ? cpComparison : a.pokedexNumber - b.pokedexNumber;
    }
    case 'number':
      return compareNumber(a, b, direction);
    case 'hp':
      return multiplier * (a.stamina - b.stamina);
    case 'name':
      return direction === 'ascending'
        ? a.sortName.localeCompare(b.sortName)
        : b.sortName.localeCompare(a.sortName);
    case 'combatPower': {
      const comparison = multiplier * (a.cp - b.cp);
      return comparison !== 0 ? comparison : a.pokedexNumber - b.pokedexNumber;
    }
  }
};

export const sortPokemonCollectionItems = <T>(
  items: T[],
  sort: PokemonCollectionSortType,
  direction: PokemonCollectionSortDirection,
  project: (item: T) => PokemonCollectionSortProjection,
): T[] => [...items].sort((a, b) =>
  comparePokemonCollectionSortProjections(project(a), project(b), sort, direction));

export type PokemonFavoriteTagSortSource = {
  favorite?: boolean;
  cp?: number | string | null;
  cp50?: number | string | null;
  pokedex_number?: number | string | null;
};

const favoriteTagInteger = (
  value: number | string | null | undefined,
  fallback: number,
): number => {
  if (value == null) return fallback;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

/** Tag previews use CP descending independently of the collection grid's sort. */
export const sortPokemonFavoriteTagItems = <T>(
  items: readonly T[],
  project: (item: T) => PokemonFavoriteTagSortSource,
): T[] => items.map((item) => {
  const source = project(item);
  return {
    item,
    favorite: Boolean(source.favorite),
    cp: favoriteTagInteger(source.cp ?? source.cp50, -1),
    pokedexNumber: favoriteTagInteger(source.pokedex_number, 0),
  };
}).sort((a, b) =>
  Number(b.favorite) - Number(a.favorite)
  || b.cp - a.cp
  || a.pokedexNumber - b.pokedexNumber,
).map(({ item }) => item);
