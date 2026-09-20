import { createMobileSessionApi } from '../../../src/auth/mobileSessionApi';

const response = (status: number, payload: unknown): Response => ({
  ok: status >= 200 && status < 300,
  status,
  text: jest.fn().mockResolvedValue(JSON.stringify(payload)),
}) as unknown as Response;

const session = {
  user: {
    user_id: 'user-1',
    username: 'misty',
    email: 'misty@example.invalid',
    pokemonGoName: null,
    trainerCode: null,
    allowLocation: false,
    location: null,
    coordinates: null,
  },
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  accessTokenExpiry: '2026-08-23T22:00:00.000Z',
  refreshTokenExpiry: '2026-08-30T21:00:00.000Z',
};

describe('mobile session API', () => {
  it('uses explicit no-cookie mobile session endpoints', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(response(200, session))
      .mockResolvedValueOnce(response(200, session))
      .mockResolvedValueOnce(response(200, { message: 'Logged out successfully' }));
    const api = createMobileSessionApi(fetchMock);

    await api.login({ username: 'misty', password: 'password', device_id: 'native-device' });
    await api.refresh('refresh-token');
    await api.logout('refresh-token');

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://pokegonexus.com/api/auth/mobile/login',
      'https://pokegonexus.com/api/auth/mobile/refresh',
      'https://pokegonexus.com/api/auth/mobile/logout',
    ]);
    for (const [, options] of fetchMock.mock.calls) {
      expect(options).toEqual(expect.objectContaining({ credentials: 'omit' }));
    }
  });

  it('rejects a malformed successful response', async () => {
    const api = createMobileSessionApi(
      jest.fn().mockResolvedValue(response(200, { message: 'missing tokens' })),
    );
    await expect(api.refresh('refresh-token')).rejects.toThrow(
      'Authentication service returned an invalid mobile session',
    );
  });

  it('registers, exchanges the password for mobile tokens, and supports password recovery', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(response(201, { message: 'Account created successfully.' }))
      .mockResolvedValueOnce(response(200, session))
      .mockResolvedValueOnce(response(200, { message: 'If that account exists, reset instructions are on the way.' }))
      .mockResolvedValueOnce(response(200, { message: 'Password reset successful.' }));
    const api = createMobileSessionApi(fetchMock);

    await expect(api.register({
      device_id: 'native-device',
      email: 'misty@example.com',
      password: 'Strong_password_42',
      username: 'misty',
    })).resolves.toEqual(session);
    await api.requestPasswordReset({ identifier: 'misty@example.com' });
    await api.confirmPasswordReset({ token: 'reset-token', password: 'Strong_password_43' });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://pokegonexus.com/api/auth/register',
      'https://pokegonexus.com/api/auth/mobile/login',
      'https://pokegonexus.com/api/auth/reset-password',
      'https://pokegonexus.com/api/auth/reset-password/confirm',
    ]);
  });

  it('uses native provider start, exchange, and registration endpoints', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(response(201, {
        provider: 'google',
        intent: 'register',
        authorizationUrl: 'https://accounts.example/authorize',
      }))
      .mockResolvedValueOnce(response(200, {
        provider: 'google', status: 'registration-required', email: 'misty@example.com',
      }))
      .mockResolvedValueOnce(response(201, {
        provider: 'google', status: 'authenticated', session,
      }));
    const api = createMobileSessionApi(fetchMock);

    await api.startOAuth({ provider: 'google', intent: 'register', device_id: 'native-device' });
    await api.exchangeOAuth({ code: 'one-use-code', device_id: 'native-device' });
    await api.completeOAuthRegistration({
      code: 'one-use-code',
      device_id: 'native-device',
      username: 'misty',
    });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://pokegonexus.com/api/auth/mobile/oauth/start',
      'https://pokegonexus.com/api/auth/mobile/oauth/exchange',
      'https://pokegonexus.com/api/auth/mobile/oauth/complete-registration',
    ]);
    for (const [, options] of fetchMock.mock.calls) {
      expect(options).toEqual(expect.objectContaining({ credentials: 'omit' }));
    }
  });
});
