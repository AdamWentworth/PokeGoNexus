import { useMutation, useQueryClient } from '@tanstack/react-query';
import { resolveInstanceCollectionKey } from '@pokemongonexus/shared-domain/instances';
import type { NativeCollectionSnapshot } from '../../services/collectionApi';
import { useNativeApiClients } from '../../services/useNativeApiClients';
import { nativeCollectionOutbox } from '../../storage/nativeCollectionOutbox';
import { useNativeCollectionSync } from '../collection/NativeCollectionSyncProvider';
import { nativeCollectionQueryKeys } from '../collection/collectionQueries';
import {
  persistNativeTradePreferenceMutation,
  type NativeTradePreferenceMutationRequest,
} from './nativeTradePreferencesMutation';

export const useNativeTradePreferenceMutation = (userId: string) => {
  const clients = useNativeApiClients();
  const queryClient = useQueryClient();
  const sync = useNativeCollectionSync();
  return useMutation({
    mutationFn: async (request: NativeTradePreferenceMutationRequest) => {
      const queryKey = nativeCollectionQueryKeys.snapshot(userId);
      const snapshot = queryClient.getQueryData<NativeCollectionSnapshot>(queryKey);
      if (!snapshot) throw new Error('Load your collection before editing trade preferences.');
      const result = await persistNativeTradePreferenceMutation({
        userId,
        snapshot,
        request,
        outbox: nativeCollectionOutbox,
        receiverClient: clients.receiver,
        onQueued: (updates) => {
          queryClient.setQueryData<NativeCollectionSnapshot>(queryKey, (current) => {
            if (!current) return current;
            const instances = { ...current.instances };
            for (const update of updates) {
              const collectionKey = resolveInstanceCollectionKey(
                instances,
                update.instance_id,
              ) ?? update.instance_id;
              instances[collectionKey] = update;
            }
            return { ...current, instances };
          });
        },
      });
      await queryClient.invalidateQueries({ queryKey });
      await sync.refreshStatus();
      return result;
    },
  });
};
