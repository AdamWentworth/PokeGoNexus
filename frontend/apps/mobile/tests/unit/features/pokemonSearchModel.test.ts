import type { BasePokemon } from '@pokemongonexus/shared-contracts/pokemon';
import {
  buildNativePokemonSearchResults,
  mapCoordinateForSearchListing,
} from '../../../src/features/search/pokemonSearchModel';

const pokemon = (pokemonId: number, name: string): BasePokemon => ({
  pokemon_id: pokemonId,
  pokedex_number: pokemonId,
  name,
  image_url: `https://assets/${name}.png`,
  image_url_shiny: `https://assets/shiny-${name}.png`,
  image_url_shadow: '',
  image_url_shiny_shadow: '',
  type_1_icon: '',
  type_2_icon: '',
  costumes: [],
  moves: [],
  fusion: [],
  backgrounds: [],
  megaEvolutions: [],
  evolves_from: [],
  max: [],
} as unknown as BasePokemon);

describe('native Pokémon search model', () => {
  it('maps exact coordinates and derives an explicitly approximate boundary center', () => {
    expect(mapCoordinateForSearchListing({ latitude: '49.2', longitude: '-123.1' }))
      .toEqual({ coordinate: [-123.1, 49.2], approximate: false });
    expect(mapCoordinateForSearchListing({
      boundary: 'POLYGON((-123.2 49.1,-122.8 49.1,-122.8 49.5,-123.2 49.5,-123.2 49.1))',
    })).toEqual({ coordinate: [-123, 49.3], approximate: true });
    expect(mapCoordinateForSearchListing({ boundary: 'invalid' }))
      .toEqual({ coordinate: null, approximate: false });
  });

  it('uses canonical collection artwork and ranks reciprocal matches before distance', () => {
    const results = buildNativePokemonSearchResults({
      assetOrigin: 'https://pokegonexus.com',
      catalog: [pokemon(25, 'Pikachu'), pokemon(6, 'Charizard')],
      mode: 'trade',
      results: [
        {
          instance_id: 'near', pokemon_id: 25, username: 'Near', distance: 1,
          shiny: true,
          wanted_list: {
            wanted: { instance_id: 'wanted', pokemon_id: 6, is_wanted: true, match: false },
          },
        },
        {
          instance_id: 'match', pokemon_id: 25, username: 'Match', distance: 8,
          shiny: true, gender: 'Female', weight: 6, height: 0.4,
          fast_move_id: 1, charged_move1_id: 2,
          pokemonInfo: { moves: [{ move_id: 1, name: 'Thunder Shock' }, { move_id: 2, name: 'Wild Charge' }] },
          wanted_list: {
            wanted2: { instance_id: 'wanted2', pokemon_id: 6, is_wanted: true, match: true },
          },
        },
      ],
    });
    expect(results.map((result) => result.id)).toEqual(['match', 'near']);
    expect(results[0]).toEqual(expect.objectContaining({
      hasMutualMatch: true,
      row: expect.objectContaining({ name: 'Shiny Pikachu', imageUri: 'https://assets/shiny-Pikachu.png' }),
      details: expect.objectContaining({
        gender: 'Female',
        weight: 6,
        height: 0.4,
        moves: ['Thunder Shock', 'Wild Charge'],
      }),
      relatedRows: [expect.objectContaining({ name: 'Charizard', match: true })],
    }));
  });

  it('preserves wanted and caught semantics without manufacturing linked rows', () => {
    const catalog = [pokemon(1, 'Bulbasaur')];
    expect(buildNativePokemonSearchResults({
      assetOrigin: 'https://pokegonexus.com', catalog, mode: 'caught',
      results: [{ instance_id: 'caught', pokemon_id: 1, username: 'Ash' }],
    })[0]).toEqual(expect.objectContaining({
      mode: 'caught', relatedRows: [], row: expect.objectContaining({ status: 'caught' }),
    }));
    expect(buildNativePokemonSearchResults({
      assetOrigin: 'https://pokegonexus.com', catalog, mode: 'wanted',
      results: [{ instance_id: 'wanted', pokemon_id: 1, username: 'Ash' }],
    })[0].row.status).toBe('wanted');
  });
});
