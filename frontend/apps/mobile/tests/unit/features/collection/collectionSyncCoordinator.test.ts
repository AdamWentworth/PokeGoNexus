import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import {
  isNativeCollectionBatchCommitted,
  projectNativeCollectionOutbox,
  reconcileAcknowledgedNativeCollectionBatches,
  sendPendingNativeCollectionBatches,
} from '../../../../src/features/collection/collectionSyncCoordinator';
import type { NativeCollectionSyncUpdate } from '../../../../src/services/collectionSyncApi';
import type { NativeCollectionOutboxEntry } from '../../../../src/storage/nativeCollectionOutbox';

const update = (patch: Partial<PokemonInstance> = {}): NativeCollectionSyncUpdate => ({
  instance_id: 'instance-1', variant_id: '1', pokemon_id: 1,
  nickname: null, cp: 500, level: 20, attack_iv: null, defense_iv: null, stamina_iv: null,
  shiny: false, costume_id: null, lucky: false, shadow: false, purified: false,
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
  last_update: 200,
  ...patch,
});

const entry = (
  id: string,
  state: 'pending' | 'acknowledged' = 'pending',
  pokemonUpdate = update(),
): NativeCollectionOutboxEntry => ({
  userId: 'user-1',
  batch: { sync_batch_id: id, location: null, pokemonUpdates: [pokemonUpdate] },
  state,
  createdAt: 100,
  updatedAt: 100,
  attemptCount: 0,
  lastError: null,
  acknowledgedAt: state === 'acknowledged' ? 150 : null,
});

const outbox = (entries: NativeCollectionOutboxEntry[]) => ({
  list: jest.fn().mockResolvedValue(entries),
  markAttemptFailed: jest.fn().mockResolvedValue(undefined),
  markAcknowledged: jest.fn().mockResolvedValue(undefined),
  removeAcknowledged: jest.fn().mockResolvedValue(undefined),
});

describe('native collection sync coordinator', () => {
  it('sends pending batches in order and retains each as acknowledged', async () => {
    const store = outbox([entry('batch-1'), entry('batch-2')]);
    const receiverClient = {
      post: jest.fn().mockResolvedValue({ message: 'accepted' }),
    };

    await expect(sendPendingNativeCollectionBatches({
      userId: 'user-1', outbox: store, receiverClient,
    })).resolves.toEqual({
      acknowledgedBatchIds: ['batch-1', 'batch-2'],
      failedBatchId: null,
      error: null,
    });
    expect(receiverClient.post).toHaveBeenCalledTimes(2);
    expect(store.markAcknowledged.mock.calls).toEqual([
      ['user-1', 'batch-1'],
      ['user-1', 'batch-2'],
    ]);
    expect(store.removeAcknowledged).not.toHaveBeenCalled();
  });

  it('stops after the first failure so later device mutations cannot pass it', async () => {
    const store = outbox([entry('batch-1'), entry('batch-2'), entry('batch-3')]);
    const receiverClient = {
      post: jest.fn()
        .mockResolvedValueOnce({ message: 'accepted' })
        .mockRejectedValueOnce(new Error('Receiver unavailable')),
    };

    await expect(sendPendingNativeCollectionBatches({
      userId: 'user-1', outbox: store, receiverClient,
    })).resolves.toEqual({
      acknowledgedBatchIds: ['batch-1'],
      failedBatchId: 'batch-2',
      error: 'Receiver unavailable',
    });
    expect(receiverClient.post).toHaveBeenCalledTimes(2);
    expect(store.markAttemptFailed).toHaveBeenCalledWith(
      'user-1', 'batch-2', 'Receiver unavailable',
    );
  });

  it('recognizes canonical updates by shared instance identity and timestamp', () => {
    const acknowledged = entry('batch-1', 'acknowledged');
    expect(isNativeCollectionBatchCommitted(acknowledged, {
      legacy_key: update({ instance_id: 'instance-1', last_update: 200 }),
    })).toBe(true);
    expect(isNativeCollectionBatchCommitted(acknowledged, {
      legacy_key: update({ instance_id: 'instance-1', last_update: 199 }),
    })).toBe(false);
  });

  it('treats an absent canonical row as a committed deletion but not a committed update', () => {
    expect(isNativeCollectionBatchCommitted(
      entry('delete', 'acknowledged', update({
        is_caught: false, is_for_trade: false, is_wanted: false,
      })),
      {},
    )).toBe(true);
    expect(isNativeCollectionBatchCommitted(entry('update', 'acknowledged'), {})).toBe(false);
  });

  it('removes only acknowledged batches observed in the canonical snapshot', async () => {
    const committed = entry('batch-1', 'acknowledged');
    const waiting = entry('batch-2', 'acknowledged', update({
      instance_id: 'instance-2', last_update: 300,
    }));
    const store = outbox([committed, waiting]);

    await expect(reconcileAcknowledgedNativeCollectionBatches({
      userId: 'user-1',
      outbox: store,
      canonicalInstances: {
        'instance-1': update({ last_update: 200 }),
        'instance-2': update({ instance_id: 'instance-2', last_update: 299 }),
      },
    })).resolves.toEqual(['batch-1']);
    expect(store.removeAcknowledged).toHaveBeenCalledWith('user-1', ['batch-1']);
  });

  it('projects retained snapshots in device order without overriding newer canonical data', () => {
    const olderLocal = entry('batch-1', 'pending', update({ cp: 501, last_update: 201 }));
    const newerLocal = {
      ...entry('batch-2', 'acknowledged', update({ cp: 502, last_update: 202 })),
      createdAt: 101,
    };
    const result = projectNativeCollectionOutbox({
      'instance-1': update({ cp: 500, last_update: 200 }),
      'instance-newer': update({
        instance_id: 'instance-newer', cp: 900, last_update: 300,
      }),
    }, [newerLocal, olderLocal, entry('stale', 'pending', update({
      instance_id: 'instance-newer', cp: 100, last_update: 299,
    }))]);

    expect(result['instance-1']?.cp).toBe(502);
    expect(result['instance-newer']?.cp).toBe(900);
  });

  it('projects retained creations and deletions', () => {
    const result = projectNativeCollectionOutbox({
      deleted: update({ instance_id: 'deleted', last_update: 100 }),
    }, [
      entry('create', 'pending', update({ instance_id: 'created', last_update: 200 })),
      entry('delete', 'acknowledged', update({
        instance_id: 'deleted', is_caught: false, is_for_trade: false,
        is_wanted: false, last_update: 201,
      })),
    ]);

    expect(result.created?.instance_id).toBe('created');
    expect(result.deleted).toBeUndefined();
  });
});
