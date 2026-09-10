import { useMutation, useQueryClient } from '@tanstack/react-query';
import { resolveInstanceCollectionKey } from '@pokemongonexus/shared-domain/instances';
import { buildPokemonCatalogEntries } from '@pokemongonexus/shared-domain/catalog';
import type { NativeCollectionSnapshot } from '../../services/collectionApi';
import { useNativeApiClients } from '../../services/useNativeApiClients';
import { nativeCollectionOutbox } from '../../storage/nativeCollectionOutbox';
import { useNativeCollectionSync } from './NativeCollectionSyncProvider';
import { nativeCollectionQueryKeys } from './collectionQueries';
import {
  persistNativeCatalogAddition,
  type NativeCatalogDestination,
  type NativeCatalogOrganizerRequest,
} from './nativeCatalogMutation';

export const useNativeCatalogAddition = (
  userId: string,
  variantId: string,
) => {
  const clients = useNativeApiClients();
  const queryClient = useQueryClient();
  const sync = useNativeCollectionSync();
  return useMutation({
    mutationFn: async (request: NativeCatalogDestination | Pick<NativeCatalogOrganizerRequest, 'destination' | 'formChoices'>) => {
      const { destination, formChoices } = typeof request === 'string' ? { destination: request, formChoices: undefined } : request;
      const queryKey = nativeCollectionQueryKeys.snapshot(userId);
      const snapshot = queryClient.getQueryData<NativeCollectionSnapshot>(queryKey);
      if (!snapshot) throw new Error('Load your collection before adding this Pokémon.');
      const entry = buildPokemonCatalogEntries(snapshot.catalog)
        .find((candidate) => candidate.id === variantId);
      if (!entry) throw new Error('This Pokémon variant is no longer available.');
      const result = await persistNativeCatalogAddition({
        userId,
        snapshot,
        entry,
        destination,
        formChoices,
        outbox: nativeCollectionOutbox,
        receiverClient: clients.receiver,
        onQueued: (instance) => {
          queryClient.setQueryData<NativeCollectionSnapshot>(queryKey, (current) => {
            if (!current || !instance.instance_id) return current;
            return {
              ...current,
              instances: { ...current.instances, [resolveInstanceCollectionKey(current.instances, instance.instance_id)
                ?? instance.instance_id]: instance },
            };
          });
        },
      });
      await queryClient.invalidateQueries({ queryKey });
      await sync.refreshStatus();
      return result;
    },
  });
};
