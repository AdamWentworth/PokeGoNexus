import { act, renderHook, waitFor } from '@testing-library/react-native';
import { ApiClientError, createApiClient } from '@pokemongonexus/shared-api-client';
import type { PropsWithChildren } from 'react';
import {
  NativeSessionProvider,
  useNativeSession,
} from '../../../src/auth/NativeSessionContext';

const session = (suffix: string) => ({
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
  accessToken: `access-${suffix}`,
  refreshToken: `refresh-${suffix}`,
  accessTokenExpiry: '2026-08-23T22:00:00.000Z',
  refreshTokenExpiry: '2026-08-30T21:00:00.000Z',
});

const createApi = (patch: Record<string, jest.Mock> = {}) => ({
  confirmPasswordReset: jest.fn(),
  completeOAuthRegistration: jest.fn(),
  exchangeOAuth: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  refresh: jest.fn(),
  register: jest.fn(),
  requestPasswordReset: jest.fn(),
  startOAuth: jest.fn(),
  ...patch,
});

describe('NativeSessionProvider', () => {
  it('settles signed out when no refresh token is stored', async () => {
    const api = createApi();
    const persistence = {
      read: jest.fn().mockResolvedValue(null),
      store: jest.fn(),
      clear: jest.fn().mockResolvedValue(undefined),
    };
    const getDeviceId = jest.fn().mockResolvedValue('native-device');
    const wrapper = ({ children }: PropsWithChildren) => (
      <NativeSessionProvider
        api={api}
        getDeviceId={getDeviceId}
        persistence={persistence}
      >
        {children}
      </NativeSessionProvider>
    );
    const { result } = renderHook(() => useNativeSession(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signed-out'));
    expect(api.refresh).not.toHaveBeenCalled();
    expect(result.current.user).toBeNull();
  });

  it('restores and rotates a persisted session before exposing the user', async () => {
    const api = createApi({ refresh: jest.fn().mockResolvedValue(session('rotated')) });
    const persistence = {
      read: jest.fn().mockResolvedValue('refresh-stored'),
      store: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
    };
    const wrapper = ({ children }: PropsWithChildren) => (
      <NativeSessionProvider api={api} persistence={persistence}>
        {children}
      </NativeSessionProvider>
    );

    const { result } = renderHook(() => useNativeSession(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signed-in'));

    expect(api.refresh).toHaveBeenCalledWith('refresh-stored');
    expect(persistence.store).toHaveBeenCalledWith('refresh-rotated');
    expect(result.current.user?.username).toBe('misty');
    expect(result.current.getAccessToken()).toBe('access-rotated');
  });

  it('signs in with a stable device ID and clears both sides on logout', async () => {
    const api = createApi({
      login: jest.fn().mockResolvedValue(session('login')),
      logout: jest.fn().mockResolvedValue(undefined),
    });
    const persistence = {
      read: jest.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('refresh-login'),
      store: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
    };
    const getDeviceId = jest.fn().mockResolvedValue('native-device');
    const wrapper = ({ children }: PropsWithChildren) => (
      <NativeSessionProvider
        api={api}
        persistence={persistence}
        getDeviceId={getDeviceId}
      >
        {children}
      </NativeSessionProvider>
    );

    const { result } = renderHook(() => useNativeSession(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signed-out'));

    await act(async () => result.current.signIn(' misty ', 'password'));
    expect(api.login).toHaveBeenCalledWith({
      username: 'misty',
      password: 'password',
      device_id: 'native-device',
    });
    expect(result.current.status).toBe('signed-in');

    await act(async () => result.current.signOut());
    expect(api.logout).toHaveBeenCalledWith('refresh-login');
    expect(result.current.status).toBe('signed-out');
    expect(result.current.getAccessToken()).toBeNull();
  });

  it('preserves persisted credentials on a transient restoration failure', async () => {
    const api = createApi({
      refresh: jest.fn()
        .mockRejectedValueOnce(new Error('Network request failed'))
        .mockResolvedValueOnce(session('retry')),
    });
    const persistence = {
      read: jest.fn().mockResolvedValue('refresh-stored'),
      store: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
    };
    const wrapper = ({ children }: PropsWithChildren) => (
      <NativeSessionProvider api={api} persistence={persistence}>
        {children}
      </NativeSessionProvider>
    );

    const { result } = renderHook(() => useNativeSession(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('unavailable'));
    expect(persistence.clear).not.toHaveBeenCalled();

    await act(async () => result.current.retrySession());
    expect(result.current.status).toBe('signed-in');
    expect(result.current.getAccessToken()).toBe('access-retry');
  });

  it('can recover after a protected request encounters a temporary refresh outage', async () => {
    const api = createApi({
      refresh: jest.fn()
        .mockResolvedValueOnce(session('restored'))
        .mockRejectedValueOnce(new Error('Network request failed'))
        .mockResolvedValueOnce(session('recovered')),
    });
    const persistence = {
      read: jest.fn().mockResolvedValue('refresh-stored'),
      store: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
    };
    const wrapper = ({ children }: PropsWithChildren) => (
      <NativeSessionProvider api={api} persistence={persistence}>{children}</NativeSessionProvider>
    );
    const { result } = renderHook(() => useNativeSession(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signed-in'));
    const client = createApiClient({
      baseUrl: 'https://pokegonexus.com/api/users',
      authentication: { mode: 'bearer', tokens: {
        getAccessToken: () => result.current.getAccessToken(),
        refreshAccessToken: () => result.current.refreshAccessToken(),
        clearSession: () => result.current.clearSession(),
      } },
      fetch: jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: 'Expired' }),
      } as Response),
    });

    await act(async () => {
      await expect(client.get('/preferences')).rejects.toMatchObject({ status: 401 });
    });
    expect(result.current.status).toBe('unavailable');
    expect(persistence.clear).not.toHaveBeenCalled();
    await act(async () => result.current.retrySession());
    expect(result.current.status).toBe('signed-in');
    expect(result.current.getAccessToken()).toBe('access-recovered');
  });

  it('coalesces concurrent refresh requests into one token rotation', async () => {
    let resolveRefresh: (value: ReturnType<typeof session>) => void = () => undefined;
    const pendingRefresh = new Promise<ReturnType<typeof session>>((resolve) => {
      resolveRefresh = resolve;
    });
    const api = createApi({ refresh: jest.fn().mockReturnValue(pendingRefresh) });
    const persistence = {
      read: jest.fn().mockResolvedValue('refresh-stored'),
      store: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
    };
    const wrapper = ({ children }: PropsWithChildren) => (
      <NativeSessionProvider api={api} persistence={persistence}>{children}</NativeSessionProvider>
    );
    const { result } = renderHook(() => useNativeSession(), { wrapper });
    await waitFor(() => expect(api.refresh).toHaveBeenCalledTimes(1));
    let first: Promise<string | null> | undefined;
    let second: Promise<string | null> | undefined;
    act(() => {
      first = result.current.refreshAccessToken();
      second = result.current.refreshAccessToken();
    });
    expect(api.refresh).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveRefresh(session('coalesced'));
      await Promise.all([first, second]);
    });
    expect(result.current.status).toBe('signed-in');
    expect(result.current.getAccessToken()).toBe('access-coalesced');
  });

  it('creates an account with the stable device ID and applies its mobile session', async () => {
    const api = createApi({ register: jest.fn().mockResolvedValue(session('register')) });
    const persistence = {
      read: jest.fn().mockResolvedValue(null),
      store: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
    };
    const wrapper = ({ children }: PropsWithChildren) => (
      <NativeSessionProvider
        api={api}
        persistence={persistence}
        getDeviceId={jest.fn().mockResolvedValue('native-device')}
      >
        {children}
      </NativeSessionProvider>
    );
    const { result } = renderHook(() => useNativeSession(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signed-out'));

    await act(async () => result.current.register({
      email: 'misty@example.com',
      password: 'Strong_password_42',
      username: 'misty',
    }));

    expect(api.register).toHaveBeenCalledWith(expect.objectContaining({
      device_id: 'native-device',
      username: 'misty',
    }));
    expect(result.current.status).toBe('signed-in');
    expect(persistence.store).toHaveBeenCalledWith('refresh-register');
  });

  it('clears an invalid persisted refresh token', async () => {
    const api = createApi({
      refresh: jest.fn().mockRejectedValue(
        new ApiClientError(401, 'Invalid token', { message: 'Invalid token' }),
      ),
    });
    const persistence = {
      read: jest.fn().mockResolvedValue('refresh-invalid'),
      store: jest.fn(),
      clear: jest.fn().mockResolvedValue(undefined),
    };
    const wrapper = ({ children }: PropsWithChildren) => (
      <NativeSessionProvider api={api} persistence={persistence}>
        {children}
      </NativeSessionProvider>
    );

    const { result } = renderHook(() => useNativeSession(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signed-out'));
    expect(persistence.clear).toHaveBeenCalledTimes(1);
  });

  it('cleans up a server session when secure persistence fails during sign-in', async () => {
    const api = createApi({
      login: jest.fn().mockResolvedValue(session('unpersisted')),
      logout: jest.fn().mockResolvedValue(undefined),
    });
    const persistence = {
      read: jest.fn().mockResolvedValue(null),
      store: jest.fn().mockRejectedValue(new Error('SecureStore unavailable')),
      clear: jest.fn().mockResolvedValue(undefined),
    };
    const wrapper = ({ children }: PropsWithChildren) => (
      <NativeSessionProvider
        api={api}
        getDeviceId={jest.fn().mockResolvedValue('native-device')}
        persistence={persistence}
      >
        {children}
      </NativeSessionProvider>
    );
    const { result } = renderHook(() => useNativeSession(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signed-out'));
    let caught: unknown;
    await act(async () => {
      try {
        await result.current.signIn('misty', 'password');
      } catch (error) {
        caught = error;
      }
    });
    expect(caught).toEqual(expect.objectContaining({ message: 'SecureStore unavailable' }));
    expect(api.login).toHaveBeenCalledTimes(1);
    expect(api.logout).toHaveBeenCalledWith('refresh-unpersisted');
    expect(result.current.status).toBe('signed-out');
    expect(result.current.user).toBeNull();
  });

  it('stays locally signed out when the server logout request fails', async () => {
    const api = createApi({ logout: jest.fn().mockRejectedValue(new Error('offline')) });
    const persistence = {
      read: jest.fn().mockResolvedValue('refresh-stored'),
      store: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
    };
    const wrapper = ({ children }: PropsWithChildren) => (
      <NativeSessionProvider api={api} persistence={persistence}>{children}</NativeSessionProvider>
    );
    const { result } = renderHook(() => useNativeSession(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('unavailable'));
    await act(async () => result.current.signOut());
    expect(result.current.status).toBe('signed-out');
    expect(result.current.getAccessToken()).toBeNull();
    expect(persistence.clear).toHaveBeenCalled();
  });

  it('clears the in-memory session even when secure storage cannot be cleared', async () => {
    const api = createApi({
      refresh: jest.fn().mockResolvedValue(session('restored')),
      logout: jest.fn().mockResolvedValue(undefined),
    });
    const persistence = {
      read: jest.fn().mockResolvedValue('refresh-stored'),
      store: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockRejectedValue(new Error('SecureStore unavailable')),
    };
    const wrapper = ({ children }: PropsWithChildren) => (
      <NativeSessionProvider api={api} persistence={persistence}>{children}</NativeSessionProvider>
    );
    const { result } = renderHook(() => useNativeSession(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signed-in'));
    await act(async () => result.current.signOut());
    expect(result.current.status).toBe('signed-out');
    expect(result.current.user).toBeNull();
    expect(result.current.getAccessToken()).toBeNull();
    expect(api.logout).toHaveBeenCalledWith('refresh-stored');
  });

  it('cleans up an OAuth registration session when secure persistence fails', async () => {
    const api = createApi({
      completeOAuthRegistration: jest.fn().mockResolvedValue({
        provider: 'google',
        status: 'authenticated',
        session: session('oauth-unpersisted'),
      }),
      logout: jest.fn().mockResolvedValue(undefined),
    });
    const persistence = {
      read: jest.fn().mockResolvedValue(null),
      store: jest.fn().mockRejectedValue(new Error('SecureStore unavailable')),
      clear: jest.fn().mockResolvedValue(undefined),
    };
    const getDeviceId = jest.fn().mockResolvedValue('native-device');
    const wrapper = ({ children }: PropsWithChildren) => (
      <NativeSessionProvider api={api} getDeviceId={getDeviceId} persistence={persistence}>
        {children}
      </NativeSessionProvider>
    );
    const { result } = renderHook(() => useNativeSession(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signed-out'));
    let caught: unknown;
    await act(async () => {
      try {
        await result.current.completeOAuthRegistration('oauth-code', { username: 'misty' });
      } catch (error) {
        caught = error;
      }
    });
    expect(caught).toEqual(expect.objectContaining({ message: 'SecureStore unavailable' }));
    expect(api.logout).toHaveBeenCalledWith('refresh-oauth-unpersisted');
    expect(result.current.status).toBe('signed-out');
  });

  it('applies a validated account profile response without replacing session tokens', async () => {
    const api = createApi({
      refresh: jest.fn().mockResolvedValue(session('restored')),
    });
    const persistence = {
      read: jest.fn().mockResolvedValue('refresh-stored'),
      store: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
    };
    const wrapper = ({ children }: PropsWithChildren) => (
      <NativeSessionProvider api={api} persistence={persistence}>
        {children}
      </NativeSessionProvider>
    );
    const { result } = renderHook(() => useNativeSession(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe('signed-in'));

    act(() => result.current.replaceSessionUser({
      ...session('restored').user,
      pokemonGoName: 'UpdatedGoName',
    }));

    expect(result.current.user?.pokemonGoName).toBe('UpdatedGoName');
    expect(result.current.getAccessToken()).toBe('access-restored');
    expect(api.refresh).toHaveBeenCalledTimes(1);
  });
});
