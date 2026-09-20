import * as Crypto from 'expo-crypto';
import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import {
  resolveInstanceCollectionKey,
} from '@pokemongonexus/shared-domain/instances';
import type { TradePreferenceFilters } from '@pokemongonexus/shared-domain/trade-preferences';
import type { NativeCollectionSnapshot } from '../../services/collectionApi';
import {
  createNativeCollectionSyncBatch,
  type NativeCollectionSyncUpdate,
} from '../../services/collectionSyncApi';
import type { NativeReceiverApiClient } from '../../services/nativeApiClients';
import type { nativeCollectionOutbox } from '../../storage/nativeCollectionOutbox';
import { sendPendingNativeCollectionBatches } from '../collection/collectionSyncCoordinator';
import {
  createNativeCollectionMutation,
  type NativeCollectionMutation,
} from '../collection/collectionMutationModel';
import { normalizeNativeInstance } from '../collection/nativeInstanceNormalization';
import {
  buildNativeTradePreferencePatchPlan,
  type NativeTradePreferenceMode,
} from './nativeTradePreferencesModel';

type CollectionOutboxPort = Pick<
  typeof nativeCollectionOutbox,
  'queue' | 'list' | 'markAttemptFailed' | 'markAcknowledged' | 'removeAcknowledged'
>;

export type NativeTradePreferenceMutationRequest = {
  filteredOutIds: string[];
  filters: TradePreferenceFilters;
  manuallyExcludedIds: string[];
  mirror: boolean;
  mode: NativeTradePreferenceMode;
  selectedInstanceId: string;
};

export type NativeTradePreferenceMutationResult = {
  message: string;
  mutations: NativeCollectionMutation[];
  mirrorCreation: NativeCollectionSyncUpdate | null;
  syncState: 'acknowledged' | 'pending' | 'unchanged';
  updates: NativeCollectionSyncUpdate[];
};

const normalizeMirrorVariantId = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const separator = value.indexOf('-');
  if (separator < 0) return value.toLocaleLowerCase();
  return `${value.slice(0, separator)}-${value.slice(separator + 1).replace(/-/g, '_')}`
    .toLocaleLowerCase();
};

const findExistingMirrorWanted = (
  instances: Record<string, PokemonInstance>,
  source: PokemonInstance,
): string | null => {
  const sourceVariant = normalizeMirrorVariantId(source.variant_id);
  if (!sourceVariant) return null;
  const found = Object.entries(instances).find(([, candidate]) => (
    !candidate.disabled
    && candidate.is_wanted
    && !candidate.is_caught
    && !candidate.is_for_trade
    && candidate.pokemon_id === source.pokemon_id
    && normalizeMirrorVariantId(candidate.variant_id) === sourceVariant
  ));
  return found?.[0] ?? null;
};

/**
 * Receiver requires complete snapshots. A mirror target deliberately keeps
 * only variant identity from the For Trade source and clears caught-specific
 * details, matching the canonical web editor's generated Wanted entry.
 */
export const createNativeMirrorWantedInstance = ({
  source,
  instanceId,
  now,
}: {
  source: PokemonInstance;
  instanceId: string;
  now: number;
}): NativeCollectionSyncUpdate => {
  const normalized = normalizeNativeInstance(source);
  return {
    ...normalized,
    instance_id: instanceId,
    nickname: null,
    cp: null,
    level: null,
    attack_iv: null,
    defense_iv: null,
    stamina_iv: null,
    lucky: false,
    shadow: false,
    purified: false,
    fast_move_id: null,
    charged_move1_id: null,
    charged_move2_id: null,
    weight: null,
    height: null,
    gender: null,
    mega: false,
    mega_form: null,
    is_mega: false,
    max_attack: null,
    max_guard: null,
    max_spirit: null,
    is_fused: false,
    fusion: null,
    fusion_form: null,
    fused_with: null,
    is_traded: false,
    traded_date: null,
    original_trainer_id: null,
    original_trainer_name: null,
    is_caught: false,
    is_for_trade: false,
    is_wanted: true,
    most_wanted: false,
    caught_tags: [],
    trade_tags: [],
    wanted_tags: [],
    not_trade_list: {},
    not_wanted_list: {},
    trade_filters: {},
    wanted_filters: {},
    wanted_size_preferences: null,
    mirror: true,
    pref_lucky: false,
    friendship_level: null,
    registered: true,
    favorite: false,
    disabled: false,
    pokeball: null,
    location_card: null,
    location_caught: null,
    date_caught: null,
    date_added: new Date(now).toISOString(),
    last_update: now,
    gps: null,
  };
};

const patchChanged = (
  instance: PokemonInstance,
  patch: Partial<PokemonInstance>,
): boolean => Object.entries(patch).some(([field, value]) => (
  JSON.stringify(instance[field]) !== JSON.stringify(value)
));

export const persistNativeTradePreferenceMutation = async ({
  userId,
  snapshot,
  request,
  outbox,
  receiverClient,
  onQueued,
  mirrorInstanceId = Crypto.randomUUID(),
  syncBatchId = Crypto.randomUUID(),
  now = Date.now(),
}: {
  userId: string;
  snapshot: NativeCollectionSnapshot;
  request: NativeTradePreferenceMutationRequest;
  outbox: CollectionOutboxPort;
  receiverClient: Pick<NativeReceiverApiClient, 'post'>;
  onQueued?: (updates: NativeCollectionSyncUpdate[]) => Promise<void> | void;
  mirrorInstanceId?: string;
  syncBatchId?: string;
  now?: number;
}): Promise<NativeTradePreferenceMutationResult> => {
  const plan = buildNativeTradePreferencePatchPlan({
    filteredOutIds: request.filteredOutIds,
    filters: request.filters,
    instances: snapshot.instances,
    manuallyExcludedIds: request.manuallyExcludedIds,
    mirror: request.mirror,
    mode: request.mode,
    selectedInstanceId: request.selectedInstanceId,
  });
  const selected = snapshot.instances[plan.selectedCollectionKey];
  if (!selected) throw new Error('The selected trade preference entry no longer exists.');

  let mirrorCreation: NativeCollectionSyncUpdate | null = null;
  if (request.mode === 'trade' && request.mirror) {
    const existingMirror = findExistingMirrorWanted(snapshot.instances, selected);
    if (!existingMirror) {
      if (resolveInstanceCollectionKey(snapshot.instances, mirrorInstanceId)) {
        throw new Error('Could not create a unique mirror target. Try saving again.');
      }
      mirrorCreation = createNativeMirrorWantedInstance({
        source: selected,
        instanceId: mirrorInstanceId,
        now,
      });
    }
  }

  const mutations = Object.entries(plan.patches).flatMap(([collectionKey, patch], index) => {
    const current = snapshot.instances[collectionKey];
    if (!current || !patchChanged(current, patch)) return [];
    return [createNativeCollectionMutation({
      instances: snapshot.instances,
      requestedInstanceId: collectionKey,
      patch,
      syncBatchId,
      now: now + index + (mirrorCreation ? 1 : 0),
    })];
  });
  const updates = [
    ...(mirrorCreation ? [mirrorCreation] : []),
    ...mutations.map((mutation) => mutation.updated),
  ];
  if (updates.length === 0) {
    return {
      message: 'These trade preferences are already saved.',
      mirrorCreation: null,
      mutations: [],
      syncState: 'unchanged',
      updates: [],
    };
  }

  const batch = createNativeCollectionSyncBatch({
    syncBatchId,
    location: null,
    updates,
  });
  await outbox.queue(userId, batch, now);
  await onQueued?.(updates);
  const sent = await sendPendingNativeCollectionBatches({ userId, outbox, receiverClient });
  return {
    message: sent.failedBatchId
      ? 'Preferences saved on this device. They will sync when Receiver is available.'
      : 'Trade preferences saved. Receiver accepted the update.',
    mirrorCreation,
    mutations,
    syncState: sent.failedBatchId ? 'pending' : 'acknowledged',
    updates,
  };
};
