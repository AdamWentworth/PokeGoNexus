import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import { receiverContract } from '@pokemongonexus/shared-contracts/receiver';
import {
  createNativeCollectionSyncBatch,
  submitNativeCollectionSyncBatch,
  type NativeCollectionSyncUpdate,
} from '../../../src/services/collectionSyncApi';

const snapshot = (
  patch: Partial<PokemonInstance> = {},
): NativeCollectionSyncUpdate => ({
  instance_id: 'instance-1',
  variant_id: '6-shiny',
  pokemon_id: 6,
  nickname: null,
  cp: 2499,
  level: 40,
  attack_iv: 15,
  defense_iv: 14,
  stamina_iv: 13,
  shiny: true,
  costume_id: null,
  lucky: false,
  shadow: false,
  purified: false,
  fast_move_id: 101,
  charged_move1_id: 102,
  charged_move2_id: null,
  weight: null,
  height: null,
  gender: 'Male',
  mega: false,
  mega_form: null,
  is_mega: false,
  dynamax: false,
  gigantamax: false,
  crown: false,
  max_attack: null,
  max_guard: null,
  max_spirit: null,
  is_fused: false,
  fusion: null,
  fusion_form: null,
  fused_with: null,
  is_traded: false,
  traded_date: null,
  original_trainer_id: null,
  original_trainer_name: null,
  is_caught: true,
  is_for_trade: false,
  is_wanted: false,
  most_wanted: false,
  caught_tags: [],
  trade_tags: [],
  wanted_tags: [],
  not_trade_list: null,
  not_wanted_list: null,
  trade_filters: null,
  wanted_filters: null,
  mirror: false,
  pref_lucky: false,
  friendship_level: null,
  registered: true,
  favorite: false,
  disabled: false,
  pokeball: null,
  location_card: null,
  location_caught: null,
  date_caught: null,
  date_added: '2026-08-23T00:00:00Z',
  last_update: 1_777_000_000_000,
  ...patch,
});

describe('native collection sync API', () => {
  it('builds an idempotent full-snapshot Receiver batch', () => {
    const update = snapshot();
    const batch = createNativeCollectionSyncBatch({
      syncBatchId: 'device_batch-1',
      location: { latitude: 49.24, longitude: -123.01 },
      updates: [update],
    });

    expect(batch).toEqual({
      sync_batch_id: 'device_batch-1',
      location: { latitude: 49.24, longitude: -123.01 },
      pokemonUpdates: [update],
    });
    expect(batch.pokemonUpdates[0]).not.toBe(update);
  });

  it.each([
    ['missing instance identity', snapshot({ instance_id: ' ' })],
    ['missing ownership state', snapshot({ is_caught: undefined as never })],
    ['missing tracked variant', snapshot({ variant_id: '' })],
    ['missing timestamp', snapshot({ last_update: 0 })],
  ])('rejects %s before anything reaches Receiver', (_label, update) => {
    expect(() => createNativeCollectionSyncBatch({
      syncBatchId: 'batch-1',
      location: null,
      updates: [update],
    })).toThrow();
  });

  it('rejects a partial object that would otherwise clear Storage columns', () => {
    const { nickname: _nickname, ...partial } = snapshot();
    expect(() => createNativeCollectionSyncBatch({
      syncBatchId: 'batch-1',
      location: null,
      updates: [partial as NativeCollectionSyncUpdate],
    })).toThrow('partial snapshot missing nickname');
  });

  it('rejects invalid IDs, coordinates, and oversized batches', () => {
    expect(() => createNativeCollectionSyncBatch({
      syncBatchId: 'not a valid id',
      location: null,
      updates: [snapshot()],
    })).toThrow('batch ID is invalid');
    expect(() => createNativeCollectionSyncBatch({
      syncBatchId: 'batch-1',
      location: { latitude: 91, longitude: 0 },
      updates: [snapshot()],
    })).toThrow('Latitude');
    expect(() => createNativeCollectionSyncBatch({
      syncBatchId: 'batch-1',
      location: null,
      updates: Array.from({ length: 5001 }, () => snapshot()),
    })).toThrow('cannot exceed 5000');
  });

  it('submits the exact retained batch to the authenticated Receiver client', async () => {
    const batch = createNativeCollectionSyncBatch({
      syncBatchId: 'batch-1',
      location: null,
      updates: [snapshot()],
    });
    const receiverClient = {
      post: jest.fn().mockResolvedValue({ message: 'Batched updates successfully processed' }),
    };

    await expect(submitNativeCollectionSyncBatch(receiverClient, batch)).resolves.toEqual({
      message: 'Batched updates successfully processed',
    });
    expect(receiverClient.post).toHaveBeenCalledWith(
      receiverContract.endpoints.batchedUpdates,
      batch,
    );
  });
});
