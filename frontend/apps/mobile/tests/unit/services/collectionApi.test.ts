import { pokemonContract } from '@pokemongonexus/shared-contracts/pokemon';
import { usersContract } from '@pokemongonexus/shared-contracts/users';
import {
  getCachedNativeCollectionSnapshot,
  getNativeCollectionSnapshot,
  getNativePokemonMoves,
  getReconciledNativeCollectionSnapshot,
} from '../../../src/services/collectionApi';

const flushDeferredPersistence = () => new Promise<void>((resolve) => {
  setTimeout(resolve, 0);
});

describe('getNativeCollectionSnapshot', () => {
  it('projects retained edits into a durable snapshot without acknowledging them', async () => {
    const cachedInstance = { instance_id: 'instance-1', pokemon_id: 1, last_update: 100 };
    const retainedInstance = {
      ...cachedInstance,
      cp: 777,
      is_caught: true,
      is_for_trade: false,
      is_wanted: false,
      last_update: 200,
    };
    const outbox = {
      list: jest.fn().mockResolvedValue([{
        userId: 'user-1',
        batch: { sync_batch_id: 'batch-1', location: null, pokemonUpdates: [retainedInstance] },
        state: 'pending' as const,
        createdAt: 100,
        updatedAt: 100,
        attemptCount: 0,
        lastError: null,
        acknowledgedAt: null,
      }]),
    };
    const cache = {
      read: jest.fn().mockResolvedValue({
        snapshot: { instances: { 'instance-1': cachedInstance }, catalog: [] },
        savedAt: 1234,
      }),
    };

    await expect(getCachedNativeCollectionSnapshot(
      outbox,
      cache,
      'user-1',
    )).resolves.toEqual(expect.objectContaining({
      cachedAt: 1234,
      source: 'cache',
      instances: expect.objectContaining({
        'instance-1': expect.objectContaining({
          cp: 777,
        }),
      }),
    }));
    expect(cache.read).toHaveBeenCalledWith('user-1');
    expect(outbox.list).toHaveBeenCalledWith('user-1');
  });

  it('does no outbox work when there is no durable snapshot to paint', async () => {
    const outbox = { list: jest.fn() };
    const cache = { read: jest.fn().mockResolvedValue(null) };

    await expect(getCachedNativeCollectionSnapshot(
      outbox,
      cache,
      'user-1',
    )).resolves.toBeNull();
    expect(outbox.list).not.toHaveBeenCalled();
  });

  it('loads canonical instances and the image-bearing catalog together', async () => {
    const instances = { 'instance-1': { pokemon_id: 1 } };
    const catalog = [{ pokemon_id: 1, name: 'Bulbasaur' }];
    const tags = { tags: [], orders: { caught: [], wanted: [] } };
    const usersClient = {
      get: jest.fn()
        .mockResolvedValueOnce({
        checkpoint: 'checkpoint-1',
        not_modified: false,
        instances,
        })
        .mockResolvedValueOnce(tags),
    };
    const pokemonClient = { get: jest.fn().mockResolvedValue(catalog) };

    await expect(
      getNativeCollectionSnapshot(usersClient, pokemonClient),
    ).resolves.toEqual({
      instances: {
        'instance-1': expect.objectContaining({
          pokemon_id: 1,
          caught_tags: [],
          trade_tags: [],
          wanted_tags: [],
        }),
      },
      catalog,
      tags,
    });
    expect(usersClient.get).toHaveBeenCalledWith(usersContract.endpoints.instanceSync);
    expect(usersClient.get).toHaveBeenCalledWith(usersContract.endpoints.tags);
    expect(pokemonClient.get).toHaveBeenCalledWith(pokemonContract.endpoints.catalog);
  });

  it('loads move metadata lazily for native instance details', async () => {
    const moves = [{ pokemon_id: 6, moves: [] }];
    const pokemonClient = { get: jest.fn().mockResolvedValue(moves) };

    await expect(getNativePokemonMoves(pokemonClient)).resolves.toEqual(moves);
    expect(pokemonClient.get).toHaveBeenCalledWith(pokemonContract.endpoints.moves);
  });

  it('keeps the catalog usable when optional custom tags cannot load', async () => {
    const instances = { 'instance-1': { pokemon_id: 1 } };
    const catalog = [{ pokemon_id: 1, name: 'Bulbasaur' }];
    const usersClient = {
      get: jest.fn()
        .mockResolvedValueOnce({ instances })
        .mockRejectedValueOnce(new Error('tag service unavailable')),
    };
    const pokemonClient = { get: jest.fn().mockResolvedValue(catalog) };

    await expect(getNativeCollectionSnapshot(usersClient, pokemonClient)).resolves.toEqual({
      instances: {
        'instance-1': expect.objectContaining({
          pokemon_id: 1,
          caught_tags: [],
          trade_tags: [],
          wanted_tags: [],
        }),
      },
      catalog,
      tags: {
        tags: [],
        orders: {
          caught: ['system:caught', 'system:favorites', 'system:trade'],
          wanted: ['system:wanted', 'system:most-wanted'],
        },
      },
      tagLoadWarning: expect.stringContaining('tag service unavailable'),
    });
  });

  it('normalizes malformed custom tag data instead of crashing tag views', async () => {
    const usersClient = {
      get: jest.fn()
        .mockResolvedValueOnce({ instances: {} })
        .mockResolvedValueOnce({ tags: null, orders: { caught: 'bad', wanted: [42] } }),
    };
    const pokemonClient = { get: jest.fn().mockResolvedValue([]) };

    await expect(getNativeCollectionSnapshot(usersClient, pokemonClient)).resolves.toEqual({
      instances: {},
      catalog: [],
      tags: {
        tags: [],
        orders: {
          caught: ['system:caught', 'system:favorites', 'system:trade'],
          wanted: [],
        },
      },
    });
  });

  it('reconciles acknowledged batches and projects retained local snapshots', async () => {
    const canonicalInstance = { instance_id: 'instance-1', pokemon_id: 1, last_update: 100 };
    const localInstance = {
      ...canonicalInstance,
      variant_id: '1', nickname: null, cp: 501, level: null,
      attack_iv: null, defense_iv: null, stamina_iv: null,
      shiny: false, costume_id: null, lucky: false, shadow: false, purified: false,
      fast_move_id: null, charged_move1_id: null, charged_move2_id: null,
      weight: null, height: null, gender: null, mega: false, mega_form: null,
      is_mega: false, dynamax: false, gigantamax: false, crown: false,
      max_attack: null, max_guard: null, max_spirit: null, is_fused: false,
      fusion: null, fusion_form: null, fused_with: null, is_traded: false,
      traded_date: null, original_trainer_id: null, original_trainer_name: null,
      is_caught: true, is_for_trade: false, is_wanted: false, most_wanted: false,
      caught_tags: [], trade_tags: [], wanted_tags: [], not_trade_list: null,
      not_wanted_list: null, trade_filters: null, wanted_filters: null,
      mirror: false, pref_lucky: false, friendship_level: null, registered: true,
      favorite: false, disabled: false, pokeball: null, location_card: null,
      location_caught: null, date_caught: null, date_added: '2026-08-23T00:00:00Z',
      last_update: 200,
    };
    const retained = [{
      userId: 'user-1',
      batch: { sync_batch_id: 'batch-1', location: null, pokemonUpdates: [localInstance] },
      state: 'pending' as const,
      createdAt: 100, updatedAt: 100, attemptCount: 0,
      lastError: null, acknowledgedAt: null,
    }];
    const tags = { tags: [], orders: { caught: [], wanted: [] } };
    const usersClient = { get: jest.fn()
      .mockResolvedValueOnce({ instances: { 'instance-1': canonicalInstance } })
      .mockResolvedValueOnce(tags) };
    const pokemonClient = { get: jest.fn().mockResolvedValue([]) };
    const outbox = {
      list: jest.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(retained),
      removeAcknowledged: jest.fn().mockResolvedValue(undefined),
    };
    const cache = {
      read: jest.fn().mockResolvedValue(null),
      write: jest.fn().mockResolvedValue(undefined),
    };

    const snapshot = await getReconciledNativeCollectionSnapshot(
      usersClient, pokemonClient, outbox, cache, 'user-1',
    );
    await flushDeferredPersistence();
    expect(snapshot.instances['instance-1']?.cp).toBe(501);
    expect(snapshot).toEqual(expect.objectContaining({ source: 'network', cachedAt: null }));
    expect(cache.write).toHaveBeenCalledWith('user-1', {
      instances: {
        'instance-1': expect.objectContaining({
          ...canonicalInstance,
          caught_tags: [],
          trade_tags: [],
          wanted_tags: [],
        }),
      },
      catalog: [],
      tags,
    });
    expect(outbox.list).toHaveBeenNthCalledWith(1, 'user-1', 'acknowledged');
    expect(outbox.list).toHaveBeenNthCalledWith(2, 'user-1');
  });

  it('does not downgrade the whole collection to offline when only tags fail', async () => {
    const usersClient = { get: jest.fn()
      .mockResolvedValueOnce({ instances: {} })
      .mockRejectedValueOnce(new Error('tags unavailable')) };
    const pokemonClient = { get: jest.fn().mockResolvedValue([]) };
    const outbox = {
      list: jest.fn().mockResolvedValue([]),
      removeAcknowledged: jest.fn().mockResolvedValue(undefined),
    };
    const cache = {
      read: jest.fn().mockResolvedValue(null),
      write: jest.fn().mockResolvedValue(undefined),
    };

    const snapshot = await getReconciledNativeCollectionSnapshot(
      usersClient, pokemonClient, outbox, cache, 'user-1',
    );
    await flushDeferredPersistence();

    expect(snapshot).toEqual(expect.objectContaining({
      source: 'network',
      instances: {},
      catalog: [],
      tagLoadWarning: expect.stringContaining('tags unavailable'),
    }));
    expect(snapshot.tags?.orders.caught).toContain('system:caught');
    expect(cache.write).toHaveBeenCalledWith('user-1', expect.objectContaining({
      instances: {},
      catalog: [],
      tags: expect.objectContaining({ tags: [] }),
    }));
  });

  it('falls back to a user-scoped cached snapshot and still projects retained edits', async () => {
    const cachedInstance = { instance_id: 'instance-1', pokemon_id: 1, last_update: 100 };
    const retainedInstance = {
      ...cachedInstance,
      cp: 999,
      is_caught: true,
      is_for_trade: false,
      is_wanted: false,
      last_update: 200,
    };
    const usersClient = { get: jest.fn().mockRejectedValue(new Error('offline')) };
    const pokemonClient = { get: jest.fn().mockRejectedValue(new Error('offline')) };
    const outbox = {
      list: jest.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{
          userId: 'user-1',
          batch: { sync_batch_id: 'batch-1', location: null, pokemonUpdates: [retainedInstance] },
          state: 'pending' as const,
          createdAt: 100, updatedAt: 100, attemptCount: 0,
          lastError: null, acknowledgedAt: null,
        }]),
      removeAcknowledged: jest.fn().mockResolvedValue(undefined),
    };
    const cache = {
      read: jest.fn().mockResolvedValue({
        snapshot: { instances: { 'instance-1': cachedInstance }, catalog: [] },
        savedAt: 1234,
      }),
      write: jest.fn(),
    };

    const snapshot = await getReconciledNativeCollectionSnapshot(
      usersClient, pokemonClient, outbox, cache, 'user-1',
    );

    expect(cache.read).toHaveBeenCalledWith('user-1');
    expect(snapshot.source).toBe('cache');
    expect(snapshot.cachedAt).toBe(1234);
    expect(snapshot.instances['instance-1']?.cp).toBe(999);
  });

  it('does not let a replaceable cache write block an online collection', async () => {
    const tags = { tags: [], orders: { caught: [], wanted: [] } };
    const usersClient = { get: jest.fn()
      .mockResolvedValueOnce({ instances: {} })
      .mockResolvedValueOnce(tags) };
    const pokemonClient = { get: jest.fn().mockResolvedValue([]) };
    const outbox = {
      list: jest.fn().mockResolvedValue([]),
      removeAcknowledged: jest.fn().mockResolvedValue(undefined),
    };
    const cache = {
      read: jest.fn(),
      write: jest.fn().mockRejectedValue(new Error('disk full')),
    };

    await expect(getReconciledNativeCollectionSnapshot(
      usersClient, pokemonClient, outbox, cache, 'user-1',
    )).resolves.toEqual({ instances: {}, catalog: [], tags, source: 'network', cachedAt: null });
  });

  it('paints the online collection before a slow replaceable cache write finishes', async () => {
    let finishWrite!: () => void;
    const write = new Promise<void>((resolve) => {
      finishWrite = resolve;
    });
    const tags = { tags: [], orders: { caught: [], wanted: [] } };
    const usersClient = { get: jest.fn()
      .mockResolvedValueOnce({ instances: {} })
      .mockResolvedValueOnce(tags) };
    const pokemonClient = { get: jest.fn().mockResolvedValue([]) };
    const outbox = {
      list: jest.fn().mockResolvedValue([]),
      removeAcknowledged: jest.fn().mockResolvedValue(undefined),
    };
    const cache = {
      read: jest.fn(),
      write: jest.fn().mockReturnValue(write),
    };

    await expect(getReconciledNativeCollectionSnapshot(
      usersClient, pokemonClient, outbox, cache, 'user-1',
    )).resolves.toEqual({
      instances: {},
      catalog: [],
      tags,
      source: 'network',
      cachedAt: null,
    });
    await flushDeferredPersistence();
    expect(cache.write).toHaveBeenCalledTimes(1);
    finishWrite();
    await write;
  });

  it('preserves the network failure when no cached copy exists', async () => {
    const networkError = new Error('network unavailable');
    const usersClient = { get: jest.fn().mockRejectedValue(networkError) };
    const pokemonClient = { get: jest.fn().mockRejectedValue(networkError) };
    const outbox = { list: jest.fn(), removeAcknowledged: jest.fn() };
    const cache = { read: jest.fn().mockResolvedValue(null), write: jest.fn() };

    await expect(getReconciledNativeCollectionSnapshot(
      usersClient, pokemonClient, outbox, cache, 'user-1',
    )).rejects.toBe(networkError);
  });
});
