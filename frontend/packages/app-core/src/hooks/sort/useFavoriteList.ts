import { useMemo } from 'react';
import {
  sortPokemonFavoriteTagItems,
  type PokemonFavoriteTagSortSource,
} from '@pokemongonexus/shared-domain/collection-sort';

const useFavoriteList = <T extends PokemonFavoriteTagSortSource>(
  displayedPokemons: T[] | undefined | null,
): T[] => useMemo(
  () => Array.isArray(displayedPokemons)
    ? sortPokemonFavoriteTagItems(displayedPokemons, (item) => item)
    : [],
  [displayedPokemons],
);

export default useFavoriteList;
