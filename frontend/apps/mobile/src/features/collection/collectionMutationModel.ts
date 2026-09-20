import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import {
  getFavoriteTradeConflict,
  resolveInstanceCollectionKey,
} from '@pokemongonexus/shared-domain/instances';
import {
  createNativeCollectionSyncBatch,
  type NativeCollectionSyncBatch,
  type NativeCollectionSyncLocation,
  type NativeCollectionSyncUpdate,
} from '../../services/collectionSyncApi';
import { normalizeNativeInstance } from './nativeInstanceNormalization';

export type NativeCollectionMutation = {
  collectionKey: string;
  previous: PokemonInstance;
  updated: NativeCollectionSyncUpdate;
  batch: NativeCollectionSyncBatch;
};

export const createNativeCollectionMutation = ({
  instances,
  requestedInstanceId,
  patch,
  syncBatchId,
  location = null,
  now = Date.now(),
}: {
  instances: Record<string, PokemonInstance>;
  requestedInstanceId: string;
  patch: Partial<PokemonInstance>;
  syncBatchId: string;
  location?: NativeCollectionSyncLocation | null;
  now?: number;
}): NativeCollectionMutation => {
  const collectionKey = resolveInstanceCollectionKey(instances, requestedInstanceId);
  if (!collectionKey) throw new Error('This Pokémon is no longer in your collection.');
  const previous = normalizeNativeInstance(instances[collectionKey]);
  const conflict = getFavoriteTradeConflict(previous, patch);
  if (conflict) throw new Error(conflict);

  const instanceId = previous.instance_id?.trim() || collectionKey;
  const updated: NativeCollectionSyncUpdate = {
    ...previous,
    ...patch,
    instance_id: instanceId,
    last_update: Math.max(now, previous.last_update + 1),
  };
  const hasChange = Object.entries(patch).some(
    ([field, value]) => !Object.is(previous[field], value),
  );
  if (!hasChange) throw new Error('This Pokémon already has those details.');

  return {
    collectionKey,
    previous,
    updated,
    batch: createNativeCollectionSyncBatch({
      syncBatchId,
      location,
      updates: [updated],
    }),
  };
};
