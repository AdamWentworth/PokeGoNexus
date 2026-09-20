// src/features/instances/storage/instancesStorage.ts
import * as idb from '@/db/indexedDB';
import { generateUUID } from '@/utils/PokemonIDUtils';
import { createNewInstanceData } from '../utils/createNewInstanceData';
import { createScopedLogger, loggerInternals } from '@/utils/logger';
import {
  getStorageNumber,
  setStorageNumber,
  STORAGE_KEYS,
} from '@/utils/storage';

import type { Instances } from '@/types/instances';
import type { PokemonInstance } from '@/types/pokemonInstance';
import type { PokemonVariant } from '@/types/pokemonVariants';

const log = createScopedLogger('instancesStorage');
const canDebugLog = loggerInternals.shouldEmit('debug');

export async function getInstancesData(): Promise<{
  data: Instances;
  timestamp: number;
}> {
  const data = await idb.getAllInstances<PokemonInstance>();
  const instances: Instances = {};

  data.forEach((item) => {
    if (item.instance_id) {
      instances[item.instance_id] = item;
    } else if (canDebugLog) {
      log.warn('Skipped item without instance_id', item);
    }
  });

  const rawTs = getStorageNumber(STORAGE_KEYS.ownershipTimestamp, 0);
  const timestamp = rawTs > 0 ? rawTs : 0;
  return { data: instances, timestamp };
}

/**
 * Upsert many items; used by initializer flows.
 */
export async function setInstancesData(payload: {
  data: Instances;
  timestamp: number;
}): Promise<void> {
  const t0 = performance.now();
  const items: PokemonInstance[] = Object.entries(payload.data).map(([instance_id, row]) => ({
    ...row,
    instance_id,
  }));

  await idb.putInstancesBulk(items);

  if (canDebugLog) {
    log.debug(`Stored instances into IndexedDB in ${Math.round(performance.now() - t0)} ms`);
  }

  setStorageNumber(STORAGE_KEYS.ownershipTimestamp, payload.timestamp);
}

/**
 * Authoritative REPLACE: atomically replace the full snapshot.
 * Use this right after mergeInstancesData so the cache matches UI exactly.
 * Readers (including a newly opened page) must see either the previous snapshot
 * or the complete replacement, even if a page closes during persistence.
 */
export async function replaceInstancesData(
  data: Instances,
  timestamp: number,
): Promise<void> {
  const t0 = performance.now();
  const items: PokemonInstance[] = Object.entries(data).map(([instance_id, row]) => ({
    ...row,
    instance_id,
  }));

  const db = await idb.initInstancesDB();
  if (!db) return;
  const tx = db.transaction(idb.INSTANCES_STORE, 'readwrite');
  const writes: Promise<unknown>[] = [];
  try {
    // Queue requests together instead of waiting for each individual row.
    // Yielding to a paint here would allow IndexedDB to commit a partial save.
    writes.push(tx.store.clear());
    for (const item of items) writes.push(tx.store.put(item));
    await Promise.all([...writes, tx.done]);
  } catch (error) {
    // A synchronous put failure (for example DataCloneError) does not abort
    // the transaction automatically. Roll back its clear and earlier writes.
    try { tx.abort(); } catch { /* The transaction may already have aborted. */ }
    await Promise.allSettled([...writes, tx.done]);
    throw error;
  }

  if (canDebugLog) {
    log.debug(`[replaceInstancesData] wrote ${items.length} rows in ${Math.round(performance.now() - t0)} ms`);
  }

  setStorageNumber(STORAGE_KEYS.ownershipTimestamp, timestamp);
}

export async function initializeOrUpdateInstancesData(
  _keys: string[], // still passed in, but not required for computation below
  variants: PokemonVariant[],
): Promise<Instances> {
  try {
    const { data: stored } = await getInstancesData();
    if (canDebugLog) {
      log.debug('Parsed instancesData', stored);
    }

    let shouldUpdate = false;

    const existingVariantIds = new Set(
      Object.values(stored)
        .map((entry) => entry.variant_id)
        .filter((variantId): variantId is string => Boolean(variantId))
    );

    const t0 = performance.now();
    variants.forEach((variant) => {
      const vkey = variant.variant_id;
      if (!vkey || existingVariantIds.has(vkey)) return;

      const instance_id = generateUUID();
      const newEntry: PokemonInstance = {
        ...createNewInstanceData(variant),
        instance_id,
        variant_id: vkey,
      };
      stored[instance_id] = newEntry;
      shouldUpdate = true;
    });

    if (canDebugLog) {
      log.debug(`Init/update pass took ${Math.round(performance.now() - t0)} ms`);
    }

    if (shouldUpdate) {
      await setInstancesData({ data: stored, timestamp: Date.now() });
    } else if (canDebugLog) {
      log.debug('No updates required');
    }

    return stored;
  } catch (err) {
    log.error('Failed', err);
    throw new Error('Failed to update instances data');
  }
}
