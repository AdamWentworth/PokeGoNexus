// useNamePokemons.ts

import { useMemo } from 'react';
import {
  projectPokemonCollectionSortSource,
  sortPokemonCollectionItems,
} from '@pokemongonexus/shared-domain/collection-sort';
import type { PokemonVariant } from '@/types/pokemonVariants';
import type { SortMode } from '@/types/sort'; // Updated import

const useNamePokemons = (
  displayedPokemons: PokemonVariant[],
  sortMode: SortMode
): PokemonVariant[] => {
  return useMemo(() => {
    return sortPokemonCollectionItems(
      displayedPokemons,
      'name',
      sortMode,
      projectPokemonCollectionSortSource,
    );
  }, [displayedPokemons, sortMode]);
};

export default useNamePokemons;
