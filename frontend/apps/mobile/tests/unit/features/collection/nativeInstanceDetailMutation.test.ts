import { persistNativeInstanceDetailMutation } from '../../../../src/features/collection/nativeInstanceDetailMutation';
import type { NativeCollectionSnapshot } from '../../../../src/services/collectionApi';
import type { BasePokemon } from '@pokemongonexus/shared-contracts/pokemon';

const necrozmaCatalogEntry = {
  pokemon_id: 800,
  fusion: [{
    fusion_id: 2,
    base_pokemon_id1: 800,
    base_pokemon_id2: 792,
    name: 'Dawn Wings Necrozma',
  }],
} as unknown as BasePokemon;

const snapshot = {
  catalog: [],
  instances: {
    'instance-1': {
      instance_id: 'instance-1',
      variant_id: '0003-default',
      pokemon_id: 3,
      nickname: null,
      cp: 2000,
      level: 40,
      attack_iv: 10,
      defense_iv: 10,
      stamina_iv: 10,
      shiny: false,
      costume_id: null,
      lucky: false,
      shadow: false,
      purified: false,
      fast_move_id: null,
      charged_move1_id: null,
      charged_move2_id: null,
      weight: null,
      height: null,
      gender: null,
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
      date_added: '2026-01-01T00:00:00.000Z',
      last_update: 100,
    },
  },
} satisfies NativeCollectionSnapshot;

const makeOutbox = () => ({
  queue: jest.fn().mockResolvedValue(undefined),
  list: jest.fn().mockResolvedValue([]),
  markAttemptFailed: jest.fn().mockResolvedValue(undefined),
  markAcknowledged: jest.fn().mockResolvedValue(undefined),
  removeAcknowledged: jest.fn().mockResolvedValue(undefined),
});

describe('persistNativeInstanceDetailMutation', () => {
  it('queues a validated canonical instance patch and updates local state first', async () => {
    const outbox = makeOutbox();
    const receiverClient = { post: jest.fn().mockResolvedValue({ accepted: true }) };
    const onQueued = jest.fn();
    const result = await persistNativeInstanceDetailMutation({
      userId: 'user-1',
      snapshot,
      requestedInstanceId: 'instance-1',
      patch: {
        nickname: '  BulbaBuddy  ',
        cp: 2222,
        level: 40.5,
        attack_iv: 15,
        location_caught: '  Burnaby, British Columbia  ',
        lucky: true,
        is_traded: true,
        original_trainer_name: '  TradePartner  ',
        pokeball: 'beast_ball',
        max_attack: '3',
        max_guard: 2,
        max_spirit: 0,
      },
      outbox,
      receiverClient,
      onQueued,
      syncBatchId: 'batch-1',
      now: 200,
    });

    expect(result.mutation.updated).toEqual(expect.objectContaining({
      nickname: 'BulbaBuddy',
      cp: 2222,
      level: 40.5,
      attack_iv: 15,
      location_caught: 'Burnaby, British Columbia',
      lucky: true,
      is_traded: true,
      original_trainer_name: 'TradePartner',
      pokeball: 'beast_ball',
      max_attack: 3,
      max_guard: 2,
      max_spirit: 0,
      last_update: 200,
    }));
    expect(outbox.queue).toHaveBeenCalledTimes(1);
    expect(onQueued).toHaveBeenCalledWith(result.mutation);
  });

  it.each([
    [{ cp: 9 }, 'CP must be between 10 and 100000.'],
    [{ level: 40.25 }, 'Level must use half-level steps.'],
    [{ attack_iv: 16 }, 'Attack IV must be between 0 and 15.'],
    [{ friendship_level: 6 }, 'Friendship must be between 0 and 5.'],
    [{ gender: 'Unknown' }, 'Gender selection is invalid.'],
    [{ pokeball: 'ordinary_ball' }, 'Poké Ball selection is invalid.'],
    [{ lucky: true, is_traded: false }, 'Lucky Pokémon are always traded.'],
    [{ max_attack: 0 }, 'Max Attack must be between 1 and 3.'],
    [{ max_guard: 4 }, 'Max Guard must be between 0 and 3.'],
    [{ max_spirit: 1.5 }, 'Max Spirit must be a whole number.'],
    [{ shadow: true, purified: true }, 'A Pokémon cannot be Shadow and Purified at the same time.'],
  ])('rejects an invalid detail patch %#', async (patch, message) => {
    await expect(persistNativeInstanceDetailMutation({
      userId: 'user-1',
      snapshot,
      requestedInstanceId: 'instance-1',
      patch,
      outbox: makeOutbox(),
      receiverClient: { post: jest.fn() },
      syncBatchId: 'batch-1',
      now: 200,
    })).rejects.toThrow(message);
  });

  it('enforces the canonical Shadow invariants in the persisted mutation', async () => {
    const result = await persistNativeInstanceDetailMutation({
      userId: 'user-1',
      snapshot,
      requestedInstanceId: 'instance-1',
      patch: {
        shadow: true,
        lucky: true,
        is_traded: true,
        purified: false,
      },
      outbox: makeOutbox(),
      receiverClient: { post: jest.fn().mockResolvedValue({ accepted: true }) },
      syncBatchId: 'batch-shadow',
      now: 201,
    });

    expect(result.mutation.updated).toEqual(expect.objectContaining({
      shadow: true,
      purified: false,
      lucky: false,
      is_traded: false,
    }));
  });

  it('keeps Mega registration separate from the currently active Mega form', async () => {
    const active = await persistNativeInstanceDetailMutation({
      userId: 'user-1',
      snapshot,
      requestedInstanceId: 'instance-1',
      patch: {
        is_mega: true,
        mega: false,
        mega_form: 'x',
        fusion_form: 'Crowned Sword',
      },
      outbox: makeOutbox(),
      receiverClient: { post: jest.fn().mockResolvedValue({ accepted: true }) },
      syncBatchId: 'batch-mega-active',
      now: 202,
    });
    expect(active.mutation.updated).toEqual(expect.objectContaining({
      is_mega: true,
      mega: true,
      mega_form: 'x',
      fusion_form: 'Crowned Sword',
    }));

    const inactive = await persistNativeInstanceDetailMutation({
      userId: 'user-1',
      snapshot,
      requestedInstanceId: 'instance-1',
      patch: { is_mega: false, mega: true, mega_form: 'x' },
      outbox: makeOutbox(),
      receiverClient: { post: jest.fn().mockResolvedValue({ accepted: true }) },
      syncBatchId: 'batch-mega-inactive',
      now: 203,
    });
    expect(inactive.mutation.updated).toEqual(expect.objectContaining({
      is_mega: false,
      mega: true,
      mega_form: null,
    }));
  });

  it('returns after the durable queue write when Receiver sync is deferred', async () => {
    const receiverClient = { post: jest.fn() };
    const result = await persistNativeInstanceDetailMutation({
      userId: 'user-1',
      snapshot,
      requestedInstanceId: 'instance-1',
      patch: { nickname: 'Immediate' },
      outbox: makeOutbox(),
      receiverClient,
      syncBatchId: 'batch-deferred-sync',
      now: 204,
      sendImmediately: false,
    });

    expect(result.syncState).toBe('pending');
    expect(result.mutation.updated.nickname).toBe('Immediate');
    expect(receiverClient.post).not.toHaveBeenCalled();
  });

  it('queues the visible Pokémon and consumed fusion partner in one atomic batch', async () => {
    const outbox = makeOutbox();
    const fusionSnapshot: NativeCollectionSnapshot = {
      ...snapshot,
      catalog: [necrozmaCatalogEntry],
      instances: {
        ...snapshot.instances,
        'instance-1': {
          ...snapshot.instances['instance-1'],
          pokemon_id: 800,
          variant_id: '0800-default',
        },
        'partner-1': {
          ...snapshot.instances['instance-1'],
          instance_id: 'partner-1',
          pokemon_id: 792,
          variant_id: '0792-default',
        },
      },
    };
    const onQueued = jest.fn();
    const result = await persistNativeInstanceDetailMutation({
      userId: 'user-1',
      snapshot: fusionSnapshot,
      requestedInstanceId: 'instance-1',
      patch: {
        is_fused: true,
        fused_with: 'partner-1',
        fusion_form: 'Dawn Wings Necrozma',
        fusion: { 2: true },
      },
      outbox,
      receiverClient: { post: jest.fn().mockResolvedValue({ accepted: true }) },
      onQueued,
      syncBatchId: 'batch-fusion',
      now: 204,
    });

    expect(result.mutation.updated).toEqual(expect.objectContaining({
      is_fused: true,
      fused_with: 'partner-1',
      fusion_form: 'Dawn Wings Necrozma',
    }));
    expect(result.companionMutations[0]?.updated).toEqual(expect.objectContaining({
      instance_id: 'partner-1',
      disabled: true,
      is_fused: true,
      fused_with: 'instance-1',
      fusion_form: 'Dawn Wings Necrozma',
    }));
    expect(outbox.queue).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ pokemonUpdates: expect.arrayContaining([
        expect.objectContaining({ instance_id: 'instance-1' }),
        expect.objectContaining({ instance_id: 'partner-1', disabled: true }),
      ]) }),
      204,
    );
    expect(onQueued).toHaveBeenCalledTimes(2);
  });

  it.each(['Dawn Wings Necrozma', '2'])('switches registered forms using the active choice %s and releases the old partner', async (fusionForm) => {
    const outbox = makeOutbox();
    const fusionSnapshot: NativeCollectionSnapshot = {
      ...snapshot,
      catalog: [{ ...necrozmaCatalogEntry, fusion: [
        { ...necrozmaCatalogEntry.fusion[0], fusion_id: 1, name: 'Dusk Mane Necrozma', base_pokemon_id2: 791 },
        ...necrozmaCatalogEntry.fusion,
      ] }],
      instances: {
        'instance-1': { ...snapshot.instances['instance-1'], pokemon_id: 800, is_fused: true, fused_with: 'solgaleo', fusion_form: 'Dusk Mane Necrozma', fusion: { 1: true } },
        solgaleo: { ...snapshot.instances['instance-1'], instance_id: 'solgaleo', pokemon_id: 791, disabled: true, is_fused: true, fused_with: 'instance-1' },
        lunala: { ...snapshot.instances['instance-1'], instance_id: 'lunala', pokemon_id: 792 },
      },
    };
    const result = await persistNativeInstanceDetailMutation({
      userId: 'user-1', snapshot: fusionSnapshot, requestedInstanceId: 'instance-1',
      patch: { is_fused: true, fused_with: 'lunala', fusion_form: fusionForm, fusion: { 1: true, 2: true } },
      outbox, receiverClient: { post: jest.fn() }, sendImmediately: false,
    });
    expect(result.companionMutations.map((entry) => entry.updated)).toEqual(expect.arrayContaining([
      expect.objectContaining({ instance_id: 'solgaleo', disabled: false, is_fused: false, fused_with: null }),
      expect.objectContaining({ instance_id: 'lunala', disabled: true, is_fused: true, fused_with: 'instance-1' }),
    ]));
    expect(result.mutation.updated.fusion).toEqual({ 1: true, 2: true });
    expect(outbox.queue).toHaveBeenCalledTimes(1);
  });

  it('rejects a fusion partner whose species does not match the selected form', async () => {
    const fusionSnapshot: NativeCollectionSnapshot = {
      ...snapshot,
      catalog: [necrozmaCatalogEntry],
      instances: {
        ...snapshot.instances,
        'instance-1': {
          ...snapshot.instances['instance-1'],
          pokemon_id: 800,
          variant_id: '0800-default',
        },
        'wrong-partner': {
          ...snapshot.instances['instance-1'],
          instance_id: 'wrong-partner',
          pokemon_id: 791,
          variant_id: '0791-default',
        },
      },
    };

    await expect(persistNativeInstanceDetailMutation({
      userId: 'user-1',
      snapshot: fusionSnapshot,
      requestedInstanceId: 'instance-1',
      patch: {
        is_fused: true,
        fused_with: 'wrong-partner',
        fusion_form: 'Dawn Wings Necrozma',
        fusion: { 2: true },
      },
      outbox: makeOutbox(),
      receiverClient: { post: jest.fn() },
      syncBatchId: 'batch-wrong-fusion',
      now: 205,
    })).rejects.toThrow("This fusion requires Dawn Wings Necrozma's matching partner.");
  });

  it('releases a linked fusion partner in the same separation batch', async () => {
    const fusionSnapshot: NativeCollectionSnapshot = {
      ...snapshot,
      instances: {
        'instance-1': {
          ...snapshot.instances['instance-1'],
          is_fused: true,
          fused_with: 'partner-1',
          fusion_form: 'Dawn Wings Necrozma',
        },
        'partner-1': {
          ...snapshot.instances['instance-1'],
          instance_id: 'partner-1',
          pokemon_id: 792,
          variant_id: '0792-default',
          disabled: true,
          is_fused: true,
          fused_with: 'instance-1',
          fusion_form: 'Dawn Wings Necrozma',
        },
      },
    };
    const result = await persistNativeInstanceDetailMutation({
      userId: 'user-1',
      snapshot: fusionSnapshot,
      requestedInstanceId: 'instance-1',
      patch: { is_fused: false, fused_with: null, fusion_form: null },
      outbox: makeOutbox(),
      receiverClient: { post: jest.fn().mockResolvedValue({ accepted: true }) },
      syncBatchId: 'batch-separate',
      now: 205,
    });

    expect(result.mutation.updated).toEqual(expect.objectContaining({
      is_fused: false,
      fused_with: null,
      fusion_form: null,
    }));
    expect(result.companionMutations[0]?.updated).toEqual(expect.objectContaining({
      disabled: false,
      is_fused: false,
      fused_with: null,
      fusion_form: null,
    }));
  });
  it.each([
    ['0_0_100', 'Male'], ['100_0_0', 'Female'], ['0_100_0', 'Male'], [null, 'Female'],
  ])('rejects a new impossible gender for rate %s before queueing or sending', async (rate, gender) => {
    const outbox = makeOutbox();
    const receiverClient = { post: jest.fn() };
    await expect(persistNativeInstanceDetailMutation({
      userId: 'user-1', requestedInstanceId: 'instance-1', patch: { gender },
      snapshot: { ...snapshot, catalog: [{ pokemon_id: 3, gender_rate: rate } as BasePokemon] },
      outbox, receiverClient,
    })).rejects.toThrow('This gender is not available');
    expect(outbox.queue).not.toHaveBeenCalled();
    expect(receiverClient.post).not.toHaveBeenCalled();
  });

  it('preserves historical gender data on unrelated edits', async () => {
    const outbox = makeOutbox();
    await expect(persistNativeInstanceDetailMutation({
      userId: 'user-1', requestedInstanceId: 'instance-1', patch: { gender: 'Male', nickname: 'Updated' },
      snapshot: { ...snapshot, catalog: [{ pokemon_id: 3, gender_rate: '0_0_100' } as BasePokemon],
        instances: { 'instance-1': { ...snapshot.instances['instance-1'], gender: 'Male' } } },
      outbox, receiverClient: { post: jest.fn() }, sendImmediately: false,
    })).resolves.toBeDefined();
    expect(outbox.queue).toHaveBeenCalledTimes(1);
  });

});
