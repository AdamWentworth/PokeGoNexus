import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type { BasePokemon } from '@pokemongonexus/shared-contracts/pokemon';
import type { SearchResultRow } from '@pokemongonexus/shared-contracts/search';
import { buildNativeCollectionRows, type NativeCollectionRow } from '../collection/collectionModel';

export type NativePokemonSearchMode = 'caught' | 'trade' | 'wanted';

export type NativePokemonSearchRelatedRow = NativeCollectionRow & {
  match: boolean;
};

export type NativePokemonSearchListingDetails = {
  gender: string | null;
  weight: number | null;
  height: number | null;
  moves: string[];
  attackIv: number | null;
  defenseIv: number | null;
  staminaIv: number | null;
  locationCaught: string | null;
  dateCaught: string | null;
  friendshipLevel: number | null;
  prefLucky: boolean;
  wantedSizeLabels: string[];
};

export type NativePokemonSearchResult = {
  id: string;
  username: string;
  distanceKm: number | null;
  mode: NativePokemonSearchMode;
  row: NativeCollectionRow;
  details: NativePokemonSearchListingDetails;
  relatedRows: NativePokemonSearchRelatedRow[];
  hasMutualMatch: boolean;
  mapCoordinate: [longitude: number, latitude: number] | null;
  mapCoordinateIsApproximate: boolean;
};

type RawSearchListing = SearchResultRow & Partial<PokemonInstance> & {
  instance_id?: string;
  username?: string;
  wanted_list?: Record<string, unknown> | null;
  trade_list?: Record<string, unknown> | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  boundary?: string | null;
  pokemonInfo?: {
    moves?: { move_id?: number; name?: string }[] | null;
  } | null;
};

const finiteNumber = (value: unknown): number | null => {
  const numeric = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(numeric) ? numeric : null;
};

const nonEmptyString = (value: unknown): string | null => (
  typeof value === 'string' && value.trim() ? value.trim() : null
);

const moveNamesForListing = (listing: RawSearchListing): string[] => {
  const moveIds = [listing.fast_move_id, listing.charged_move1_id, listing.charged_move2_id]
    .map(finiteNumber)
    .filter((value): value is number => value != null);
  const moveById = new Map((listing.pokemonInfo?.moves ?? []).flatMap((move) => {
    const id = finiteNumber(move.move_id);
    const name = nonEmptyString(move.name);
    return id != null && name ? [[id, name] as const] : [];
  }));
  return moveIds.map((id) => moveById.get(id) ?? `Move #${id}`);
};

const wantedSizeLabelsForListing = (listing: RawSearchListing): string[] => {
  const preferences = listing.wanted_size_preferences;
  if (!preferences || typeof preferences !== 'object') return [];
  return (['weight', 'height'] as const).flatMap((metric) => {
    const range = preferences[metric];
    const category = range && typeof range === 'object'
      ? nonEmptyString(range.category)
      : null;
    return category ? [`${metric === 'weight' ? 'Weight' : 'Height'} ${category}`] : [];
  });
};

const detailsForListing = (listing: RawSearchListing): NativePokemonSearchListingDetails => ({
  gender: nonEmptyString(listing.gender),
  weight: finiteNumber(listing.weight),
  height: finiteNumber(listing.height),
  moves: moveNamesForListing(listing),
  attackIv: finiteNumber(listing.attack_iv),
  defenseIv: finiteNumber(listing.defense_iv),
  staminaIv: finiteNumber(listing.stamina_iv),
  locationCaught: nonEmptyString(listing.location_caught),
  dateCaught: nonEmptyString(listing.date_caught),
  friendshipLevel: finiteNumber(listing.friendship_level),
  prefLucky: Boolean(listing.pref_lucky),
  wantedSizeLabels: wantedSizeLabelsForListing(listing),
});

export const mapCoordinateForSearchListing = (
  listing: Pick<RawSearchListing, 'boundary' | 'latitude' | 'longitude'>,
): { coordinate: [number, number] | null; approximate: boolean } => {
  const longitude = finiteNumber(listing.longitude);
  const latitude = finiteNumber(listing.latitude);
  if (longitude != null && latitude != null) {
    return { coordinate: [longitude, latitude], approximate: false };
  }

  if (!listing.boundary) return { coordinate: null, approximate: false };
  const points = [...listing.boundary.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)]
    .flatMap((match) => {
      const lon = finiteNumber(match[1]);
      const lat = finiteNumber(match[2]);
      return lon != null && lat != null ? [[lon, lat] as [number, number]] : [];
    });
  if (points.length === 0) return { coordinate: null, approximate: false };
  const longitudes = points.map(([lon]) => lon);
  const latitudes = points.map(([, lat]) => lat);
  return {
    coordinate: [
      (Math.min(...longitudes) + Math.max(...longitudes)) / 2,
      (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
    ],
    approximate: true,
  };
};

const recordEntries = (value: unknown): [string, Record<string, unknown>][] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value).flatMap(([key, entry]) => (
    entry && typeof entry === 'object' && !Array.isArray(entry)
      ? [[key, entry as Record<string, unknown>]]
      : []
  ));
};

const ensureStatus = (
  listing: Record<string, unknown>,
  mode: NativePokemonSearchMode,
): PokemonInstance => ({
  ...listing,
  is_caught: mode === 'caught' || mode === 'trade',
  is_for_trade: mode === 'trade',
  is_wanted: mode === 'wanted',
} as PokemonInstance);

const rowForInstance = ({
  assetOrigin,
  catalog,
  id,
  instance,
  mode,
}: {
  assetOrigin: string;
  catalog: BasePokemon[];
  id: string;
  instance: Record<string, unknown>;
  mode: NativePokemonSearchMode;
}): NativeCollectionRow | null => buildNativeCollectionRows(
  { [id]: ensureStatus({ ...instance, instance_id: id }, mode) },
  catalog,
  assetOrigin,
)[0] ?? null;

export const buildNativePokemonSearchResults = ({
  assetOrigin,
  catalog,
  mode,
  results,
}: {
  assetOrigin: string;
  catalog: BasePokemon[];
  mode: NativePokemonSearchMode;
  results: SearchResultRow[];
}): NativePokemonSearchResult[] => {
  const mapped = results.flatMap<NativePokemonSearchResult>((raw) => {
    const listing = raw as RawSearchListing;
    const id = listing.instance_id?.trim();
    if (!id) return [];
    const row = rowForInstance({ assetOrigin, catalog, id, instance: listing, mode });
    if (!row) return [];

    const relatedMode: NativePokemonSearchMode = mode === 'trade' ? 'wanted' : 'trade';
    const relatedSource = mode === 'trade' ? listing.wanted_list : listing.trade_list;
    const relatedRows = mode === 'caught' ? [] : recordEntries(relatedSource).flatMap(
      ([relatedId, related]) => {
        const relatedRow = rowForInstance({
          assetOrigin,
          catalog,
          id: relatedId,
          instance: related,
          mode: relatedMode,
        });
        return relatedRow ? [{
          ...relatedRow,
          match: related.match === true,
        }] : [];
      },
    );
    const distance = Number(listing.distance);
    const mapLocation = mapCoordinateForSearchListing(listing);
    return [{
      id,
      username: listing.username?.trim() || 'Unknown trainer',
      distanceKm: Number.isFinite(distance) ? distance : null,
      mode,
      row,
      details: detailsForListing(listing),
      relatedRows: relatedRows.sort((left, right) => (
        Number(right.match) - Number(left.match)
        || left.pokedexNumber - right.pokedexNumber
        || left.name.localeCompare(right.name)
      )),
      hasMutualMatch: relatedRows.some((related) => related.match),
      mapCoordinate: mapLocation.coordinate,
      mapCoordinateIsApproximate: mapLocation.approximate,
    }];
  });

  return mapped.sort((left, right) => (
    Number(right.hasMutualMatch) - Number(left.hasMutualMatch)
    || (left.distanceKm ?? Number.POSITIVE_INFINITY)
      - (right.distanceKm ?? Number.POSITIVE_INFINITY)
    || left.username.localeCompare(right.username)
  ));
};
