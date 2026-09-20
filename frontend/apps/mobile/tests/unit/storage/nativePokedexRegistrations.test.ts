import type { SQLiteRunResult } from 'expo-sqlite';
import { createNativePokedexRegistrationStore } from '../../../src/storage/nativePokedexRegistrations';

const result = { changes: 1, lastInsertRowId: 1 } as SQLiteRunResult;

describe('native Pokédex registrations', () => {
  it('keeps manual registrations user-scoped and round-trips facets', async () => {
    const database = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      getAllAsync: jest.fn().mockResolvedValue([{
        registration_id: '0001-shiny|lucky:true',
        entry_id: '0001-shiny',
        facets_json: '{"lucky":true}',
      }]),
      runAsync: jest.fn().mockResolvedValue(result),
    };
    const store = createNativePokedexRegistrationStore(async () => database);
    const registration = {
      registrationId: '0001-shiny|lucky:true',
      entryId: '0001-shiny',
      facets: { lucky: true as const },
    };

    await store.register('user-1', [registration]);
    await expect(store.read('user-1')).resolves.toEqual([registration]);
    await store.unregister('user-1', [registration.registrationId]);

    expect(database.runAsync).toHaveBeenCalledTimes(2);
    expect(database.runAsync.mock.calls[0][1][0]).toBe('user-1');
    expect(database.runAsync.mock.calls[1][1]).toEqual(['user-1', registration.registrationId]);
    expect(database.execAsync).toHaveBeenCalledTimes(1);
  });

  it('rejects an empty identity before reading another account registration set', async () => {
    const database = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      getAllAsync: jest.fn().mockResolvedValue([]),
      runAsync: jest.fn().mockResolvedValue(result),
    };
    const store = createNativePokedexRegistrationStore(async () => database);
    await expect(store.read(' ')).rejects.toThrow('signed-in user');
  });
});
