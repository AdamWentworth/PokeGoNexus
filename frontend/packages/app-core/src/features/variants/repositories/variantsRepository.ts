// src/features/variants/repositories/variantsRepository.ts
import type { PokemonVariant } from '@/types/pokemonVariants';

import { getAllVariants } from '@/db/variantsDB';

import { loadVariants }   from '../utils/loadVariants';

export interface VariantsRepository {
  loadCache():  Promise<{ variants: PokemonVariant[] }>;
  fetchFresh(): Promise<{ variants: PokemonVariant[] }>;
}

export const variantsRepository: VariantsRepository = {
  async loadCache() {
    const variants = await getAllVariants<PokemonVariant>();
    return { variants };
  },

  async fetchFresh() {
    return loadVariants();
  },
};
