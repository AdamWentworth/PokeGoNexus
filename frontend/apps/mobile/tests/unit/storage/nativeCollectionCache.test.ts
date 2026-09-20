import type { SQLiteBindParams, SQLiteRunResult } from 'expo-sqlite';
import { createNativeCollectionCache } from '../../../src/storage/nativeCollectionCache';

const result = { changes: 1, lastInsertRowId: 1 } as SQLiteRunResult;

describe('native collection cache', () => {
  it('stores one replaceable snapshot per user and reads it back', async () => {
    const rows = new Map<string, { snapshot_json: string; saved_at: number }>();
    const database = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn(async (_sql: string, params: SQLiteBindParams) => {
        const values = params as (string | number)[];
        rows.set(String(values[0]), {
          snapshot_json: String(values[1]),
          saved_at: Number(values[2]),
        });
        return result;
      }),
      getFirstAsync: jest.fn(async (_sql: string, params: SQLiteBindParams) =>
        rows.get(String((params as string[])[0])) ?? null),
    };
    const openDatabase = jest.fn().mockResolvedValue(database);
    const cache = createNativeCollectionCache(openDatabase);
    const snapshot = { instances: {}, catalog: [] };

    await cache.write('user-1', snapshot, 1234);

    await expect(cache.read('user-1')).resolves.toEqual({
      snapshot: {
        ...snapshot,
        tags: {
          tags: [],
          orders: {
            caught: ['system:caught', 'system:favorites', 'system:trade'],
            wanted: ['system:wanted', 'system:most-wanted'],
          },
        },
      },
      savedAt: 1234,
    });
    await expect(cache.read('user-2')).resolves.toBeNull();
    expect(openDatabase).toHaveBeenCalledTimes(1);
    expect(database.execAsync).toHaveBeenCalledTimes(1);
  });

  it('surfaces a corrupt snapshot instead of treating it as valid offline data', async () => {
    const database = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn().mockResolvedValue(result),
      getFirstAsync: jest.fn().mockResolvedValue({ snapshot_json: '{', saved_at: 1234 }),
    };
    const cache = createNativeCollectionCache(async () => database);

    await expect(cache.read('user-1')).rejects.toThrow('not valid JSON');
  });

  it('repairs malformed optional tag metadata without discarding cached Pokémon', async () => {
    const database = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn().mockResolvedValue(result),
      getFirstAsync: jest.fn().mockResolvedValue({
        snapshot_json: JSON.stringify({
          instances: {},
          catalog: [],
          tags: { tags: null, orders: { caught: {}, wanted: ['system:wanted'] } },
        }),
        saved_at: 1234,
      }),
    };
    const cache = createNativeCollectionCache(async () => database);

    await expect(cache.read('user-1')).resolves.toEqual({
      snapshot: {
        instances: {},
        catalog: [],
        tags: {
          tags: [],
          orders: {
            caught: ['system:caught', 'system:favorites', 'system:trade'],
            wanted: ['system:wanted'],
          },
        },
      },
      savedAt: 1234,
    });
  });

  it('repairs legacy instance tag membership before cached collection rendering', async () => {
    const database = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn().mockResolvedValue(result),
      getFirstAsync: jest.fn().mockResolvedValue({
        snapshot_json: JSON.stringify({
          instances: {
            legacy: {
              instance_id: 'legacy',
              caught_tags: {},
              trade_tags: '["trade-tag"]',
              wanted_tags: null,
            },
          },
          catalog: [],
        }),
        saved_at: 1234,
      }),
    };
    const cache = createNativeCollectionCache(async () => database);

    const cached = await cache.read('user-1');
    expect(cached?.snapshot.instances.legacy).toEqual(expect.objectContaining({
      caught_tags: [],
      trade_tags: ['trade-tag'],
      wanted_tags: [],
    }));
  });

  it('rejects empty user identities so cached accounts cannot bleed together', async () => {
    const database = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn().mockResolvedValue(result),
      getFirstAsync: jest.fn().mockResolvedValue(null),
    };
    const cache = createNativeCollectionCache(async () => database);

    await expect(cache.write(' ', { instances: {}, catalog: [] })).rejects.toThrow(
      'signed-in user',
    );
  });
});
