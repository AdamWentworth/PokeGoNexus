// useNumberPokemons.ts

import { useMemo } from 'react';
import {
  projectPokemonCollectionSortSource,
  sortPokemonCollectionItems,
} from '@pokemongonexus/shared-domain/collection-sort';
import type { PokemonVariant } from '@/types/pokemonVariants';
import type { SortMode } from '@/types/sort'; // Updated import
import { createScopedLogger } from '@/utils/logger';

const log = createScopedLogger('useNumberPokemons');

const useNumberPokemons = (
  displayedPokemons: PokemonVariant[] | undefined,
  sortMode: SortMode
): PokemonVariant[] => {
  return useMemo(() => {
    if (!displayedPokemons || !Array.isArray(displayedPokemons)) {
      log.error('displayedPokemons is either undefined or not an array:', displayedPokemons);
      return [];
    }

    return sortPokemonCollectionItems(
      displayedPokemons,
      'number',
      sortMode,
      projectPokemonCollectionSortSource,
    );
  }, [displayedPokemons, sortMode]);
};

export default useNumberPokemons;
