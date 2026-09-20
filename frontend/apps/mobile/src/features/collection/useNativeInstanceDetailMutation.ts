import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeCollectionSnapshot } from '../../services/collectionApi';
import { useNativeApiClients } from '../../services/useNativeApiClients';
import { nativeCollectionOutbox } from '../../storage/nativeCollectionOutbox';
import { useNativeCollectionSync } from './NativeCollectionSyncProvider';
import { nativeCollectionQueryKeys } from './collectionQueries';
import {
  persistNativeInstanceDetailMutation,
  type NativeInstanceDetailPatch,
} from './nativeInstanceDetailMutation';

export const useNativeInstanceDetailMutation = (
  userId: string,
  requestedInstanceId: string,
) => {
  const clients = useNativeApiClients();
  const queryClient = useQueryClient();
  const sync = useNativeCollectionSync();
  return useMutation({
    mutationFn: async (patch: NativeInstanceDetailPatch) => {
      const queryKey = nativeCollectionQueryKeys.snapshot(userId);
      const snapshot = queryClient.getQueryData<NativeCollectionSnapshot>(queryKey);
      if (!snapshot) throw new Error('Load your collection before editing this Pokémon.');
      const result = await persistNativeInstanceDetailMutation({
        userId,
        snapshot,
        requestedInstanceId,
        patch,
        outbox: nativeCollectionOutbox,
        receiverClient: clients.receiver,
        onQueued: (mutation) => {
          queryClient.setQueryData<NativeCollectionSnapshot>(queryKey, (current) => {
            if (!current) return current;
            return {
              ...current,
              instances: {
                ...current.instances,
                [mutation.collectionKey]: mutation.updated,
              },
            };
          });
        },
        sendImmediately: false,
      });
      // The complete snapshot is already in the durable outbox and projected
      // into React Query. Network acknowledgement must not hold the Save UI.
      void sync.retry();
      return result;
    },
  });
};
