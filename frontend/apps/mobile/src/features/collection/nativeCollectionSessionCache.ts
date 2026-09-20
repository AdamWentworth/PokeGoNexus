import type { PokemonTagOrderKey } from '@pokemongonexus/shared-contracts/users';
import type { NativePokemonHubView } from './NativePokemonHubHeader';
import type {
  NativeCollectionSort,
  NativeCollectionSortDirection,
} from './collectionModel';

export type NativeCollectionSession = {
  activeView: NativePokemonHubView;
  query: string;
  scrollOffset: number;
  selectedTagKey: PokemonTagOrderKey | null;
  showEvolutionaryLine: boolean;
  sort: NativeCollectionSort;
  sortDirection: NativeCollectionSortDirection;
};

const sessions = new Map<string, NativeCollectionSession>();
const revisions = new Map<string, number>();
const listeners = new Map<string, Set<() => void>>();

export const createNativeCollectionSession = (
  initial?: Partial<NativeCollectionSession>,
): NativeCollectionSession => ({
  activeView: initial?.activeView ?? 'pokemon',
  query: initial?.query ?? '',
  scrollOffset: initial?.scrollOffset ?? 0,
  selectedTagKey: initial?.selectedTagKey ?? null,
  showEvolutionaryLine: initial?.showEvolutionaryLine ?? false,
  sort: initial?.sort ?? 'number',
  sortDirection: initial?.sortDirection ?? 'ascending',
});

export const readNativeCollectionSession = (
  ownerKey: string,
): NativeCollectionSession | null => sessions.get(ownerKey) ?? null;

export const patchNativeCollectionSession = (
  ownerKey: string,
  patch: Partial<NativeCollectionSession>,
): NativeCollectionSession => {
  const next = {
    ...(sessions.get(ownerKey) ?? createNativeCollectionSession()),
    ...patch,
  };
  sessions.set(ownerKey, next);
  return next;
};

/**
 * Prime collection state from outside the collection route (for example, a
 * Home summary card) and notify an already-mounted Expo route. Ordinary
 * in-screen patches stay silent to avoid rerendering the route while the user
 * scrolls or types.
 */
export const primeNativeCollectionSession = (
  ownerKey: string,
  patch: Partial<NativeCollectionSession>,
): NativeCollectionSession => {
  const next = patchNativeCollectionSession(ownerKey, patch);
  revisions.set(ownerKey, (revisions.get(ownerKey) ?? 0) + 1);
  listeners.get(ownerKey)?.forEach((listener) => listener());
  return next;
};

export const readNativeCollectionSessionRevision = (ownerKey: string): number => (
  revisions.get(ownerKey) ?? 0
);

export const subscribeNativeCollectionSession = (
  ownerKey: string,
  listener: () => void,
): (() => void) => {
  const ownerListeners = listeners.get(ownerKey) ?? new Set<() => void>();
  ownerListeners.add(listener);
  listeners.set(ownerKey, ownerListeners);
  return () => {
    ownerListeners.delete(listener);
    if (ownerListeners.size === 0) listeners.delete(ownerKey);
  };
};

export const clearNativeCollectionSession = (ownerKey: string): void => {
  sessions.delete(ownerKey);
  revisions.delete(ownerKey);
};
