import type {
  TrainerPreferences,
  UpdateTrainerPreferencesRequest,
} from '@pokemongonexus/shared-contracts/users';
import { usersContract } from '@pokemongonexus/shared-contracts/users';
import type { NativeUsersApiClient } from './nativeApiClients';

type PreferencesClient = Pick<NativeUsersApiClient, 'get' | 'put'>;

const PROFILE_VISIBILITY = new Set(['public', 'friends', 'private']);
const FRIEND_REQUEST_PERMISSION = new Set(['everyone', 'nobody']);
const COORDINATION_METHOD = new Set(['campfire', 'discord', 'other', 'none']);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const isTrainerPreferences = (value: unknown): value is TrainerPreferences => {
  if (!isRecord(value)) return false;
  return typeof value.user_id === 'string' && value.user_id.trim().length > 0
    && typeof value.profile_visibility === 'string'
    && PROFILE_VISIBILITY.has(value.profile_visibility)
    && typeof value.collection_visibility === 'string'
    && PROFILE_VISIBILITY.has(value.collection_visibility)
    && typeof value.friend_request_permission === 'string'
    && FRIEND_REQUEST_PERMISSION.has(value.friend_request_permission)
    && typeof value.trainer_code_visibility === 'string'
    && PROFILE_VISIBILITY.has(value.trainer_code_visibility)
    && typeof value.coordination_method === 'string'
    && COORDINATION_METHOD.has(value.coordination_method)
    && (value.coordination_handle === undefined
      || value.coordination_handle === null
      || typeof value.coordination_handle === 'string')
    && typeof value.share_trade_contact === 'boolean'
    && typeof value.show_location === 'boolean'
    && typeof value.show_pokemon_go_name === 'boolean';
};

const requireTrainerPreferences = (payload: unknown): TrainerPreferences => {
  if (!isTrainerPreferences(payload)) {
    throw new Error('The trainer settings response is invalid.');
  }
  return payload;
};

export const getNativeTrainerPreferences = async (
  client: Pick<PreferencesClient, 'get'>,
): Promise<TrainerPreferences> => requireTrainerPreferences(
  await client.get<unknown>(usersContract.endpoints.preferences),
);

export const updateNativeTrainerPreferences = async (
  client: Pick<PreferencesClient, 'put'>,
  request: UpdateTrainerPreferencesRequest,
): Promise<TrainerPreferences> => requireTrainerPreferences(
  await client.put<unknown>(usersContract.endpoints.preferences, request),
);
