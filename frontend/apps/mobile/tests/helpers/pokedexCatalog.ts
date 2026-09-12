import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { BasePokemon } from '@pokemongonexus/shared-contracts/pokemon';

// Use the same catalog as Vite so real form IDs and release dates exercise the adapter.
export const pokedexCatalog = JSON.parse(readFileSync(resolve(
  __dirname, '../../../../packages/app-core/tests/__helpers__/fixtures/pokemons.json',
), 'utf8')) as BasePokemon[];
