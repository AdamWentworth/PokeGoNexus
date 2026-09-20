import { beforeEach, describe, expect, it, vi } from 'vitest';

import { updateInstanceStatus } from '@/features/instances/actions/updateInstanceStatus';
import * as db from '@/db/indexedDB';
import type { Instances } from '@/types/instances';

const TS = 1_700_000_000_000;
const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

const VARIANT = {
  variant_id: '0001-default',
  pokemon_id: 1,
  variantType: 'default',
  currentImage: '',
  species_name: 'Bulbasaur',
} as any;

function makeInstance(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    variant_id: '0001-default',
    pokemon_id: 1,
    is_caught: false,
    is_for_trade: false,
    is_wanted: false,
    registered: false,
    lucky: false,
    shadow: false,
    mega: false,
    is_mega: false,
    fusion: {},
    favorite: false,
    most_wanted: false,
    caught_tags: [],
    trade_tags: [],
    wanted_tags: [],
    last_update: 0,
    ...overrides,
  } as any;
}

function createHarness(initial: Instances) {
  const data = {
    variants: [VARIANT],
    instances: { ...initial },
  };

  let latest = data.instances;
  const ref = { current: latest };

  const setData = vi.fn((updater: any) => {
    const next = updater({ variants: data.variants, instances: latest });
    latest = next.instances;
    data.instances = latest;
    ref.current = latest;
    return next;
  });

  const updater = updateInstanceStatus(data as any, setData as any, ref as any);

  return {
    updater,
    setData,
    getInstances: () => latest,
  };
}

describe('updateInstanceStatus', () => {
  let setItemSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(Date, 'now').mockReturnValue(TS);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });

    setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
    vi.spyOn(db, 'putInstancesBulk').mockResolvedValue(undefined);
    vi.spyOn(db, 'putBatchedPokemonUpdates').mockResolvedValue(undefined);
  });

  it('updates a single UUID instance and persists updates', async () => {
    const { updater, getInstances } = createHarness({
      [UUID_A]: makeInstance(),
    });

    const outcomes = await updater(UUID_A, 'Caught');

    const out = getInstances();
    expect(out[UUID_A]).toMatchObject({
      is_caught: true,
      is_for_trade: false,
      is_wanted: false,
      registered: true,
    });

    expect(db.putInstancesBulk).toHaveBeenCalled();
    const bulkItems = (db.putInstancesBulk as any).mock.calls.flatMap((c: any[]) => c[0] ?? []);
    expect(bulkItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          instance_id: UUID_A,
          is_caught: true,
          last_update: TS,
        }),
      ]),
    );

    expect(db.putBatchedPokemonUpdates).toHaveBeenCalledWith(
      UUID_A,
      expect.objectContaining({ is_caught: true, last_update: TS }),
    );
    expect(setItemSpy).toHaveBeenCalledWith('ownershipTimestamp', String(TS));
    expect(outcomes).toEqual([
      expect.objectContaining({
        sourceKey: UUID_A,
        sourceInstanceId: UUID_A,
        resultingInstanceId: UUID_A,
        targetStatus: 'Caught',
        operation: 'updated',
        changed: true,
      }),
    ]);
  });

  it('updates multiple UUID instances to Trade in one call', async () => {
    const { updater, getInstances } = createHarness({
      [UUID_A]: makeInstance(),
      [UUID_B]: makeInstance(),
    });

    const outcomes = await updater([UUID_A, UUID_B], 'Trade');

    const out = getInstances();
    expect(out[UUID_A]).toMatchObject({ is_caught: true, is_for_trade: true, is_wanted: false });
    expect(out[UUID_B]).toMatchObject({ is_caught: true, is_for_trade: true, is_wanted: false });

    expect(db.putBatchedPokemonUpdates).toHaveBeenCalledWith(
      UUID_A,
      expect.objectContaining({ is_for_trade: true }),
    );
    expect(db.putBatchedPokemonUpdates).toHaveBeenCalledWith(
      UUID_B,
      expect.objectContaining({ is_for_trade: true }),
    );
    expect(db.putInstancesBulk).toHaveBeenCalled();
    expect(outcomes).toHaveLength(2);
    expect(outcomes.every((outcome) => outcome.targetStatus === 'Trade' && outcome.changed)).toBe(true);
  });

  it('creates a new instance when called with a variant_id target', async () => {
    const { updater, getInstances } = createHarness({});

    const outcomes = await updater('0001-default', 'Wanted');

    const out = getInstances();
    const keys = Object.keys(out);
    expect(keys).toHaveLength(1);

    const created = out[keys[0]] as any;
    expect(created).toMatchObject({
      variant_id: '0001-default',
      is_caught: false,
      is_for_trade: false,
      is_wanted: true,
      registered: true,
    });

    const createdId = keys[0];
    expect(db.putBatchedPokemonUpdates).toHaveBeenCalledWith(
      createdId,
      expect.objectContaining({ is_wanted: true }),
    );
    expect(db.putInstancesBulk).toHaveBeenCalled();
    expect(outcomes).toEqual([
      expect.objectContaining({
        sourceKey: '0001-default',
        resultingInstanceId: createdId,
        targetStatus: 'Wanted',
        operation: 'created',
        changed: true,
      }),
    ]);
  });

  it('applies destination labels to the resulting wanted clone, not its caught source', async () => {
    const { updater, getInstances } = createHarness({
      [UUID_A]: makeInstance({
        instance_id: UUID_A,
        is_caught: true,
        registered: true,
        caught_tags: ['living-dex'],
      }),
    });

    const outcomes = await updater(UUID_A, 'Wanted', undefined, {
      most_wanted: true,
      wanted_tags: ['regional-wishlist'],
    });

    expect(outcomes).toEqual([
      expect.objectContaining({
        sourceInstanceId: UUID_A,
        targetStatus: 'Wanted',
        operation: 'cloned',
        changed: true,
      }),
    ]);
    const cloneId = outcomes[0].resultingInstanceId;
    expect(cloneId).not.toBe(UUID_A);
    expect(getInstances()[cloneId]).toMatchObject({
      is_wanted: true,
      most_wanted: true,
      wanted_tags: ['regional-wishlist'],
    });
    expect(getInstances()[UUID_A]).toMatchObject({
      is_caught: true,
      is_wanted: false,
      caught_tags: ['living-dex'],
    });
  });

  it('does not apply destination labels when the requested status is blocked', async () => {
    const alert = vi.fn();
    const { updater, getInstances } = createHarness({
      [UUID_A]: makeInstance({
        instance_id: UUID_A,
        is_caught: true,
        registered: true,
        lucky: true,
      }),
    });

    const outcomes = await updater(UUID_A, 'Trade', alert, {
      favorite: true,
      caught_tags: ['trade-box'],
    });

    expect(alert).toHaveBeenCalled();
    expect(outcomes).toEqual([
      expect.objectContaining({ operation: 'unchanged', changed: false }),
    ]);
    expect(getInstances()[UUID_A]).toMatchObject({
      is_for_trade: false,
      favorite: false,
      caught_tags: [],
    });
  });

  it('does not allow a destination patch to make a For Trade instance a favorite', async () => {
    const { updater, getInstances } = createHarness({});

    const outcomes = await updater('0001-default', 'Trade', undefined, {
      favorite: true,
    });

    expect(outcomes).toEqual([
      expect.objectContaining({ targetStatus: 'Trade', changed: true }),
    ]);
    expect(getInstances()[outcomes[0].resultingInstanceId]).toMatchObject({
      is_for_trade: true,
      favorite: false,
    });
  });

  it('logs updatesDB errors but does not throw', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (db.putBatchedPokemonUpdates as any).mockRejectedValueOnce(new Error('updates down'));

    const { updater } = createHarness({
      [UUID_A]: makeInstance(),
    });

    await expect(updater(UUID_A, 'Caught')).resolves.toEqual([
      expect.objectContaining({ resultingInstanceId: UUID_A, changed: true }),
    ]);
    expect(errSpy).toHaveBeenCalledWith(
      '[updateInstanceStatus]',
      'updatesDB write failed:',
      expect.any(Error),
    );
  });
});
