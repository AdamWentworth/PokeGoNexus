import { ApiClientError } from '@pokemongonexus/shared-api-client';
import { pokemonContract } from '@pokemongonexus/shared-contracts/pokemon';
import { usersContract } from '@pokemongonexus/shared-contracts/users';
import { getNativeForeignCollection } from '../../../src/services/foreignCollectionApi';

describe('getNativeForeignCollection', () => {
  it('loads and normalizes a canonical foreign collection without an owned cache port', async () => {
    const usersClient = {
      get: jest.fn().mockResolvedValue({
        username: 'OtherTrainer',
        instances: {
          'foreign-1': {
            instance_id: 'foreign-1',
            pokemon_id: 6,
            is_caught: true,
            is_for_trade: true,
          },
        },
      }),
    };
    const catalog = [{ pokemon_id: 6, name: 'Charizard' }];
    const pokemonClient = { get: jest.fn().mockResolvedValue(catalog) };

    await expect(getNativeForeignCollection(
      usersClient,
      pokemonClient,
      '  OTHERTRAINER  ',
    )).resolves.toEqual({
      type: 'success',
      username: 'OtherTrainer',
      instances: {
        'foreign-1': expect.objectContaining({
          instance_id: 'foreign-1',
          pokemon_id: 6,
          caught_tags: [],
          trade_tags: [],
          wanted_tags: [],
        }),
      },
      catalog,
    });
    expect(usersClient.get).toHaveBeenCalledWith(
      usersContract.endpoints.instancesByUsername('othertrainer'),
    );
    expect(pokemonClient.get).toHaveBeenCalledWith(pokemonContract.endpoints.catalog);
  });

  it('returns an explicit not-found outcome without loading the catalog', async () => {
    const usersClient = {
      get: jest.fn()
        .mockRejectedValueOnce(new ApiClientError(404, 'User not found', null))
        .mockRejectedValueOnce(new ApiClientError(404, 'User not found', null)),
    };
    const pokemonClient = { get: jest.fn() };

    await expect(getNativeForeignCollection(
      usersClient,
      pokemonClient,
      'missing',
    )).resolves.toEqual({ type: 'not-found' });
    expect(pokemonClient.get).not.toHaveBeenCalled();
  });

  it('preserves the privacy message for a forbidden catalog', async () => {
    const usersClient = {
      get: jest.fn()
        .mockRejectedValueOnce(new ApiClientError(
          403,
          "This trainer's collection is private",
          null,
        ))
        .mockRejectedValueOnce(new ApiClientError(
          403,
          "This trainer's collection is private",
          null,
        )),
    };
    const pokemonClient = { get: jest.fn() };

    await expect(getNativeForeignCollection(
      usersClient,
      pokemonClient,
      'private',
    )).resolves.toEqual({
      type: 'forbidden',
      message: "This trainer's collection is private",
    });
    expect(pokemonClient.get).not.toHaveBeenCalled();
  });

  it('uses the canonical public snapshot fallback before declaring a trainer missing', async () => {
    const usersClient = {
      get: jest.fn()
        .mockRejectedValueOnce(new ApiClientError(404, 'Route not found', null))
        .mockResolvedValueOnce({
          user: { username: 'FallbackTrainer' },
          instances: {
            'foreign-2': {
              instance_id: 'foreign-2',
              pokemon_id: 25,
              is_wanted: true,
            },
          },
        }),
    };
    const catalog = [{ pokemon_id: 25, name: 'Pikachu' }];
    const pokemonClient = { get: jest.fn().mockResolvedValue(catalog) };

    await expect(getNativeForeignCollection(
      usersClient,
      pokemonClient,
      'FallbackTrainer',
    )).resolves.toEqual(expect.objectContaining({
      type: 'success',
      username: 'FallbackTrainer',
      instances: {
        'foreign-2': expect.objectContaining({ instance_id: 'foreign-2' }),
      },
    }));
    expect(usersClient.get).toHaveBeenNthCalledWith(
      1,
      usersContract.endpoints.instancesByUsername('fallbacktrainer'),
    );
    expect(usersClient.get).toHaveBeenNthCalledWith(
      2,
      usersContract.endpoints.publicUserByUsername('fallbacktrainer'),
    );
  });

  it('rejects malformed instance envelopes instead of mixing them into the grid', async () => {
    const usersClient = {
      get: jest.fn().mockResolvedValue({ username: 'broken', instances: [] }),
    };
    const pokemonClient = { get: jest.fn() };

    await expect(getNativeForeignCollection(
      usersClient,
      pokemonClient,
      'broken',
    )).rejects.toThrow('invalid Pokémon data');
    expect(pokemonClient.get).not.toHaveBeenCalled();
  });

  it('does not issue a request for an empty trainer name', async () => {
    const usersClient = { get: jest.fn() };
    const pokemonClient = { get: jest.fn() };

    await expect(getNativeForeignCollection(
      usersClient,
      pokemonClient,
      '   ',
    )).resolves.toEqual({ type: 'not-found' });
    expect(usersClient.get).not.toHaveBeenCalled();
    expect(pokemonClient.get).not.toHaveBeenCalled();
  });
});
