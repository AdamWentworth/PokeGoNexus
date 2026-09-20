import type { SearchQueryParams, SearchResultRow } from '@/services/searchService';
import type { SearchOwnershipMode } from './utils/ownershipMode';
import type {
  Coordinates,
  IvFilters,
  SelectedMoves,
} from './utils/buildPokemonSearchQuery';
import type { SearchMode } from './SearchModeToggle';

export type SearchView = 'list' | 'map';

export type PokemonSearchDraft = {
  pokemon: string;
  isShiny: boolean;
  isShadow: boolean;
  costume: string | null;
  selectedForm: string;
  selectedMoves: SelectedMoves;
  selectedGender: string | null;
  selectedBackgroundId: number | null;
  dynamax: boolean;
  gigantamax: boolean;
  city: string;
  useCurrentLocation: boolean;
  ownershipMode: SearchOwnershipMode;
  coordinates: Coordinates;
  range: number;
  resultsLimit: number;
  ivs: IvFilters;
  isHundo: boolean;
  onlyMatchingTrades: boolean;
  prefLucky: boolean;
  alreadyRegistered: boolean;
  tradeInWantedList: boolean;
  friendshipLevel: number;
};

export type PokemonSearchSession = {
  version: 1;
  ownerKey: string;
  queryParams: SearchQueryParams;
  draft: PokemonSearchDraft;
  rawResults: SearchResultRow[];
  boundaryWKT: string | null;
  ownershipMode: SearchOwnershipMode;
  searchMode: SearchMode;
  view: SearchView;
  scrollY: number;
  savedAt: number;
};

const CACHE_VERSION = 1 as const;
const STORAGE_PREFIX = 'pokegonexus.search-session.v1';
const memoryCache = new Map<string, PokemonSearchSession>();

const storageKey = (ownerKey: string): string =>
  `${STORAGE_PREFIX}:${encodeURIComponent(ownerKey)}`;

const canUseSessionStorage = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return typeof window.sessionStorage !== 'undefined';
  } catch {
    return false;
  }
};

const isSearchSession = (
  value: unknown,
  ownerKey: string,
): value is PokemonSearchSession => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<PokemonSearchSession>;
  return (
    candidate.version === CACHE_VERSION &&
    candidate.ownerKey === ownerKey &&
    Array.isArray(candidate.rawResults) &&
    Boolean(candidate.draft) &&
    typeof candidate.draft === 'object' &&
    Boolean(candidate.queryParams) &&
    typeof candidate.queryParams === 'object' &&
    (candidate.searchMode === 'pokemon' || candidate.searchMode === 'trainer') &&
    (candidate.view === 'list' || candidate.view === 'map') &&
    typeof candidate.scrollY === 'number'
  );
};

export const createDefaultPokemonSearchDraft = (): PokemonSearchDraft => ({
  pokemon: '',
  isShiny: false,
  isShadow: false,
  costume: '',
  selectedForm: '',
  selectedMoves: {
    fastMove: null,
    chargedMove1: null,
    chargedMove2: null,
  },
  selectedGender: 'Any',
  selectedBackgroundId: null,
  dynamax: false,
  gigantamax: false,
  city: '',
  useCurrentLocation: false,
  ownershipMode: 'caught',
  coordinates: {
    latitude: null,
    longitude: null,
  },
  range: 5,
  resultsLimit: 5,
  ivs: {
    Attack: null,
    Defense: null,
    Stamina: null,
  },
  isHundo: false,
  onlyMatchingTrades: false,
  prefLucky: false,
  alreadyRegistered: false,
  tradeInWantedList: false,
  friendshipLevel: 0,
});

export const readSearchSession = (
  ownerKey: string,
): PokemonSearchSession | null => {
  const inMemory = memoryCache.get(ownerKey);
  if (inMemory) return inMemory;

  if (!canUseSessionStorage()) return null;
  try {
    const serialized = window.sessionStorage.getItem(storageKey(ownerKey));
    if (!serialized) return null;
    const parsed: unknown = JSON.parse(serialized);
    if (!isSearchSession(parsed, ownerKey)) {
      window.sessionStorage.removeItem(storageKey(ownerKey));
      return null;
    }
    memoryCache.set(ownerKey, parsed);
    return parsed;
  } catch {
    return null;
  }
};

export const writeSearchSession = (
  session: Omit<PokemonSearchSession, 'version' | 'savedAt'>,
): PokemonSearchSession => {
  const completeSession: PokemonSearchSession = {
    ...session,
    version: CACHE_VERSION,
    savedAt: Date.now(),
  };
  memoryCache.set(session.ownerKey, completeSession);

  if (canUseSessionStorage()) {
    try {
      window.sessionStorage.setItem(
        storageKey(session.ownerKey),
        JSON.stringify(completeSession),
      );
    } catch {
      // The in-memory copy still preserves route-to-route navigation if the
      // browser denies storage or the result set exceeds its quota.
    }
  }
  return completeSession;
};

export const patchSearchSession = (
  ownerKey: string,
  patch: Partial<
    Pick<PokemonSearchSession, 'searchMode' | 'view' | 'scrollY'>
  >,
): PokemonSearchSession | null => {
  const current = readSearchSession(ownerKey);
  if (!current) return null;
  return writeSearchSession({
    ...current,
    ...patch,
    ownerKey,
  });
};

export const clearSearchSession = (ownerKey?: string): void => {
  if (ownerKey) {
    memoryCache.delete(ownerKey);
    if (canUseSessionStorage()) {
      try {
        window.sessionStorage.removeItem(storageKey(ownerKey));
      } catch {
        // Nothing else to clear when storage is unavailable.
      }
    }
    return;
  }

  memoryCache.clear();
  if (!canUseSessionStorage()) return;
  try {
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(`${STORAGE_PREFIX}:`)) {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch {
    // Nothing else to clear when storage is unavailable.
  }
};
