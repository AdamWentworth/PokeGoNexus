import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import { resolveInstanceCollectionKey } from '@pokemongonexus/shared-domain/instances';
import { submitNativeCollectionSyncBatch } from '../../services/collectionSyncApi';
import type { NativeReceiverApiClient } from '../../services/nativeApiClients';
import type {
  NativeCollectionOutboxEntry,
  NativeCollectionOutboxState,
} from '../../storage/nativeCollectionOutbox';

type CollectionOutboxPort = {
  list(
    userId: string,
    state?: NativeCollectionOutboxState,
  ): Promise<NativeCollectionOutboxEntry[]>;
  markAttemptFailed(
    userId: string,
    syncBatchId: string,
    error: string,
  ): Promise<void>;
  markAcknowledged(userId: string, syncBatchId: string): Promise<void>;
  removeAcknowledged(userId: string, syncBatchIds: string[]): Promise<void>;
};

export type NativeCollectionSendResult = {
  acknowledgedBatchIds: string[];
  failedBatchId: string | null;
  error: string | null;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Collection synchronization failed.';

/**
 * Send in creation order and stop after the first failure. That preserves the
 * same per-device mutation ordering represented by each snapshot timestamp.
 */
export const sendPendingNativeCollectionBatches = async ({
  userId,
  outbox,
  receiverClient,
}: {
  userId: string;
  outbox: CollectionOutboxPort;
  receiverClient: Pick<NativeReceiverApiClient, 'post'>;
}): Promise<NativeCollectionSendResult> => {
  const pending = await outbox.list(userId, 'pending');
  const acknowledgedBatchIds: string[] = [];

  for (const entry of pending) {
    try {
      await submitNativeCollectionSyncBatch(receiverClient, entry.batch);
      await outbox.markAcknowledged(userId, entry.batch.sync_batch_id);
      acknowledgedBatchIds.push(entry.batch.sync_batch_id);
    } catch (error) {
      const message = errorMessage(error);
      await outbox.markAttemptFailed(
        userId,
        entry.batch.sync_batch_id,
        message,
      );
      return {
        acknowledgedBatchIds,
        failedBatchId: entry.batch.sync_batch_id,
        error: message,
      };
    }
  }

  return { acknowledgedBatchIds, failedBatchId: null, error: null };
};

export const isNativeCollectionBatchCommitted = (
  entry: NativeCollectionOutboxEntry,
  canonicalInstances: Record<string, PokemonInstance>,
): boolean => entry.batch.pokemonUpdates.every((update) => {
  const collectionKey = resolveInstanceCollectionKey(
    canonicalInstances,
    update.instance_id,
  );
  const canonical = collectionKey ? canonicalInstances[collectionKey] : undefined;
  const expectedToExist = update.is_caught || update.is_for_trade || update.is_wanted;

  if (!canonical) return !expectedToExist;
  return Number.isFinite(canonical.last_update)
    && canonical.last_update >= update.last_update;
});

/**
 * Retained device snapshots remain visible while offline or while Kafka and
 * Storage catch up. A newer canonical timestamp always wins, so another device
 * or a later server-authoritative change cannot be overwritten by stale local
 * state.
 */
export const projectNativeCollectionOutbox = (
  canonicalInstances: Record<string, PokemonInstance>,
  entries: NativeCollectionOutboxEntry[],
): Record<string, PokemonInstance> => {
  const projected = { ...canonicalInstances };
  const orderedEntries = [...entries].sort((left, right) =>
    left.createdAt - right.createdAt
    || left.batch.sync_batch_id.localeCompare(right.batch.sync_batch_id));

  for (const entry of orderedEntries) {
    for (const update of entry.batch.pokemonUpdates) {
      const collectionKey = resolveInstanceCollectionKey(projected, update.instance_id)
        ?? update.instance_id;
      const current = projected[collectionKey];
      if (current && current.last_update >= update.last_update) continue;

      const expectedToExist = update.is_caught || update.is_for_trade || update.is_wanted;
      if (!expectedToExist) {
        delete projected[collectionKey];
        continue;
      }
      projected[collectionKey] = { ...update };
    }
  }

  return projected;
};

/**
 * Receiver acknowledgement only means Kafka accepted the batch. Entries leave
 * the outbox after a later users-service snapshot observes Storage's commit.
 */
export const reconcileAcknowledgedNativeCollectionBatches = async ({
  userId,
  outbox,
  canonicalInstances,
}: {
  userId: string;
  outbox: Pick<CollectionOutboxPort, 'list' | 'removeAcknowledged'>;
  canonicalInstances: Record<string, PokemonInstance>;
}): Promise<string[]> => {
  const acknowledged = await outbox.list(userId, 'acknowledged');
  const committedBatchIds = acknowledged
    .filter((entry) => isNativeCollectionBatchCommitted(entry, canonicalInstances))
    .map((entry) => entry.batch.sync_batch_id);
  await outbox.removeAcknowledged(userId, committedBatchIds);
  return committedBatchIds;
};
