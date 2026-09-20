import type { SQLiteBindParams, SQLiteRunResult } from 'expo-sqlite';
import type {
  NativeCollectionSyncBatch,
  NativeCollectionSyncUpdate,
} from '../../../src/services/collectionSyncApi';
import { createNativeCollectionOutbox } from '../../../src/storage/nativeCollectionOutbox';

const update = (): NativeCollectionSyncUpdate => ({
  instance_id: 'instance-1', variant_id: '1-shiny', pokemon_id: 1,
  nickname: null, cp: 500, level: 20, attack_iv: 15, defense_iv: 15, stamina_iv: 15,
  shiny: true, costume_id: null, lucky: false, shadow: false, purified: false,
  fast_move_id: null, charged_move1_id: null, charged_move2_id: null,
  weight: null, height: null, gender: null,
  mega: false, mega_form: null, is_mega: false,
  dynamax: false, gigantamax: false, crown: false,
  max_attack: null, max_guard: null, max_spirit: null,
  is_fused: false, fusion: null, fusion_form: null, fused_with: null,
  is_traded: false, traded_date: null, original_trainer_id: null,
  original_trainer_name: null, is_caught: true, is_for_trade: false,
  is_wanted: false, most_wanted: false, caught_tags: [], trade_tags: [], wanted_tags: [],
  not_trade_list: null, not_wanted_list: null, trade_filters: null, wanted_filters: null,
  mirror: false, pref_lucky: false, friendship_level: null, registered: true,
  favorite: false, disabled: false, pokeball: null, location_card: null,
  location_caught: null, date_caught: null, date_added: '2026-08-23T00:00:00Z',
  last_update: 1_777_000_000_000,
});

const batch = (): NativeCollectionSyncBatch => ({
  sync_batch_id: 'batch-1',
  location: null,
  pokemonUpdates: [update()],
});

type Row = {
  user_id: string;
  sync_batch_id: string;
  payload_json: string;
  state: 'pending' | 'acknowledged';
  created_at: number;
  updated_at: number;
  attempt_count: number;
  last_error: string | null;
  acknowledged_at: number | null;
};

const result = { changes: 1, lastInsertRowId: 1 } as SQLiteRunResult;

describe('native collection outbox', () => {
  it('initializes once, queues an immutable user-scoped batch, and lists it', async () => {
    const rows: Row[] = [];
    const database = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn(async (sql: string, params: SQLiteBindParams) => {
        if (sql.includes('INSERT OR IGNORE')) {
          const values = params as (string | number)[];
          if (!rows.some((row) => row.user_id === values[0] && row.sync_batch_id === values[1])) {
            rows.push({
              user_id: String(values[0]), sync_batch_id: String(values[1]),
              payload_json: String(values[2]), state: 'pending',
              created_at: Number(values[3]), updated_at: Number(values[4]),
              attempt_count: 0, last_error: null, acknowledged_at: null,
            });
          }
        }
        return result;
      }),
      getFirstAsync: jest.fn(async () => rows[0]
        ? { payload_json: rows[0].payload_json }
        : null),
      getAllAsync: jest.fn(async () => rows),
    };
    const openDatabase = jest.fn().mockResolvedValue(database);
    const outbox = createNativeCollectionOutbox(openDatabase);

    await outbox.queue('user-1', batch(), 100);
    const entries = await outbox.list('user-1');

    expect(openDatabase).toHaveBeenCalledTimes(1);
    expect(database.execAsync).toHaveBeenCalledTimes(1);
    expect(entries).toEqual([expect.objectContaining({
      userId: 'user-1', state: 'pending', createdAt: 100,
      batch: expect.objectContaining({ sync_batch_id: 'batch-1' }),
    })]);
  });

  it('refuses to reuse a retained batch ID for different payload data', async () => {
    const stored = JSON.stringify(batch());
    const database = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn().mockResolvedValue(result),
      getFirstAsync: jest.fn().mockResolvedValue({ payload_json: stored }),
      getAllAsync: jest.fn().mockResolvedValue([]),
    };
    const outbox = createNativeCollectionOutbox(async () => database);
    const changed = batch();
    changed.pokemonUpdates[0] = { ...changed.pokemonUpdates[0], cp: 501 };

    await expect(outbox.queue('user-1', changed, 100)).rejects.toThrow(
      'was reused with different data',
    );
  });

  it('tracks failures and acknowledgements separately and only removes acknowledged rows', async () => {
    const database = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn().mockResolvedValue(result),
      getFirstAsync: jest.fn().mockResolvedValue(null),
      getAllAsync: jest.fn().mockResolvedValue([]),
    };
    const outbox = createNativeCollectionOutbox(async () => database);

    await outbox.markAttemptFailed('user-1', 'batch-1', 'network offline', 200);
    await outbox.markAcknowledged('user-1', 'batch-1', 300);
    await outbox.removeAcknowledged('user-1', ['batch-1']);

    expect(database.runAsync).toHaveBeenNthCalledWith(
      1, expect.stringContaining('attempt_count = attempt_count + 1'),
      ['network offline', 200, 'user-1', 'batch-1'],
    );
    expect(database.runAsync).toHaveBeenNthCalledWith(
      2, expect.stringContaining("state = 'acknowledged'"),
      [300, 300, 'user-1', 'batch-1'],
    );
    expect(database.runAsync).toHaveBeenNthCalledWith(
      3, expect.stringContaining("state = 'acknowledged'"),
      ['user-1', 'batch-1'],
    );
  });

  it('surfaces corrupted retained payloads instead of silently dropping edits', async () => {
    const database = {
      execAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn().mockResolvedValue(result),
      getFirstAsync: jest.fn().mockResolvedValue(null),
      getAllAsync: jest.fn().mockResolvedValue([{
        user_id: 'user-1', sync_batch_id: 'batch-bad', payload_json: '{', state: 'pending',
        created_at: 100, updated_at: 100, attempt_count: 0,
        last_error: null, acknowledged_at: null,
      }]),
    };
    const outbox = createNativeCollectionOutbox(async () => database);

    await expect(outbox.list('user-1')).rejects.toThrow('is not valid JSON');
  });
});
