import { useQuery } from '@tanstack/react-query';
import {
  getNativeCommunityRankings,
  getNativeMaxData,
  getNativeMovesData,
  getNativePokedexSpecies,
  getNativePvpData,
  getNativeRaidData,
  getNativeToolCatalog,
} from '../../services/nativePokemonToolsApi';
import { useNativeApiClients } from '../../services/useNativeApiClients';

export const nativeToolQueryKeys = {
  catalog: ['native', 'tools', 'catalog'] as const,
  raid: ['native', 'tools', 'raid'] as const,
  max: ['native', 'tools', 'max'] as const,
  moves: ['native', 'tools', 'moves'] as const,
  pokedex: ['native', 'tools', 'pokedex'] as const,
  pvp: ['native', 'tools', 'pvp'] as const,
  rankings: ['native', 'tools', 'rankings'] as const,
};

export const useNativeToolCatalogQuery = (enabled = true) => {
  const { pokemon } = useNativeApiClients();
  return useQuery({
    queryKey: nativeToolQueryKeys.catalog,
    queryFn: () => getNativeToolCatalog(pokemon),
    enabled,
    staleTime: 24 * 60 * 60_000,
  });
};

export const useNativeRaidDataQuery = () => {
  const { pokemon } = useNativeApiClients();
  return useQuery({ queryKey: nativeToolQueryKeys.raid, queryFn: () => getNativeRaidData(pokemon), staleTime: 24 * 60 * 60_000 });
};

export const useNativeMaxDataQuery = () => {
  const { pokemon } = useNativeApiClients();
  return useQuery({ queryKey: nativeToolQueryKeys.max, queryFn: () => getNativeMaxData(pokemon), staleTime: 24 * 60 * 60_000 });
};

export const useNativeMovesDataQuery = (enabled = true) => {
  const { pokemon } = useNativeApiClients();
  return useQuery({
    queryKey: nativeToolQueryKeys.moves,
    queryFn: () => getNativeMovesData(pokemon),
    enabled,
    staleTime: 24 * 60 * 60_000,
  });
};

export const useNativePokedexSpeciesQuery = () => {
  const { pokemon } = useNativeApiClients();
  return useQuery({ queryKey: nativeToolQueryKeys.pokedex, queryFn: () => getNativePokedexSpecies(pokemon), staleTime: 24 * 60 * 60_000 });
};

export const useNativePvpDataQuery = () => {
  const { pokemon } = useNativeApiClients();
  return useQuery({ queryKey: nativeToolQueryKeys.pvp, queryFn: () => getNativePvpData(pokemon), staleTime: 24 * 60 * 60_000 });
};

export const useNativeCommunityRankingsQuery = () => {
  const { search } = useNativeApiClients();
  return useQuery({ queryKey: nativeToolQueryKeys.rankings, queryFn: () => getNativeCommunityRankings(search), staleTime: 5 * 60_000 });
};
