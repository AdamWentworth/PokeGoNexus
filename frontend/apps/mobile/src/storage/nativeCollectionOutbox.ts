import type { SQLiteBindParams, SQLiteRunResult } from 'expo-sqlite';
import type {
  NativeCollectionSyncBatch,
  NativeCollectionSyncLocation,
} from '../services/collectionSyncApi';
import { createNativeCollectionSyncBatch } from '../services/collectionSyncApi';
import { openNativeDatabase } from './nativeDatabase';

export type NativeCollectionOutboxState = 'pending' | 'acknowledged';

export type NativeCollectionOutboxEntry = {
  userId: string;
  batch: NativeCollectionSyncBatch;
  state: NativeCollectionOutboxState;
  createdAt: number;
  updatedAt: number;
  attemptCount: number;
  lastError: string | null;
  acknowledgedAt: number | null;
};

type NativeCollectionOutboxRow = {
  user_id: string;
  sync_batch_id: string;
  payload_json: string;
  state: NativeCollectionOutboxState;
  created_at: number;
  updated_at: number;
  attempt_count: number;
  last_error: string | null;
  acknowledged_at: number | null;
};

type OutboxDatabase = {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: SQLiteBindParams): Promise<SQLiteRunResult>;
  getFirstAsync<T>(source: string, params: SQLiteBindParams): Promise<T | null>;
  getAllAsync<T>(source: string, params: SQLiteBindParams): Promise<T[]>;
};

type OpenOutboxDatabase = () => Promise<OutboxDatabase>;

const normalizeUserId = (userId: string): string => {
  const normalized = userId.trim();
  if (!normalized) throw new Error('A signed-in user is required for collection sync.');
  return normalized;
};

const parseStoredBatch = (row: NativeCollectionOutboxRow): NativeCollectionSyncBatch => {
  let parsed: NativeCollectionSyncBatch;
  try {
    parsed = JSON.parse(row.payload_json) as NativeCollectionSyncBatch;
  } catch {
    throw new Error(`Stored collection batch ${row.sync_batch_id} is not valid JSON.`);
  }

  try {
    return createNativeCollectionSyncBatch({
      syncBatchId: parsed.sync_batch_id,
      location: parsed.location as NativeCollectionSyncLocation | null,
      updates: parsed.pokemonUpdates,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown validation error.';
    throw new Error(`Stored collection batch ${row.sync_batch_id} is invalid: ${message}`);
  }
};

const toEntry = (row: NativeCollectionOutboxRow): NativeCollectionOutboxEntry => ({
  userId: row.user_id,
  batch: parseStoredBatch(row),
  state: row.state,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  attemptCount: row.attempt_count,
  lastError: row.last_error,
  acknowledgedAt: row.acknowledged_at,
});

const defaultOpenDatabase: OpenOutboxDatabase = openNativeDatabase;

export const createNativeCollectionOutbox = (
  openDatabase: OpenOutboxDatabase = defaultOpenDatabase,
) => {
  let databasePromise: Promise<OutboxDatabase> | null = null;

  const getDatabase = (): Promise<OutboxDatabase> => {
    if (!databasePromise) {
      databasePromise = openDatabase().then(async (database) => {
        await database.execAsync(`
          PRAGMA journal_mode = WAL;
          CREATE TABLE IF NOT EXISTS collection_sync_outbox (
            user_id TEXT NOT NULL,
            sync_batch_id TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            state TEXT NOT NULL CHECK (state IN ('pending', 'acknowledged')),
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            attempt_count INTEGER NOT NULL DEFAULT 0,
            last_error TEXT,
            acknowledged_at INTEGER,
            PRIMARY KEY (user_id, sync_batch_id)
          );
          CREATE INDEX IF NOT EXISTS collection_sync_outbox_user_state_created
            ON collection_sync_outbox (user_id, state, created_at);
        `);
        return database;
      }).catch((error) => {
        databasePromise = null;
        throw error;
      });
    }
    return databasePromise;
  };

  const queue = async (
    userId: string,
    batch: NativeCollectionSyncBatch,
    now = Date.now(),
  ): Promise<void> => {
    const normalizedUserId = normalizeUserId(userId);
    const validatedBatch = createNativeCollectionSyncBatch({
      syncBatchId: batch.sync_batch_id,
      location: batch.location as NativeCollectionSyncLocation | null,
      updates: batch.pokemonUpdates,
    });
    const payloadJson = JSON.stringify(validatedBatch);
    const database = await getDatabase();
    await database.runAsync(
      `INSERT OR IGNORE INTO collection_sync_outbox (
        user_id, sync_batch_id, payload_json, state, created_at, updated_at,
        attempt_count, last_error, acknowledged_at
      ) VALUES (?, ?, ?, 'pending', ?, ?, 0, NULL, NULL)`,
      [normalizedUserId, validatedBatch.sync_batch_id, payloadJson, now, now],
    );

    const stored = await database.getFirstAsync<Pick<NativeCollectionOutboxRow, 'payload_json'>>(
      `SELECT payload_json FROM collection_sync_outbox
       WHERE user_id = ? AND sync_batch_id = ?`,
      [normalizedUserId, validatedBatch.sync_batch_id],
    );
    if (!stored || stored.payload_json !== payloadJson) {
      throw new Error(
        `Collection sync batch ${validatedBatch.sync_batch_id} was reused with different data.`,
      );
    }
  };

  const list = async (
    userId: string,
    state?: NativeCollectionOutboxState,
  ): Promise<NativeCollectionOutboxEntry[]> => {
    const normalizedUserId = normalizeUserId(userId);
    const database = await getDatabase();
    const rows = state
      ? await database.getAllAsync<NativeCollectionOutboxRow>(
        `SELECT * FROM collection_sync_outbox
         WHERE user_id = ? AND state = ?
         ORDER BY created_at ASC, sync_batch_id ASC`,
        [normalizedUserId, state],
      )
      : await database.getAllAsync<NativeCollectionOutboxRow>(
        `SELECT * FROM collection_sync_outbox
         WHERE user_id = ?
         ORDER BY created_at ASC, sync_batch_id ASC`,
        [normalizedUserId],
      );
    return rows.map(toEntry);
  };

  const markAttemptFailed = async (
    userId: string,
    syncBatchId: string,
    error: string,
    now = Date.now(),
  ): Promise<void> => {
    const database = await getDatabase();
    await database.runAsync(
      `UPDATE collection_sync_outbox
       SET attempt_count = attempt_count + 1, last_error = ?, updated_at = ?
       WHERE user_id = ? AND sync_batch_id = ? AND state = 'pending'`,
      [error.slice(0, 1000), now, normalizeUserId(userId), syncBatchId],
    );
  };

  const markAcknowledged = async (
    userId: string,
    syncBatchId: string,
    now = Date.now(),
  ): Promise<void> => {
    const database = await getDatabase();
    await database.runAsync(
      `UPDATE collection_sync_outbox
       SET state = 'acknowledged', attempt_count = attempt_count + 1,
           last_error = NULL, acknowledged_at = ?, updated_at = ?
       WHERE user_id = ? AND sync_batch_id = ? AND state = 'pending'`,
      [now, now, normalizeUserId(userId), syncBatchId],
    );
  };

  const removeAcknowledged = async (
    userId: string,
    syncBatchIds: string[],
  ): Promise<void> => {
    if (syncBatchIds.length === 0) return;
    const database = await getDatabase();
    for (const syncBatchId of syncBatchIds) {
      await database.runAsync(
        `DELETE FROM collection_sync_outbox
         WHERE user_id = ? AND sync_batch_id = ? AND state = 'acknowledged'`,
        [normalizeUserId(userId), syncBatchId],
      );
    }
  };

  return { queue, list, markAttemptFailed, markAcknowledged, removeAcknowledged };
};

export const nativeCollectionOutbox = createNativeCollectionOutbox();
