// src/features/instances/actions/updateInstanceDetails.ts
import { produce } from 'immer';
import { putBatchedPokemonUpdates, putInstancesBulk } from '@/db/indexedDB';
import { createScopedLogger } from '@/utils/logger';
import { setStorageNumber, STORAGE_KEYS } from '@/utils/storage';
import {
  getFavoriteTradeConflict,
  resolveInstanceCollectionKey,
} from '@pokemongonexus/shared-domain/instances';
import type { PokemonInstance } from '@/types/pokemonInstance';
import type { MutableInstances, SetInstancesFn } from '@/types/instances';

type Patch = Partial<PokemonInstance>;
type PatchMap = Record<string, Patch>;
type InstanceSnapshot = Partial<PokemonInstance>;
type PersistedInstance = InstanceSnapshot & { instance_id: string };
const log = createScopedLogger('updateInstanceDetails');

async function yieldToPaint() {
  await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
}

/**
 * Updates fields (e.g., IVs, nickname) on one or more Pokémon instances.
 *
 * Overloads:
 * - updater(keyOrKeys: string | string[], patch: Patch): Promise<void>
 * - updater(patchMap: Record<string, Patch>): Promise<void>
 */
export function updateInstanceDetails(
  data: { instances: MutableInstances },
  setData: SetInstancesFn,
): {
  (keyOrKeys: string | string[], patch: Patch): Promise<void>;
  (patchMap: PatchMap): Promise<void>;
} {
  return async (
    keyOrKeysOrMap: string | string[] | PatchMap,
    maybePatch?: Patch,
  ): Promise<void> => {
    const timestamp = Date.now();
    const updatedKeys: string[] = [];

    // Immutable local map update
    const newMap = produce(data.instances, (draft: MutableInstances) => {
      const apply = (key: string, patch: Patch): string | null => {
        if (!patch || Object.keys(patch).length === 0) return null;

        const resolvedKey = resolveInstanceCollectionKey(draft, key) ?? key;
        const existing = draft[resolvedKey];
        if (!existing) {
          log.warn('"%s" missing - creating placeholder', key);
          draft[resolvedKey] = {};
        }

        const current = draft[resolvedKey] ?? {};
        const conflict = getFavoriteTradeConflict(current, patch);
        if (conflict) throw new Error(conflict);
        const hasActualChange = Object.entries(patch).some(
          ([field, value]) => !Object.is(current[field], value)
        );
        if (!hasActualChange) return null;

        draft[resolvedKey] = {
          ...current,
          ...patch,
          last_update: timestamp,
        };
        return resolvedKey;
      };

      const isPatchMap = (input: unknown): input is PatchMap =>
        typeof input === 'object' && input !== null && !Array.isArray(input);

      if (isPatchMap(keyOrKeysOrMap) && maybePatch === undefined) {
        for (const [key, patch] of Object.entries(keyOrKeysOrMap)) {
          const updatedKey = apply(key, patch);
          if (updatedKey && !updatedKeys.includes(updatedKey)) updatedKeys.push(updatedKey);
        }
      } else {
        const keys =
          typeof keyOrKeysOrMap === 'string'
            ? [keyOrKeysOrMap]
            : Array.isArray(keyOrKeysOrMap)
            ? keyOrKeysOrMap
            : [];
        const patch: Patch = maybePatch ?? {};
        for (const key of keys) {
          const updatedKey = apply(key, patch);
          if (updatedKey && !updatedKeys.includes(updatedKey)) updatedKeys.push(updatedKey);
        }
      }
    });

    if (updatedKeys.length === 0) return;

    // Commit to React state
    setData(prev => ({ ...prev, instances: newMap }));

    // Give the browser a frame to paint before heavy IO
    await yieldToPaint();

    // Local cache: write only changed keys directly to instancesDB
    try {
      const items: PersistedInstance[] = updatedKeys
        .map((id) => {
          const snapshot = newMap[id];
          return snapshot ? { ...snapshot, instance_id: id } : null;
        })
        .filter((item): item is PersistedInstance => item !== null);
      if (items.length) {
        await putInstancesBulk(items);
      }
    } catch (err) {
      log.error('instancesDB write failed:', err);
    }

    // Local timestamp (used by freshness checks)
    setStorageNumber(STORAGE_KEYS.ownershipTimestamp, timestamp);

    // Queue patches to updatesDB for SW network batching
    const queueEntries: Array<{ key: string; snapshot: InstanceSnapshot }> = updatedKeys
      .map((key) => {
        const snapshot = newMap[key];
        return snapshot ? { key, snapshot } : null;
      })
      .filter((entry): entry is { key: string; snapshot: InstanceSnapshot } => entry !== null);

    try {
      const promises = queueEntries.map((entry) => putBatchedPokemonUpdates(entry.key, entry.snapshot));
      if (promises.length) await Promise.all(promises);
    } catch (err) {
      log.error('updatesDB fail:', err);
    }

    // Dev logging
    if (import.meta.env.DEV) {
      log.debug('patches saved', {
        timestamp,
        updatedKeys,
        patches: Object.fromEntries(queueEntries.map((entry) => [entry.key, entry.snapshot])),
      });
    }
  };
}
