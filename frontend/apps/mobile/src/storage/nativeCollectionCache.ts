import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import type { BasePokemon } from '@pokemongonexus/shared-contracts/pokemon';
import type { CustomTagsEnvelope } from '@pokemongonexus/shared-contracts/users';
import type { SQLiteBindParams, SQLiteRunResult } from 'expo-sqlite';
import { normalizeNativeTagsEnvelope } from '../features/collection/nativeTagsEnvelope';
import { normalizeNativeInstances } from '../features/collection/nativeInstanceNormalization';
import { openNativeDatabase } from './nativeDatabase';

export type NativeCachedCollectionSnapshot = {
  instances: Record<string, PokemonInstance>;
  catalog: BasePokemon[];
  tags?: CustomTagsEnvelope;
};

export type NativeCollectionCacheEntry = {
  snapshot: NativeCachedCollectionSnapshot;
  savedAt: number;
};

type NativeCollectionCacheRow = {
  snapshot_json: string;
  saved_at: number;
};

type CollectionCacheDatabase = {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: SQLiteBindParams): Promise<SQLiteRunResult>;
  getFirstAsync<T>(source: string, params: SQLiteBindParams): Promise<T | null>;
};

type OpenCollectionCacheDatabase = () => Promise<CollectionCacheDatabase>;

const normalizeUserId = (userId: string): string => {
  const normalized = userId.trim();
  if (!normalized) throw new Error('A signed-in user is required for collection caching.');
  return normalized;
};

const parseSnapshot = (snapshotJson: string): NativeCachedCollectionSnapshot => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(snapshotJson);
  } catch {
    throw new Error('The saved collection copy is not valid JSON.');
  }

  if (
    !parsed
    || typeof parsed !== 'object'
    || Array.isArray(parsed)
    || !('instances' in parsed)
    || !('catalog' in parsed)
  ) {
    throw new Error('The saved collection copy has an invalid shape.');
  }

  const { instances, catalog } = parsed as Record<string, unknown>;
  if (!instances || typeof instances !== 'object' || Array.isArray(instances)) {
    throw new Error('The saved collection instances are invalid.');
  }
  if (!Array.isArray(catalog)) {
    throw new Error('The saved Pokémon catalog is invalid.');
  }

  const tags = normalizeNativeTagsEnvelope(
    'tags' in parsed ? parsed.tags : undefined,
  );

  return {
    instances: normalizeNativeInstances(instances),
    catalog: catalog as BasePokemon[],
    tags,
  };
};

const defaultOpenDatabase: OpenCollectionCacheDatabase = openNativeDatabase;

export const createNativeCollectionCache = (
  openDatabase: OpenCollectionCacheDatabase = defaultOpenDatabase,
) => {
  let databasePromise: Promise<CollectionCacheDatabase> | null = null;

  const getDatabase = (): Promise<CollectionCacheDatabase> => {
    if (!databasePromise) {
      databasePromise = openDatabase().then(async (database) => {
        await database.execAsync(`
          PRAGMA journal_mode = WAL;
          CREATE TABLE IF NOT EXISTS collection_snapshot_cache (
            user_id TEXT NOT NULL PRIMARY KEY,
            snapshot_json TEXT NOT NULL,
            saved_at INTEGER NOT NULL
          );
        `);
        return database;
      }).catch((error) => {
        databasePromise = null;
        throw error;
      });
    }
    return databasePromise;
  };

  const write = async (
    userId: string,
    snapshot: NativeCachedCollectionSnapshot,
    now = Date.now(),
  ): Promise<void> => {
    const normalizedUserId = normalizeUserId(userId);
    const snapshotJson = JSON.stringify(snapshot);
    const database = await getDatabase();
    await database.runAsync(
      `INSERT INTO collection_snapshot_cache (user_id, snapshot_json, saved_at)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         snapshot_json = excluded.snapshot_json,
         saved_at = excluded.saved_at`,
      [normalizedUserId, snapshotJson, now],
    );
  };

  const read = async (userId: string): Promise<NativeCollectionCacheEntry | null> => {
    const database = await getDatabase();
    const row = await database.getFirstAsync<NativeCollectionCacheRow>(
      `SELECT snapshot_json, saved_at FROM collection_snapshot_cache WHERE user_id = ?`,
      [normalizeUserId(userId)],
    );
    if (!row) return null;
    return { snapshot: parseSnapshot(row.snapshot_json), savedAt: row.saved_at };
  };

  return { write, read };
};

export const nativeCollectionCache = createNativeCollectionCache();
