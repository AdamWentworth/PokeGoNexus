import {
  PermissionsAndroid,
  Platform,
  TurboModuleRegistry,
  type TurboModule,
} from 'react-native';
import type { Coordinates } from '@pokemongonexus/shared-contracts/location';

type NativeLocationTurboModule = TurboModule & {
  getCurrentPosition: () => Promise<unknown>;
  requestPermissions: () => Promise<void>;
  onUpdate: (listener: (position: unknown) => void) => { remove: () => void };
  start: () => void;
  stop: () => void;
};

const DEVICE_LOCATION_TIMEOUT_MS = 15_000;
const MAX_LOCATION_AGE_MS = 60_000;
let currentRequest: Promise<Coordinates> | null = null;

const readRecentCoordinates = (position: unknown): Coordinates | null => {
  if (!position || typeof position !== 'object') return null;
  const { coords, timestamp } = position as { coords?: Partial<Coordinates>; timestamp?: number };
  const { latitude, longitude } = coords ?? {};
  if (
    typeof latitude !== 'number' || !Number.isFinite(latitude) || Math.abs(latitude) > 90
    || typeof longitude !== 'number' || !Number.isFinite(longitude) || Math.abs(longitude) > 180
    || typeof timestamp !== 'number' || !Number.isFinite(timestamp)
  ) return null;
  // The installed MapLibre iOS module emits epoch seconds; Android emits milliseconds.
  const age = Date.now() - timestamp * (Platform.OS === 'ios' ? 1_000 : 1);
  return age >= 0 && age <= MAX_LOCATION_AGE_MS ? { latitude, longitude } : null;
};

const requestNativeCurrentCoordinates = async (): Promise<Coordinates> => {
  if (Platform.OS === 'web') throw new Error('Device location is available in the installed app.');
  if (Platform.OS === 'android') {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    ]);
    const allowed = result[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED
      || result[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;
    if (!allowed) throw new Error('Location permission was not granted. You can type a place or choose it on the map.');
  }
  // Avoid re-evaluating MapLibre's generated map views, which Fast Refresh can
  // attempt to register a second time. This helper owns the app's GPS requests.
  const locationModule = TurboModuleRegistry.get<NativeLocationTurboModule>('MLRNLocationModule');
  if (!locationModule) throw new Error('Device location is unavailable. You can type a place or choose it on the map.');
  if (Platform.OS === 'ios') await locationModule.requestPermissions();

  return new Promise<Coordinates>((resolve, reject) => {
    let subscription: { remove: () => void } | undefined;
    let started = false;
    let settled = false;
    const finish = (coordinates: Coordinates | null, error?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        try {
          subscription?.remove();
        } finally {
          if (started) locationModule.stop();
        }
      } catch (cleanupError) {
        reject(error ?? cleanupError);
        return;
      }
      if (coordinates) resolve(coordinates);
      else reject(error);
    };
    // The bound starts after permission so it does not race the system dialog.
    const timeout = setTimeout(() => finish(null, new Error(
      'Finding your location timed out. You can try again or type a place.',
    )), DEVICE_LOCATION_TIMEOUT_MS);
    const acceptPosition = (position: unknown) => {
      const coordinates = readRecentCoordinates(position);
      if (coordinates) finish(coordinates);
    };
    try {
      subscription = locationModule.onUpdate(acceptPosition);
      if (settled) {
        subscription.remove();
        return;
      }
      started = true;
      locationModule.start();
      if (!settled) {
        // A missing/stale cached position still allows a fresh update to win.
        void locationModule.getCurrentPosition().then(acceptPosition, () => undefined);
      }
    } catch (error) {
      finish(null, error);
    }
  });
};

export const getNativeCurrentCoordinates = (): Promise<Coordinates> => {
  // Registration and profile callers share ownership until this one-shot ends.
  if (!currentRequest) {
    currentRequest = requestNativeCurrentCoordinates().finally(() => {
      currentRequest = null;
    });
  }
  return currentRequest;
};
