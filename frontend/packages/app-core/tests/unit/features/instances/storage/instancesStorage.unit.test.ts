import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as idb from '@/db/indexedDB';
import * as idUtils from '@/utils/PokemonIDUtils';
import {
  getInstancesData,
  setInstancesData,
  replaceInstancesData,
  initializeOrUpdateInstancesData,
} from '@/features/instances/storage/instancesStorage';

describe('instancesStorage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();

    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });

    vi.spyOn(idb, 'getAllInstances').mockResolvedValue([] as any);
    vi.spyOn(idb, 'putInstancesBulk').mockResolvedValue(undefined);
  });

  it('getInstancesData maps by instance_id and sanitizes timestamp', async () => {
    (idb.getAllInstances as any).mockResolvedValue([
      { instance_id: 'i-1', variant_id: '0001-default' },
      { variant_id: 'missing-id' },
    ]);
    localStorage.setItem('ownershipTimestamp', '-100');

    const { data, timestamp } = await getInstancesData();

    expect(Object.keys(data)).toEqual(['i-1']);
    expect(timestamp).toBe(0);
  });

  it('setInstancesData upserts rows and stores timestamp', async () => {
    await setInstancesData({
      data: {
        'i-1': { variant_id: '0001-default', pokemon_id: 1, is_caught: false, is_for_trade: false, is_wanted: false, registered: false, last_update: 1 } as any,
      },
      timestamp: 77,
    });

    expect(idb.putInstancesBulk).toHaveBeenCalledWith([
      expect.objectContaining({ instance_id: 'i-1', variant_id: '0001-default' }),
    ]);
    expect(localStorage.getItem('ownershipTimestamp')).toBe('77');
  });

  it('replaceInstancesData clears then rewrites snapshot rows', async () => {
    const clear = vi.fn(async () => {});
    const put = vi.fn(async () => {});

    const fakeDb = {
      transaction: vi.fn().mockImplementation(() => ({
        store: {
          clear,
          put,
        },
        done: Promise.resolve(),
      })),
    };

    vi.spyOn(idb, 'initInstancesDB').mockResolvedValue(fakeDb as any);

    await replaceInstancesData(
      {
        'i-1': { variant_id: '0001-default', pokemon_id: 1, last_update: 1 } as any,
        'i-2': { variant_id: '0002-default', pokemon_id: 2, last_update: 2 } as any,
      },
      999,
    );

    expect(clear).toHaveBeenCalledTimes(1);
    expect(put).toHaveBeenCalledTimes(2);
    expect(fakeDb.transaction).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('ownershipTimestamp')).toBe('999');
  });

  it('initializeOrUpdateInstancesData creates missing variant baselines', async () => {
    vi.spyOn(idUtils, 'generateUUID').mockReturnValue('generated-uuid');

    const variants = [
      { variant_id: '0001-default', pokemon_id: 1, variantType: 'default', currentImage: '', species_name: 'Bulbasaur' },
    ] as any;

    const out = await initializeOrUpdateInstancesData([], variants);

    expect(
      Object.values(out).some((row: any) => row?.variant_id === '0001-default'),
    ).toBe(true);
    expect(idb.putInstancesBulk).toHaveBeenCalled();
  });

  it('initializeOrUpdateInstancesData skips write when no variants are missing', async () => {
    (idb.getAllInstances as any).mockResolvedValue([
      { instance_id: 'existing-1', variant_id: '0001-default', pokemon_id: 1 },
    ]);

    const variants = [
      { variant_id: '0001-default', pokemon_id: 1, variantType: 'default', currentImage: '', species_name: 'Bulbasaur' },
    ] as any;

    const beforeWrites = (idb.putInstancesBulk as any).mock.calls.length;
    const out = await initializeOrUpdateInstancesData([], variants);
    const afterWrites = (idb.putInstancesBulk as any).mock.calls.length;

    expect(out).toHaveProperty('existing-1');
    expect(afterWrites).toBe(beforeWrites);
  });

  it('initializeOrUpdateInstancesData wraps fetch errors', async () => {
    (idb.getAllInstances as any).mockRejectedValueOnce(new Error('db read failed'));

    await expect(initializeOrUpdateInstancesData([], [])).rejects.toThrow(
      'Failed to update instances data',
    );
  });
});
