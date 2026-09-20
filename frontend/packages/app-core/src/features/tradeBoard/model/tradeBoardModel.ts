import type { TagItem } from '@/types/tags';
import type { AllVariants } from '@/types/pokemonVariants';

export type TradeBoardTheme = 'brand-dark' | 'brand-light' | 'minimal';

export interface TradeBoardEntry {
  key: string;
  pokemonId: number;
  pokedexNumber: number;
  name: string;
  imageUrl: string;
  locationBackgroundUrl: string | null;
  dynamax: boolean;
  gigantamax: boolean;
  luckyRequested: boolean;
  mostWanted: boolean;
  quantity: number;
}

export interface TradeBoardModel {
  username: string;
  pokemonGoName: string | null;
  boardUrl: string;
  generatedAt: string;
  includeTrade: boolean;
  includeWanted: boolean;
  tradeCount: number;
  wantedCount: number;
  mostWantedCount: number;
  tradeEntries: TradeBoardEntry[];
  wantedEntries: TradeBoardEntry[];
}

export interface BuildTradeBoardModelInput {
  username: string;
  pokemonGoName?: string | null;
  boardUrl: string;
  generatedAt?: Date | string;
  includeTrade?: boolean;
  includeWanted?: boolean;
  showPokemonGoName?: boolean;
  tradeItems: TagItem[];
  wantedItems: TagItem[];
  variants: AllVariants;
}

const normalizeDate = (value: Date | string | undefined): string => {
  const parsed = value instanceof Date ? value : new Date(value ?? Date.now());
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

const resolveBackgroundUrl = (
  item: TagItem,
  variantsById: Map<string, AllVariants[number]>,
  variantsByPokemonId: Map<number, AllVariants[number]>,
): string | null => {
  const rawBackgroundId = item.location_card;
  if (rawBackgroundId == null || rawBackgroundId === '') return null;
  const backgroundId = Number(rawBackgroundId);
  if (!Number.isFinite(backgroundId)) return null;

  const variant = (item.variant_id ? variantsById.get(item.variant_id) : undefined)
    ?? variantsByPokemonId.get(item.pokemon_id);
  return variant?.backgrounds?.find(
    (background) => Number(background.background_id) === backgroundId,
  )?.image_url ?? null;
};

const buildEntries = (
  items: TagItem[],
  variants: AllVariants,
  section: 'trade' | 'wanted',
): TradeBoardEntry[] => {
  const variantsById = new Map(variants.map((variant) => [variant.variant_id, variant]));
  const variantsByPokemonId = new Map<number, AllVariants[number]>();
  for (const variant of variants) {
    if (!variantsByPokemonId.has(variant.pokemon_id)) {
      variantsByPokemonId.set(variant.pokemon_id, variant);
    }
  }

  const grouped = new Map<string, TradeBoardEntry>();
  for (const item of items) {
    const variantType = item.variantType?.toLowerCase() ?? '';
    const gigantamax = variantType.includes('gigantamax');
    const dynamax = !gigantamax && variantType.includes('dynamax');
    const locationBackgroundUrl = resolveBackgroundUrl(
      item,
      variantsById,
      variantsByPokemonId,
    );
    const name = item.name?.trim() || 'Unknown Pokémon';
    const mostWanted = section === 'wanted' && item.most_wanted;
    const luckyRequested = section === 'wanted' && item.pref_lucky;
    const groupKey = JSON.stringify([
      item.variant_id ?? '',
      item.currentImage,
      name,
      locationBackgroundUrl,
      dynamax,
      gigantamax,
      mostWanted,
      luckyRequested,
      item.gender,
    ]);
    const existing = grouped.get(groupKey);
    if (existing) {
      existing.quantity += 1;
      continue;
    }

    grouped.set(groupKey, {
      key: `${section}:${item.instance_id || item.key || groupKey}`,
      pokemonId: item.pokemon_id,
      pokedexNumber: item.pokedex_number,
      name,
      imageUrl: item.currentImage || '/images/default_pokemon.png',
      locationBackgroundUrl,
      dynamax,
      gigantamax,
      luckyRequested,
      mostWanted,
      quantity: 1,
    });
  }

  return [...grouped.values()].sort((left, right) => {
    if (section === 'wanted' && left.mostWanted !== right.mostWanted) {
      return left.mostWanted ? -1 : 1;
    }
    return left.pokedexNumber - right.pokedexNumber
      || left.name.localeCompare(right.name)
      || left.key.localeCompare(right.key);
  });
};

export const buildTradeBoardModel = ({
  username,
  pokemonGoName,
  boardUrl,
  generatedAt,
  includeTrade = true,
  includeWanted = true,
  showPokemonGoName = true,
  tradeItems,
  wantedItems,
  variants,
}: BuildTradeBoardModelInput): TradeBoardModel => {
  const normalizedPokemonGoName = pokemonGoName?.trim() || null;
  const visiblePokemonGoName = showPokemonGoName
    && normalizedPokemonGoName
    && normalizedPokemonGoName.toLocaleLowerCase() !== username.trim().toLocaleLowerCase()
    ? normalizedPokemonGoName
    : null;

  return {
    username: username.trim(),
    pokemonGoName: visiblePokemonGoName,
    boardUrl,
    generatedAt: normalizeDate(generatedAt),
    includeTrade,
    includeWanted,
    tradeCount: includeTrade ? tradeItems.length : 0,
    wantedCount: includeWanted ? wantedItems.length : 0,
    mostWantedCount: includeWanted
      ? wantedItems.filter((item) => item.most_wanted).length
      : 0,
    tradeEntries: includeTrade ? buildEntries(tradeItems, variants, 'trade') : [],
    wantedEntries: includeWanted ? buildEntries(wantedItems, variants, 'wanted') : [],
  };
};

export const formatTradeBoardDate = (isoDate: string): string => {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(parsed);
};

export const tradeBoardFilename = (username: string, isoDate: string): string => {
  const date = isoDate.slice(0, 10) || new Date().toISOString().slice(0, 10);
  const safeUsername = username.trim().replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '')
    || 'trainer';
  return `pokegonexus-${safeUsername}-trade-board-${date}.png`;
};
