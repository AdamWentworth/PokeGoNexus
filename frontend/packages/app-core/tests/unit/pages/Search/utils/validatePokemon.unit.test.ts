import { describe, expect, it } from 'vitest';

import validatePokemon from '@/pages/Search/utils/validatePokemon';

const pokemonData = [
  {
    name: 'Pikachu',
    form: 'Normal',
    shiny_available: 1,
    date_shadow_available: '2020-01-01',
    shadow_shiny_available: 1,
    costumes: [
      {
        name: 'party_hat',
        image_url_shiny: '/images/party_hat_shiny.png',
        shadow_costume: { image_url_shadow_costume: '/images/party_hat_shadow.png' },
      },
      {
        name: 'basic_hat',
      },
    ],
  },
  {
    name: 'Pikachu',
    form: 'Halloween',
    shiny_available: 1,
    date_shadow_available: '2020-01-01',
    shadow_shiny_available: 1,
    costumes: [],
  },
];

describe('validatePokemon', () => {
  it('rejects shadow selections for dynamax/gigantamax', () => {
    const result = validatePokemon(
      pokemonData as any,
      'Pikachu',
      false,
      true,
      null,
      'Normal',
      true,
      false,
    );
    expect(result.error).toBe('Shadow not available for Dynamax/Gigantamax.');
  });

  it('rejects costume selections for dynamax/gigantamax', () => {
    const result = validatePokemon(
      pokemonData as any,
      'Pikachu',
      false,
      false,
      'party_hat',
      'Normal',
      true,
      false,
    );
    expect(result.error).toBe('Costumes not available for Dynamax/Gigantamax.');
  });

  it('returns no-match error for unknown pokemon/form pairs', () => {
    const result = validatePokemon(
      pokemonData as any,
      'MissingNo',
      false,
      false,
      null,
      'Normal',
      false,
      false,
    );
    expect(result.error).toBe('No match found for Pokémon "MissingNo" with form "Normal".');
    expect(result.availableCostumes).toEqual([]);
    expect(result.availableForms).toEqual([]);
  });

  it('returns forms and costumes when no costume is selected', () => {
    const result = validatePokemon(
      pokemonData as any,
      'Pikachu',
      false,
      false,
      '',
      'Normal',
      false,
      false,
    );
    expect(result.error).toBeNull();
    expect(result.availableForms).toEqual(['Normal', 'Halloween']);
    expect(result.availableCostumes).toHaveLength(2);
  });

  it('returns not-found error when selected costume is missing', () => {
    const result = validatePokemon(
      pokemonData as any,
      'Pikachu',
      false,
      false,
      'ghost_hat',
      'Normal',
      false,
      false,
    );
    expect(result.error).toBe('Costume "ghost_hat" not found.');
  });

  it('rejects shiny costume requests when shiny image is unavailable', () => {
    const result = validatePokemon(
      pokemonData as any,
      'Pikachu',
      true,
      false,
      'basic_hat',
      'Normal',
      false,
      false,
    );
    expect(result.error).toBe('No shiny variant available for the costume "basic_hat".');
  });

  it('accepts valid shiny shadow costume selections', () => {
    const result = validatePokemon(
      pokemonData as any,
      'Pikachu',
      true,
      true,
      'party_hat',
      'Normal',
      false,
      false,
    );
    expect(result.error).toBeNull();
    expect(result.availableCostumes).toHaveLength(2);
  });
});
