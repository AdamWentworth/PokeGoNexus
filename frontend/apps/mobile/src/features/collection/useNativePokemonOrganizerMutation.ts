import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeCollectionSnapshot } from '../../services/collectionApi';
import { useNativeApiClients } from '../../services/useNativeApiClients';
import { nativeCollectionOutbox } from '../../storage/nativeCollectionOutbox';
import { useNativeCollectionSync } from './NativeCollectionSyncProvider';
import { nativeCollectionQueryKeys } from './collectionQueries';
import {
  persistNativeCatalogAdditions,
  mergeNativeCatalogInstances,
  type NativeCatalogOrganizerRequest,
} from './nativeCatalogMutation';
import {
  persistNativeExistingOrganizerMutation,
  type NativeExistingOrganizerRequest,
} from './nativeExistingOrganizerMutation';

export type NativePokemonOrganizerRequest =
  | ({ operation: 'create' } & NativeCatalogOrganizerRequest)
  | NativeExistingOrganizerRequest;

export const useNativePokemonOrganizerMutation = (userId: string) => {
  const clients = useNativeApiClients();
  const queryClient = useQueryClient();
  const sync = useNativeCollectionSync();

  return useMutation({
    mutationFn: async (request: NativePokemonOrganizerRequest) => {
      const queryKey = nativeCollectionQueryKeys.snapshot(userId);
      const snapshot = queryClient.getQueryData<NativeCollectionSnapshot>(queryKey);
      if (!snapshot) throw new Error('Load your collection before organizing Pokémon.');

      const result = request.operation === 'create'
        ? await persistNativeCatalogAdditions({
            userId,
            snapshot,
            request,
            outbox: nativeCollectionOutbox,
            receiverClient: clients.receiver,
            onQueued: (instances) => {
              queryClient.setQueryData<NativeCollectionSnapshot>(queryKey, (current) => {
                if (!current) return current;
                return { ...current, instances: mergeNativeCatalogInstances(current.instances, instances) };
              });
            },
          })
        : await persistNativeExistingOrganizerMutation({
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
                  const tracked = update.instance.is_caught
                    || update.instance.is_for_trade
                    || update.instance.is_wanted;
                  if (tracked) instances[update.collectionKey] = update.instance;
                  else delete instances[update.collectionKey];
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
