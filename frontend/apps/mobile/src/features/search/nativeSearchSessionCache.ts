import type { PokemonSearchQueryParams } from '@pokemongonexus/shared-contracts/search';
import * as SecureStore from 'expo-secure-store';
import type { NativePokemonSearchDraft } from './nativePokemonSearchDraft';
import type { NativeSearchHubView } from './NativeSearchHubHeader';

export type NativeSearchSession = {
  activeView: NativeSearchHubView;
  draft: NativePokemonSearchDraft;
  executedDraft: NativePokemonSearchDraft | null;
  ownerKey: string;
  pokemonDisplayMode: 'list' | 'map';
  pokemonQuery: PokemonSearchQueryParams | null;
  pokemonScrollOffset: number;
  savedAt: number;
  trainerQuery: string;
  trainerScrollOffset: number;
};

const sessions = new Map<string, NativeSearchSession>();
const pendingPersistence = new Map<string, NativeSearchSession>();
const persistenceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const SEARCH_SESSION_KEY_PREFIX = 'pokemongonexus.mobile.search-session.v1.';
const PERSISTENCE_DEBOUNCE_MS = 200;

const storageKey = (ownerKey: string): string => (
  `${SEARCH_SESSION_KEY_PREFIX}${ownerKey.trim()}`
);

const isNativeSearchSession = (
  value: unknown,
  ownerKey: string,
): value is NativeSearchSession => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.ownerKey === ownerKey
    && (candidate.activeView === 'pokemon' || candidate.activeView === 'trainers')
    && (candidate.pokemonDisplayMode === 'list' || candidate.pokemonDisplayMode === 'map')
    && typeof candidate.trainerQuery === 'string'
    && typeof candidate.pokemonScrollOffset === 'number'
    && Number.isFinite(candidate.pokemonScrollOffset)
    && typeof candidate.trainerScrollOffset === 'number'
    && Number.isFinite(candidate.trainerScrollOffset)
    && typeof candidate.savedAt === 'number'
    && Boolean(candidate.draft)
    && typeof candidate.draft === 'object';
};

const persistPendingSession = (ownerKey: string): void => {
  persistenceTimers.delete(ownerKey);
  const session = pendingPersistence.get(ownerKey);
  if (!session) return;
  pendingPersistence.delete(ownerKey);
  void SecureStore.setItemAsync(storageKey(ownerKey), JSON.stringify(session)).catch(() => {
    // Search restoration is a convenience. An unavailable device store must
    // never interrupt a search that is otherwise working.
  });
};

const persistSession = (session: NativeSearchSession): void => {
  pendingPersistence.set(session.ownerKey, session);
  const existingTimer = persistenceTimers.get(session.ownerKey);
  if (existingTimer) clearTimeout(existingTimer);
  persistenceTimers.set(session.ownerKey, setTimeout(
    () => persistPendingSession(session.ownerKey),
    PERSISTENCE_DEBOUNCE_MS,
  ));
};

export const readNativeSearchSession = (
  ownerKey: string,
): NativeSearchSession | null => sessions.get(ownerKey) ?? null;

export const writeNativeSearchSession = (
  session: Omit<NativeSearchSession, 'savedAt'>,
): NativeSearchSession => {
  const complete = { ...session, savedAt: Date.now() };
  sessions.set(session.ownerKey, complete);
  persistSession(complete);
  return complete;
};

export const hydrateNativeSearchSession = async (
  ownerKey: string,
): Promise<NativeSearchSession | null> => {
  const inMemory = readNativeSearchSession(ownerKey);
  if (inMemory) return inMemory;
  try {
    const stored = await SecureStore.getItemAsync(storageKey(ownerKey));
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    if (!isNativeSearchSession(parsed, ownerKey)) {
      await SecureStore.deleteItemAsync(storageKey(ownerKey));
      return null;
    }
    sessions.set(ownerKey, parsed);
    return parsed;
  } catch {
    return null;
  }
};

export const patchNativeSearchSession = (
  ownerKey: string,
  patch: Partial<Omit<NativeSearchSession, 'ownerKey' | 'savedAt'>>,
): NativeSearchSession | null => {
  const current = sessions.get(ownerKey);
  if (!current) return null;
  return writeNativeSearchSession({ ...current, ...patch, ownerKey });
};

export const clearNativeSearchSession = (ownerKey?: string): void => {
  if (ownerKey) {
    sessions.delete(ownerKey);
    pendingPersistence.delete(ownerKey);
    const timer = persistenceTimers.get(ownerKey);
    if (timer) clearTimeout(timer);
    persistenceTimers.delete(ownerKey);
    void SecureStore.deleteItemAsync(storageKey(ownerKey)).catch(() => {});
    return;
  }
  sessions.clear();
  pendingPersistence.clear();
  for (const timer of persistenceTimers.values()) clearTimeout(timer);
  persistenceTimers.clear();
};
