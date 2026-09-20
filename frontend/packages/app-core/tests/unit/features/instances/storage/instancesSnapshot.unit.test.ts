import { beforeEach, describe, expect, it, vi } from 'vitest';

import { initInstancesDB, INSTANCES_STORE } from '@/db/indexedDB';
import { getInstancesData, replaceInstancesData } from '@/features/instances/storage/instancesStorage';
import type { Instances } from '@/types/instances';
import type { PokemonInstance } from '@/types/pokemonInstance';

const previous: Instances = {
  owned: { instance_id: 'owned', variant_id: '0001-default', is_caught: true, is_for_trade: true } as PokemonInstance,
};
const replacement: Instances = Object.fromEntries(Array.from({ length: 600 }, (_, index) => [
  `new-${index}`,
  { instance_id: `new-${index}`, variant_id: '0001-default', is_caught: true } as PokemonInstance,
]));

describe('collection snapshot transactions', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await replaceInstancesData(previous, 1);
  });

  it('preserves the previous collection and timestamp when a save is interrupted after 500 rows', async () => {
    const originalPut = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (value, key) {
      const request = originalPut.call(this, value, key);
      if (value.instance_id === 'new-550') {
        request.addEventListener('success', () => this.transaction.abort());
      }
      return request;
    });

    await expect(replaceInstancesData(replacement, 2)).rejects.toMatchObject({ name: 'AbortError' });
    expect(await getInstancesData()).toEqual({ data: previous, timestamp: 1 });
  });

  it('never exposes a cleared or partial collection to a concurrent reader', async () => {
    const db = (await initInstancesDB())!;
    const originalClear = IDBObjectStore.prototype.clear;
    let concurrentRead: Promise<PokemonInstance[]> | undefined;
    vi.spyOn(IDBObjectStore.prototype, 'clear').mockImplementation(function () {
      const request = originalClear.call(this);
      request.addEventListener('success', () => {
        concurrentRead = db.getAll(INSTANCES_STORE);
      });
      return request;
    });

    await replaceInstancesData(replacement, 2);
    expect(await concurrentRead).toHaveLength(600);
    expect(await getInstancesData()).toEqual({ data: replacement, timestamp: 2 });
  });

  it('rolls back a synchronous serialization failure as well as the queued clear', async () => {
    const invalid = { ...replacement, invalid: { instance_id: 'invalid', uncloneable: () => undefined } } as unknown as Instances;

    await expect(replaceInstancesData(invalid, 2)).rejects.toMatchObject({ name: 'DataCloneError' });
    expect(await getInstancesData()).toEqual({ data: previous, timestamp: 1 });
  });
});
