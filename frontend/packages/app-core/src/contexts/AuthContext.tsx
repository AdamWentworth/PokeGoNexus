// src/contexts/AuthContext.tsx
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
  useState,
} from 'react';
import { useNavigate } from 'react-router';
import {
  logoutUser,
  updateUserDetails as updateUserService,
  deleteAccount as deleteAccountService,
  deleteUserData,
  refreshTokenService,
  updateUserInSecondaryDB,
} from '../services/authService';
import { feedback } from '@/components/feedback';
import { useInstancesStore } from '@/features/instances/store/useInstancesStore';
import { useTagsStore } from '@/features/tags/store/useTagsStore';
import { useTradeStore } from '@/features/trades/store/useTradeStore';
import { useAuthStore } from '../stores/useAuthStore';
import { createScopedLogger } from '@/utils/logger';
import {
  getStoredUser,
  removeStorageKeys,
  setStoredUser,
  STORAGE_KEYS,
} from '@/utils/storage';
import { queryClient } from '@/services/queryClient';
import {
  clearInstancesStore,
  clearTradesStore,
  clearAllTagsDB,
  clearAcknowledgedPokemonUpdates,
  clearBatchedPokemonUpdates,
  POKEMON_TRADES_STORE,
  RELATED_INSTANCES_STORE,
} from '../db/indexedDB';
import type { User } from '../types/auth';
import type { ApiResponse } from '../types/common';
import type { AuthContextType } from '../types/authContext';

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const log = createScopedLogger('AuthContext');

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const setIsLoggedIn = useAuthStore.getState().setIsLoggedIn;

  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore.getState().setUser;
  const resetTags = useTagsStore((s) => s.resetTags);

  const [isLoading, setIsLoading] = useState(true);
  const userRef = useRef<User | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearSessionRef = useRef<(forced: boolean) => Promise<void>>(async () => {});
  const checkAndRefreshTokenRef = useRef<() => Promise<void>>(async () => {});
  const refreshTokenRef = useRef<() => Promise<void>>(async () => {});
  const scheduleTokenRefreshRef = useRef<(accessExp: Date) => void>(() => {});
  const startTokenExpirationCheckRef = useRef<() => void>(() => {});

  const navigate = useNavigate();
  const { resetInstances } = useInstancesStore();
  const resetTradeData = useTradeStore((s) => s.resetTradeData);

  function postAuthStateToSW(isLoggedIn: boolean) {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then((registration) => {
      registration.active?.postMessage({
        type: 'AUTH_STATE',
        payload: { isLoggedIn },
      });
    });
  }

  const clearSession = useCallback(async (forced: boolean) => {
    removeStorageKeys([
      STORAGE_KEYS.user,
      STORAGE_KEYS.pokemonOwnership,
      STORAGE_KEYS.ownershipTimestamp,
      STORAGE_KEYS.ownershipCheckpoint,
      STORAGE_KEYS.listsTimestamp,
    ]);

    setIsLoggedIn(false);
    setUser(null);
    queryClient.clear();
    userRef.current = null;

    resetInstances();
    resetTradeData();
    resetTags();

    postAuthStateToSW(false); 

    try {
      await clearInstancesStore();
      await clearAllTagsDB();
      await clearTradesStore(POKEMON_TRADES_STORE);
      await clearTradesStore(RELATED_INSTANCES_STORE);
      await clearBatchedPokemonUpdates();
      await clearAcknowledgedPokemonUpdates();
    } catch (err) {
      log.error('Error clearing IndexedDB data:', err);
    }

    navigate('/login', { replace: true });
    if (forced) {
      setTimeout(() => feedback.info('Your session has expired, please log in again.'), 1_000);
    }
  }, [navigate, resetInstances, resetTags, resetTradeData, setIsLoggedIn, setUser]);

  const startTokenExpirationCheck = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const current = userRef.current;
      if (!current) return;
      if (Date.now() >= new Date(current.refreshTokenExpiry).getTime()) {
        void clearSessionRef.current(true);
      }
    }, 60_000);
  }, []);

  const checkAndRefreshToken = useCallback(async () => {
    const current = userRef.current;
    if (!current) return;

    const now = Date.now();
    const accessExp = new Date(current.accessTokenExpiry).getTime();
    const refreshExp = new Date(current.refreshTokenExpiry).getTime();
    const msUntilRefresh = accessExp - now - 60_000;

    if (now >= refreshExp) {
      await clearSessionRef.current(true);
      return;
    }

    if (msUntilRefresh <= 0) {
      await refreshTokenRef.current();
    } else {
      scheduleTokenRefreshRef.current(new Date(accessExp));
    }
  }, []);

  const refreshToken = useCallback(async () => {
    try {
      const { accessTokenExpiry, refreshTokenExpiry } =
        await refreshTokenService();

      const newUser: User = {
        ...userRef.current!,
        accessTokenExpiry,
        refreshTokenExpiry,
      };

      setUser(newUser);
      userRef.current = newUser;
      setStoredUser(newUser);
      scheduleTokenRefreshRef.current(new Date(accessTokenExpiry));
    } catch {
      await clearSessionRef.current(true);
    }
  }, [setUser]);

  const scheduleTokenRefresh = useCallback((accessExp: Date) => {
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    const msUntilRefresh = accessExp.getTime() - Date.now() - 60_000;
    refreshTimeoutRef.current = setTimeout(
      () => void checkAndRefreshTokenRef.current(),
      Math.max(msUntilRefresh, 0),
    );
  }, []);

  clearSessionRef.current = clearSession;
  checkAndRefreshTokenRef.current = checkAndRefreshToken;
  refreshTokenRef.current = refreshToken;
  scheduleTokenRefreshRef.current = scheduleTokenRefresh;
  startTokenExpirationCheckRef.current = startTokenExpirationCheck;

  useEffect(() => {
    const userData = getStoredUser();
    if (userData) {
      useAuthStore.getState().setUser(userData);
      userRef.current = userData;
      useAuthStore.getState().setIsLoggedIn(true);

      const now = Date.now();
      const accessExp = new Date(userData.accessTokenExpiry).getTime();
      const refreshExp = new Date(userData.refreshTokenExpiry).getTime();
      const msUntilRefresh = accessExp - now - 60_000;

      postAuthStateToSW(true);

      if (refreshExp > now) {
        if (msUntilRefresh > 0) {
          refreshTimeoutRef.current = setTimeout(
            () => void checkAndRefreshTokenRef.current(),
            msUntilRefresh,
          );
        } else {
          void checkAndRefreshTokenRef.current();
        }
        startTokenExpirationCheckRef.current();
      } else {
        void clearSessionRef.current(true);
      }
    }

    setIsLoading(false);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    };
  }, []);

  const login = (userData: User) => {
    setStoredUser(userData);
    setIsLoggedIn(true);
    setUser(userData);
    userRef.current = userData;
    startTokenExpirationCheck();
    scheduleTokenRefresh(new Date(userData.accessTokenExpiry));
    postAuthStateToSW(true);
  };

  const logout = async () => {
    try {
      await logoutUser();
    } catch (err: unknown) {
      if ((err as { response?: { status: number } }).response?.status !== 404) {
        feedback.error('An error occurred during logout. Please try again.');
        return;
      }
    } finally {
      await clearSession(false);
    }
  };

  const updateUserDetails = async (
    userId: string,
    newDetails: Partial<User>,
  ): Promise<ApiResponse<User>> => {
    try {
      const response = (await updateUserService(
        userId,
        newDetails,
      )) as ApiResponse<{ data: Partial<User> }>;

      if (!response.success) {
        return { success: false, error: response.error };
      }

      /* Merge account fields from Auth API, but preserve existing token-expiry
         values unless the API explicitly returns non-empty replacements. */
      const prev = userRef.current!;
      const incoming = (response.data?.data || {}) as Partial<User>;
      const updated = {
        ...prev,
        ...incoming,
        accessTokenExpiry:
          incoming.accessTokenExpiry && String(incoming.accessTokenExpiry).trim() !== ''
            ? String(incoming.accessTokenExpiry)
            : prev.accessTokenExpiry,
        refreshTokenExpiry:
          incoming.refreshTokenExpiry && String(incoming.refreshTokenExpiry).trim() !== ''
            ? String(incoming.refreshTokenExpiry)
            : prev.refreshTokenExpiry,
      } as User;

      setUser(updated);
      userRef.current = updated;
      setStoredUser(updated);

      /* ------------------------------------------------------------------ */
      /* decide if we need to sync the secondary MySQL DB                   */
      const { username, pokemonGoName, coordinates } = updated;

      const needsSync =
        prev.username       !== username       ||
        prev.pokemonGoName  !== pokemonGoName  ||   // <‑‑ added
        prev.coordinates?.latitude  !== coordinates?.latitude ||
        prev.coordinates?.longitude !== coordinates?.longitude;

      if (needsSync) {
        const secondary = await updateUserInSecondaryDB(userId, {
          username,
          pokemonGoName,                           // <‑‑ added
          ...(coordinates && {
            latitude:  coordinates.latitude,
            longitude: coordinates.longitude,
          }),
        });

        if (!secondary.success) {
          feedback.error(
            'User updated in main DB, but failed to sync secondary DB.',
          );
        }
      }
      /* ------------------------------------------------------------------ */

      return { success: true, data: updated };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      feedback.error(`Failed to update account details: ${msg}`);
      return { success: false, error: msg };
    }
  };

  const deleteAccount = async (userId: string, currentPassword?: string) => {
    // Delete the SQL-backed catalog/profile graph first. The authentication
    // record remains available for a safe retry if that transactional delete
    // fails; auth is removed only after all application data is gone.
    await deleteUserData(userId);
    await deleteAccountService(userId, currentPassword);
    await clearSession(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn,
        isLoading,
        login,
        logout,
        updateUserDetails,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
