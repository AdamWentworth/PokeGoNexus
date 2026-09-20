// src/features/tags/store/useTagsStore.ts

import { create } from 'zustand';

import {
  getAllTagDefs,
  replaceTagDefs,
  persistSystemMembershipsFromBuckets,
  getSystemChildrenSnapshot,
  setSystemChildrenSnapshot,
  type SystemChildrenIdsSnapshot,
} from '@/db/tagsDB';

import { getAllVariants }  from '@/db/variantsDB';
import { getAllInstances } from '@/db/instancesDB';

import { initializePokemonTags } from '../utils/initializePokemonTags';
import { isDataFresh }          from '@/utils/cacheHelpers';
import { createScopedLogger }   from '@/utils/logger';
import {
  getStoredUser,
  getStorageNumber,
  removeStorageKey,
  setStorageNumber,
  STORAGE_KEYS,
} from '@/utils/storage';

import { useVariantsStore }  from '@/features/variants/store/useVariantsStore';
import { useInstancesStore } from '@/features/instances/store/useInstancesStore';
import { useAuthStore }      from '@/stores/useAuthStore';
import {
  readCachedTagOrders,
  writeCachedTagOrders,
} from '@/features/tags/utils/tagOrderCache';

import type { TagBuckets, TagItem } from '@/types/tags';
import type { Instances }           from '@/types/instances';
import type { PokemonVariant }      from '@/types/pokemonVariants';
import type { PokemonInstance }     from '@/types/pokemonInstance';
import type { TagDef }              from '@/db/tagsDB';
import type {
  CustomTagDefinition,
  CustomTagParent,
  PokemonTagOrderKey,
  PokemonTagOrders,
} from '@shared-contracts/users';
import {
  createCustomTag as createCustomTagRequest,
  deleteCustomTag as deleteCustomTagRequest,
  fetchCustomTags,
  updatePokemonTagOrder,
  updateCustomTag as updateCustomTagRequest,
} from '@/services/tagService';

const log = createScopedLogger('useTagsStore');

/* ------------ Types for custom tag tree (NO trade parent) ------------ */

export interface CustomTagBucket {
  tag: TagDef;
  items: Record<string, TagItem>;
}

export interface CustomTagsTree {
  caught: Record<string, CustomTagBucket>;
  wanted: Record<string, CustomTagBucket>;
}

/* ------------ System children (computed) ------------ */

export interface SystemChildren {
  caught: { favorite: Record<string, TagItem>; trade: Record<string, TagItem>; };
  wanted: { mostWanted: Record<string, TagItem>; };
}

// We keep TagBuckets.trade in memory for backward-compat,
// but we DO NOT treat it as a parent or read it to compute children/UI.
const EMPTY_BUCKETS: TagBuckets = { caught: {}, wanted: {}, trade: {} };
const EMPTY_CUSTOM  : CustomTagsTree = { caught: {}, wanted: {} };
export const DEFAULT_POKEMON_TAG_ORDERS: PokemonTagOrders = {
  caught: ['system:caught', 'system:favorites', 'system:trade'],
  wanted: ['system:wanted', 'system:most-wanted'],
};

const customTagOrderKey = (tagId: string): PokemonTagOrderKey => `custom:${tagId}`;

const currentUserId = (): string | null =>
  useAuthStore.getState().user?.user_id ?? getStoredUser()?.user_id ?? null;

function normalizePokemonTagOrders(
  orders: Partial<PokemonTagOrders> | null | undefined,
  definitions: TagDef[],
): PokemonTagOrders {
  const normalizeParent = (parent: CustomTagParent): PokemonTagOrderKey[] => {
    const available = [
      ...DEFAULT_POKEMON_TAG_ORDERS[parent],
      ...definitions
        .filter((tag) => !tag.deleted_at && tag.parent === parent)
        .sort((left, right) =>
          (left.sort ?? 0) - (right.sort ?? 0) || left.name.localeCompare(right.name))
        .map((tag) => customTagOrderKey(tag.tag_id)),
    ];
    const allowed = new Set<PokemonTagOrderKey>(available);
    const seen = new Set<PokemonTagOrderKey>();
    const normalized: PokemonTagOrderKey[] = [];
    for (const key of orders?.[parent] ?? []) {
      if (!allowed.has(key) || seen.has(key)) continue;
      seen.add(key);
      normalized.push(key);
    }
    for (const key of available) {
      if (seen.has(key)) continue;
      normalized.push(key);
    }
    return normalized;
  };

  return {
    caught: normalizeParent('caught'),
    wanted: normalizeParent('wanted'),
  };
}

function computeSystemChildren(tags: TagBuckets): SystemChildren {
  const favorite   : Record<string, TagItem> = {};
  const tradeChild : Record<string, TagItem> = {};
  const mostWanted : Record<string, TagItem> = {};

  // Favorite + Trade strictly from CAUGHT
  for (const [id, item] of Object.entries(tags.caught)) {
    if (item.favorite)     favorite[id]   = item;
    if (item.is_for_trade) tradeChild[id] = item;
  }

  // Most Wanted strictly from WANTED
  for (const [id, item] of Object.entries(tags.wanted)) {
    if (item.most_wanted) mostWanted[id] = item;
  }

  return { caught: { favorite, trade: tradeChild }, wanted: { mostWanted } };
}

function toSnapshotIds(sys: SystemChildren): SystemChildrenIdsSnapshot {
  return {
    caught_favorite_ids   : Object.keys(sys.caught.favorite),
    caught_trade_ids      : Object.keys(sys.caught.trade),
    wanted_mostWanted_ids : Object.keys(sys.wanted.mostWanted),
    version: 1,
  };
}

function idsToChildren(snap: SystemChildrenIdsSnapshot, buckets: TagBuckets): SystemChildren {
  const pick = (ids: string[], src: Record<string, TagItem>) => {
    const out: Record<string, TagItem> = {};
    for (const id of ids) if (src[id]) out[id] = src[id];
    return out;
  };

  // Rehydrate purely from their parent buckets
  return {
    caught: {
      favorite: pick(snap.caught_favorite_ids, buckets.caught),
      trade   : pick(snap.caught_trade_ids,    buckets.caught),
    },
    wanted: {
      mostWanted: pick(snap.wanted_mostWanted_ids, buckets.wanted),
    },
  };
}

/* ------------ Store ------------ */

interface TagsStore {
  tags             : TagBuckets;
  customTags       : CustomTagsTree;
  tagOrders        : PokemonTagOrders;
  systemChildren   : SystemChildren;
  tagsLoading      : boolean;
  customTagsLoading: boolean;
  foreignTags      : TagBuckets | null;

  buildTags       (): Promise<void>;
  refreshTags     (): Promise<void>;
  resetTags       : () => void;
  hydrateFromCache: () => Promise<void>;
  buildForeignTags(instances: Instances): void;

  rebuildCustomTags(): Promise<void>;
  refreshCustomTagDefinitions(): Promise<void>;
  createCustomTag(input: { parent: CustomTagParent; name: string; color: string }): Promise<TagDef>;
  updateCustomTag(tagId: string, input: { name?: string; color?: string }): Promise<TagDef>;
  deleteCustomTag(tagId: string): Promise<void>;
  saveTagOrder(parent: CustomTagParent, tagKeys: PokemonTagOrderKey[]): Promise<void>;
  applyCustomTagChanges(
    instanceIds: Iterable<string>,
    changes: Record<string, boolean>,
  ): Promise<{ updated: number; skipped: number }>;
}

function normalizeTagIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  for (const entry of value) {
    const raw = typeof entry === 'string'
      ? entry
      : entry && typeof entry === 'object'
        ? (entry as { tag_id?: unknown; id?: unknown; value?: unknown }).tag_id ??
          (entry as { id?: unknown }).id ??
          (entry as { value?: unknown }).value
        : null;
    if (typeof raw === 'string' && raw.trim()) ids.add(raw.trim());
  }
  return [...ids];
}

function toLocalTagDef(tag: CustomTagDefinition): TagDef {
  return {
    ...tag,
    parent: tag.parent,
    color: tag.color,
    sort: tag.sort,
    deleted_at: null,
  };
}

export const useTagsStore = create<TagsStore>()((set, get) => ({
  tags             : { ...EMPTY_BUCKETS },
  customTags       : { ...EMPTY_CUSTOM },
  tagOrders        : {
    caught: [...DEFAULT_POKEMON_TAG_ORDERS.caught],
    wanted: [...DEFAULT_POKEMON_TAG_ORDERS.wanted],
  },
  systemChildren   : computeSystemChildren(EMPTY_BUCKETS),
  tagsLoading      : true,
  customTagsLoading: true,
  foreignTags      : null,

  async rebuildCustomTags() {
    const { variantsLoading }   = useVariantsStore.getState();
    const { instancesLoading } = useInstancesStore.getState();
    if (variantsLoading || instancesLoading) return;

    set({ customTagsLoading: true });

    try {
      const defs = await getAllTagDefs();
      const instances = useInstancesStore.getState().instances;

      // quick lookup from system buckets
      const itemByInstance: Record<string, TagItem> = {};
      const sysBuckets = get().tags;
      for (const b of Object.values(sysBuckets)) {
        for (const [iid, item] of Object.entries(b)) if (!itemByInstance[iid]) itemByInstance[iid] = item;
      }

      const out: CustomTagsTree = { caught: {}, wanted: {} };

      const byTag = new Map<string, string[]>();
      for (const [collectionKey, instance] of Object.entries(instances)) {
        const instanceId = collectionKey;
        const tagIds = instance.is_wanted
          ? normalizeTagIds(instance.wanted_tags)
          : instance.is_caught
            ? normalizeTagIds(instance.caught_tags)
            : [];
        for (const tagId of tagIds) {
          const ids = byTag.get(tagId) ?? [];
          ids.push(instanceId);
          byTag.set(tagId, ids);
        }
      }

      for (const def of defs) {
        if (def.deleted_at) continue;

        // Only allow 'caught' | 'wanted' as parents (Trade is NOT a parent)
        const parent: 'caught' | 'wanted' | null =
          def.parent === 'caught' ? 'caught'
        : def.parent === 'wanted' ? 'wanted'
        : null;
        if (!parent) continue; // ignore any legacy 'trade' parents

        const instIds = byTag.get(def.tag_id) || [];
        const items: Record<string, TagItem> = {};
        for (const iid of instIds) if (itemByInstance[iid]) items[iid] = itemByInstance[iid];

        out[parent][def.tag_id] = { tag: def, items };
      }

      set({ customTags: out, customTagsLoading: false });
    } catch (e) {
      log.error('rebuildCustomTags failed:', e);
      set({ customTags: { ...EMPTY_CUSTOM }, customTagsLoading: false });
    }
  },

  async refreshCustomTagDefinitions() {
    const responsePromise = fetchCustomTags();
    const cachedDefinitions = await getAllTagDefs();
    const cachedOrders = readCachedTagOrders(currentUserId());
    if (cachedOrders) {
      set({ tagOrders: normalizePokemonTagOrders(cachedOrders, cachedDefinitions) });
    }

    const response = await responsePromise;
    const definitions = response.tags.map(toLocalTagDef);
    const orders = normalizePokemonTagOrders(response.orders, definitions);
    await replaceTagDefs(definitions);
    set({ tagOrders: orders });
    writeCachedTagOrders(currentUserId(), orders);
    await get().rebuildCustomTags();
  },

  async createCustomTag(input) {
    const created = toLocalTagDef(await createCustomTagRequest(input));
    const parent: CustomTagParent = created.parent === 'wanted' ? 'wanted' : 'caught';
    const definitions = (await getAllTagDefs()).filter((tag) => tag.tag_id !== created.tag_id);
    await replaceTagDefs([...definitions, created]);
    set((state) => ({
      tagOrders: {
        ...state.tagOrders,
        [parent]: [
          ...state.tagOrders[parent],
          customTagOrderKey(created.tag_id),
        ],
      },
    }));
    writeCachedTagOrders(currentUserId(), get().tagOrders);
    await get().rebuildCustomTags();
    return created;
  },

  async updateCustomTag(tagId, input) {
    const updated = toLocalTagDef(await updateCustomTagRequest(tagId, input));
    const definitions = (await getAllTagDefs()).filter((tag) => tag.tag_id !== tagId);
    await replaceTagDefs([...definitions, updated]);
    await get().rebuildCustomTags();
    return updated;
  },

  async deleteCustomTag(tagId) {
    await deleteCustomTagRequest(tagId);
    const definitions = (await getAllTagDefs()).filter((tag) => tag.tag_id !== tagId);
    await replaceTagDefs(definitions);
    const deletedKey = customTagOrderKey(tagId);
    set((state) => ({
      tagOrders: {
        caught: state.tagOrders.caught.filter((key) => key !== deletedKey),
        wanted: state.tagOrders.wanted.filter((key) => key !== deletedKey),
      },
    }));
    writeCachedTagOrders(currentUserId(), get().tagOrders);

    const instances = useInstancesStore.getState().instances;
    const patches: Record<string, Partial<PokemonInstance>> = {};
    for (const [key, instance] of Object.entries(instances)) {
      const caughtTags = normalizeTagIds(instance.caught_tags);
      const wantedTags = normalizeTagIds(instance.wanted_tags);
      if (caughtTags.includes(tagId)) {
        patches[key] = { ...patches[key], caught_tags: caughtTags.filter((id) => id !== tagId) };
      }
      if (wantedTags.includes(tagId)) {
        patches[key] = { ...patches[key], wanted_tags: wantedTags.filter((id) => id !== tagId) };
      }
    }
    if (Object.keys(patches).length) {
      await useInstancesStore.getState().updateInstanceDetails(patches);
    }
    await get().rebuildCustomTags();
  },

  async saveTagOrder(parent, tagKeys) {
    const response = await updatePokemonTagOrder({ parent, tag_keys: tagKeys });
    const savedOrders: PokemonTagOrders = {
      ...get().tagOrders,
      [parent]: response.tag_keys,
    };
    set({ tagOrders: savedOrders });
    writeCachedTagOrders(currentUserId(), savedOrders);
  },

  async applyCustomTagChanges(instanceIds, changes) {
    const instances = useInstancesStore.getState().instances;
    const definitions = await getAllTagDefs();
    const byId = new Map(definitions.map((tag) => [tag.tag_id, tag]));
    const patches: Record<string, Partial<PokemonInstance>> = {};
    let updated = 0;
    let skipped = 0;

    for (const requestedId of instanceIds) {
      const entry = Object.entries(instances).find(
        ([key, instance]) => key === requestedId || instance.instance_id === requestedId,
      );
      if (!entry) {
        skipped += 1;
        continue;
      }
      const [key, instance] = entry;
      let changed = false;
      const caught = new Set(normalizeTagIds(instance.caught_tags));
      const wanted = new Set(normalizeTagIds(instance.wanted_tags));

      for (const [tagId, shouldApply] of Object.entries(changes)) {
        const definition = byId.get(tagId);
        if (!definition || definition.deleted_at) continue;
        const eligible = definition.parent === 'caught' ? instance.is_caught : instance.is_wanted;
        if (!eligible) continue;
        const target = definition.parent === 'caught' ? caught : wanted;
        if (shouldApply && !target.has(tagId)) {
          target.add(tagId);
          changed = true;
        } else if (!shouldApply && target.delete(tagId)) {
          changed = true;
        }
      }

      if (changed) {
        patches[key] = {
          caught_tags: instance.is_caught ? [...caught] : [],
          wanted_tags: instance.is_wanted ? [...wanted] : [],
        };
        updated += 1;
      }
    }

    if (Object.keys(patches).length) {
      await useInstancesStore.getState().updateInstanceDetails(patches);
    }
    await get().rebuildCustomTags();
    return { updated, skipped };
  },

  async buildTags() {
    const { variants, variantsLoading }   = useVariantsStore.getState();
    const { instances, instancesLoading } = useInstancesStore.getState();
    if (variantsLoading || instancesLoading) return;

    set({ tagsLoading: true });

    const newTags = initializePokemonTags(instances, variants);
    const sys     = computeSystemChildren(newTags);

    set({ tags: newTags, tagsLoading: false, systemChildren: sys });

    await setSystemChildrenSnapshot(toSnapshotIds(sys));

    // Mirror derived children (favorites, caught->trade, most_wanted).
    await persistSystemMembershipsFromBuckets(newTags).catch(() => {});

    await get().rebuildCustomTags();
  },

  buildForeignTags(instances) {
    const { variants, variantsLoading } = useVariantsStore.getState();
    if (variantsLoading || !variants.length) return;
    set({ foreignTags: initializePokemonTags(instances, variants) });
  },

  async hydrateFromCache() {
    const tagsTS = getStorageNumber(STORAGE_KEYS.tagsTimestamp, 0);
    const ownTS = getStorageNumber(STORAGE_KEYS.ownershipTimestamp, 0);
    const fresh       = !!tagsTS && isDataFresh(tagsTS);
    const needRebuild = ownTS > tagsTS;

    try {
      const definitions = await getAllTagDefs();
      const cachedOrders = readCachedTagOrders(currentUserId());
      if (cachedOrders) {
        set({ tagOrders: normalizePokemonTagOrders(cachedOrders, definitions) });
      }

      let variants = useVariantsStore.getState().variants;
      let instancesMap = useInstancesStore.getState().instances;

      if (!variants?.length) {
        variants = await getAllVariants<PokemonVariant>();
      }
      if (!Object.keys(instancesMap || {}).length) {
        const instArr = await getAllInstances<PokemonInstance>();
        instancesMap = (instArr || []).reduce<Instances>((acc, row) => {
          const instanceId = row?.instance_id;
          if (typeof instanceId === 'string' && instanceId.length > 0) {
            acc[instanceId] = row;
          }
          return acc;
        }, {});
      }

      if (!variants?.length) {
        set({ tagsLoading: false });
        return;
      }

      if (!Object.keys(instancesMap || {}).length) {
        const emptyBuckets: TagBuckets = { caught: {}, wanted: {}, trade: {} };
        const emptySystem = computeSystemChildren(emptyBuckets);

        set({
          tags: emptyBuckets,
          systemChildren: emptySystem,
          tagsLoading: false,
        });

        await setSystemChildrenSnapshot(toSnapshotIds(emptySystem)).catch(() => {});
        await persistSystemMembershipsFromBuckets(emptyBuckets).catch(() => {});
        setStorageNumber(STORAGE_KEYS.tagsTimestamp, Date.now());
        await get().rebuildCustomTags();
        return;
      }

      const buckets = initializePokemonTags(instancesMap, variants);
      const snap = await getSystemChildrenSnapshot();

      const sys = snap ? idsToChildren(snap, buckets) : computeSystemChildren(buckets);

      set({
        tags: buckets,
        systemChildren: sys,
        tagsLoading: false,
      });

      await persistSystemMembershipsFromBuckets(buckets).catch(() => {});

      setStorageNumber(STORAGE_KEYS.tagsTimestamp, Date.now());

      await get().rebuildCustomTags();
    } catch (e) {
      log.warn('hydrateFromCache failed; will rebuild later:', e);
    }

    if (!fresh || needRebuild) {
      await get().buildTags();
    }
  },

  refreshTags() {
    return get().buildTags();
  },

  resetTags() {
    set({
      tags: { ...EMPTY_BUCKETS },
      customTags: { ...EMPTY_CUSTOM },
      tagOrders: {
        caught: [...DEFAULT_POKEMON_TAG_ORDERS.caught],
        wanted: [...DEFAULT_POKEMON_TAG_ORDERS.wanted],
      },
      systemChildren: computeSystemChildren(EMPTY_BUCKETS),
      tagsLoading: true,
      customTagsLoading: true,
      foreignTags: null,
    });
    removeStorageKey(STORAGE_KEYS.tagsTimestamp);
  },
}));

/* live lightweight rebuilds */
const quickRebuild = (instances: Instances, dest: 'tags' | 'foreignTags') => {
  const { variants, variantsLoading } = useVariantsStore.getState();
  if (variantsLoading || !variants.length) return;

  const buckets = initializePokemonTags(instances, variants);

  if (dest === 'tags') {
    const sys = computeSystemChildren(buckets);
    useTagsStore.setState({ tags: buckets, systemChildren: sys });
    setSystemChildrenSnapshot(toSnapshotIds(sys)).catch(() => {});
    persistSystemMembershipsFromBuckets(buckets).catch(() => {});
  } else {
    useTagsStore.setState({ foreignTags: buckets });
  }
};

let prevLocalInstancesRef = useInstancesStore.getState().instances;
let prevForeignInstancesRef = useInstancesStore.getState().foreignInstances;
let customRebuildQueued = false;

const scheduleCustomTagsRebuild = () => {
  if (customRebuildQueued) return;
  customRebuildQueued = true;
  Promise.resolve()
    .then(() => useTagsStore.getState().rebuildCustomTags())
    .catch(() => {})
    .finally(() => {
      customRebuildQueued = false;
    });
};

useInstancesStore.subscribe((state) => {
  if (state.instances === prevLocalInstancesRef) return;
  prevLocalInstancesRef = state.instances;
  quickRebuild(state.instances, 'tags');
  scheduleCustomTagsRebuild();
});

useInstancesStore.subscribe((state) => {
  if (state.foreignInstances === prevForeignInstancesRef) return;
  prevForeignInstancesRef = state.foreignInstances;
  if (state.foreignInstances) quickRebuild(state.foreignInstances, 'foreignTags');
  else useTagsStore.setState({ foreignTags: null });
});
