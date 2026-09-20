import { useCallback, useEffect, useRef } from 'react';
import { feedback } from '@/components/feedback';

import { useAuth } from '@/contexts/AuthContext';
import { useLocationStore } from '@/features/location/store/useLocationStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { createScopedLogger } from '@/utils/logger';
import {
  getStoredLocation,
  removeStorageKey,
  setStoredLocation,
  STORAGE_KEYS,
} from '@/utils/storage';

const log = createScopedLogger('useInitLocation');

const LOCATION_REFRESH_INTERVAL_MS = 60 * 60 * 1_000;
const LOCATION_PERMISSION_NOTICE_KEY = 'pokegonexus-location-permission-notice';
const LOCATION_PERMISSION_TOAST_ID = 'location-permission-unavailable';

export const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  maximumAge: 5 * 60 * 1_000,
  timeout: 15_000,
};

type AvailableCoordinates = {
  latitude: number;
  longitude: number;
};

const toAvailableCoordinates = (
  value:
    | {
        latitude?: unknown;
        longitude?: unknown;
      }
    | null
    | undefined,
): AvailableCoordinates | null => {
  const latitude = Number(value?.latitude);
  const longitude = Number(value?.longitude);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return { latitude, longitude };
};

const hasShownPermissionNotice = (): boolean => {
  try {
    return (
      window.sessionStorage.getItem(LOCATION_PERMISSION_NOTICE_KEY) === 'true'
    );
  } catch {
    return false;
  }
};

const rememberPermissionNotice = (): void => {
  try {
    window.sessionStorage.setItem(LOCATION_PERMISSION_NOTICE_KEY, 'true');
  } catch {
    // Toast IDs still prevent duplicates while the current app is mounted.
  }
};

/** Bootstraps device geolocation once and refreshes it hourly while enabled. */
export function useInitLocation(enabled = true) {
  const { isLoading: authLoading, updateUserDetails } = useAuth();
  const user = useAuthStore((state) => state.user);
  const setLocation = useLocationStore((state) => state.setLocation);
  const setStatus = useLocationStore((state) => state.setStatus);

  const userRef = useRef(user);
  const updateUserDetailsRef = useRef(updateUserDetails);
  userRef.current = user;
  updateUserDetailsRef.current = updateUserDetails;

  const storeCoordinates = useCallback(
    (coordinates: AvailableCoordinates) => {
      setLocation(coordinates);
      setStatus('available');
      setStoredLocation(coordinates);
      log.debug('Location acquired and stored.', coordinates);
    },
    [setLocation, setStatus],
  );

  const applySavedCoordinates = useCallback(
    (
      currentUser: typeof user,
      reason: 'manual' | 'permission' | 'temporary',
    ): boolean => {
      const fallback =
        toAvailableCoordinates(currentUser?.coordinates) ??
        toAvailableCoordinates(getStoredLocation());

      if (!fallback) return false;

      storeCoordinates(fallback);
      log.debug(`Using saved coordinates after ${reason} location handling.`);
      return true;
    },
    [storeCoordinates],
  );

  useEffect(() => {
    if (!enabled || authLoading) return;

    let active = true;
    let refreshInterval: ReturnType<typeof setInterval> | null = null;

    const markUnavailable = () => {
      setLocation(null);
      setStatus('unavailable');
    };

    const showPermissionNotice = () => {
      if (hasShownPermissionNotice()) return;

      feedback.warning(
        'Location access is blocked on this device. Allow it in your browser settings or choose a saved location.',
        { id: LOCATION_PERMISSION_TOAST_ID },
      );
      rememberPermissionNotice();
    };

    const handleLocationFailure = (
      currentUser: typeof user,
      error?: GeolocationPositionError,
    ) => {
      if (!active) return;

      const permissionDenied = error?.code === 1;
      const reason = permissionDenied ? 'permission' : 'temporary';
      const hasFallback = applySavedCoordinates(currentUser, reason);

      if (permissionDenied) {
        log.warn('Browser location permission is blocked.', {
          code: error.code,
          message: error.message,
        });
        if (!hasFallback) showPermissionNotice();
      } else {
        log.warn('Current device location could not be determined.', {
          code: error?.code,
          message: error?.message,
        });
      }

      if (!hasFallback) markUnavailable();
    };

    const fetchLocation = () => {
      const currentUser = userRef.current;

      if (!currentUser) {
        markUnavailable();
        removeStorageKey(STORAGE_KEYS.location);
        return;
      }

      if (!currentUser.allowLocation) {
        if (!applySavedCoordinates(currentUser, 'manual')) {
          markUnavailable();
          removeStorageKey(STORAGE_KEYS.location);
        }
        return;
      }

      if (
        !navigator.geolocation ||
        typeof navigator.geolocation.getCurrentPosition !== 'function'
      ) {
        const hasFallback = applySavedCoordinates(currentUser, 'permission');
        log.warn('Geolocation is not supported by this browser.');
        if (!hasFallback) {
          markUnavailable();
          showPermissionNotice();
        }
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!active) return;

          const coordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          storeCoordinates(coordinates);

          const latestUser = userRef.current;
          if (!latestUser || latestUser.user_id !== currentUser.user_id) return;

          const previousCoordinates = toAvailableCoordinates(
            latestUser.coordinates,
          );
          const changed =
            !previousCoordinates ||
            previousCoordinates.latitude !== coordinates.latitude ||
            previousCoordinates.longitude !== coordinates.longitude;

          if (!changed) return;

          void updateUserDetailsRef
            .current(latestUser.user_id, { coordinates })
            .then((result) => {
              if (!result.success) {
                log.error(
                  'Failed to sync updated coordinates to the user account.',
                  result.error,
                );
              }
            })
            .catch((error: unknown) => {
              log.error(
                'Failed to sync updated coordinates to the user account.',
                error,
              );
            });
        },
        (error) => handleLocationFailure(currentUser, error),
        GEOLOCATION_OPTIONS,
      );
    };

    fetchLocation();

    if (user?.allowLocation) {
      refreshInterval = setInterval(
        fetchLocation,
        LOCATION_REFRESH_INTERVAL_MS,
      );
    }

    return () => {
      active = false;
      if (refreshInterval) clearInterval(refreshInterval);
    };
  }, [
    authLoading,
    enabled,
    setLocation,
    setStatus,
    applySavedCoordinates,
    storeCoordinates,
    user?.allowLocation,
    user?.user_id,
  ]);
}
