import type {
  MobileOAuthCompleteRegistrationRequest,
  MobileOAuthIntent,
  MobileRegisterRequest,
  MobileSessionResponse,
  MobileSessionUser,
  OAuthProvider,
} from '@pokemongonexus/shared-contracts/auth';
import { ApiClientError } from '@pokemongonexus/shared-api-client';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getOrCreateDeviceId } from './deviceIdentity';
import { mobileSessionApi, type MobileSessionApi } from './mobileSessionApi';
import {
  clearRefreshToken,
  readRefreshToken,
  storeRefreshToken,
} from './sessionStorage';
import {
  authenticateWithNativeOAuth,
  type NativeOAuthAttemptResult,
} from '../features/auth/nativeOAuthSession';

export type NativeSessionStatus =
  | 'restoring'
  | 'signed-out'
  | 'signed-in'
  | 'unavailable';

type NativeSessionContextValue = {
  status: NativeSessionStatus;
  user: MobileSessionUser | null;
  signIn: (username: string, password: string) => Promise<void>;
  register: (request: Omit<MobileRegisterRequest, 'device_id'>) => Promise<void>;
  authenticateWithOAuth: (
    provider: OAuthProvider,
    intent: MobileOAuthIntent,
  ) => Promise<NativeOAuthAttemptResult | null>;
  completeOAuthRegistration: (
    code: string,
    request: Omit<MobileOAuthCompleteRegistrationRequest, 'code' | 'device_id'>,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<string | null>;
  replaceSessionUser: (user: MobileSessionUser) => void;
  retrySession: () => Promise<void>;
  clearSession: () => Promise<void>;
};

type SessionPersistence = {
  read: () => Promise<string | null>;
  store: (token: string) => Promise<void>;
  clear: () => Promise<void>;
};

type NativeSessionProviderProps = PropsWithChildren<{
  api?: MobileSessionApi;
  persistence?: SessionPersistence;
  getDeviceId?: () => Promise<string>;
}>;

const defaultPersistence: SessionPersistence = {
  read: readRefreshToken,
  store: storeRefreshToken,
  clear: clearRefreshToken,
};

const NativeSessionContext = createContext<NativeSessionContextValue | null>(null);

export const NativeSessionProvider = ({
  children,
  api = mobileSessionApi,
  persistence = defaultPersistence,
  getDeviceId = getOrCreateDeviceId,
}: NativeSessionProviderProps) => {
  const accessTokenRef = useRef<string | null>(null);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);
  const [status, setStatus] = useState<NativeSessionStatus>('restoring');
  const [user, setUser] = useState<MobileSessionUser | null>(null);

  const clearSession = useCallback(async () => {
    accessTokenRef.current = null;
    setUser(null);
    setStatus('signed-out');
    try {
      await persistence.clear();
    } catch {
      // In-memory credentials are cleared even if platform storage is unavailable.
    }
  }, [persistence]);

  const applySession = useCallback(async (session: MobileSessionResponse) => {
    await persistence.store(session.refreshToken);
    accessTokenRef.current = session.accessToken;
    setUser(session.user);
    setStatus('signed-in');
  }, [persistence]);

  const applyIssuedSession = useCallback(async (session: MobileSessionResponse) => {
    try {
      await applySession(session);
    } catch (error) {
      try {
        await api.logout(session.refreshToken);
      } catch {
        // Server expiry is the fallback if cleanup cannot be completed.
      }
      throw error;
    }
  }, [api, applySession]);

  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    refreshPromiseRef.current = (async () => {
      try {
        const refreshToken = await persistence.read();
        if (!refreshToken) {
          await clearSession();
          return null;
        }
        const session = await api.refresh(refreshToken);
        await applySession(session);
        return session.accessToken;
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 401) {
          await clearSession();
        } else {
          accessTokenRef.current = null;
          setUser(null);
          setStatus('unavailable');
        }
        return null;
      }
    })().finally(() => {
      refreshPromiseRef.current = null;
    });

    return refreshPromiseRef.current;
  }, [api, applySession, clearSession, persistence]);

  useEffect(() => {
    void refreshAccessToken();
  }, [refreshAccessToken]);

  const signIn = useCallback(async (username: string, password: string) => {
    const deviceId = await getDeviceId();
    const session = await api.login({
      username: username.trim(),
      password,
      device_id: deviceId,
    });
    await applyIssuedSession(session);
  }, [api, applyIssuedSession, getDeviceId]);

  const register = useCallback(async (request: Omit<MobileRegisterRequest, 'device_id'>) => {
    const deviceId = await getDeviceId();
    const nextSession = await api.register({ ...request, device_id: deviceId });
    await applyIssuedSession(nextSession);
  }, [api, applyIssuedSession, getDeviceId]);

  const authenticateWithOAuth = useCallback(async (
    provider: OAuthProvider,
    intent: MobileOAuthIntent,
  ) => {
    const deviceId = await getDeviceId();
    const result = await authenticateWithNativeOAuth({
      api,
      deviceId,
      intent,
      provider,
    });
    if (result?.status === 'authenticated') {
      if (!result.session) throw new Error('Provider sign-in returned an invalid mobile session.');
      await applyIssuedSession(result.session);
    }
    return result;
  }, [api, applyIssuedSession, getDeviceId]);

  const completeOAuthRegistration = useCallback(async (
    code: string,
    request: Omit<MobileOAuthCompleteRegistrationRequest, 'code' | 'device_id'>,
  ) => {
    const deviceId = await getDeviceId();
    const result = await api.completeOAuthRegistration({
      ...request,
      code,
      device_id: deviceId,
    });
    if (result.status !== 'authenticated' || !result.session) {
      throw new Error('Provider registration returned an invalid mobile session.');
    }
    await applyIssuedSession(result.session);
  }, [api, applyIssuedSession, getDeviceId]);

  const retrySession = useCallback(async () => {
    setStatus('restoring');
    await refreshAccessToken();
  }, [refreshAccessToken]);

  const signOut = useCallback(async () => {
    let refreshToken: string | null = null;
    try {
      refreshToken = await persistence.read();
    } catch {
      // Local sign-out still proceeds if platform storage cannot be read.
    }
    await clearSession();
    if (!refreshToken) return;
    try {
      await api.logout(refreshToken);
    } catch {
      // The local session is already cleared. Server expiry remains the fallback.
    }
  }, [api, clearSession, persistence]);

  const getAccessToken = useCallback(() => accessTokenRef.current, []);
  const replaceSessionUser = useCallback((nextUser: MobileSessionUser) => {
    setUser(nextUser);
  }, []);

  const value = useMemo<NativeSessionContextValue>(() => ({
    status,
    user,
    signIn,
    register,
    authenticateWithOAuth,
    completeOAuthRegistration,
    signOut,
    getAccessToken,
    refreshAccessToken,
    replaceSessionUser,
    retrySession,
    clearSession,
  }), [authenticateWithOAuth, clearSession, completeOAuthRegistration, getAccessToken, refreshAccessToken, register, replaceSessionUser, retrySession, signIn, signOut, status, user]);

  return (
    <NativeSessionContext.Provider value={value}>
      {children}
    </NativeSessionContext.Provider>
  );
};

export const useNativeSession = (): NativeSessionContextValue => {
  const value = useContext(NativeSessionContext);
  if (!value) throw new Error('useNativeSession must be used inside NativeSessionProvider');
  return value;
};

/** Components shared by live native routes and isolated visual/device fixtures
 * may render outside the session provider. Let those components preserve the
 * signed-out UI instead of throwing while live routes still consume the real
 * session when one is available. */
export const useOptionalNativeSession = (): NativeSessionContextValue | null => (
  useContext(NativeSessionContext)
);
