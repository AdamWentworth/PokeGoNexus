import type {
  PokemonSearchQueryParams,
  SearchResultRow,
} from '@pokemongonexus/shared-contracts/search';
import { searchContract } from '@pokemongonexus/shared-contracts/search';
import type { NativeSearchApiClient } from './nativeApiClients';

type PokemonSearchClient = Pick<NativeSearchApiClient, 'get'>;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const isSearchResult = (value: unknown): value is SearchResultRow => {
  if (!isRecord(value)) return false;
  return typeof value.instance_id === 'string'
    && value.instance_id.trim().length > 0
    && Number.isFinite(Number(value.pokemon_id));
};

const normalizePayload = (payload: unknown): SearchResultRow[] => {
  if (Array.isArray(payload)) {
    if (payload.some((row) => !isSearchResult(row))) {
      throw new Error('The Pokémon search response contains an invalid listing.');
    }
    return payload as SearchResultRow[];
  }
  if (isRecord(payload) && typeof payload.message === 'string') return [];
  if (isRecord(payload)) {
    const rows = Object.values(payload);
    if (rows.some((row) => !isSearchResult(row))) {
      throw new Error('The Pokémon search response contains an invalid listing.');
    }
    return rows as SearchResultRow[];
  }
  throw new Error('The Pokémon search response is invalid.');
};

export const searchNativePokemon = async (
  searchClient: PokemonSearchClient,
  query: PokemonSearchQueryParams,
): Promise<SearchResultRow[]> => normalizePayload(
  await searchClient.get<unknown>(searchContract.endpoints.searchPokemon, {
    query,
    timeoutMs: 30_000,
  }),
);
