import type {
  FriendRequestPermission,
  ProfileVisibility,
  TradeCoordinationMethod,
  TrainerCodeVisibility,
  TrainerPreferences,
  UpdateTrainerPreferencesRequest,
} from '@pokemongonexus/shared-contracts/users';

export type NativeTrainerPreferencesDraft = {
  collectionVisibility: ProfileVisibility;
  coordinationHandle: string;
  coordinationMethod: TradeCoordinationMethod;
  friendRequestPermission: FriendRequestPermission;
  profileVisibility: ProfileVisibility;
  shareTradeContact: boolean;
  showLocation: boolean;
  showPokemonGoName: boolean;
  trainerCodeVisibility: TrainerCodeVisibility;
};

export const createNativeTrainerPreferencesDraft = (
  preferences: TrainerPreferences,
): NativeTrainerPreferencesDraft => ({
  collectionVisibility: preferences.collection_visibility,
  coordinationHandle: preferences.coordination_handle ?? '',
  coordinationMethod: preferences.coordination_method,
  friendRequestPermission: preferences.friend_request_permission,
  profileVisibility: preferences.profile_visibility,
  shareTradeContact: preferences.share_trade_contact,
  showLocation: preferences.show_location,
  showPokemonGoName: preferences.show_pokemon_go_name,
  trainerCodeVisibility: preferences.trainer_code_visibility,
});

const normalizeCoordinationHandle = (value: string): string | null => {
  const handle = value.trim().replace(/^@/, '');
  if (!handle) return null;
  if (handle.length > 80) {
    throw new Error('Coordination handle must be 80 characters or fewer.');
  }
  if (handle.includes('@') || handle.includes('://')) {
    throw new Error('Use a platform username, not an email address or link.');
  }
  return handle;
};

export const buildNativeTrainerPreferencesRequest = (
  draft: NativeTrainerPreferencesDraft,
): UpdateTrainerPreferencesRequest => {
  const coordinationHandle = draft.coordinationMethod === 'none'
    ? null
    : normalizeCoordinationHandle(draft.coordinationHandle);
  const shareTradeContact = draft.coordinationMethod === 'none'
    ? false
    : draft.shareTradeContact;

  if (shareTradeContact
      && (draft.coordinationMethod === 'discord' || draft.coordinationMethod === 'other')
      && !coordinationHandle) {
    throw new Error('Add a coordination handle or choose Campfire.');
  }

  return {
    profile_visibility: draft.profileVisibility,
    collection_visibility: draft.collectionVisibility,
    friend_request_permission: draft.friendRequestPermission,
    trainer_code_visibility: draft.trainerCodeVisibility,
    coordination_method: draft.coordinationMethod,
    coordination_handle: coordinationHandle,
    share_trade_contact: shareTradeContact,
    show_location: draft.showLocation,
    show_pokemon_go_name: draft.showPokemonGoName,
  };
};

export const changeNativeCoordinationMethod = (
  draft: NativeTrainerPreferencesDraft,
  coordinationMethod: TradeCoordinationMethod,
): NativeTrainerPreferencesDraft => ({
  ...draft,
  coordinationMethod,
  coordinationHandle: coordinationMethod === 'none' ? '' : draft.coordinationHandle,
  shareTradeContact: coordinationMethod === 'none' ? false : draft.shareTradeContact,
});
