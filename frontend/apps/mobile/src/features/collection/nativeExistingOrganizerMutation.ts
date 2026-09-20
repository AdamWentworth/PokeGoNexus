import * as Crypto from 'expo-crypto';
import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import {
  getFavoriteTradeConflict,
  resolveInstanceCollectionKey,
} from '@pokemongonexus/shared-domain/instances';
import { createNativeCollectionSyncBatch } from '../../services/collectionSyncApi';
import type { NativeCollectionSnapshot } from '../../services/collectionApi';
import type { NativeReceiverApiClient } from '../../services/nativeApiClients';
import type { nativeCollectionOutbox } from '../../storage/nativeCollectionOutbox';
import { sendPendingNativeCollectionBatches } from './collectionSyncCoordinator';
import {
  normalizeNativeInstance,
  normalizeNativeTagIds,
} from './nativeInstanceNormalization';

export type NativeOrganizerTagChanges = Record<string, boolean>;

export type NativeExistingOrganizerRequest =
  | {
      operation: 'update';
      instanceIds: string[];
      favorite?: boolean;
      forTrade?: boolean;
      mostWanted?: boolean;
      caughtTagChanges?: NativeOrganizerTagChanges;
      wantedTagChanges?: NativeOrganizerTagChanges;
    }
  | {
      operation: 'clone-wanted';
      instanceIds: string[];
      customTagIds?: string[];
      mostWanted?: boolean;
    }
  | {
      operation: 'convert-caught';
      instanceIds: string[];
      destination: 'caught' | 'trade';
      customTagIds?: string[];
      favorite?: boolean;
    }
  | {
      operation: 'remove';
      instanceIds: string[];
    };

type CollectionOutboxPort = Pick<
  typeof nativeCollectionOutbox,
  'queue' | 'list' | 'markAttemptFailed' | 'markAcknowledged' | 'removeAcknowledged'
>;

const uniqueStrings = (values: string[] | undefined): string[] =>
  [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];

const applyTagChanges = (
  current: unknown,
  changes: NativeOrganizerTagChanges | undefined,
): string[] => {
  const result = new Set(normalizeNativeTagIds(current));
  for (const [tagId, selected] of Object.entries(changes ?? {})) {
    const normalized = tagId.trim();
    if (!normalized) continue;
    if (selected) result.add(normalized);
    else result.delete(normalized);
  }
  return [...result];
};

const isTracked = (instance: PokemonInstance): boolean =>
  instance.is_caught || instance.is_for_trade || instance.is_wanted;

const assertTradeEligible = (instance: PokemonInstance): void => {
  if (instance.favorite) {
    throw new Error('Favorite Pokémon cannot be listed For Trade. Remove Favorite first.');
  }
  if (instance.lucky) throw new Error('Lucky Pokémon cannot be listed For Trade.');
  if (instance.shadow) throw new Error('Shadow Pokémon cannot be listed For Trade.');
  if (instance.is_mega || instance.mega) {
    throw new Error('Mega or Primal Pokémon cannot be listed For Trade.');
  }
  if (instance.is_fused || [2270, 2271].includes(instance.pokemon_id)) {
    throw new Error('Fusion Pokémon cannot be listed For Trade.');
  }
};

const assertWantedEligible = (instance: PokemonInstance): void => {
  if (instance.lucky) throw new Error('Lucky Pokémon cannot be copied to Wanted.');
  if (instance.shadow) throw new Error('Shadow Pokémon cannot be copied to Wanted.');
  if (instance.is_mega || instance.mega) {
    throw new Error('Mega or Primal Pokémon cannot be copied to Wanted.');
  }
  if (instance.is_fused || [2270, 2271].includes(instance.pokemon_id)) {
    throw new Error('Fusion Pokémon cannot be copied to Wanted.');
  }
};

const resolveSelectedInstances = (
  instances: Record<string, PokemonInstance>,
  requestedIds: string[],
): { collectionKey: string; instance: PokemonInstance }[] => {
  const resolved = uniqueStrings(requestedIds).map((requestedId) => {
    const collectionKey = resolveInstanceCollectionKey(instances, requestedId);
    if (!collectionKey) throw new Error('A selected Pokémon is no longer in your collection.');
    const instance = normalizeNativeInstance(instances[collectionKey]);
    if (!isTracked(instance) || instance.disabled) {
      throw new Error('A selected Pokémon is unavailable and cannot be organized.');
    }
    return { collectionKey, instance };
  });
  if (resolved.length === 0) throw new Error('Select at least one Pokémon.');
  return resolved;
};

export const buildNativeExistingOrganizerUpdates = ({
  snapshot,
  request,
  cloneInstanceIds,
  now = Date.now(),
}: {
  snapshot: NativeCollectionSnapshot;
  request: NativeExistingOrganizerRequest;
  cloneInstanceIds?: string[];
  now?: number;
}): { collectionKey: string; instance: PokemonInstance }[] => {
  const selected = resolveSelectedInstances(snapshot.instances, request.instanceIds);
  let cloneIndex = 0;

  const updates = selected.map(({ collectionKey, instance }, index) => {
    const updatedAt = Math.max(now + index, instance.last_update + 1);

    if (request.operation === 'clone-wanted') {
      if (!instance.is_caught || instance.is_wanted) {
        throw new Error('Only caught Pokémon can create Wanted copies.');
      }
      assertWantedEligible(instance);
      const instanceId = cloneInstanceIds?.[cloneIndex++] ?? Crypto.randomUUID();
      return {
        collectionKey: instanceId,
        instance: {
          ...instance,
          instance_id: instanceId,
          is_caught: false,
          is_for_trade: false,
          is_wanted: true,
          favorite: false,
          most_wanted: Boolean(request.mostWanted),
          caught_tags: [],
          trade_tags: [],
          wanted_tags: uniqueStrings(request.customTagIds),
          registered: true,
          last_update: updatedAt,
        },
      };
    }

    if (request.operation === 'convert-caught') {
      if (!instance.is_wanted || instance.is_caught || instance.is_for_trade) {
        throw new Error('Only Wanted Pokémon can be moved to Caught.');
      }
      if (request.destination === 'trade') assertTradeEligible(instance);
      const next = {
        ...instance,
        is_caught: true,
        is_for_trade: request.destination === 'trade',
        is_wanted: false,
        favorite: request.destination === 'caught' && Boolean(request.favorite),
        most_wanted: false,
        caught_tags: uniqueStrings(request.customTagIds),
        trade_tags: [],
        wanted_tags: [],
        registered: true,
        last_update: updatedAt,
      };
      const conflict = getFavoriteTradeConflict(instance, next);
      if (conflict) throw new Error(conflict);
      return { collectionKey, instance: next };
    }

    if (request.operation === 'remove') {
      return {
        collectionKey,
        instance: {
          ...instance,
          is_caught: false,
          is_for_trade: false,
          is_wanted: false,
          favorite: false,
          most_wanted: false,
          caught_tags: [],
          trade_tags: [],
          wanted_tags: [],
          registered: false,
          last_update: updatedAt,
        },
      };
    }

    const next = { ...instance };
    if (instance.is_wanted) {
      if (request.mostWanted !== undefined) next.most_wanted = request.mostWanted;
      next.wanted_tags = applyTagChanges(instance.wanted_tags, request.wantedTagChanges);
    } else {
      if (request.favorite !== undefined) next.favorite = request.favorite;
      if (request.forTrade !== undefined) {
        if (request.forTrade) assertTradeEligible({ ...next, favorite: next.favorite });
        next.is_caught = true;
        next.is_for_trade = request.forTrade;
        next.is_wanted = false;
        next.most_wanted = false;
        next.wanted_tags = [];
      }
      next.caught_tags = applyTagChanges(instance.caught_tags, request.caughtTagChanges);
    }
    const conflict = getFavoriteTradeConflict(instance, next);
    if (conflict) throw new Error(conflict);
    const changed = Object.keys(next).some(
      (field) => field !== 'last_update'
        && JSON.stringify(next[field]) !== JSON.stringify(instance[field]),
    );
    if (!changed) return null;
    next.last_update = updatedAt;
    return { collectionKey, instance: next };
  });
  const changedUpdates = updates.filter(
    (update): update is { collectionKey: string; instance: PokemonInstance } => update !== null,
  );
  if (changedUpdates.length === 0) throw new Error('No organization changes were selected.');
  return changedUpdates;
};

export const persistNativeExistingOrganizerMutation = async ({
  userId,
  snapshot,
  request,
  outbox,
  receiverClient,
  onQueued,
  cloneInstanceIds,
  syncBatchId = Crypto.randomUUID(),
  now = Date.now(),
}: {
  userId: string;
  snapshot: NativeCollectionSnapshot;
  request: NativeExistingOrganizerRequest;
  outbox: CollectionOutboxPort;
  receiverClient: Pick<NativeReceiverApiClient, 'post'>;
  onQueued?: (updates: { collectionKey: string; instance: PokemonInstance }[]) => Promise<void> | void;
  cloneInstanceIds?: string[];
  syncBatchId?: string;
  now?: number;
}) => {
  const updates = buildNativeExistingOrganizerUpdates({
    snapshot,
    request,
    cloneInstanceIds,
    now,
  });
  const batch = createNativeCollectionSyncBatch({
    syncBatchId,
    location: null,
    updates: updates.map(({ instance }) => ({
      ...instance,
      instance_id: instance.instance_id!,
    })),
  });
  await outbox.queue(userId, batch, now);
  await onQueued?.(updates);
  const sent = await sendPendingNativeCollectionBatches({ userId, outbox, receiverClient });
  const subject = request.operation === 'clone-wanted'
    ? `${updates.length} Wanted ${updates.length === 1 ? 'copy' : 'copies'} created`
    : request.operation === 'convert-caught'
      ? `${updates.length} Pokémon moved to ${request.destination === 'trade' ? 'For Trade' : 'Caught'}`
      : request.operation === 'remove'
        ? `${updates.length} Pokémon removed`
        : `Organization updated for ${updates.length} Pokémon`;
  return {
    updates,
    syncState: sent.failedBatchId ? 'pending' as const : 'acknowledged' as const,
    message: sent.failedBatchId
      ? `${subject} on this device. The change will sync when Receiver is available.`
      : `${subject}. Receiver accepted the change.`,
  };
};
