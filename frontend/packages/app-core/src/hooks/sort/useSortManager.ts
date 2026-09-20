// useSortManager.ts

import useRecentPokemons from './useRecentPokemons';
import useNumberPokemons from './useNumberPokemons';
import useHPPokemons from './useHPPokemons';
import useNamePokemons from './useNamePokemons';
import useCPPokemons from './useCPPokemons';
import useFavoritePokemons from './useFavoritePokemons';
import type { PokemonVariant } from '@/types/pokemonVariants';
import type { SortMode, SortType } from '@/types/sort';

const useSortManager = (
  displayedPokemons: PokemonVariant[],
  sortType: SortType,
  sortMode: SortMode
): PokemonVariant[] => {
  // Hooks must run in a stable order; compute each candidate once and select below.
  const recentSorted = useRecentPokemons(
    displayedPokemons,
    sortMode,
    sortType === 'releaseDate',
  );
  const numberSorted = useNumberPokemons(displayedPokemons, sortMode);
  const hpSorted = useHPPokemons(displayedPokemons, sortMode);
  const nameSorted = useNamePokemons(displayedPokemons, sortMode);
  const cpSorted = useCPPokemons(displayedPokemons, sortMode);
  const favoriteSorted = useFavoritePokemons(displayedPokemons, sortMode);

  switch (sortType) {
    case 'releaseDate':
      return recentSorted;
    case 'number':
      return numberSorted;
    case 'hp':
      return hpSorted;
    case 'name':
      return nameSorted;
    case 'combatPower':
      return cpSorted;
    case 'favorite':
      return favoriteSorted;
    default:
      return displayedPokemons;
  }
};

export default useSortManager;
