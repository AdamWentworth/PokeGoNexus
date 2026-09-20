import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type { BasePokemon } from '@pokemongonexus/shared-contracts/pokemon';
import type { CustomTagsEnvelope } from '@pokemongonexus/shared-contracts/users';
import { normalizeNativeTagsEnvelope } from '../features/collection/nativeTagsEnvelope';
import { normalizeNativeInstances } from '../features/collection/nativeInstanceNormalization';
import {
  deleteNativeWebValue,
  readNativeWebValue,
  writeNativeWebValue,
} from './nativeWebStorage';

const CACHE_KEY_PREFIX = 'pokegonexus.native.collection-cache.';

export type NativeCachedCollectionSnapshot = {
  instances: Record<string, PokemonInstance>;
  catalog: BasePokemon[];
  tags?: CustomTagsEnvelope;
};

export type NativeCollectionCacheEntry = {
  snapshot: NativeCachedCollectionSnapshot;
  savedAt: number;
};

const normalizeUserId = (userId: string): string => {
  const normalized = userId.trim();
  if (!normalized) throw new Error('A signed-in user is required for collection caching.');
  return normalized;
};

const storageKey = (userId: string): string => (
  `${CACHE_KEY_PREFIX}${encodeURIComponent(normalizeUserId(userId))}`
);

const parseEntry = (value: string): NativeCollectionCacheEntry | null => {
  try {
    const parsed = JSON.parse(value) as Partial<NativeCollectionCacheEntry>;
    const snapshot = parsed.snapshot;
    if (!snapshot || typeof snapshot !== 'object'
        || !snapshot.instances || typeof snapshot.instances !== 'object'
        || !Array.isArray(snapshot.catalog)
        || typeof parsed.savedAt !== 'number') return null;
    return {
      savedAt: parsed.savedAt,
      snapshot: {
        catalog: snapshot.catalog,
        instances: normalizeNativeInstances(snapshot.instances),
        tags: normalizeNativeTagsEnvelope(snapshot.tags),
      },
    };
  } catch {
    return null;
  }
};

export const createNativeCollectionCache = () => ({
  read: async (userId: string): Promise<NativeCollectionCacheEntry | null> => {
    const key = storageKey(userId);
    const value = await readNativeWebValue('collection-cache', key);
    if (!value) return null;
    const entry = parseEntry(value);
    if (!entry) {
      await deleteNativeWebValue('collection-cache', key);
    }
    return entry;
  },
  write: async (
    userId: string,
    snapshot: NativeCachedCollectionSnapshot,
    now = Date.now(),
  ): Promise<void> => {
    await writeNativeWebValue(
      'collection-cache',
      storageKey(userId),
      JSON.stringify({ savedAt: now, snapshot }),
    );
  },
});

export const nativeCollectionCache = createNativeCollectionCache();
