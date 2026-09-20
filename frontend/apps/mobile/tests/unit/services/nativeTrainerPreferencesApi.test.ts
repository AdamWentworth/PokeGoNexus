import {
  getNativeTrainerPreferences,
  updateNativeTrainerPreferences,
} from '../../../src/services/nativeTrainerPreferencesApi';

const response = {
  user_id: 'user-1',
  profile_visibility: 'public',
  collection_visibility: 'friends',
  friend_request_permission: 'everyone',
  trainer_code_visibility: 'friends',
  coordination_method: 'campfire',
  coordination_handle: null,
  share_trade_contact: true,
  show_location: false,
  show_pokemon_go_name: true,
};

describe('nativeTrainerPreferencesApi', () => {
  it('loads and updates preferences through the users service', async () => {
    const get = jest.fn().mockResolvedValue(response);
    const put = jest.fn().mockResolvedValue({ ...response, show_location: true });
    await expect(getNativeTrainerPreferences({ get } as never)).resolves.toEqual(response);
    expect(get).toHaveBeenCalledWith('/preferences');

    await expect(updateNativeTrainerPreferences({ put } as never, {
      profile_visibility: 'public',
      collection_visibility: 'friends',
      friend_request_permission: 'everyone',
      trainer_code_visibility: 'friends',
      coordination_method: 'campfire',
      coordination_handle: null,
      share_trade_contact: true,
      show_location: true,
      show_pokemon_go_name: true,
    })).resolves.toEqual({ ...response, show_location: true });
    expect(put).toHaveBeenCalledWith('/preferences', expect.objectContaining({
      show_location: true,
    }));
  });

  it('rejects malformed preference envelopes', async () => {
    const get = jest.fn().mockResolvedValue({ ...response, show_location: 'yes' });
    await expect(getNativeTrainerPreferences({ get } as never)).rejects.toThrow(
      'trainer settings response is invalid',
    );
  });
});
