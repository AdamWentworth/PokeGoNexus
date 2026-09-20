// useRecentPokemons.ts

import { useMemo } from 'react';
import {
  projectPokemonCollectionSortSource,
  sortPokemonCollectionItems,
} from '@pokemongonexus/shared-domain/collection-sort';
import type { PokemonVariant } from '@/types/pokemonVariants';
import type { SortMode } from '@/types/sort'; // Updated import

const useRecentPokemons = (
  displayedPokemons: PokemonVariant[],
  sortMode: SortMode,
  enabled = true,
): PokemonVariant[] => {
  return useMemo(() => {
    if (!enabled) return displayedPokemons;

    return sortPokemonCollectionItems(
      displayedPokemons,
      'releaseDate',
      sortMode,
      projectPokemonCollectionSortSource,
    );
  }, [displayedPokemons, enabled, sortMode]);
};

export default useRecentPokemons;
