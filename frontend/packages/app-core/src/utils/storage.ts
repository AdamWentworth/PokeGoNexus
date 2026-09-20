import type { User } from '@/types/auth';
import type { Coordinates } from '@/types/location';
import { createScopedLogger } from '@/utils/logger';

const log = createScopedLogger('storage');

export const STORAGE_KEYS = {
  user: 'user',
  location: 'location',
  deviceId: 'deviceID',
  isLightMode: 'isLightMode',
  lastActivityTime: 'lastActivityTime',
  ownershipTimestamp: 'ownershipTimestamp',
  ownershipCheckpoint: 'ownershipCheckpoint',
  listsTimestamp: 'listsTimestamp',
  pokemonOwnership: 'pokemonOwnership',
  variantsTimestamp: 'variantsTimestamp',
  variantsPayloadHash: 'variantsPayloadHash',
  pokemonCatalogVersion: 'pokemonCatalogVersion',
  pokemonMovesVersion: 'pokemonMovesVersion',
  pokemonRaidDataVersion: 'pokemonRaidDataVersion',
  raidCalibrationObservations: 'raidCalibrationObservations',
  pvpTeams: 'pvpTeams',
  tagsTimestamp: 'tagsTimestamp',
  pokemonEtag: 'pokemonEtag',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toFiniteNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch (error) {
    log.warn('localStorage unavailable', error);
    return null;
  }
};

export const getStorageString = (key: StorageKey): string | null => {
  const storage = getStorage();
  if (!storage) return null;

  try {
    return storage.getItem(key);
  } catch (error) {
    log.warn(`Failed to read key "${key}"`, error);
    return null;
  }
};

export const setStorageString = (key: StorageKey, value: string): void => {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.setItem(key, value);
  } catch (error) {
    log.warn(`Failed to write key "${key}"`, error);
  }
};

export const removeStorageItem = (key: string): void => {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.removeItem(key);
  } catch (error) {
    log.warn(`Failed to remove key "${key}"`, error);
  }
};

export const removeStorageKey = (key: StorageKey): void => {
  removeStorageItem(key);
};

export const removeStorageKeys = (keys: StorageKey[]): void => {
  keys.forEach(removeStorageKey);
};

export const getStorageJson = <T>(key: StorageKey): T | null => {
  const raw = getStorageString(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    log.warn(`Invalid JSON for key "${key}"`, error);
    return null;
  }
};

export const setStorageJson = <T>(key: StorageKey, value: T): void => {
  setStorageString(key, JSON.stringify(value));
};

export const getStorageNumber = (
  key: StorageKey,
  fallback = 0,
): number => {
  const raw = getStorageString(key);
  if (!raw) return fallback;
  const value = toFiniteNumber(raw);
  return value ?? fallback;
};

export const setStorageNumber = (key: StorageKey, value: number): void => {
  setStorageString(key, String(value));
};

export const getStorageBoolean = (
  key: StorageKey,
  fallback = false,
): boolean => {
  const raw = getStorageString(key);
  if (raw == null) return fallback;

  if (raw === 'true') return true;
  if (raw === 'false') return false;

  const parsed = getStorageJson<unknown>(key);
  return typeof parsed === 'boolean' ? parsed : fallback;
};

export const setStorageBoolean = (key: StorageKey, value: boolean): void => {
  setStorageJson(key, value);
};

export const getStoredUserRecord = (): Record<string, unknown> | null => {
  const parsed = getStorageJson<unknown>(STORAGE_KEYS.user);
  return isRecord(parsed) ? parsed : null;
};

export const getStoredUser = (): User | null => {
  const parsed = getStoredUserRecord();
  if (!parsed) return null;

  const userId = parsed.user_id;
  const username = parsed.username;
  const accessTokenExpiry = parsed.accessTokenExpiry;
  const refreshTokenExpiry = parsed.refreshTokenExpiry;

  if (
    typeof userId !== 'string' ||
    typeof username !== 'string' ||
    typeof accessTokenExpiry !== 'string' ||
    typeof refreshTokenExpiry !== 'string'
  ) {
    return null;
  }

  return parsed as unknown as User;
};

export const setStoredUser = (user: User): void => {
  setStorageJson(STORAGE_KEYS.user, user);
};

export const getStoredUsername = (): string | null => {
  const parsed = getStoredUserRecord();
  if (!parsed) return null;
  return typeof parsed.username === 'string' && parsed.username.length > 0
    ? parsed.username
    : null;
};

export const hasActiveStoredSession = (): boolean => {
  const parsed = getStoredUserRecord();
  if (!parsed || typeof parsed.refreshTokenExpiry !== 'string') return false;

  const refreshExpiry = new Date(parsed.refreshTokenExpiry).getTime();
  return Number.isFinite(refreshExpiry) && refreshExpiry > Date.now();
};

export const getStoredLocation = (): Coordinates | null => {
  const parsed = getStorageJson<unknown>(STORAGE_KEYS.location);
  if (!isRecord(parsed)) return null;

  const latitude = toFiniteNumber(parsed.latitude);
  const longitude = toFiniteNumber(parsed.longitude);
  if (latitude == null || longitude == null) return null;

  return { latitude, longitude };
};

export const setStoredLocation = (coords: Coordinates): void => {
  setStorageJson(STORAGE_KEYS.location, coords);
};
