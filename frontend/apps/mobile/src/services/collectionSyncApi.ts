import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import {
  receiverContract,
  type ReceiverBatchedUpdatesPayload,
  type ReceiverBatchedUpdatesResponse,
} from '@pokemongonexus/shared-contracts/receiver';
import type { NativeReceiverApiClient } from './nativeApiClients';

const MAX_UPDATES_PER_BATCH = 5000;
const SYNC_BATCH_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const STORAGE_SNAPSHOT_FIELDS = [
  'variant_id', 'pokemon_id', 'nickname', 'cp', 'level',
  'attack_iv', 'defense_iv', 'stamina_iv',
  'shiny', 'costume_id', 'lucky', 'shadow', 'purified',
  'fast_move_id', 'charged_move1_id', 'charged_move2_id',
  'weight', 'height', 'gender',
  'mega', 'mega_form', 'is_mega', 'dynamax', 'gigantamax', 'crown',
  'max_attack', 'max_guard', 'max_spirit',
  'is_fused', 'fusion', 'fusion_form', 'fused_with',
  'is_traded', 'traded_date', 'original_trainer_name',
  'is_caught', 'is_for_trade', 'is_wanted', 'most_wanted',
  'caught_tags', 'trade_tags', 'wanted_tags',
  'not_trade_list', 'not_wanted_list', 'trade_filters', 'wanted_filters',
  'mirror', 'pref_lucky', 'friendship_level', 'registered', 'favorite', 'disabled',
  'pokeball', 'location_card', 'location_caught', 'date_caught', 'last_update',
] as const satisfies readonly (keyof PokemonInstance)[];

export type NativeCollectionSyncLocation = {
  latitude: number;
  longitude: number;
};

/**
 * Receiver/Storage consumes complete snapshots, not patches. Keeping the
 * required PokemonInstance shape here prevents native mutations from silently
 * clearing fields that were omitted from a partial update.
 */
export type NativeCollectionSyncUpdate = PokemonInstance & {
  instance_id: string;
};

export type NativeCollectionSyncBatch = ReceiverBatchedUpdatesPayload<
  NativeCollectionSyncUpdate
>;

const assertFiniteCoordinate = (label: string, value: number): void => {
  if (!Number.isFinite(value)) throw new Error(`${label} must be a finite number.`);
};

const validateLocation = (
  location: NativeCollectionSyncLocation | null,
): NativeCollectionSyncLocation | null => {
  if (!location) return null;
  assertFiniteCoordinate('Latitude', location.latitude);
  assertFiniteCoordinate('Longitude', location.longitude);
  if (location.latitude < -90 || location.latitude > 90) {
    throw new Error('Latitude must be between -90 and 90.');
  }
  if (location.longitude < -180 || location.longitude > 180) {
    throw new Error('Longitude must be between -180 and 180.');
  }
  return { ...location };
};

const validateSnapshot = (
  update: NativeCollectionSyncUpdate,
): NativeCollectionSyncUpdate => {
  const instanceId = typeof update.instance_id === 'string'
    ? update.instance_id.trim()
    : '';
  if (!instanceId) throw new Error('Every collection update requires an instance_id.');
  const missingField = STORAGE_SNAPSHOT_FIELDS.find(
    (field) => !Object.prototype.hasOwnProperty.call(update, field),
  );
  if (missingField) {
    throw new Error(
      `Collection update ${instanceId} is a partial snapshot missing ${missingField}.`,
    );
  }
  if (!Number.isFinite(update.last_update) || update.last_update <= 0) {
    throw new Error(`Collection update ${instanceId} requires a valid last_update.`);
  }
  if (typeof update.is_caught !== 'boolean'
    || typeof update.is_for_trade !== 'boolean'
    || typeof update.is_wanted !== 'boolean') {
    throw new Error(`Collection update ${instanceId} requires complete ownership flags.`);
  }

  const isTracked = update.is_caught || update.is_for_trade || update.is_wanted;
  if (isTracked && (
    typeof update.variant_id !== 'string'
    || !update.variant_id.trim()
    || !Number.isInteger(update.pokemon_id)
  )) {
    throw new Error(`Tracked collection update ${instanceId} requires Pokémon identity.`);
  }

  return { ...update, instance_id: instanceId };
};

export const createNativeCollectionSyncBatch = ({
  syncBatchId,
  location,
  updates,
}: {
  syncBatchId: string;
  location: NativeCollectionSyncLocation | null;
  updates: NativeCollectionSyncUpdate[];
}): NativeCollectionSyncBatch => {
  if (!SYNC_BATCH_ID_PATTERN.test(syncBatchId)) {
    throw new Error('The collection sync batch ID is invalid.');
  }
  if (updates.length === 0) {
    throw new Error('A collection sync batch must contain at least one update.');
  }
  if (updates.length > MAX_UPDATES_PER_BATCH) {
    throw new Error(`A collection sync batch cannot exceed ${MAX_UPDATES_PER_BATCH} updates.`);
  }

  return {
    sync_batch_id: syncBatchId,
    location: validateLocation(location),
    pokemonUpdates: updates.map(validateSnapshot),
  };
};

export const submitNativeCollectionSyncBatch = (
  receiverClient: Pick<NativeReceiverApiClient, 'post'>,
  batch: NativeCollectionSyncBatch,
): Promise<ReceiverBatchedUpdatesResponse> =>
  receiverClient.post<ReceiverBatchedUpdatesResponse>(
    receiverContract.endpoints.batchedUpdates,
    batch,
  );
