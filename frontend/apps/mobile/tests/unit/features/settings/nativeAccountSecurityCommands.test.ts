import {
  changeNativePasswordAndClearSession,
  deleteNativeAccountGraph,
  revokeNativeSessionsAndClearSession,
  saveNativeUsernameGraph,
} from '../../../../src/features/settings/nativeAccountSecurityCommands';

const user = {
  allowLocation: false,
  email: 'trainer@example.com',
  location: null,
  pokemonGoName: null,
  trainerCode: null,
  user_id: 'user-1',
  username: 'TrainerTwo',
};

describe('nativeAccountSecurityCommands', () => {
  it('commits auth username state before synchronizing the profile projection', async () => {
    const events: string[] = [];
    const authPut = jest.fn().mockImplementation(async () => {
      events.push('auth');
      return { success: true, data: user };
    });
    const usersPut = jest.fn().mockImplementation(async () => {
      events.push('users');
      return { success: true, message: 'Updated' };
    });
    await expect(saveNativeUsernameGraph({
      auth: { put: authPut },
      onAuthUpdated: () => events.push('session'),
      request: { email: user.email, username: user.username },
      userId: user.user_id,
      users: { put: usersPut },
    })).resolves.toEqual(user);
    expect(events).toEqual(['auth', 'session', 'users']);
  });

  it('publishes a committed auth username even when its profile projection needs retrying', async () => {
    const onAuthUpdated = jest.fn();
    await expect(saveNativeUsernameGraph({
      auth: { put: jest.fn().mockResolvedValue({ success: true, data: user }) },
      onAuthUpdated,
      request: { email: user.email, username: user.username },
      userId: user.user_id,
      users: { put: jest.fn().mockRejectedValue(new Error('projection offline')) },
    })).rejects.toThrow('projection offline');
    expect(onAuthUpdated).toHaveBeenCalledWith(user);
  });

  it('clears the local session only after a password or revocation command commits', async () => {
    const clearPasswordSession = jest.fn().mockResolvedValue(undefined);
    await changeNativePasswordAndClearSession({
      auth: { put: jest.fn().mockResolvedValue({ success: true, data: user }) },
      clearSession: clearPasswordSession,
      request: {
        currentPassword: 'Current_password_42!',
        email: user.email,
        password: 'Different_42!',
        username: user.username,
      },
      userId: user.user_id,
    });
    expect(clearPasswordSession).toHaveBeenCalledTimes(1);

    const clearRevokedSession = jest.fn().mockResolvedValue(undefined);
    await revokeNativeSessionsAndClearSession({
      auth: { post: jest.fn().mockResolvedValue({ message: 'Revoked' }) },
      clearSession: clearRevokedSession,
      proof: { currentPassword: 'Current_password_42!' },
    });
    expect(clearRevokedSession).toHaveBeenCalledTimes(1);

    const clearFailedSession = jest.fn();
    await expect(revokeNativeSessionsAndClearSession({
      auth: { post: jest.fn().mockRejectedValue(new Error('not revoked')) },
      clearSession: clearFailedSession,
      proof: {},
    })).rejects.toThrow('not revoked');
    expect(clearFailedSession).not.toHaveBeenCalled();
  });

  it('deletes SQL application data before auth and preserves auth for a safe SQL retry', async () => {
    const events: string[] = [];
    await deleteNativeAccountGraph({
      auth: { request: jest.fn().mockImplementation(async () => {
        events.push('auth');
        return { message: 'Deleted' };
      }) },
      clearSession: async () => { events.push('session'); },
      proof: { currentPassword: 'Current_password_42!' },
      userId: user.user_id,
      users: { request: jest.fn().mockImplementation(async () => {
        events.push('users');
        return { message: 'Deleted' };
      }) },
    });
    expect(events).toEqual(['users', 'auth', 'session']);

    const authRequest = jest.fn();
    const clearSession = jest.fn();
    await expect(deleteNativeAccountGraph({
      auth: { request: authRequest },
      clearSession,
      proof: {},
      userId: user.user_id,
      users: { request: jest.fn().mockRejectedValue(new Error('transaction rolled back')) },
    })).rejects.toThrow('transaction rolled back');
    expect(authRequest).not.toHaveBeenCalled();
    expect(clearSession).not.toHaveBeenCalled();
  });
});
