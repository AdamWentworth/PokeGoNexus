import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { useAuthStore } from '@/stores/useAuthStore';
import type { User } from '@/types/auth';
import {
  refreshTokenService,
} from '@/services/authService';
import { feedback } from '@/components/feedback';
import {
  clearInstancesStore,
  clearAllTagsDB,
  clearTradesStore,
} from '@/db/indexedDB';

const navigateMock = vi.fn();
const resetInstancesMock = vi.fn();
const resetTradeDataMock = vi.fn();
const resetTagsMock = vi.fn();

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>(
    'react-router',
  );
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/services/authService', async () => {
  const actual = await vi.importActual<typeof import('@/services/authService')>(
    '@/services/authService',
  );
  return {
    ...actual,
    logoutUser: vi.fn(),
    updateUserDetails: vi.fn(),
    deleteAccount: vi.fn(),
    deleteUserData: vi.fn(),
    refreshTokenService: vi.fn(),
    updateUserInSecondaryDB: vi.fn(),
  };
});

vi.mock('@/features/instances/store/useInstancesStore', () => ({
  useInstancesStore: () => ({
    resetInstances: resetInstancesMock,
  }),
}));

vi.mock('@/features/tags/store/useTagsStore', () => ({
  useTagsStore: (
    selector?: (state: { resetTags: () => void }) => unknown,
  ) => {
    const state = { resetTags: resetTagsMock };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/features/trades/store/useTradeStore', () => ({
  useTradeStore: (
    selector?: (state: { resetTradeData: () => void }) => unknown,
  ) => {
    const state = { resetTradeData: resetTradeDataMock };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/db/indexedDB', async () => {
  const actual = await vi.importActual<typeof import('@/db/indexedDB')>(
    '@/db/indexedDB',
  );
  return {
    ...actual,
    clearInstancesStore: vi.fn().mockResolvedValue(undefined),
    clearAllTagsDB: vi.fn().mockResolvedValue(undefined),
    clearTradesStore: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('@/components/feedback', () => ({
  feedback: {
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

const AuthProbe = () => {
  const { isLoggedIn, isLoading, user } = useAuth();

  return (
    <div>
      <span data-testid="is-logged-in">{String(isLoggedIn)}</span>
      <span data-testid="is-loading">{String(isLoading)}</span>
      <span data-testid="access-expiry">{user?.accessTokenExpiry ?? ''}</span>
    </div>
  );
};

const buildUser = (overrides: Partial<User> = {}): User => ({
  user_id: 'u1',
  username: 'ash',
  email: 'ash@example.com',
  pokemonGoName: 'AshK',
  trainerCode: '1234-5678',
  location: 'Kanto',
  allowLocation: true,
  coordinates: { latitude: 1, longitude: 2 },
  accessTokenExpiry: new Date(Date.now() + 5 * 60_000).toISOString(),
  refreshTokenExpiry: new Date(Date.now() + 30 * 60_000).toISOString(),
  ...overrides,
});

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAuthStore.setState({ isLoggedIn: false, user: null });
  });

  it('clears session and navigates to login when refresh token is expired on boot', async () => {
    const expiredUser = buildUser({
      accessTokenExpiry: new Date(Date.now() - 120_000).toISOString(),
      refreshTokenExpiry: new Date(Date.now() - 60_000).toISOString(),
    });
    localStorage.setItem('user', JSON.stringify(expiredUser));

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true }),
    );
    await waitFor(
      () =>
        expect(feedback.info).toHaveBeenCalledWith(
          'Your session has expired, please log in again.',
        ),
      { timeout: 1500 },
    );

    expect(screen.getByTestId('is-logged-in')).toHaveTextContent('false');
    expect(localStorage.getItem('user')).toBeNull();
    expect(resetInstancesMock).toHaveBeenCalledTimes(1);
    expect(resetTradeDataMock).toHaveBeenCalledTimes(1);
    expect(resetTagsMock).toHaveBeenCalledTimes(1);
    expect(vi.mocked(clearInstancesStore)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(clearAllTagsDB)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(clearTradesStore)).toHaveBeenCalledTimes(2);
  });

  it('refreshes token on boot when access token is expired but refresh token is valid', async () => {
    const staleAccessUser = buildUser({
      accessTokenExpiry: new Date(Date.now() - 5_000).toISOString(),
      refreshTokenExpiry: new Date(Date.now() + 20 * 60_000).toISOString(),
    });
    localStorage.setItem('user', JSON.stringify(staleAccessUser));

    const refreshedAccess = new Date(Date.now() + 10 * 60_000).toISOString();
    const refreshedRefresh = new Date(Date.now() + 60 * 60_000).toISOString();
    vi.mocked(refreshTokenService).mockResolvedValue({
      accessTokenExpiry: refreshedAccess,
      refreshTokenExpiry: refreshedRefresh,
      accessToken: 'new-token',
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(refreshTokenService).toHaveBeenCalledTimes(1));

    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    expect(storedUser.accessTokenExpiry).toBe(refreshedAccess);
    expect(storedUser.refreshTokenExpiry).toBe(refreshedRefresh);
    expect(navigateMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('is-logged-in')).toHaveTextContent('true');
    expect(screen.getByTestId('access-expiry')).toHaveTextContent(refreshedAccess);
  });
});
