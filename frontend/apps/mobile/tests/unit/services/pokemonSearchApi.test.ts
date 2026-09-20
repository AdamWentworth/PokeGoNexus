import { searchContract } from '@pokemongonexus/shared-contracts/search';
import type { PokemonSearchQueryParams } from '@pokemongonexus/shared-contracts/search';
import { searchNativePokemon } from '../../../src/services/pokemonSearchApi';

const query = {
  pokemon_id: 25,
  shiny: true,
  shadow: false,
  ownership: 'trade',
  range_km: 25,
  limit: 20,
  dynamax: false,
  gigantamax: false,
} as PokemonSearchQueryParams;

describe('searchNativePokemon', () => {
  it('uses bearer search API query semantics and normalizes object payloads', async () => {
    const client = { get: jest.fn().mockResolvedValue({
      'listing-1': { instance_id: 'listing-1', pokemon_id: 25, username: 'Misty' },
    }) };
    await expect(searchNativePokemon(client, query)).resolves.toEqual([
      { instance_id: 'listing-1', pokemon_id: 25, username: 'Misty' },
    ]);
    expect(client.get).toHaveBeenCalledWith(searchContract.endpoints.searchPokemon, {
      query,
      timeoutMs: 30_000,
    });
  });

  it('recognizes the service no-results envelope and rejects malformed listings', async () => {
    const client = { get: jest.fn().mockResolvedValue({ message: 'No Pokemon instances found' }) };
    await expect(searchNativePokemon(client, query)).resolves.toEqual([]);
    client.get.mockResolvedValueOnce({ bad: { pokemon_id: 25 } });
    await expect(searchNativePokemon(client, query)).rejects.toThrow('invalid listing');
  });
});
