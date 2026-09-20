import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { searchNativeTrainers } from '../../services/trainerSearchApi';
import { searchNativePokemon } from '../../services/pokemonSearchApi';
import { useNativeApiClients } from '../../services/useNativeApiClients';
import type { PokemonSearchQueryParams } from '@pokemongonexus/shared-contracts/search';

export const nativeSearchQueryKeys = {
  root: ['native', 'search'] as const,
  trainers: (query: string) => [
    ...nativeSearchQueryKeys.root,
    'trainers',
    query.trim().toLocaleLowerCase(),
  ] as const,
  pokemon: (query: PokemonSearchQueryParams) => [
    ...nativeSearchQueryKeys.root,
    'pokemon',
    query,
  ] as const,
};

export const useNativePokemonSearchQuery = (
  query: PokemonSearchQueryParams | null,
) => {
  const clients = useNativeApiClients();
  return useQuery({
    queryKey: nativeSearchQueryKeys.pokemon(query ?? {} as PokemonSearchQueryParams),
    queryFn: () => searchNativePokemon(clients.search, query as PokemonSearchQueryParams),
    enabled: Boolean(query),
    placeholderData: keepPreviousData,
    staleTime: 2 * 60_000,
  });
};

export const useNativeTrainerSearchQuery = (
  query: string,
  enabled: boolean,
) => {
  const clients = useNativeApiClients();
  const normalized = query.trim();
  return useQuery({
    queryKey: nativeSearchQueryKeys.trainers(normalized),
    queryFn: () => searchNativeTrainers(clients.users, normalized),
    enabled: enabled && normalized.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
};
