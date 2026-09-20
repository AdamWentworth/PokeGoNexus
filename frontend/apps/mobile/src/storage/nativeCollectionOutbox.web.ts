import type {
  NativeCollectionSyncBatch,
  NativeCollectionSyncLocation,
} from '../services/collectionSyncApi';
import { createNativeCollectionSyncBatch } from '../services/collectionSyncApi';
import { readNativeWebValue, writeNativeWebValue } from './nativeWebStorage';

const OUTBOX_KEY_PREFIX = 'pokegonexus.native.collection-outbox.';

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

const normalizeUserId = (userId: string): string => {
  const normalized = userId.trim();
  if (!normalized) throw new Error('A signed-in user is required for collection sync.');
  return normalized;
};

const storageKey = (userId: string): string => (
  `${OUTBOX_KEY_PREFIX}${encodeURIComponent(normalizeUserId(userId))}`
);

const readEntries = async (userId: string): Promise<NativeCollectionOutboxEntry[]> => {
  const value = await readNativeWebValue('collection-outbox', storageKey(userId));
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed as NativeCollectionOutboxEntry[] : [];
  } catch {
    return [];
  }
};

const writeEntries = async (
  userId: string,
  entries: NativeCollectionOutboxEntry[],
): Promise<void> => {
  await writeNativeWebValue(
    'collection-outbox',
    storageKey(userId),
    JSON.stringify(entries),
  );
};

const ordered = (entries: NativeCollectionOutboxEntry[]): NativeCollectionOutboxEntry[] => (
  [...entries].sort((left, right) => left.createdAt - right.createdAt
    || left.batch.sync_batch_id.localeCompare(right.batch.sync_batch_id))
);

export const createNativeCollectionOutbox = () => ({
  queue: async (
    userId: string,
    batch: NativeCollectionSyncBatch,
    now = Date.now(),
  ): Promise<void> => {
    const normalizedUserId = normalizeUserId(userId);
    const validatedBatch = createNativeCollectionSyncBatch({
      location: batch.location as NativeCollectionSyncLocation | null,
      syncBatchId: batch.sync_batch_id,
      updates: batch.pokemonUpdates,
    });
    const entries = await readEntries(normalizedUserId);
    const existing = entries.find(({ batch: stored }) => (
      stored.sync_batch_id === validatedBatch.sync_batch_id
    ));
    if (existing) {
      if (JSON.stringify(existing.batch) !== JSON.stringify(validatedBatch)) {
        throw new Error(`Collection sync batch ${validatedBatch.sync_batch_id} was reused with different data.`);
      }
      return;
    }
    await writeEntries(normalizedUserId, [...entries, {
      acknowledgedAt: null,
      attemptCount: 0,
      batch: validatedBatch,
      createdAt: now,
      lastError: null,
      state: 'pending',
      updatedAt: now,
      userId: normalizedUserId,
    }]);
  },
  list: async (
    userId: string,
    state?: NativeCollectionOutboxState,
  ): Promise<NativeCollectionOutboxEntry[]> => {
    const entries = ordered(await readEntries(normalizeUserId(userId)));
    return state ? entries.filter((entry) => entry.state === state) : entries;
  },
  markAttemptFailed: async (
    userId: string,
    syncBatchId: string,
    error: string,
    now = Date.now(),
  ): Promise<void> => {
    const entries = (await readEntries(userId)).map((entry) => (
      entry.batch.sync_batch_id === syncBatchId && entry.state === 'pending'
        ? { ...entry, attemptCount: entry.attemptCount + 1, lastError: error.slice(0, 1000), updatedAt: now }
        : entry
    ));
    await writeEntries(userId, entries);
  },
  markAcknowledged: async (
    userId: string,
    syncBatchId: string,
    now = Date.now(),
  ): Promise<void> => {
    const entries = (await readEntries(userId)).map((entry) => (
      entry.batch.sync_batch_id === syncBatchId && entry.state === 'pending'
        ? { ...entry, acknowledgedAt: now, attemptCount: entry.attemptCount + 1, lastError: null, state: 'acknowledged' as const, updatedAt: now }
        : entry
    ));
    await writeEntries(userId, entries);
  },
  removeAcknowledged: async (userId: string, syncBatchIds: string[]): Promise<void> => {
    if (syncBatchIds.length === 0) return;
    const ids = new Set(syncBatchIds);
    await writeEntries(userId, (await readEntries(userId)).filter((entry) => (
      entry.state !== 'acknowledged' || !ids.has(entry.batch.sync_batch_id)
    )));
  },
});

export const nativeCollectionOutbox = createNativeCollectionOutbox();
