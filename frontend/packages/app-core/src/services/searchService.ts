import {
  buildUrl,
  parseJsonSafe,
  requestWithPolicy,
  toHttpError,
} from './httpClient';
import type {
  PokemonCommunityRankingsPayload,
  SearchQueryParams,
  SearchResultRow,
} from '@shared-contracts/search';
import { searchContract } from '@shared-contracts/search';
export type { SearchQueryParams, SearchResultRow } from '@shared-contracts/search';

const SEARCH_API_URL = import.meta.env.VITE_SEARCH_API_URL;
export const SEARCH_REQUEST_TIMEOUT_MS = 30_000;

export async function searchPokemon(
  queryParams: SearchQueryParams,
): Promise<SearchResultRow[]> {
  const response = await requestWithPolicy(
    buildUrl(SEARCH_API_URL, searchContract.endpoints.searchPokemon, queryParams),
    {
      method: 'GET',
      timeoutMs: SEARCH_REQUEST_TIMEOUT_MS,
    },
  );

  const payload = await parseJsonSafe<
    SearchResultRow[] | Record<string, SearchResultRow>
  >(response);

  if (!response.ok) {
    throw toHttpError(response.status, payload);
  }

  if (!payload) {
    return [];
  }

  return Array.isArray(payload) ? payload : Object.values(payload);
}

export async function getPokemonCommunityRankings(
  limit = 10000,
): Promise<PokemonCommunityRankingsPayload> {
  const response = await requestWithPolicy(
    buildUrl(SEARCH_API_URL, searchContract.endpoints.rankings, { limit }),
    { method: 'GET', cache: 'no-cache' },
  );
  const payload = await parseJsonSafe<PokemonCommunityRankingsPayload>(response);
  if (!response.ok || !payload) {
    throw toHttpError(
      response.status,
      payload,
      'Community rankings are temporarily unavailable.',
    );
  }
  return payload;
}
