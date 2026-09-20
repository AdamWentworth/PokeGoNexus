// src/features/instances/store/useInstancesStore.ts

import { create } from 'zustand';
import { periodicUpdates as periodicFactory } from '@/stores/BatchedUpdates/periodicUpdates';
import { mergeInstancesData } from '@/features/instances/utils/mergeInstancesData';
import { updateInstanceStatus as makeUpdateStatus } from '@/features/instances/actions/updateInstanceStatus';
import { updateInstanceDetails as makeUpdateDetails } from '@/features/instances/actions/updateInstanceDetails';
import { useAuthStore } from '@/stores/useAuthStore';
import { useVariantsStore } from '@/features/variants/store/useVariantsStore';
import { replaceInstancesData } from '@/features/instances/storage/instancesStorage';
import { areInstancesEqual } from '@/features/instances/utils/instancesEquality';
import { createScopedLogger } from '@/utils/logger';
import { removeStorageKey, STORAGE_KEYS } from '@/utils/storage';

import type {
  Instances,
  InstanceStatus,
  InstanceStatusMutationOutcome,
  InstanceStatusResultPatch,
} from '@/types/instances';
import type { PokemonInstance } from '@/types/pokemonInstance';

type Patch = Partial<PokemonInstance>;
type PatchMap = Record<string, Patch>;
const log = createScopedLogger('InstancesStore');

interface InstancesStore {
  instances: Instances;
  foreignInstances: Instances | null;
  instancesLoading: boolean;
  setForeignInstances(data: Instances): void;
  resetForeignInstances(): void;
  resetInstances(): void;
  hydrateInstances(data: Instances): void;
  setInstances(data: Instances): void;
  replaceInstances(data: Instances): Promise<void>;
  applyAuthoritativeInstanceChanges(data: Instances): Promise<void>;
  updateInstanceStatus(
    instanceIds: string | string[],
    newStatus: InstanceStatus,
    onAlert?: (message: string) => void,
    resultPatch?: InstanceStatusResultPatch,
  ): Promise<InstanceStatusMutationOutcome[]>;
  updateInstanceDetails(keyOrKeysOrMap: string | string[] | PatchMap, patch?: Patch): Promise<void>;
  periodicUpdates(): void;
}

export const useInstancesStore = create<InstancesStore>()((set, get) => {
  const scheduledRef = { current: null as boolean | null };
  const timerRef = { current: null as NodeJS.Timeout | null };
  const periodicUpdates = periodicFactory(scheduledRef, timerRef);

  return {
    instances: {},
    foreignInstances: null,
    instancesLoading: true,

    resetInstances() {
      log.debug('resetInstances()');
      set({ instances: {}, instancesLoading: true });
      removeStorageKey(STORAGE_KEYS.ownershipTimestamp);
    },

    hydrateInstances(data) {
      try {
        if (!data) {
          log.debug('No data to hydrate');
          set({ instances: {}, instancesLoading: false });
          return;
        }
        const count = Object.keys(data).length;
        log.debug(`Hydrated ${count} instance${count === 1 ? '' : 's'} from cache`);
        set({ instances: data, instancesLoading: false });
      } catch (error) {
        log.error('Hydration failed', error);
        set({ instances: {}, instancesLoading: false });
      }
    },

    setForeignInstances(data) {
      const count = Object.keys(data).length;
      log.debug(`Set foreignInstances with ${count} items`);
      set({ foreignInstances: data });
    },

    resetForeignInstances() {
      log.debug('Reset foreignInstances');
      set({ foreignInstances: null });
    },

    async setInstances(incoming) {
      if (!incoming || !Object.keys(incoming).length) {
        log.debug('No incoming data; skipping set');
        return;
      }

      const current = get().instances;
      if (areInstancesEqual(current, incoming)) {
        log.debug('No changes; incoming data matches current');
        return;
      }

      const username = useAuthStore.getState().user?.username ?? '';
      const merged = mergeInstancesData(current, incoming, username);

      const ts = Date.now();
      set({ instances: merged });
      log.debug(`Updated instances; now tracking ${Object.keys(merged).length} records`);

      // Authoritative replace of cache snapshot to avoid drift.
      try {
        await replaceInstancesData(merged, ts);
      } catch (error) {
        log.warn('Failed to persist merged snapshot', error);
      }
    },

    async replaceInstances(data) {
      const ts = Date.now();
      set({ instances: data, instancesLoading: false });
      await replaceInstancesData(data, ts);
    },

    async applyAuthoritativeInstanceChanges(incoming) {
      if (!incoming || !Object.keys(incoming).length) return;

      const currentUserID = useAuthStore.getState().user?.user_id;
      if (!currentUserID) {
        log.warn('Cannot apply authoritative ownership changes without a current user');
        return;
      }

      const next = { ...get().instances };
      for (const [instanceID, instance] of Object.entries(incoming)) {
        if (instance.user_id === currentUserID) {
          next[instanceID] = { ...next[instanceID], ...instance, instance_id: instanceID };
        } else {
          delete next[instanceID];
        }
      }

      const ts = Date.now();
      set({ instances: next });
      try {
        await replaceInstancesData(next, ts);
      } catch (error) {
        log.warn('Failed to persist authoritative ownership changes', error);
      }
    },

    async updateInstanceStatus(instanceIds, newStatus, onAlert, resultPatch) {
      log.debug(
        `Updating status for ${Array.isArray(instanceIds) ? instanceIds.length : 1} records to "${newStatus}"`,
      );

      const fn = makeUpdateStatus(
        {
          variants: useVariantsStore.getState().variants,
          instances: get().instances,
        },
        updater => {
          const res = updater({
            variants: useVariantsStore.getState().variants,
            instances: get().instances,
          });
          set({ instances: res.instances });
          if (Array.isArray(instanceIds)) {
            const after = res.instances;
            for (const key of instanceIds) {
              const row = after[key];
              if (row) {
                log.debug('Post-status flags', newStatus, key, {
                  caught: row.is_caught,
                  trade: row.is_for_trade,
                  wanted: row.is_wanted,
                  missing: !row.registered,
                });
              }
            }
          }
          return res;
        },
        { current: get().instances },
      );

      const outcomes = await fn(instanceIds, newStatus, onAlert, resultPatch);
      get().periodicUpdates();
      return outcomes;
    },

    async updateInstanceDetails(keyOrKeysOrMap, patch) {
      log.debug('Updating details for', keyOrKeysOrMap);

      const fn = makeUpdateDetails(
        { instances: get().instances },
        updater => {
          const res = updater({ instances: get().instances });
          set({ instances: res.instances as Instances });
          return res;
        },
      );

      const isPatchMapInput = typeof keyOrKeysOrMap === 'object' && !Array.isArray(keyOrKeysOrMap);
      if (isPatchMapInput && patch === undefined) {
        await fn(keyOrKeysOrMap);
      } else {
        const keys = typeof keyOrKeysOrMap === 'string' || Array.isArray(keyOrKeysOrMap)
          ? keyOrKeysOrMap
          : [];
        await fn(keys, patch ?? {});
      }
      get().periodicUpdates();
    },

    periodicUpdates,
  };
});
