import { create } from 'zustand';
import { openDB } from 'idb';

import type { Instances } from '@/types/instances';
import { useInstancesStore } from '@/features/instances/store/useInstancesStore';
import { useTagsStore } from '@/features/tags/store/useTagsStore';
import { createScopedLogger } from '@/utils/logger';
import { fetchForeignInstancesByUsername } from '@/services/userSearchService';
import { caseFold, equalsCaseInsensitive } from '@shared-contracts/domain';

const CACHE_NAME = 'SearchCache';
const log = createScopedLogger('UserSearchStore');

type SearchCacheRecord = {
  username: string;
  instances: Instances;
  timestamp: number;
  etag: string | null;
};

function replaceAddressBar(oldName: string, newName: string) {
	if (oldName !== newName) {
		const path = window.location.pathname;
		const segments = path.split('/');
		const last = segments[segments.length - 1];
		if (last && equalsCaseInsensitive(last, oldName)) {
			segments[segments.length - 1] = newName;
			const nextPath = segments.join('/');
			window.history.replaceState(
				window.history.state,
				'',
				`${nextPath}${window.location.search}${window.location.hash}`
			);
		}
	}
}

function getCachedInstances(record: SearchCacheRecord | null): Instances | null {
  if (!record) return null;
  return record.instances ?? null;
}

interface UserSearchStore {
  viewedInstances: Instances | null;
  canonicalUsername: string | null;
  foreignInstancesLoading: boolean;
  userExists: boolean | null;
  fetchUserInstancesByUsername: (
    searchedUsername: string,
    setOwnershipFilter?: (tag: string) => void,
    defaultFilter?: string,
    alertFn?: (msg: string) => Promise<void>
  ) => Promise<string | void>;
  loadForeignProfile: (
    username: string,
    resetTagFilter: () => void
  ) => Promise<string | void>;
  resetUserSearch: () => void;
}

export const useUserSearchStore = create<UserSearchStore>((set, get) => ({
  viewedInstances: null,
  canonicalUsername: null,
  foreignInstancesLoading: false,
  userExists: null,

  async fetchUserInstancesByUsername(
    searchedUsername,
    setOwnershipFilter,
    defaultFilter = 'Caught',
    alertFn
  ) {
    log.debug('fetchUserInstancesByUsername ->', searchedUsername);
    set({ foreignInstancesLoading: true, userExists: null });
    let db: Awaited<ReturnType<typeof openDB>> | null = null;

    try {
      const lower = caseFold(searchedUsername);
      db = await openDB(CACHE_NAME, 1, {
        upgrade(upgradeDB) {
          if (!upgradeDB.objectStoreNames.contains(CACHE_NAME)) {
            upgradeDB.createObjectStore(CACHE_NAME, { keyPath: 'username' });
          }
        },
      });

      // Fast-path common lookups before a full key scan.
      const exactCached = (await db.get(CACHE_NAME, searchedUsername)) as SearchCacheRecord | null;
      const lowerCached =
        searchedUsername === lower
          ? exactCached
          : ((await db.get(CACHE_NAME, lower)) as SearchCacheRecord | null);

      let cached = exactCached ?? lowerCached ?? null;
      let canonicalKey: string | null = cached?.username ?? null;

      if (!cached) {
        for (const key of await db.getAllKeys(CACHE_NAME)) {
          if (typeof key === 'string' && equalsCaseInsensitive(key, lower)) {
            canonicalKey = key;
            cached = (await db.get(CACHE_NAME, canonicalKey)) as SearchCacheRecord | null;
            break;
          }
        }
      }

      const cachedInstances = getCachedInstances(cached);
      const cachedEtag = cached?.etag ?? null;
      const outcome = await fetchForeignInstancesByUsername(lower, cachedEtag);

      if (outcome.type === 'notModified' && cached && cachedInstances) {
        log.debug('304 - using cached data');
        useInstancesStore.getState().setForeignInstances(cachedInstances);
        set({
          viewedInstances: cachedInstances,
          canonicalUsername: cached.username,
          userExists: true,
        });
        setOwnershipFilter?.(defaultFilter);
        return cached.username;
      }

      if (outcome.type === 'success') {
        const actualUsername = outcome.username;
        const instances = outcome.instances;

        replaceAddressBar(searchedUsername, actualUsername);
        useInstancesStore.getState().setForeignInstances(instances);

        set({
          viewedInstances: instances,
          canonicalUsername: actualUsername,
          userExists: true,
        });

        await db.put(CACHE_NAME, {
          username: actualUsername,
          instances,
          timestamp: Date.now(),
          etag: outcome.etag,
        } as SearchCacheRecord);

        setOwnershipFilter?.(defaultFilter);
        return actualUsername;
      }

      if (outcome.type === 'notFound') {
        log.info('404 - user not found');
        set({ userExists: false });
      } else if (outcome.type === 'forbidden') {
        if (alertFn) await alertFn('You must be logged in to perform this search.');
      } else if (outcome.type === 'notModified') {
        log.error('304 with no cache available');
      } else if (outcome.type === 'error') {
        log.error('fetch failed', outcome.status, outcome.statusText);
      }

      // Avoid leaking stale foreign profile data after failed lookups.
      useInstancesStore.getState().resetForeignInstances();
      set({
        viewedInstances: null,
        canonicalUsername: null,
      });
    } catch (err) {
      log.error('fetch error', err);
      useInstancesStore.getState().resetForeignInstances();
      set({
        viewedInstances: null,
        canonicalUsername: null,
      });
    } finally {
      db?.close();
      set({ foreignInstancesLoading: false });
    }
  },

  loadForeignProfile(username, resetTagFilter) {
    const { fetchUserInstancesByUsername } = get();
    return fetchUserInstancesByUsername(username, resetTagFilter, 'Caught');
  },

  resetUserSearch() {
    useInstancesStore.getState().resetForeignInstances();
    set({
      viewedInstances: null,
      canonicalUsername: null,
      foreignInstancesLoading: false,
      userExists: null,
    });
    useTagsStore.getState().buildForeignTags({});
  },
}));
