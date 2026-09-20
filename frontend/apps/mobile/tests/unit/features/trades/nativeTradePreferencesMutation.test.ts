import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type { NativeCollectionSyncBatch } from '../../../../src/services/collectionSyncApi';
import {
  createNativeMirrorWantedInstance,
  persistNativeTradePreferenceMutation,
} from '../../../../src/features/trades/nativeTradePreferencesMutation';

const instance = (
  id: string,
  pokemonId: number,
  patch: Partial<PokemonInstance> = {},
): PokemonInstance => ({
  instance_id: id,
  variant_id: `${String(pokemonId).padStart(4, '0')}-shiny`,
  pokemon_id: pokemonId,
  nickname: 'Caught detail',
  cp: 1500,
  level: 40,
  attack_iv: 15,
  defense_iv: 14,
  stamina_iv: 13,
  shiny: true,
  costume_id: null,
  lucky: false,
  shadow: false,
  purified: false,
  fast_move_id: 1,
  charged_move1_id: 2,
  charged_move2_id: null,
  weight: 10,
  height: 1,
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
  not_trade_list: {},
  not_wanted_list: {},
  trade_filters: {},
  wanted_filters: {},
  wanted_size_preferences: null,
  mirror: false,
  pref_lucky: false,
  friendship_level: null,
  registered: true,
  favorite: false,
  disabled: false,
  pokeball: null,
  location_card: null,
  location_caught: 'Burnaby',
  date_caught: '2026-08-20',
  date_added: '2026-08-20T00:00:00.000Z',
  last_update: 100,
  gps: null,
  ...patch,
});

const makeOutbox = () => {
  let batch: NativeCollectionSyncBatch | null = null;
  return {
    queue: jest.fn(async (_userId: string, next: NativeCollectionSyncBatch) => {
      batch = next;
    }),
    list: jest.fn(async () => batch ? [{
      userId: 'user-1',
      batch,
      state: 'pending' as const,
      createdAt: 200,
      updatedAt: 200,
      attemptCount: 0,
      lastError: null,
      acknowledgedAt: null,
    }] : []),
    markAttemptFailed: jest.fn().mockResolvedValue(undefined),
    markAcknowledged: jest.fn().mockResolvedValue(undefined),
    removeAcknowledged: jest.fn().mockResolvedValue(undefined),
  };
};

describe('native trade preference persistence', () => {
  it('queues the selected and reciprocal exclusion changes in one Receiver batch', async () => {
    const outbox = makeOutbox();
    const receiverClient = { post: jest.fn().mockResolvedValue({ accepted: true }) };
    const onQueued = jest.fn();
    const result = await persistNativeTradePreferenceMutation({
      userId: 'user-1',
      snapshot: {
        catalog: [],
        instances: {
          offered: instance('offered-id', 25, {
            is_for_trade: true,
            not_wanted_list: { oldWanted: true },
          }),
          oldWanted: instance('old-wanted-id', 1, {
            is_caught: false,
            is_wanted: true,
            not_trade_list: { offered: true },
          }),
          newWanted: instance('new-wanted-id', 7, {
            is_caught: false,
            is_wanted: true,
          }),
        },
      },
      request: {
        filteredOutIds: [],
        filters: { shinyIconFilter: true },
        manuallyExcludedIds: ['newWanted'],
        mirror: false,
        mode: 'trade',
        selectedInstanceId: 'offered-id',
      },
      outbox,
      receiverClient,
      onQueued,
      syncBatchId: 'preference-batch',
      now: 200,
    });

    expect(outbox.queue).toHaveBeenCalledTimes(1);
    const queued = outbox.queue.mock.calls[0][1];
    expect(queued.pokemonUpdates).toHaveLength(3);
    expect(queued.pokemonUpdates.find((update) => update.instance_id === 'offered-id')).toEqual(
      expect.objectContaining({
        mirror: false,
        not_wanted_list: { newWanted: true },
        wanted_filters: { shinyIconFilter: true },
      }),
    );
    expect(queued.pokemonUpdates.find((update) => update.instance_id === 'old-wanted-id')?.not_trade_list).toEqual({});
    expect(queued.pokemonUpdates.find((update) => update.instance_id === 'new-wanted-id')?.not_trade_list).toEqual({ offered: true });
    expect(onQueued).toHaveBeenCalledWith(queued.pokemonUpdates);
    expect(result.syncState).toBe('acknowledged');
    expect(receiverClient.post).toHaveBeenCalledTimes(1);
  });

  it('creates a clean Wanted mirror snapshot when no matching entry exists', async () => {
    const source = instance('offered', 6, {
      gigantamax: true,
      is_for_trade: true,
      location_card: 'Background A',
    });
    const outbox = makeOutbox();
    const result = await persistNativeTradePreferenceMutation({
      userId: 'user-1',
      snapshot: { catalog: [], instances: { offered: source } },
      request: {
        filteredOutIds: [],
        filters: { shinyIconFilter: true },
        manuallyExcludedIds: [],
        mirror: true,
        mode: 'trade',
        selectedInstanceId: 'offered',
      },
      outbox,
      receiverClient: { post: jest.fn().mockResolvedValue({ accepted: true }) },
      mirrorInstanceId: 'new-mirror',
      syncBatchId: 'mirror-batch',
      now: 300,
    });

    expect(result.mirrorCreation).toEqual(expect.objectContaining({
      instance_id: 'new-mirror',
      variant_id: '0006-shiny',
      pokemon_id: 6,
      gigantamax: true,
      is_caught: false,
      is_for_trade: false,
      is_wanted: true,
      mirror: true,
      cp: null,
      nickname: null,
      location_card: null,
      last_update: 300,
    }));
    expect(result.updates.find((update) => update.instance_id === 'offered')).toEqual(
      expect.objectContaining({ mirror: true, not_wanted_list: {}, wanted_filters: {} }),
    );
  });

  it('reuses an existing normalized mirror target instead of creating a duplicate', async () => {
    const outbox = makeOutbox();
    const result = await persistNativeTradePreferenceMutation({
      userId: 'user-1',
      snapshot: {
        catalog: [],
        instances: {
          offered: instance('offered', 6, {
            variant_id: '0006-shiny-gigantamax',
            gigantamax: true,
            is_for_trade: true,
          }),
          existing: instance('existing', 6, {
            variant_id: '0006-shiny_gigantamax',
            gigantamax: true,
            is_caught: false,
            is_wanted: true,
          }),
        },
      },
      request: {
        filteredOutIds: [],
        filters: {},
        manuallyExcludedIds: [],
        mirror: true,
        mode: 'trade',
        selectedInstanceId: 'offered',
      },
      outbox,
      receiverClient: { post: jest.fn().mockResolvedValue({ accepted: true }) },
      mirrorInstanceId: 'must-not-be-created',
      syncBatchId: 'reuse-batch',
      now: 400,
    });

    expect(result.mirrorCreation).toBeNull();
    expect(result.updates.map((update) => update.instance_id)).toEqual(['offered']);
  });

  it('retains an offline preference update in the collection outbox', async () => {
    const outbox = makeOutbox();
    const result = await persistNativeTradePreferenceMutation({
      userId: 'user-1',
      snapshot: {
        catalog: [],
        instances: {
          wanted: instance('wanted', 1, {
            is_caught: false,
            is_wanted: true,
          }),
          offer: instance('offer', 4, { is_for_trade: true }),
        },
      },
      request: {
        filteredOutIds: [],
        filters: {},
        manuallyExcludedIds: ['offer'],
        mirror: false,
        mode: 'wanted',
        selectedInstanceId: 'wanted',
      },
      outbox,
      receiverClient: { post: jest.fn().mockRejectedValue(new Error('offline')) },
      syncBatchId: 'offline-batch',
      now: 500,
    });

    expect(result.syncState).toBe('pending');
    expect(result.message).toContain('saved on this device');
    expect(outbox.markAttemptFailed).toHaveBeenCalledWith(
      'user-1',
      'offline-batch',
      'offline',
    );
  });

  it('rejects stale ownership before queueing anything', async () => {
    const outbox = makeOutbox();
    await expect(persistNativeTradePreferenceMutation({
      userId: 'user-1',
      snapshot: { catalog: [], instances: { caught: instance('caught', 1) } },
      request: {
        filteredOutIds: [],
        filters: {},
        manuallyExcludedIds: [],
        mirror: false,
        mode: 'trade',
        selectedInstanceId: 'caught',
      },
      outbox,
      receiverClient: { post: jest.fn() },
      syncBatchId: 'stale-batch',
      now: 600,
    })).rejects.toThrow('no longer listed For Trade');
    expect(outbox.queue).not.toHaveBeenCalled();
  });

  it('builds complete mirror snapshots independently of persistence', () => {
    const mirror = createNativeMirrorWantedInstance({
      source: instance('source', 25, { is_for_trade: true }),
      instanceId: 'mirror',
      now: 700,
    });
    expect(mirror).toEqual(expect.objectContaining({
      instance_id: 'mirror',
      is_wanted: true,
      is_caught: false,
      cp: null,
      last_update: 700,
    }));
  });
});
