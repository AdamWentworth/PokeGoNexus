import { beforeEach, describe, expect, it, vi } from 'vitest';

import { updateInstanceDetails } from '@/features/instances/actions/updateInstanceDetails';
import * as db from '@/db/indexedDB';

type MapState = Record<string, Record<string, unknown>>;

const TS = 1_700_000_000_123;

function createHarness(initial: MapState) {
  const data = { instances: { ...initial } };
  let latest = data.instances;

  const setData = vi.fn((updater: any) => {
    const next = updater({ instances: latest });
    latest = next.instances;
    data.instances = latest;
    return next;
  });

  const updater = updateInstanceDetails(data as any, setData as any);

  return {
    updater,
    setData,
    getInstances: () => latest,
  };
}

describe('updateInstanceDetails', () => {
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

  it('applies patch map updates and creates placeholders for missing keys', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { updater, getInstances, setData } = createHarness({
      a: { cp: 10, last_update: 1 },
      b: { nickname: 'old', last_update: 1 },
    });

    await updater({
      a: { cp: 1500 },
      c: { nickname: 'new' },
    });

    const out = getInstances();
    expect(setData).toHaveBeenCalledTimes(1);
    expect(out.a).toMatchObject({ cp: 1500, last_update: TS });
    expect(out.c).toMatchObject({ nickname: 'new', last_update: TS });

    expect(warnSpy).toHaveBeenCalledWith(
      '[updateInstanceDetails]',
      expect.stringContaining('missing - creating placeholder'),
      'c',
    );

    expect(db.putInstancesBulk).toHaveBeenCalled();
    const bulkItems = (db.putInstancesBulk as any).mock.calls.flatMap((c: any[]) => c[0] ?? []);
    expect(bulkItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ instance_id: 'a', cp: 1500 }),
        expect.objectContaining({ instance_id: 'c', nickname: 'new' }),
      ]),
    );

    expect(db.putBatchedPokemonUpdates).toHaveBeenCalledWith(
      'a',
      expect.objectContaining({ cp: 1500 }),
    );
    expect(db.putBatchedPokemonUpdates).toHaveBeenCalledWith(
      'c',
      expect.objectContaining({ nickname: 'new' }),
    );
    expect(setItemSpy).toHaveBeenCalledWith('ownershipTimestamp', String(TS));
  });

  it('maps legacy variant-prefixed keys to existing instance rows', async () => {
    const partnerId = 'c9277c53-f26d-4370-bfec-d26a9278df64';
    const legacyKey = `0800-default_${partnerId}`;
    const actualKey = '79094536-4eec-4736-bcc7-e440d188eee5';
    const { updater, getInstances } = createHarness({
      [actualKey]: {
        instance_id: partnerId,
        disabled: true,
        fused_with: 'open-instance',
        is_fused: true,
        fusion_form: 'Dusk Mane Necrozma',
        last_update: 1,
      },
    });

    await updater({
      [legacyKey]: {
        disabled: false,
        fused_with: null,
        is_fused: false,
        fusion_form: null,
      },
    });

    const out = getInstances();
    expect(out[actualKey]).toMatchObject({
      instance_id: partnerId,
      disabled: false,
      fused_with: null,
      is_fused: false,
      fusion_form: null,
      last_update: TS,
    });
    expect(out[legacyKey]).toBeUndefined();

    expect(db.putBatchedPokemonUpdates).toHaveBeenCalledWith(
      actualKey,
      expect.objectContaining({
        disabled: false,
        fused_with: null,
        is_fused: false,
        fusion_form: null,
      }),
    );
  });

  it('maps uuid-only keys to legacy-prefixed instance rows', async () => {
    const partnerId = 'c9277c53-f26d-4370-bfec-d26a9278df64';
    const actualKey = `0791-default_${partnerId}`;
    const { updater, getInstances } = createHarness({
      [actualKey]: {
        instance_id: `0791-default_${partnerId}`,
        disabled: true,
        fused_with: '0800-fusion_1_abc',
        is_fused: true,
        fusion_form: 'Dusk Mane Necrozma',
        last_update: 1,
      },
    });

    await updater({
      [partnerId]: {
        disabled: false,
        fused_with: null,
        is_fused: false,
        fusion_form: null,
      },
    });

    const out = getInstances();
    expect(out[actualKey]).toMatchObject({
      instance_id: `0791-default_${partnerId}`,
      disabled: false,
      fused_with: null,
      is_fused: false,
      fusion_form: null,
      last_update: TS,
    });
    expect(out[partnerId]).toBeUndefined();

    expect(db.putBatchedPokemonUpdates).toHaveBeenCalledWith(
      actualKey,
      expect.objectContaining({
        disabled: false,
        fused_with: null,
        is_fused: false,
        fusion_form: null,
      }),
    );
  });

  it('applies a shared patch to multiple keys', async () => {
    const { updater, getInstances } = createHarness({
      a: { favorite: false, last_update: 1 },
      b: { favorite: false, last_update: 1 },
    });

    await updater(['a', 'b'], { favorite: true });

    const out = getInstances();
    expect(out.a).toMatchObject({ favorite: true, last_update: TS });
    expect(out.b).toMatchObject({ favorite: true, last_update: TS });
    expect(db.putBatchedPokemonUpdates).toHaveBeenCalledWith(
      'a',
      expect.objectContaining({ favorite: true }),
    );
    expect(db.putBatchedPokemonUpdates).toHaveBeenCalledWith(
      'b',
      expect.objectContaining({ favorite: true }),
    );
  });

  it('rejects marking a For Trade Pokémon as Favorite', async () => {
    const { updater, getInstances, setData } = createHarness({
      trade: { is_caught: true, is_for_trade: true, favorite: false, last_update: 1 },
    });

    await expect(updater('trade', { favorite: true })).rejects.toThrow(
      'For Trade Pokémon cannot be marked as Favorite',
    );
    expect(getInstances().trade).toMatchObject({ is_for_trade: true, favorite: false });
    expect(setData).not.toHaveBeenCalled();
    expect(db.putBatchedPokemonUpdates).not.toHaveBeenCalled();
  });

  it('rejects listing a Favorite Pokémon For Trade', async () => {
    const { updater, getInstances, setData } = createHarness({
      favorite: { is_caught: true, is_for_trade: false, favorite: true, last_update: 1 },
    });

    await expect(updater('favorite', { is_for_trade: true })).rejects.toThrow(
      'Favorite Pokémon cannot be listed For Trade',
    );
    expect(getInstances().favorite).toMatchObject({ is_for_trade: false, favorite: true });
    expect(setData).not.toHaveBeenCalled();
    expect(db.putBatchedPokemonUpdates).not.toHaveBeenCalled();
  });

  it('no-ops for empty patch payloads', async () => {
    const { updater, setData } = createHarness({
      a: { cp: 10, last_update: 1 },
    });

    await updater('a', {});

    expect(setData).not.toHaveBeenCalled();
    expect(db.putInstancesBulk).not.toHaveBeenCalled();
    expect(db.putBatchedPokemonUpdates).not.toHaveBeenCalled();
  });

  it('logs updatesDB failures without throwing', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (db.putBatchedPokemonUpdates as any).mockRejectedValueOnce(new Error('queue down'));

    const { updater } = createHarness({
      a: { cp: 10, last_update: 1 },
    });

    await expect(updater('a', { cp: 99 })).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalledWith(
      '[updateInstanceDetails]',
      'updatesDB fail:',
      expect.any(Error),
    );
  });
});
