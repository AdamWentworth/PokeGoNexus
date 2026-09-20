import {
  confirmNativeEmailChange,
  deleteNativeApplicationAccount,
  deleteNativeAuthenticationAccount,
  exchangeNativeOAuthProviderLink,
  getNativeAccountSecurity,
  requestNativeEmailChange,
  revokeNativeAccountSessions,
  startNativeOAuthProviderLink,
  unlinkNativeAccountProvider,
  updateNativeAccountPassword,
  updateNativeAccountUsername,
  updateNativeSecondaryUsername,
} from '../../../src/services/nativeAccountSecurityApi';

const user = {
  allowLocation: false,
  email: 'trainer@example.com',
  location: null,
  pokemonGoName: null,
  trainerCode: null,
  user_id: 'user-1',
  username: 'TrainerOne',
};

describe('nativeAccountSecurityApi', () => {
  it('validates the account security envelope', async () => {
    const get = jest.fn().mockResolvedValue({
      activeSessions: 2,
      email: 'trainer@example.com',
      hasPassword: true,
      providers: [{
        email: 'trainer@gmail.com',
        emailVerified: true,
        linkedAt: '2026-01-01T00:00:00Z',
        provider: 'google',
      }],
    });
    await expect(getNativeAccountSecurity({ get })).resolves.toMatchObject({ activeSessions: 2 });
    get.mockResolvedValueOnce({ activeSessions: -1, providers: [] });
    await expect(getNativeAccountSecurity({ get })).rejects.toThrow('account security response is invalid');
  });

  it('validates username and password update responses', async () => {
    const put = jest.fn().mockResolvedValue({ success: true, data: user });
    await expect(updateNativeAccountUsername({ put }, 'user-1', {
      email: user.email,
      username: 'TrainerTwo',
    })).resolves.toEqual(user);
    await expect(updateNativeAccountPassword({ put }, 'user-1', {
      currentPassword: 'Current_password_42!',
      email: user.email,
      password: 'Different_42!',
      username: user.username,
    })).resolves.toEqual(user);
    put.mockResolvedValueOnce({ success: true, data: { username: 'missing-id' } });
    await expect(updateNativeAccountUsername({ put }, 'user-1', {
      email: user.email,
      username: 'TrainerTwo',
    })).rejects.toThrow('account update response is invalid');
  });

  it('uses explicit bearer commands for email, sessions, providers, and deletion', async () => {
    const post = jest.fn().mockResolvedValue({ message: 'Done' });
    const request = jest.fn().mockResolvedValue({ message: 'Done' });
    await requestNativeEmailChange({ post }, {
      currentPassword: 'proof',
      email: 'new@example.com',
    });
    await confirmNativeEmailChange({ post }, 'a'.repeat(64));
    await revokeNativeAccountSessions({ post }, { currentPassword: 'proof' });
    await unlinkNativeAccountProvider({ request }, 'discord', { currentPassword: 'proof' });
    await deleteNativeAuthenticationAccount({ request }, 'user-1', { currentPassword: 'proof' });
    await deleteNativeApplicationAccount({ request }, 'user-1');
    expect(post).toHaveBeenNthCalledWith(1, '/email-change', {
      currentPassword: 'proof',
      email: 'new@example.com',
    });
    expect(post).toHaveBeenNthCalledWith(2, '/email-change/confirm', { token: 'a'.repeat(64) });
    expect(post).toHaveBeenNthCalledWith(3, '/sessions/revoke-all', { currentPassword: 'proof' });
    expect(request).toHaveBeenNthCalledWith(1, '/account/identities/discord', {
      json: { currentPassword: 'proof' },
      method: 'DELETE',
    });
    expect(request).toHaveBeenNthCalledWith(2, '/delete/user-1', {
      json: { currentPassword: 'proof' },
      method: 'DELETE',
    });
    expect(request).toHaveBeenNthCalledWith(3, '/user-1', { method: 'DELETE' });
  });

  it('validates native provider-link start and exchange envelopes', async () => {
    const post = jest.fn()
      .mockResolvedValueOnce({
        authorizationUrl: 'https://accounts.example.test/oauth?state=native.state',
        provider: 'google',
      })
      .mockResolvedValueOnce({ provider: 'google', status: 'linked' });
    await expect(startNativeOAuthProviderLink({ post }, 'google')).resolves.toMatchObject({
      provider: 'google',
    });
    await expect(exchangeNativeOAuthProviderLink({ post }, 'one-use-code')).resolves.toEqual({
      provider: 'google',
      status: 'linked',
    });
    expect(post).toHaveBeenNthCalledWith(1, '/mobile/oauth/link/start', { provider: 'google' });
    expect(post).toHaveBeenNthCalledWith(2, '/mobile/oauth/link/exchange', { code: 'one-use-code' });

    post.mockResolvedValueOnce({ provider: 'google', authorizationUrl: 'javascript:alert(1)' });
    await expect(startNativeOAuthProviderLink({ post }, 'google'))
      .rejects.toThrow('provider connection response is invalid');
    post.mockResolvedValueOnce({ provider: 'google', status: 'unknown' });
    await expect(exchangeNativeOAuthProviderLink({ post }, 'bad-result'))
      .rejects.toThrow('provider connection result is invalid');
  });

  it('syncs a username to the users service and rejects malformed success', async () => {
    const put = jest.fn().mockResolvedValue({ success: true, message: 'Updated' });
    await expect(updateNativeSecondaryUsername({ put }, 'user-1', 'TrainerTwo')).resolves.toBeUndefined();
    expect(put).toHaveBeenCalledWith('/update-user/user-1', { username: 'TrainerTwo' });
    put.mockResolvedValueOnce({ success: false });
    await expect(updateNativeSecondaryUsername({ put }, 'user-1', 'TrainerTwo'))
      .rejects.toThrow('trainer username response is invalid');
  });
});
