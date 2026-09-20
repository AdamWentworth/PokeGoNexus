import * as Crypto from 'expo-crypto';
import type { NativeCollectionSnapshot } from '../../services/collectionApi';
import type { NativeReceiverApiClient } from '../../services/nativeApiClients';
import type { nativeCollectionOutbox } from '../../storage/nativeCollectionOutbox';
import { sendPendingNativeCollectionBatches } from './collectionSyncCoordinator';
import {
  createNativeCollectionMutation,
  type NativeCollectionMutation,
} from './collectionMutationModel';

type CollectionOutboxPort = Pick<
  typeof nativeCollectionOutbox,
  'queue' | 'list' | 'markAttemptFailed' | 'markAcknowledged' | 'removeAcknowledged'
>;

export type NativeFavoriteMutationResult = {
  mutation: NativeCollectionMutation;
  syncState: 'acknowledged' | 'pending';
  message: string;
};

export const persistNativeFavoriteMutation = async ({
  userId,
  snapshot,
  requestedInstanceId,
  favorite,
  outbox,
  receiverClient,
  onQueued,
  syncBatchId = Crypto.randomUUID(),
  now = Date.now(),
}: {
  userId: string;
  snapshot: NativeCollectionSnapshot;
  requestedInstanceId: string;
  favorite: boolean;
  outbox: CollectionOutboxPort;
  receiverClient: Pick<NativeReceiverApiClient, 'post'>;
  onQueued?: (mutation: NativeCollectionMutation) => Promise<void> | void;
  syncBatchId?: string;
  now?: number;
}): Promise<NativeFavoriteMutationResult> => {
  const mutation = createNativeCollectionMutation({
    instances: snapshot.instances,
    requestedInstanceId,
    patch: { favorite },
    syncBatchId,
    now,
  });
  await outbox.queue(userId, mutation.batch, now);
  await onQueued?.(mutation);
  const sent = await sendPendingNativeCollectionBatches({
    userId,
    outbox,
    receiverClient,
  });

  if (sent.failedBatchId) {
    return {
      mutation,
      syncState: 'pending',
      message: 'Saved on this device. It will sync when Receiver is available.',
    };
  }
  return {
    mutation,
    syncState: 'acknowledged',
    message: 'Saved on this device. Receiver accepted it; checking server reconciliation.',
  };
};
