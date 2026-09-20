import { persistNativeFavoriteMutation } from '../../../../src/features/collection/nativeFavoriteMutation';
import type { NativeCollectionSyncUpdate } from '../../../../src/services/collectionSyncApi';

const instance = (): NativeCollectionSyncUpdate => ({
  instance_id: 'instance-1', variant_id: '1', pokemon_id: 1,
  nickname: null, cp: null, level: null, attack_iv: null, defense_iv: null, stamina_iv: null,
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
  last_update: 100,
});

const store = () => ({
  queue: jest.fn().mockResolvedValue(undefined),
  list: jest.fn().mockResolvedValue([]),
  markAttemptFailed: jest.fn().mockResolvedValue(undefined),
  markAcknowledged: jest.fn().mockResolvedValue(undefined),
  removeAcknowledged: jest.fn().mockResolvedValue(undefined),
});

describe('native Favorite mutation', () => {
  it('persists before sending and reports Receiver acknowledgement as reconciliation pending', async () => {
    const outbox = store();
    outbox.list.mockResolvedValueOnce([{
      userId: 'user-1',
      batch: { sync_batch_id: 'batch-1', location: null, pokemonUpdates: [{
        ...instance(), favorite: true, last_update: 200,
      }] },
      state: 'pending', createdAt: 200, updatedAt: 200,
      attemptCount: 0, lastError: null, acknowledgedAt: null,
    }]);
    const receiverClient = { post: jest.fn().mockResolvedValue({ message: 'accepted' }) };
    const onQueued = jest.fn();

    const result = await persistNativeFavoriteMutation({
      userId: 'user-1',
      snapshot: { instances: { 'instance-1': instance() }, catalog: [] },
      requestedInstanceId: 'instance-1', favorite: true, outbox, receiverClient,
      syncBatchId: 'batch-1', now: 200, onQueued,
    });

    expect(outbox.queue.mock.invocationCallOrder[0]).toBeLessThan(
      receiverClient.post.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
    expect(onQueued.mock.invocationCallOrder[0]).toBeLessThan(
      receiverClient.post.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
    expect(result.syncState).toBe('acknowledged');
    expect(result.message).toContain('server reconciliation');
  });

  it('keeps an offline edit pending instead of falsely reporting success', async () => {
    const outbox = store();
    outbox.list.mockResolvedValueOnce([{
      userId: 'user-1',
      batch: { sync_batch_id: 'batch-1', location: null, pokemonUpdates: [{
        ...instance(), favorite: true, last_update: 200,
      }] },
      state: 'pending', createdAt: 200, updatedAt: 200,
      attemptCount: 0, lastError: null, acknowledgedAt: null,
    }]);
    const receiverClient = { post: jest.fn().mockRejectedValue(new Error('offline')) };

    const result = await persistNativeFavoriteMutation({
      userId: 'user-1',
      snapshot: { instances: { 'instance-1': instance() }, catalog: [] },
      requestedInstanceId: 'instance-1', favorite: true, outbox, receiverClient,
      syncBatchId: 'batch-1', now: 200,
    });

    expect(result.syncState).toBe('pending');
    expect(result.message).toContain('Saved on this device');
    expect(outbox.markAttemptFailed).toHaveBeenCalledWith(
      'user-1', 'batch-1', 'offline',
    );
  });
});
