import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import {
  buildNativeExistingOrganizerUpdates,
  persistNativeExistingOrganizerMutation,
} from '../../../../src/features/collection/nativeExistingOrganizerMutation';

const instance = (patch: Partial<PokemonInstance> = {}): PokemonInstance => ({
  instance_id: 'caught-1', variant_id: '0001-default', pokemon_id: 1,
  nickname: null, cp: null, level: null,
  attack_iv: null, defense_iv: null, stamina_iv: null,
  shiny: false, costume_id: null, lucky: false, shadow: false, purified: false,
  fast_move_id: null, charged_move1_id: null, charged_move2_id: null,
  weight: null, height: null, gender: null,
  mega: false, mega_form: null, is_mega: false, dynamax: false, gigantamax: false,
  crown: false, max_attack: null, max_guard: null, max_spirit: null,
  is_fused: false, fusion: null, fusion_form: null, fused_with: null,
  is_traded: false, traded_date: null, original_trainer_id: null,
  original_trainer_name: null,
  is_caught: true, is_for_trade: false, is_wanted: false, most_wanted: false,
  caught_tags: ['old'], trade_tags: [], wanted_tags: [],
  not_trade_list: {}, not_wanted_list: {}, trade_filters: {}, wanted_filters: {},
  wanted_size_preferences: null, mirror: false, pref_lucky: false,
  friendship_level: null, registered: true, favorite: false, disabled: false,
  pokeball: null, location_card: null, location_caught: null, date_caught: null,
  date_added: '2026-08-23T00:00:00Z', last_update: 10, gps: null,
  ...patch,
});

const snapshot = (instances: Record<string, PokemonInstance>) => ({
  instances,
  catalog: [],
});

const outboxStore = () => ({
  queue: jest.fn().mockResolvedValue(undefined),
  list: jest.fn().mockResolvedValue([]),
  markAttemptFailed: jest.fn().mockResolvedValue(undefined),
  markAcknowledged: jest.fn().mockResolvedValue(undefined),
  removeAcknowledged: jest.fn().mockResolvedValue(undefined),
});

describe('native existing Pokémon organizer mutation', () => {
  it('updates caught labels and status without dropping unrelated instance details', () => {
    const current = instance({ cp: 812, caught_tags: ['old', 'remove'] });
    const [update] = buildNativeExistingOrganizerUpdates({
      snapshot: snapshot({ key: current }),
      request: {
        operation: 'update', instanceIds: ['caught-1'], forTrade: true,
        caughtTagChanges: { old: true, remove: false, new: true },
      },
      now: 100,
    });

    expect(update.instance).toEqual(expect.objectContaining({
      cp: 812,
      is_caught: true,
      is_for_trade: true,
      is_wanted: false,
      caught_tags: ['old', 'new'],
      last_update: 100,
    }));
  });

  it('preserves Favorite and For Trade mutual exclusion', () => {
    expect(() => buildNativeExistingOrganizerUpdates({
      snapshot: snapshot({ key: instance({ favorite: true }) }),
      request: { operation: 'update', instanceIds: ['caught-1'], forTrade: true },
    })).toThrow('Favorite Pokémon cannot be listed For Trade');

    expect(() => buildNativeExistingOrganizerUpdates({
      snapshot: snapshot({ key: instance({ is_for_trade: true }) }),
      request: { operation: 'update', instanceIds: ['caught-1'], favorite: true },
    })).toThrow('For Trade Pokémon cannot be marked as Favorite');
  });

  it('rejects an existing-organizer apply with no selected changes', () => {
    expect(() => buildNativeExistingOrganizerUpdates({
      snapshot: snapshot({ key: instance() }),
      request: { operation: 'update', instanceIds: ['caught-1'] },
    })).toThrow('No organization changes were selected');
  });

  it('skips already-matching rows while applying a bulk change to the rest', () => {
    const updates = buildNativeExistingOrganizerUpdates({
      snapshot: snapshot({
        favorite: instance({ instance_id: 'favorite-1', favorite: true }),
        ordinary: instance({ instance_id: 'ordinary-1' }),
      }),
      request: {
        operation: 'update',
        instanceIds: ['favorite-1', 'ordinary-1'],
        favorite: true,
      },
      now: 100,
    });
    expect(updates).toHaveLength(1);
    expect(updates[0].instance.instance_id).toBe('ordinary-1');
    expect(updates[0].instance.favorite).toBe(true);
  });

  it.each([
    ['lucky', { lucky: true }, 'Lucky Pokémon'],
    ['shadow', { shadow: true }, 'Shadow Pokémon'],
    ['mega', { is_mega: true }, 'Mega or Primal Pokémon'],
    ['fusion', { is_fused: true }, 'Fusion Pokémon'],
  ] as const)('rejects %s Pokémon from For Trade', (_label, patch, message) => {
    expect(() => buildNativeExistingOrganizerUpdates({
      snapshot: snapshot({ key: instance(patch) }),
      request: { operation: 'update', instanceIds: ['caught-1'], forTrade: true },
    })).toThrow(message);
  });

  it('creates a separate Wanted copy and leaves the caught source untouched', () => {
    const current = instance({ cp: 812, favorite: true });
    const [update] = buildNativeExistingOrganizerUpdates({
      snapshot: snapshot({ key: current }),
      request: {
        operation: 'clone-wanted', instanceIds: ['caught-1'],
        customTagIds: ['priority'], mostWanted: true,
      },
      cloneInstanceIds: ['wanted-2'],
      now: 100,
    });

    expect(update.collectionKey).toBe('wanted-2');
    expect(update.instance).toEqual(expect.objectContaining({
      instance_id: 'wanted-2', cp: 812,
      is_caught: false, is_for_trade: false, is_wanted: true,
      favorite: false, most_wanted: true,
      caught_tags: [], wanted_tags: ['priority'],
    }));
    expect(current).toEqual(expect.objectContaining({
      instance_id: 'caught-1', is_caught: true, favorite: true,
    }));
  });

  it('converts Wanted entries to caught or For Trade and clears wanted-only state', () => {
    const wanted = instance({
      instance_id: 'wanted-1', is_caught: false, is_wanted: true,
      most_wanted: true, caught_tags: [], wanted_tags: ['old-wanted'],
    });
    const [update] = buildNativeExistingOrganizerUpdates({
      snapshot: snapshot({ key: wanted }),
      request: {
        operation: 'convert-caught', instanceIds: ['wanted-1'],
        destination: 'trade', customTagIds: ['inventory'],
      },
      now: 100,
    });

    expect(update.instance).toEqual(expect.objectContaining({
      is_caught: true, is_for_trade: true, is_wanted: false,
      most_wanted: false, caught_tags: ['inventory'], wanted_tags: [],
    }));
  });

  it('represents removal as a complete untracked snapshot', () => {
    const [update] = buildNativeExistingOrganizerUpdates({
      snapshot: snapshot({ key: instance({ favorite: true }) }),
      request: { operation: 'remove', instanceIds: ['caught-1'] },
      now: 100,
    });
    expect(update.instance).toEqual(expect.objectContaining({
      is_caught: false, is_for_trade: false, is_wanted: false,
      favorite: false, most_wanted: false, registered: false,
      caught_tags: [], trade_tags: [], wanted_tags: [],
    }));
  });

  it('queues one complete batch before sending and reports offline retention', async () => {
    const outbox = outboxStore();
    outbox.list.mockImplementation(async () => {
      const queued = outbox.queue.mock.calls[0];
      if (!queued) return [];
      return [{
        userId: queued[0], batch: queued[1], state: 'pending',
        createdAt: queued[2], updatedAt: queued[2], attemptCount: 0,
        lastError: null, acknowledgedAt: null,
      }];
    });
    const receiverClient = { post: jest.fn().mockRejectedValue(new Error('offline')) };
    const onQueued = jest.fn();

    const result = await persistNativeExistingOrganizerMutation({
      userId: 'user-1',
      snapshot: snapshot({ key: instance() }),
      request: { operation: 'update', instanceIds: ['caught-1'], favorite: true },
      outbox,
      receiverClient,
      onQueued,
      syncBatchId: 'batch-1',
      now: 100,
    });

    expect(outbox.queue).toHaveBeenCalledTimes(1);
    expect(onQueued).toHaveBeenCalledWith([
      expect.objectContaining({ instance: expect.objectContaining({ favorite: true }) }),
    ]);
    expect(result.syncState).toBe('pending');
    expect(result.message).toContain('will sync when Receiver is available');
  });
});
