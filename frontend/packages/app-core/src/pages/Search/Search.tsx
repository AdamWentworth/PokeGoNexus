import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';

import ProductPageHeader from '@/components/layout/ProductPageHeader';
import PageState from '@/components/layout/PageState';
import HorizontalPageSlider from '@/components/motion/HorizontalPageSlider';
import useHorizontalPageNavigation from '@/components/motion/useHorizontalPageNavigation';
import PokemonSearchBar from './PokemonSearchBar';
import TrainerSearchBar from './TrainerSearchBar';
import SearchModeToggle, { type SearchMode } from './SearchModeToggle';
import ListView from './views/ListView';
import MapView from './views/MapView';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useVariantsStore } from '@/features/variants/store/useVariantsStore';
import { useModal } from '../../contexts/ModalContext';
import { createScopedLogger } from '@/utils/logger';
import { normalizeOwnershipMode } from './utils/ownershipMode';
import { searchPokemon } from '@/services/searchService';
import { RenderProfiler } from '@/components/dev/RenderProfiler';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  createDefaultPokemonSearchDraft,
  patchSearchSession,
  readSearchSession,
  writeSearchSession,
  type PokemonSearchDraft,
  type SearchView,
} from './searchSessionCache';

import type { PokemonVariant } from '@/types/pokemonVariants';
import type {
  SearchQueryParams,
  SearchResultRow,
} from '@/services/searchService';
import './Search.css';

const SEARCH_MODES = ['pokemon', 'trainer'] as const;

const readRequestedSearchMode = (): SearchMode | null =>
  new URLSearchParams(window.location.search).get('mode') === 'trainer'
    ? 'trainer'
    : null;

type EnrichedSearchResult = SearchResultRow & {
  pokemonInfo: PokemonVariant;
  boundary?: string | null;
};

const coerceOwnershipModeInput = (
  value: unknown,
): Parameters<typeof normalizeOwnershipMode>[0] => {
  if (value === 'caught' || value === 'trade' || value === 'wanted') {
    return value;
  }
  return undefined;
};

const log = createScopedLogger('Search');

const hasLinkedMatch = (row: SearchResultRow): boolean =>
  ['wanted_list', 'trade_list'].some((listKey) => {
    const list = row[listKey];
    if (!list || typeof list !== 'object' || Array.isArray(list)) return false;
    return Object.values(list as Record<string, unknown>).some(
      (entry) =>
        Boolean(entry) &&
        typeof entry === 'object' &&
        !Array.isArray(entry) &&
        (entry as { match?: unknown }).match === true,
    );
  });

const searchResultDistance = (row: SearchResultRow): number =>
  typeof row.distance === 'number' && Number.isFinite(row.distance)
    ? row.distance
    : Number.POSITIVE_INFINITY;

const enrichAndSortSearchResults = (
  rows: SearchResultRow[],
  pokemonById: Map<number, PokemonVariant>,
  boundaryWKT?: string | null,
): EnrichedSearchResult[] => {
  const enrichedResults = rows.reduce<EnrichedSearchResult[]>((acc, item) => {
    const pokemonId = Number(item.pokemon_id);
    if (!Number.isFinite(pokemonId)) return acc;
    const pokemonInfo = pokemonById.get(pokemonId);
    if (!pokemonInfo) return acc;
    acc.push({
      ...item,
      pokemonInfo,
      boundary: boundaryWKT,
    });
    return acc;
  }, []);

  return enrichedResults.sort(
    (a, b) =>
      Number(hasLinkedMatch(b)) - Number(hasLinkedMatch(a)) ||
      searchResultDistance(a) - searchResultDistance(b),
  );
};

const Search: React.FC = () => {
  const userId = useAuthStore((state) => state.user?.user_id);
  const cacheOwnerKey = userId ?? 'anonymous';
  const [initialSession, setInitialSession] = useState(() =>
    readSearchSession(cacheOwnerKey),
  );
  const [searchMode, setSearchMode] = useState<SearchMode>(
    readRequestedSearchMode() ?? initialSession?.searchMode ?? 'pokemon',
  );
  const [view, setView] = useState<SearchView>(initialSession?.view ?? 'list');
  const [searchResults, setSearchResults] = useState<EnrichedSearchResult[]>([]);
  const [ownershipMode, setOwnershipMode] = useState<
    ReturnType<typeof normalizeOwnershipMode>
  >(initialSession?.ownershipMode ?? 'caught');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(Boolean(initialSession));
  const [scrollToTopTrigger, setScrollToTopTrigger] = useState(0);

  const variants = useVariantsStore((state) => state.variants);
  const { alert } = useModal();
  const modeSlider = useHorizontalPageNavigation({
    pages: SEARCH_MODES,
    activePage: searchMode,
    onChange: setSearchMode,
  });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollRef = useRef(false);
  const hasRestoredSessionRef = useRef(false);
  const loadedOwnerKeyRef = useRef(cacheOwnerKey);
  const searchModeRef = useRef(searchMode);
  const viewRef = useRef(view);
  const pokemonCache = useMemo<PokemonVariant[]>(
    () => variants.filter((variant) => variant.variantType === 'default'),
    [variants],
  );
  const pokemonById = useMemo(() => {
    const map = new Map<number, PokemonVariant>();
    for (const variant of pokemonCache) {
      const pokemonId = Number(variant.pokemon_id);
      if (Number.isFinite(pokemonId) && !map.has(pokemonId)) {
        map.set(pokemonId, variant);
      }
    }
    return map;
  }, [pokemonCache]);

  useEffect(() => {
    if (loadedOwnerKeyRef.current === cacheOwnerKey) return;
    loadedOwnerKeyRef.current = cacheOwnerKey;
    const nextSession = readSearchSession(cacheOwnerKey);
    hasRestoredSessionRef.current = false;
    setInitialSession(nextSession);
    setSearchMode(
      readRequestedSearchMode() ?? nextSession?.searchMode ?? 'pokemon',
    );
    setView(nextSession?.view ?? 'list');
    setOwnershipMode(nextSession?.ownershipMode ?? 'caught');
    setSearchResults([]);
    setHasSearched(Boolean(nextSession));
    setErrorMessage('');
  }, [cacheOwnerKey]);

  useEffect(() => {
    searchModeRef.current = searchMode;
    patchSearchSession(cacheOwnerKey, { searchMode });
  }, [cacheOwnerKey, searchMode]);

  useEffect(() => {
    viewRef.current = view;
    patchSearchSession(cacheOwnerKey, { view });
  }, [cacheOwnerKey, view]);

  useEffect(() => {
    if (hasRestoredSessionRef.current || !initialSession) return;
    if (pokemonById.size === 0) return;

    hasRestoredSessionRef.current = true;
    setSearchResults(
      enrichAndSortSearchResults(
        initialSession.rawResults,
        pokemonById,
        initialSession.boundaryWKT,
      ),
    );

    const firstFrame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: initialSession.scrollY, behavior: 'auto' });
      });
    });
    return () => window.cancelAnimationFrame(firstFrame);
  }, [initialSession, pokemonById]);

  useEffect(
    () => () => {
      patchSearchSession(cacheOwnerKey, {
        searchMode: searchModeRef.current,
        view: viewRef.current,
        scrollY: window.scrollY,
      });
    },
    [cacheOwnerKey],
  );

  useEffect(() => {
    if (shouldScrollRef.current && searchResults.length > 0) {
      setTimeout(() => {
        if (containerRef.current) {
          const offset = 50;
          const rect = containerRef.current.getBoundingClientRect();
          const absoluteTop = rect.top + window.pageYOffset - offset;
          window.scrollTo({
            top: absoluteTop,
            behavior: 'smooth',
          });
        }
        shouldScrollRef.current = false;
      }, 100);
    }
  }, [searchResults]);

  const handleSearch = async (
    queryParams: SearchQueryParams,
    boundaryWKT?: string | null,
    draft: PokemonSearchDraft = createDefaultPokemonSearchDraft(),
  ): Promise<void> => {
    setErrorMessage('');
    setIsLoading(true);
    setHasSearched(true);
    const nextOwnershipMode = normalizeOwnershipMode(
      coerceOwnershipModeInput(queryParams.ownership),
    );
    setOwnershipMode(nextOwnershipMode);
    shouldScrollRef.current = true;

    try {
      const dataArray = await searchPokemon(queryParams);
      const enrichedData = enrichAndSortSearchResults(
        dataArray,
        pokemonById,
        boundaryWKT,
      );
      setSearchResults(enrichedData);
      if (enrichedData.length > 0) {
        setScrollToTopTrigger((prev) => prev + 1);
      }
      writeSearchSession({
        ownerKey: cacheOwnerKey,
        queryParams,
        draft,
        rawResults: dataArray,
        boundaryWKT: boundaryWKT ?? null,
        ownershipMode: nextOwnershipMode,
        searchMode: searchModeRef.current,
        view: viewRef.current,
        scrollY: 0,
      });
    } catch (error) {
      log.error('Search request failed', error);
      const isTimeout =
        error instanceof Error && error.message.toLowerCase().includes('timed out');
      const message = isTimeout
        ? 'Search took too long to respond. Try a smaller distance or fewer results, then search again.'
        : 'Search is temporarily unavailable. Check your connection and try again.';
      setSearchResults([]);
      setErrorMessage(message);
      void alert(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="search-page">
      <ProductPageHeader
        align="center"
        className="search-page-header"
        description="Find Pokémon listings and connect with trainers nearby."
        eyebrow="Community discovery"
        title="Search"
      >
        <SearchModeToggle searchMode={searchMode} setSearchMode={setSearchMode} />
      </ProductPageHeader>

      <HorizontalPageSlider
        activeIndex={modeSlider.activeIndex}
        className="search-mode-slider"
        dragOffset={modeSlider.dragOffset}
        isDragging={modeSlider.isDragging}
        viewportRef={modeSlider.viewportRef}
        {...modeSlider.swipeHandlers}
      >
        <section
          aria-labelledby="search-tab-pokemon"
          className="search-mode-panel search-mode-panel--pokemon"
          id="search-panel-pokemon"
          role="tabpanel"
        >
          <PokemonSearchBar
            key={`${cacheOwnerKey}:${initialSession?.savedAt ?? 'empty'}`}
            onSearch={handleSearch}
            isLoading={isLoading}
            view={view}
            setView={setView}
            pokemonCache={pokemonCache}
            initialDraft={initialSession?.draft}
          />

          {errorMessage && (
            <PageState
              className="search-error-message"
              description={errorMessage}
              icon={<FaExclamationTriangle aria-hidden="true" />}
              title="Search couldn't be completed"
              tone="danger"
            />
          )}

          <div className="search-results-stage" ref={containerRef}>
            {isLoading ? (
              <PageState
                className="search-loading-state"
                description="Checking nearby trainers for the Pokémon you selected…"
                icon={<LoadingSpinner />}
                live="polite"
                title="Searching community listings"
                tone="info"
              />
            ) : view === 'list' ? (
              <RenderProfiler id="Search.ListView">
                <ListView
                  data={searchResults}
                  instanceData={ownershipMode}
                  hasSearched={hasSearched}
                  pokemonCache={variants}
                  scrollToTopTrigger={scrollToTopTrigger}
                />
              </RenderProfiler>
            ) : (
              <RenderProfiler id="Search.MapView">
                <MapView
                  data={searchResults}
                  hasSearched={hasSearched}
                  instanceData={ownershipMode}
                  pokemonCache={variants}
                />
              </RenderProfiler>
            )}
          </div>
        </section>

        <section
          aria-labelledby="search-tab-trainer"
          className="search-mode-panel search-mode-panel--trainer"
          id="search-panel-trainer"
          role="tabpanel"
        >
          <TrainerSearchBar />
        </section>
      </HorizontalPageSlider>
    </main>
  );
};

export default Search;
