import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import useRecentPokemons from '@/hooks/sort/useRecentPokemons';
import type { PokemonVariant } from '@/types/pokemonVariants';

const variant = (
  overrides: Partial<PokemonVariant>,
): PokemonVariant => ({
  name: 'Pokémon',
  pokedex_number: 1,
  variant_id: '1',
  variantType: 'default',
  currentImage: undefined,
  species_name: 'Pokémon',
  costumes: [],
  ...overrides,
} as PokemonVariant);

const maxWithoutReleaseDate = {
  pokemon_id: 113,
  dynamax: true,
  gigantamax: false,
  dynamax_release_date: null,
  gigantamax_release_date: null,
};

describe('useRecentPokemons', () => {
  it('does not process release metadata while another sort strategy is active', () => {
    const pokemon = [
      variant({
        name: 'Shiny Dynamax Chansey',
        pokedex_number: 113,
        variant_id: '113_shiny_dynamax',
        variantType: 'shiny_dynamax',
        max: [maxWithoutReleaseDate],
      }),
    ];

    const { result } = renderHook(() =>
      useRecentPokemons(pokemon, 'ascending', false),
    );

    expect(result.current).toBe(pokemon);
  });

  it('uses stable catalog dates when Dynamax release metadata is absent', () => {
    const older = variant({
      name: 'Older shiny Dynamax',
      pokedex_number: 2,
      variant_id: '2_shiny_dynamax',
      variantType: 'shiny_dynamax',
      date_shiny_available: '2024-01-01',
      max: [maxWithoutReleaseDate],
    });
    const newer = variant({
      name: 'Newer shiny Dynamax',
      pokedex_number: 1,
      variant_id: '1_shiny_dynamax',
      variantType: 'shiny_dynamax',
      date_shiny_available: '2025-01-01',
      max: [maxWithoutReleaseDate],
    });

    const { result } = renderHook(() =>
      useRecentPokemons([newer, older], 'ascending'),
    );

    expect(result.current.map((pokemon) => pokemon.name)).toEqual([
      'Older shiny Dynamax',
      'Newer shiny Dynamax',
    ]);
  });
});
