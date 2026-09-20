import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  GEOLOCATION_OPTIONS,
  useInitLocation,
} from '@/features/location/hooks/useInitLocation';

const mocks = vi.hoisted(() => ({
  authLoading: false,
  user: null as Record<string, any> | null,
  updateUserDetails: vi.fn(),
  setLocation: vi.fn(),
  setStatus: vi.fn(),
  getStoredLocation: vi.fn(),
  setStoredLocation: vi.fn(),
  removeStorageKey: vi.fn(),
  toastWarn: vi.fn(),
  logDebug: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    isLoading: mocks.authLoading,
    updateUserDetails: mocks.updateUserDetails,
  }),
}));

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: (
    selector: (state: { user: Record<string, any> | null }) => unknown,
  ) => selector({ user: mocks.user }),
}));

vi.mock('@/features/location/store/useLocationStore', () => ({
  useLocationStore: (
    selector: (state: {
      setLocation: typeof mocks.setLocation;
      setStatus: typeof mocks.setStatus;
    }) => unknown,
  ) =>
    selector({
      setLocation: mocks.setLocation,
      setStatus: mocks.setStatus,
    }),
}));

vi.mock('@/utils/storage', () => ({
  STORAGE_KEYS: { location: 'location' },
  getStoredLocation: mocks.getStoredLocation,
  setStoredLocation: mocks.setStoredLocation,
  removeStorageKey: mocks.removeStorageKey,
}));

vi.mock('@/components/feedback', () => ({
  feedback: {
    warning: mocks.toastWarn,
  },
}));

vi.mock('@/utils/logger', () => ({
  createScopedLogger: () => ({
    debug: mocks.logDebug,
    warn: mocks.logWarn,
    error: mocks.logError,
  }),
}));

const geolocationError = (
  code: 1 | 2 | 3,
  message: string,
): GeolocationPositionError =>
  ({
    code,
    message,
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  }) as GeolocationPositionError;

const setGeolocation = (
  getCurrentPosition: Geolocation['getCurrentPosition'],
) => {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition },
  });
};

describe('useInitLocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    mocks.authLoading = false;
    mocks.user = {
      user_id: 'user-adam',
      username: 'Adam',
      allowLocation: true,
      coordinates: null,
    };
    mocks.getStoredLocation.mockReturnValue(null);
    mocks.updateUserDetails.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores a successful browser location and syncs changed coordinates', async () => {
    const getCurrentPosition = vi.fn(
      (success: PositionCallback, _error?: PositionErrorCallback | null) => {
        success({
          coords: {
            latitude: 49.2827,
            longitude: -123.1207,
          },
        } as GeolocationPosition);
      },
    );
    setGeolocation(getCurrentPosition);

    renderHook(() => useInitLocation());

    expect(getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      GEOLOCATION_OPTIONS,
    );
    expect(mocks.setLocation).toHaveBeenCalledWith({
      latitude: 49.2827,
      longitude: -123.1207,
    });
    expect(mocks.setStatus).toHaveBeenCalledWith('available');
    expect(mocks.setStoredLocation).toHaveBeenCalledWith({
      latitude: 49.2827,
      longitude: -123.1207,
    });
    await waitFor(() =>
      expect(mocks.updateUserDetails).toHaveBeenCalledWith('user-adam', {
        coordinates: {
          latitude: 49.2827,
          longitude: -123.1207,
        },
      }),
    );
  });

  it('keeps saved coordinates when the device position is temporarily unavailable', () => {
    mocks.user!.coordinates = {
      latitude: 49.25,
      longitude: -123.1,
    };
    setGeolocation(
      vi.fn((_success, error) => {
        error?.(geolocationError(2, 'Position unavailable'));
      }),
    );

    renderHook(() => useInitLocation());

    expect(mocks.setLocation).toHaveBeenCalledWith({
      latitude: 49.25,
      longitude: -123.1,
    });
    expect(mocks.setStatus).toHaveBeenCalledWith('available');
    expect(mocks.removeStorageKey).not.toHaveBeenCalled();
    expect(mocks.toastWarn).not.toHaveBeenCalled();
  });

  it('warns once per tab when permission is blocked and no fallback exists', () => {
    setGeolocation(
      vi.fn((_success, error) => {
        error?.(geolocationError(1, 'Permission denied'));
      }),
    );

    const first = renderHook(() => useInitLocation());
    first.unmount();
    renderHook(() => useInitLocation());

    expect(mocks.toastWarn).toHaveBeenCalledTimes(1);
    expect(mocks.toastWarn).toHaveBeenCalledWith(
      expect.stringContaining('Location access is blocked'),
      expect.objectContaining({
        id: 'location-permission-unavailable',
      }),
    );
    expect(mocks.setStatus).toHaveBeenCalledWith('unavailable');
    expect(mocks.removeStorageKey).not.toHaveBeenCalled();
  });

  it('silently marks location unavailable after a temporary failure without fallback data', () => {
    setGeolocation(
      vi.fn((_success, error) => {
        error?.(geolocationError(3, 'Timed out'));
      }),
    );

    renderHook(() => useInitLocation());

    expect(mocks.setLocation).toHaveBeenCalledWith(null);
    expect(mocks.setStatus).toHaveBeenCalledWith('unavailable');
    expect(mocks.toastWarn).not.toHaveBeenCalled();
    expect(mocks.removeStorageKey).not.toHaveBeenCalled();
  });

  it('uses manual coordinates without requesting device geolocation', () => {
    mocks.user!.allowLocation = false;
    mocks.user!.coordinates = {
      latitude: 48.4284,
      longitude: -123.3656,
    };
    const getCurrentPosition = vi.fn();
    setGeolocation(getCurrentPosition);

    renderHook(() => useInitLocation());

    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(mocks.setLocation).toHaveBeenCalledWith({
      latitude: 48.4284,
      longitude: -123.3656,
    });
    expect(mocks.setStatus).toHaveBeenCalledWith('available');
  });

  it('restarts acquisition and its refresh timer after being re-enabled', () => {
    vi.useFakeTimers();
    const getCurrentPosition = vi.fn();
    setGeolocation(getCurrentPosition);

    const { rerender } = renderHook(
      ({ enabled }) => useInitLocation(enabled),
      {
        initialProps: { enabled: true },
      },
    );
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);

    rerender({ enabled: false });
    act(() => {
      vi.advanceTimersByTime(60 * 60 * 1_000);
    });
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);

    rerender({ enabled: true });
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
    act(() => {
      vi.advanceTimersByTime(60 * 60 * 1_000);
    });
    expect(getCurrentPosition).toHaveBeenCalledTimes(3);
  });
});
