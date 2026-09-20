import * as SecureStore from 'expo-secure-store';
import type { NativeFriendsView } from '../../screens/NativeFriendsScreen';

export type NativeFriendsSession = {
  activeView: NativeFriendsView;
  executedQuery: string;
  ownerKey: string;
  query: string;
  savedAt: number;
};

const sessions = new Map<string, NativeFriendsSession>();
const FRIENDS_SESSION_KEY_PREFIX = 'pokemongonexus.mobile.friends-session.v1.';

const storageKey = (ownerKey: string): string => (
  `${FRIENDS_SESSION_KEY_PREFIX}${ownerKey.trim()}`
);

const isFriendsView = (value: unknown): value is NativeFriendsView => (
  value === 'friends' || value === 'requests' || value === 'find' || value === 'blocked'
);

const isNativeFriendsSession = (
  value: unknown,
  ownerKey: string,
): value is NativeFriendsSession => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.ownerKey === ownerKey
    && isFriendsView(candidate.activeView)
    && typeof candidate.query === 'string'
    && typeof candidate.executedQuery === 'string'
    && typeof candidate.savedAt === 'number';
};

const persistSession = (session: NativeFriendsSession): void => {
  void SecureStore.setItemAsync(
    storageKey(session.ownerKey),
    JSON.stringify(session),
  ).catch(() => {
    // Navigation restoration is a convenience. Storage failures must not
    // prevent the trainer network itself from loading.
  });
};

export const readNativeFriendsSession = (
  ownerKey: string,
): NativeFriendsSession | null => sessions.get(ownerKey) ?? null;

export const writeNativeFriendsSession = (
  session: Omit<NativeFriendsSession, 'savedAt'>,
): NativeFriendsSession => {
  const complete = { ...session, savedAt: Date.now() };
  sessions.set(session.ownerKey, complete);
  persistSession(complete);
  return complete;
};

export const patchNativeFriendsSession = (
  ownerKey: string,
  patch: Partial<Omit<NativeFriendsSession, 'ownerKey' | 'savedAt'>>,
): NativeFriendsSession | null => {
  const current = sessions.get(ownerKey);
  if (!current) return null;
  return writeNativeFriendsSession({ ...current, ...patch, ownerKey });
};

export const hydrateNativeFriendsSession = async (
  ownerKey: string,
): Promise<NativeFriendsSession | null> => {
  const inMemory = readNativeFriendsSession(ownerKey);
  if (inMemory) return inMemory;
  try {
    const stored = await SecureStore.getItemAsync(storageKey(ownerKey));
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    if (!isNativeFriendsSession(parsed, ownerKey)) {
      await SecureStore.deleteItemAsync(storageKey(ownerKey));
      return null;
    }
    sessions.set(ownerKey, parsed);
    return parsed;
  } catch {
    return null;
  }
};

export const clearNativeFriendsSession = (ownerKey?: string): void => {
  if (ownerKey) {
    sessions.delete(ownerKey);
    void SecureStore.deleteItemAsync(storageKey(ownerKey)).catch(() => {});
    return;
  }
  sessions.clear();
};
