import type { TrainerPreferences } from '@pokemongonexus/shared-contracts/users';
import {
  buildNativeTrainerPreferencesRequest,
  changeNativeCoordinationMethod,
  createNativeTrainerPreferencesDraft,
} from '../../../../src/features/social/nativeTrainerPreferencesModel';

const preferences: TrainerPreferences = {
  user_id: 'user-1',
  profile_visibility: 'public',
  collection_visibility: 'friends',
  friend_request_permission: 'everyone',
  trainer_code_visibility: 'friends',
  coordination_method: 'discord',
  coordination_handle: 'MistyTrades',
  share_trade_contact: true,
  show_location: false,
  show_pokemon_go_name: true,
};

describe('nativeTrainerPreferencesModel', () => {
  it('creates a complete editable draft and normalized command', () => {
    const draft = createNativeTrainerPreferencesDraft(preferences);
    expect(draft).toEqual({
      collectionVisibility: 'friends',
      coordinationHandle: 'MistyTrades',
      coordinationMethod: 'discord',
      friendRequestPermission: 'everyone',
      profileVisibility: 'public',
      shareTradeContact: true,
      showLocation: false,
      showPokemonGoName: true,
      trainerCodeVisibility: 'friends',
    });
    expect(buildNativeTrainerPreferencesRequest({
      ...draft,
      coordinationHandle: '  @UpdatedTrainer  ',
    })).toEqual({
      profile_visibility: 'public',
      collection_visibility: 'friends',
      friend_request_permission: 'everyone',
      trainer_code_visibility: 'friends',
      coordination_method: 'discord',
      coordination_handle: 'UpdatedTrainer',
      share_trade_contact: true,
      show_location: false,
      show_pokemon_go_name: true,
    });
  });

  it('clears coordination details when sharing is disabled', () => {
    const draft = changeNativeCoordinationMethod(
      createNativeTrainerPreferencesDraft(preferences),
      'none',
    );
    expect(draft.coordinationHandle).toBe('');
    expect(draft.shareTradeContact).toBe(false);
    expect(buildNativeTrainerPreferencesRequest(draft)).toEqual(expect.objectContaining({
      coordination_method: 'none',
      coordination_handle: null,
      share_trade_contact: false,
    }));
  });

  it('rejects unsafe or incomplete coordination details before the request', () => {
    const draft = createNativeTrainerPreferencesDraft(preferences);
    expect(() => buildNativeTrainerPreferencesRequest({
      ...draft,
      coordinationHandle: 'trainer@example.com',
    })).toThrow('not an email address or link');
    expect(() => buildNativeTrainerPreferencesRequest({
      ...draft,
      coordinationHandle: '',
    })).toThrow('Add a coordination handle');
    expect(() => buildNativeTrainerPreferencesRequest({
      ...draft,
      coordinationHandle: 'x'.repeat(81),
    })).toThrow('80 characters or fewer');
  });
});
