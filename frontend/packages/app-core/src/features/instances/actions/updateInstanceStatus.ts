// src/features/instances/actions/updateInstanceStatus.ts
import { RefObject } from 'react';
import { produce } from 'immer';
import { updatePokemonInstanceStatus } from '../services/updatePokemonInstanceStatus';
import { putBatchedPokemonUpdates, putInstancesBulk } from '@/db/indexedDB';
import { createScopedLogger } from '@/utils/logger';
import { setStorageNumber, STORAGE_KEYS } from '@/utils/storage';
import type { PokemonInstance } from '@/types/pokemonInstance';
import type {
  InstanceStatus,
  Instances,
  InstanceStatusMutationOperation,
  InstanceStatusMutationOutcome,
  InstanceStatusResultPatch,
} from '@/types/instances';
import { PokemonVariant } from '@/types/pokemonVariants';
import { enforceFavoriteTradeInvariant } from '@pokemongonexus/shared-domain/instances';

type AppState = {
  variants: PokemonVariant[];
  instances: Instances;
};

type UpdatePayload = Record<string, unknown>;

const log = createScopedLogger('updateInstanceStatus');

async function yieldToPaint() {
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}

function hasInstanceChanges(
  original: PokemonInstance | undefined,
  updated: PokemonInstance | undefined,
): boolean {
  if (!updated) return false;
  if (!original) return true;

  return Object.keys(updated).some((key) => {
    const nextValue = updated[key];
    const prevValue = original[key];
    return nextValue !== prevValue || !Object.prototype.hasOwnProperty.call(original, key);
  });
}

function isPlaceholder(entry: PokemonInstance | undefined): boolean {
  return !!entry && !entry.registered && !entry.is_caught && !entry.is_for_trade && !entry.is_wanted;
}

function buildPrunedPlaceholderPayload(
  id: string,
  snapshot: PokemonInstance | undefined,
  timestamp: number,
): UpdatePayload {
  return {
    ...(snapshot ?? {}),
    key: id,
    instance_id: id,
    is_caught: false,
    is_for_trade: false,
    is_wanted: false,
    registered: false,
    last_update: timestamp,
  };
}

function resolveSourceInstanceId(instances: Instances, target: string): string | null {
  if (instances[target]) return target;
  for (const [instanceId, instance] of Object.entries(instances)) {
    if (instance.instance_id === target) return instanceId;
  }
  return null;
}

function describeOperation({
  sourceKey,
  sourceInstanceId,
  resultingInstanceId,
  targetStatus,
  source,
  changed,
}: {
  sourceKey: string;
  sourceInstanceId: string | null;
  resultingInstanceId: string;
  targetStatus: InstanceStatus;
  source: PokemonInstance | undefined;
  changed: boolean;
}): InstanceStatusMutationOperation {
  if (!changed) return 'unchanged';
  if (sourceInstanceId && sourceInstanceId !== resultingInstanceId) return 'cloned';
  if (!sourceInstanceId || sourceKey !== resultingInstanceId) return 'created';
  if (source?.is_wanted && (targetStatus === 'Caught' || targetStatus === 'Trade')) {
    return 'converted';
  }
  return 'updated';
}

function hasTargetStatus(instance: PokemonInstance | undefined, status: InstanceStatus): boolean {
  if (!instance) return false;
  switch (status) {
    case 'Caught':
      return instance.is_caught && !instance.is_for_trade && !instance.is_wanted;
    case 'Trade':
      return instance.is_caught && instance.is_for_trade && !instance.is_wanted;
    case 'Wanted':
      return instance.is_wanted && !instance.is_caught && !instance.is_for_trade;
    case 'Missing':
      return !instance.is_caught && !instance.is_for_trade && !instance.is_wanted;
  }
}

export const updateInstanceStatus =
  (
    data: AppState,
    setData: (updater: (prev: AppState) => AppState) => AppState,
    instancesDataRef: RefObject<Instances>,
  ) =>
  async (
    instanceIds: string | string[],
    newStatus: InstanceStatus,
    onAlert?: (message: string) => void,
    resultPatch?: InstanceStatusResultPatch,
  ): Promise<InstanceStatusMutationOutcome[]> => {
    const keys = Array.isArray(instanceIds) ? instanceIds : [instanceIds];
    const timestamp = Date.now();
    const currentInstances = instancesDataRef.current ?? {};

    const changedKeys = new Set<string>();
    const outcomes: InstanceStatusMutationOutcome[] = [];

    const tempData = produce(currentInstances, (draft: Instances) => {
      for (const target of keys) {
        const sourceInstanceId = resolveSourceInstanceId(currentInstances, target);
        const source = sourceInstanceId ? currentInstances[sourceInstanceId] : undefined;
        const resolvedId = updatePokemonInstanceStatus(
          target,
          newStatus,
          data.variants,
          draft,
          onAlert,
        );
        if (!resolvedId) continue;

        const original = currentInstances[resolvedId];
        const updated = draft[resolvedId];
        const statusChanged = hasInstanceChanges(original, updated);
        const reachedTargetStatus = hasTargetStatus(updated, newStatus);
        const initialOperation = describeOperation({
          sourceKey: target,
          sourceInstanceId,
          resultingInstanceId: resolvedId,
          targetStatus: newStatus,
          source,
          changed: statusChanged && reachedTargetStatus,
        });
        if (updated && reachedTargetStatus && resultPatch) {
          const patch = typeof resultPatch === 'function'
            ? resultPatch({
                sourceKey: target,
                sourceInstanceId,
                resultingInstanceId: resolvedId,
                targetStatus: newStatus,
                operation: initialOperation,
              }, updated)
            : resultPatch;
          if (Object.keys(patch).length > 0) Object.assign(updated, patch);
        }
        if (updated) enforceFavoriteTradeInvariant(updated, 'trade');
        const persistedChange = hasInstanceChanges(original, updated);
        const changed = persistedChange && hasTargetStatus(updated, newStatus);
        if (persistedChange) changedKeys.add(resolvedId);
        outcomes.push({
          sourceKey: target,
          sourceInstanceId,
          resultingInstanceId: resolvedId,
          targetStatus: newStatus,
          operation: describeOperation({
            sourceKey: target,
            sourceInstanceId,
            resultingInstanceId: resolvedId,
            targetStatus: newStatus,
            source,
            changed,
          }),
          changed,
        });
      }
    });

    // Snapshot before prune
    const beforePruneSnapshot = new Map<string, PokemonInstance>();
    for (const k of changedKeys) {
      const row = tempData[k];
      if (row) beforePruneSnapshot.set(k, { ...row });
    }

    // Commit
    setData((prev) => ({ ...prev, instances: tempData }));
    instancesDataRef.current = tempData;

    // Prune redundant placeholders of same variant_id by scanning only once
    const prunedKeys = new Set<string>();
    const finalData = produce(tempData, (draft: Instances) => {
      // Build quick index of variant_id -> ids for targeted scans
      const byVariant: Record<string, string[]> = {};
      for (const id of Object.keys(draft)) {
        const variantId = draft[id]?.variant_id;
        if (!variantId) continue;
        (byVariant[variantId] ||= []).push(id);
      }

      for (const id of Object.keys(draft)) {
        const entry = draft[id];
        if (!isPlaceholder(entry)) continue;

        const variantKey = entry.variant_id;
        if (!variantKey) continue;

        const siblings = byVariant[variantKey] || [];
        const hasSibling = siblings.some((otherId) => otherId !== id);

        if (hasSibling) {
          prunedKeys.add(id);
          delete draft[id];
        }
      }
    });

    setData((prev) => ({ ...prev, instances: finalData }));
    instancesDataRef.current = finalData;

    // Build updates maps (changed + pruned)
    const updates = new Map<string, UpdatePayload>();
    for (const id of changedKeys) {
      const updated = finalData[id];
      if (updated) {
        updates.set(id, { ...updated, last_update: timestamp });
      } else if (prunedKeys.has(id)) {
        updates.set(id, buildPrunedPlaceholderPayload(id, beforePruneSnapshot.get(id), timestamp));
      }
    }

    // Give the browser a frame to paint before IO
    await yieldToPaint();

    // Local cache: write only updated/pruned keys
    try {
      const items: PokemonInstance[] = [];
      for (const [id, value] of updates) {
        items.push({ ...(value as PokemonInstance), instance_id: id });
      }
      if (items.length) await putInstancesBulk(items);
    } catch (err) {
      log.error('instancesDB write failed:', err);
    }

    // Timestamp for freshness checks
    setStorageNumber(STORAGE_KEYS.ownershipTimestamp, timestamp);

    // Queue to updatesDB; SW will batch-send to backend
    try {
      const promises: Array<Promise<unknown>> = [];
      for (const [id, value] of updates) {
        promises.push(putBatchedPokemonUpdates(id, value));
      }
      if (promises.length) await Promise.all(promises);
    } catch (err) {
      log.error('updatesDB write failed:', err);
    }

    return outcomes;
  };
