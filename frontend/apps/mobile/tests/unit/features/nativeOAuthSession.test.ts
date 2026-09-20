import {
  authenticateWithNativeOAuth,
  parseNativeOAuthSessionCallback,
} from '../../../src/features/auth/nativeOAuthSession';

describe('native OAuth session flow', () => {
  it('parses the one-use callback without exposing tokens in the URL', () => {
    expect(parseNativeOAuthSessionCallback(
      'pokegonexus://native/account?oauth_code=opaque-code',
    )).toEqual({ code: 'opaque-code', error: null });
    expect(parseNativeOAuthSessionCallback(
      'pokegonexus://native/account?oauth_error=expired',
    )).toEqual({ code: null, error: 'expired' });
    expect(parseNativeOAuthSessionCallback('not a URL')).toEqual({
      code: null,
      error: 'invalid-callback',
    });
  });

  it('starts, opens, and exchanges a device-bound provider login', async () => {
    const api = {
      startOAuth: jest.fn().mockResolvedValue({
        provider: 'google',
        intent: 'login',
        authorizationUrl: 'https://accounts.example/authorize',
      }),
      exchangeOAuth: jest.fn().mockResolvedValue({
        provider: 'google',
        status: 'authenticated',
        session: { accessToken: 'access', refreshToken: 'refresh', user: { user_id: '1', username: 'misty' } },
      }),
    };
    const openAuthSession = jest.fn().mockResolvedValue({
      type: 'success',
      url: 'pokegonexus://native/account?oauth_code=one-use-code',
    });
    const result = await authenticateWithNativeOAuth({
      api,
      deviceId: 'pixel-device',
      intent: 'login',
      openAuthSession,
      provider: 'google',
    });

    expect(api.startOAuth).toHaveBeenCalledWith({
      provider: 'google',
      intent: 'login',
      device_id: 'pixel-device',
    });
    expect(openAuthSession).toHaveBeenCalledWith(
      'https://accounts.example/authorize',
      'pokegonexus://native/account',
    );
    expect(api.exchangeOAuth).toHaveBeenCalledWith({
      code: 'one-use-code',
      device_id: 'pixel-device',
    });
    expect(result).toMatchObject({ status: 'authenticated', code: 'one-use-code' });
  });

  it('does not exchange a canceled browser session', async () => {
    const api = {
      startOAuth: jest.fn().mockResolvedValue({ authorizationUrl: 'https://example.test' }),
      exchangeOAuth: jest.fn(),
    };
    await expect(authenticateWithNativeOAuth({
      api,
      deviceId: 'pixel-device',
      intent: 'register',
      openAuthSession: jest.fn().mockResolvedValue({ type: 'cancel' }),
      provider: 'discord',
    })).resolves.toBeNull();
    expect(api.exchangeOAuth).not.toHaveBeenCalled();
  });
});
