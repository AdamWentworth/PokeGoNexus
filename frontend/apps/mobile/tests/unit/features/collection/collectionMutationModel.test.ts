import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import { TRADE_TO_FAVORITE_ERROR } from '@pokemongonexus/shared-domain/instances';
import { createNativeCollectionMutation } from '../../../../src/features/collection/collectionMutationModel';
import type { NativeCollectionSyncUpdate } from '../../../../src/services/collectionSyncApi';

const instance = (patch: Partial<PokemonInstance> = {}): NativeCollectionSyncUpdate => ({
  instance_id: 'instance-1', variant_id: '1', pokemon_id: 1,
  nickname: null, cp: 500, level: 20, attack_iv: null, defense_iv: null, stamina_iv: null,
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
  ...patch,
});

describe('native collection mutation model', () => {
  it('builds a monotonic full snapshot using shared instance identity', () => {
    const mutation = createNativeCollectionMutation({
      instances: { legacy_key: instance() },
      requestedInstanceId: 'instance-1',
      patch: { favorite: true },
      syncBatchId: 'batch-1',
      now: 199,
    });

    expect(mutation.collectionKey).toBe('legacy_key');
    expect(mutation.updated).toEqual(expect.objectContaining({
      instance_id: 'instance-1', favorite: true, last_update: 201,
    }));
    expect(mutation.batch.pokemonUpdates).toEqual([mutation.updated]);
  });

  it('blocks Favorite on a For Trade Pokémon using the shared domain rule', () => {
    expect(() => createNativeCollectionMutation({
      instances: { 'instance-1': instance({ is_for_trade: true }) },
      requestedInstanceId: 'instance-1',
      patch: { favorite: true },
      syncBatchId: 'batch-1',
    })).toThrow(TRADE_TO_FAVORITE_ERROR);
  });

  it('rejects missing instances and no-op changes before queueing', () => {
    expect(() => createNativeCollectionMutation({
      instances: {}, requestedInstanceId: 'missing', patch: { favorite: true },
      syncBatchId: 'batch-1',
    })).toThrow('no longer in your collection');
    expect(() => createNativeCollectionMutation({
      instances: { 'instance-1': instance() }, requestedInstanceId: 'instance-1',
      patch: { favorite: false }, syncBatchId: 'batch-1',
    })).toThrow('already has those details');
  });
});
