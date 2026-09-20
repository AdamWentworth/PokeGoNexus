import { authContract } from '@pokemongonexus/shared-contracts/auth';
import { usersContract } from '@pokemongonexus/shared-contracts/users';
import {
  updateNativeAuthProfile,
  updateNativeTrainerProfile,
} from '../../../src/services/nativeTrainerProfileApi';

describe('native trainer profile API', () => {
  it('updates the authenticated identity through the auth service', async () => {
    const user = {
      user_id: 'user-1',
      username: 'AdamZilla',
      email: 'adam@example.invalid',
      pokemonGoName: 'AdamGo',
      trainerCode: '123456789012',
      location: 'Burnaby, BC',
      allowLocation: false,
    };
    const client = { put: jest.fn().mockResolvedValue({ success: true, data: user }) };
    await expect(updateNativeAuthProfile(client, ' user-1 ', {
      pokemonGoName: 'AdamGo',
      trainerCode: '123456789012',
      location: 'Burnaby, BC',
    })).resolves.toEqual(user);
    expect(client.put).toHaveBeenCalledWith(authContract.endpoints.updateUser('user-1'), {
      pokemonGoName: 'AdamGo',
      trainerCode: '123456789012',
      location: 'Burnaby, BC',
    });
  });

  it('updates the trainer card through the users service', async () => {
    const client = { put: jest.fn().mockResolvedValue({ success: true }) };
    const request = { trainer_titles: ['shiny-hunter' as const] };
    await expect(updateNativeTrainerProfile(client, request)).resolves.toBeUndefined();
    expect(client.put).toHaveBeenCalledWith(usersContract.endpoints.profile, request);
  });

  it('rejects malformed success responses and missing user IDs', async () => {
    const client = { put: jest.fn().mockResolvedValue({ success: true }) };
    await expect(updateNativeAuthProfile(client, '', {
      pokemonGoName: null,
      trainerCode: null,
      location: null,
    })).rejects.toThrow('required');
    await expect(updateNativeAuthProfile(client, 'user-1', {
      pokemonGoName: null,
      trainerCode: null,
      location: null,
    })).rejects.toThrow('invalid');
    await expect(updateNativeTrainerProfile({
      put: jest.fn().mockResolvedValue({ success: false }),
    }, {})).rejects.toThrow('invalid');
  });
});
