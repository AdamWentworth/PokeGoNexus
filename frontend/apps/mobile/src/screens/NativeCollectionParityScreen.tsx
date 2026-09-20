import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { collectionExperienceParityContract } from '@pokemongonexus/shared-ui-tokens';
import {
  NativeCollectionParityFixture,
  type NativeCollectionParityFixtureHandle,
} from '../features/collection/parity/NativeCollectionParityFixture';
import {
  projectNativeCollectionParityCard,
} from '../features/collection/parity/nativeCollectionCardProjection';
import {
  filterNativeCollectionRows,
  sortNativeCollectionRows,
  type NativeCollectionRow,
  type NativeCollectionSort,
  type NativeCollectionSortDirection,
  type NativeTagSummary,
} from '../features/collection/collectionModel';
import type { NativePokemonHubView } from '../features/collection/NativePokemonHubHeader';
import {
  NATIVE_SORT_OPTIONS,
  NativeCollectionSortMenu,
  type NativeCollectionSortMenuContentProps,
} from '../features/collection/parity/NativeCollectionSortMenu';
import { useNativeColorScheme } from '../features/settings/useNativeColorScheme';
import type { NativeCollectionSession } from '../features/collection/nativeCollectionSessionCache';
import { markNativeUiPerformance } from '../observability/nativeUiPerformanceTrace';
import {
  beginNativeUiInteraction,
  runAfterNativeUiInteractions,
} from '../interaction/nativeUiInteractionScheduler';
import { createNativeCollectionImageRevealController } from '../features/collection/parity/nativeCollectionImageRevealController';
import { toNativeCollectionAssetUrl } from '../features/collection/parity/nativeCollectionImageSource';

export {
  projectNativeCollectionParityCards,
} from '../features/collection/parity/nativeCollectionCardProjection';

export type NativeCollectionSortMenuHost = {
  dismiss: () => void;
  present: (props: NativeCollectionSortMenuContentProps) => void;
};

type NativeCollectionParityScreenProps = {
  assetBaseUrl: string;
  rows: NativeCollectionRow[];
  searchUniverseRows?: NativeCollectionRow[];
  activeTag: NativeTagSummary | null;
  query: string;
  initialScrollOffset?: number;
  initialShowEvolutionaryLine?: boolean;
  initialSort?: NativeCollectionSort;
  initialSortDirection?: NativeCollectionSortDirection;
  isLoading: boolean;
  error: string | null;
  onQueryChange: (query: string, source?: 'filter' | 'typing') => void;
  onRetry: () => void;
  onOpenInstance: (row: NativeCollectionRow, orderedRows: NativeCollectionRow[]) => void;
  onLongPressInstance?: (row: NativeCollectionRow) => void;
  onOpenCanonicalCollection?: () => void;
  onClearTag: () => void;
  onViewChange: (view: NativePokemonHubView) => void;
  showHeader?: boolean;
  selectedIds?: ReadonlySet<string>;
  onClearSelection?: () => void;
  onSelectAll?: () => void;
  onSelectionActionPress?: () => void;
  selectionAction?: 'add' | 'organize';
  tagCanClear?: boolean;
  onContextChange?: (patch: Partial<NativeCollectionSession>) => void;
  onRowsCommitted?: (visibleRowCount: number, committedQuery: string) => void;
  sortMenuHost?: NativeCollectionSortMenuHost;
};

const SORT_ICONS: Record<NativeCollectionSort, string> = {
  releaseDate: '/images/sorting/recent.png',
  favorite: '/images/sorting/favorite.png',
  number: '/images/sorting/number.png',
  hp: '/images/sorting/hp.png',
  name: '/images/sorting/name.png',
  combatPower: '/images/sorting/cp.png',
};

const SORT_MENU_ASSET_PATHS = [
  ...NATIVE_SORT_OPTIONS.map(({ icon }) => icon),
  '/images/sorting/arrow.png',
  '/images/close-button.png',
  '/images/close-button-light.png',
] as const;
const warmedSortMenuAssetOrigins = new Set<string>();

export const prepareNativeCollectionParityRows = (
  rows: NativeCollectionRow[],
): void => {
  const sortedRows = sortNativeCollectionRows(rows, 'number', 'ascending');
  // Vite virtualizes before rendering cards. Warm only the first six native
  // phone rows (18 cards), not every item in a potentially 3,000-entry tag.
  sortedRows.slice(0, 18).forEach((row) => {
    projectNativeCollectionParityCard(row, true);
  });
};

const EMPTY_SELECTED_IDS: ReadonlySet<string> = new Set<string>();
// React Native's legacy Android Image view decodes on the render thread. Vite's
// browser pipeline lets cached lazy images complete independently, so never
// hand Android an entire mounted FlatList window in one frame. One card per
// frame keeps each decode slice small; three viewports cover FlatList's window
// before the ordinary unrestricted renderer resumes.
const COLLECTION_IMAGE_REVEAL_BATCH = 1;
const COLLECTION_INITIAL_IMAGE_REVEAL_BATCH = 3;
const COLLECTION_OFFSCREEN_IMAGE_REVEAL_BATCH = 3;
const COLLECTION_INITIAL_VIEWPORT_IMAGE_COUNT = 18;
const COLLECTION_IMAGE_REVEAL_WINDOW = 54;

const resolveSortSelection = (
  sort: NativeCollectionSort,
  direction: NativeCollectionSortDirection,
  nextSort: NativeCollectionSort,
): { sort: NativeCollectionSort; direction: NativeCollectionSortDirection } => ({
  sort: nextSort,
  direction: nextSort === sort
    ? direction === 'ascending' ? 'descending' : 'ascending'
    : nextSort === 'favorite' ? 'descending' : 'ascending',
});

const catalogOnlyRowsCache = new WeakMap<NativeCollectionRow[], boolean>();
const containsOnlyCatalogRows = (rows: NativeCollectionRow[]): boolean => {
  const cached = catalogOnlyRowsCache.get(rows);
  if (cached !== undefined) return cached;
  const result = rows.length > 0 && rows.every((row) => row.source === 'catalog');
  catalogOnlyRowsCache.set(rows, result);
  return result;
};

export type NativeCollectionParityScreenHandle = NativeCollectionParityFixtureHandle & {
  /** Apply a tag's exact sort without toggling its direction. Returns whether it changed. */
  applySort: (sort: NativeCollectionSort, direction: NativeCollectionSortDirection) => boolean;
};

export const NativeCollectionParityScreen = memo(forwardRef<
  NativeCollectionParityScreenHandle,
  NativeCollectionParityScreenProps
>(function NativeCollectionParityScreen({
  assetBaseUrl,
  rows,
  searchUniverseRows = rows,
  activeTag,
  query,
  initialScrollOffset = 0,
  initialShowEvolutionaryLine = false,
  initialSort = 'number',
  initialSortDirection = 'ascending',
  isLoading,
  error,
  onQueryChange,
  onRetry,
  onOpenInstance,
  onLongPressInstance,
  onOpenCanonicalCollection,
  onClearTag,
  onViewChange,
  showHeader = true,
  selectedIds = EMPTY_SELECTED_IDS,
  onClearSelection,
  onSelectAll,
  onSelectionActionPress,
  selectionAction = 'organize',
  tagCanClear = Boolean(activeTag),
  onContextChange,
  onRowsCommitted,
  sortMenuHost,
}, ref) {
  const colorScheme = useNativeColorScheme();
  const [sort, setSort] = useState<NativeCollectionSort>(initialSort);
  const [direction, setDirection] = useState<NativeCollectionSortDirection>(initialSortDirection);
  const fixtureRef = useRef<NativeCollectionParityFixtureHandle>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const [sortVisible, setSortVisible] = useState(false);
  const [showEvolutionaryLine, setShowEvolutionaryLine] = useState(initialShowEvolutionaryLine);
  const [stagedQuery, setStagedQuery] = useState<string | null>(null);
  const [stagedShowEvolutionaryLine, setStagedShowEvolutionaryLine] = useState<boolean | null>(null);
  const [collectionImageRevealController] = useState(
    () => createNativeCollectionImageRevealController(0),
  );
  const setCollectionImageRevealCount = useCallback(
    (count: number | null) => collectionImageRevealController.setRevealCount(count),
    [collectionImageRevealController],
  );
  const [collectionImageRevealInteraction, setCollectionImageRevealInteraction] = useState<string | null>(
    'initial',
  );
  useImperativeHandle(ref, () => ({
    resetScroll: () => fixtureRef.current?.resetScroll(),
    applySort: (nextSort, nextDirection) => {
      if (sort === nextSort && direction === nextDirection) return false;
      setSort(nextSort);
      setDirection(nextDirection);
      setCollectionImageRevealCount(0);
      setCollectionImageRevealInteraction(`sort:${nextSort}:${nextDirection}`);
      return true;
    },
  }), [direction, setCollectionImageRevealCount, sort]);
  const stagedQueryRef = useRef<string | null>(null);
  const adoptedStagedQueryRef = useRef<string | null>(null);
  const stagedQueryCancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterReleaseFrameRef = useRef<number | null>(null);
  const stagedEvolutionRef = useRef<boolean | null>(null);
  const stagedEvolutionCancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sortMenuRequestStartedAtRef = useRef<number | null>(null);
  const sortMenuCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sortMenuInteractionReleaseRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (warmedSortMenuAssetOrigins.has(assetBaseUrl)) return;
    warmedSortMenuAssetOrigins.add(assetBaseUrl);
    for (const path of SORT_MENU_ASSET_PATHS) {
      void Promise.resolve(
        Image.prefetch(toNativeCollectionAssetUrl(assetBaseUrl, path)),
      ).catch(() => undefined);
    }
  }, [assetBaseUrl]);

  const stagedQueryTraceRef = useRef<{
    paintedAt: number | null;
    query: string;
    startedAt: number;
  } | null>(null);
  const projectionInteractionTraceRef = useRef<{
    event: 'collection_evolution_result_painted' | 'collection_sort_result_painted';
    startedAt: number;
  } | null>(null);
  const effectiveQuery = stagedQuery ?? query;
  const effectiveShowEvolutionaryLine = stagedShowEvolutionaryLine ?? showEvolutionaryLine;
  // Match Vite's architecture: one virtualized grid receives a new immutable
  // projection when the tag changes. Sorting and card projection are cached,
  // so this changes the small visible window without retaining a hidden image
  // grid for every tag in the native view hierarchy.
  const filteredRows = useMemo(
    () => filterNativeCollectionRows(rows, 'all', effectiveQuery, {
      showEvolutionaryLine: effectiveShowEvolutionaryLine,
      universeRows: searchUniverseRows,
    }),
    [effectiveQuery, effectiveShowEvolutionaryLine, rows, searchUniverseRows],
  );
  useEffect(() => {
    if (stagedQuery !== null || collectionImageRevealInteraction !== null) {
      return undefined;
    }
    // Warm every Vite sort projection one small slice at a time after the
    // filtered row set changes. A later menu selection is then a reference-
    // stable cache lookup without changing the visible list on press-in.
    const combinations = NATIVE_SORT_OPTIONS.flatMap(({ key }) => ([
      [key, 'ascending'],
      [key, 'descending'],
    ] as const));
    let index = 0;
    let frame: number | null = requestAnimationFrame(function warmNext() {
      if (index >= combinations.length) {
        frame = null;
        return;
      }
      const [nextSort, nextDirection] = combinations[index];
      index += 1;
      sortNativeCollectionRows(filteredRows, nextSort, nextDirection);
      frame = requestAnimationFrame(warmNext);
    });
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [collectionImageRevealInteraction, filteredRows, stagedQuery]);
  const visibleRows = useMemo(
    () => sortNativeCollectionRows(filteredRows, sort, direction),
    [direction, filteredRows, sort],
  );
  const visibleRowsRef = useRef(visibleRows);
  useLayoutEffect(() => {
    visibleRowsRef.current = visibleRows;
    // React has committed the destination card window at this point. The Hub
    // can now start its native-driven track in the same paint, just as Vite's
    // filter and CSS transform take effect in one commit.
    onRowsCommitted?.(visibleRows.length, effectiveQuery);
    const projectionTrace = projectionInteractionTraceRef.current;
    if (projectionTrace) {
      projectionInteractionTraceRef.current = null;
      requestAnimationFrame(() => {
        markNativeUiPerformance(projectionTrace.event, {
          interactionLatencyMs: Date.now() - projectionTrace.startedAt,
          rowCount: visibleRows.length,
        });
      });
    }
    const trace = stagedQueryTraceRef.current;
    if (stagedQuery !== null && trace?.query === effectiveQuery && trace.paintedAt === null) {
      requestAnimationFrame(() => {
        if (stagedQueryTraceRef.current !== trace || trace.paintedAt !== null) return;
        trace.paintedAt = Date.now();
        markNativeUiPerformance('collection_query_preview_painted', {
          interactionLatencyMs: trace.paintedAt - trace.startedAt,
          query: trace.query,
          rowCount: visibleRows.length,
        });
      });
    }
  }, [
    direction,
    effectiveQuery,
    onRowsCommitted,
    showEvolutionaryLine,
    sort,
    stagedQuery,
    stagedShowEvolutionaryLine,
    visibleRows,
  ]);
  useEffect(() => {
    if (collectionImageRevealInteraction === null) return undefined;
    const startedAt = Date.now();
    const target = Math.min(COLLECTION_IMAGE_REVEAL_WINDOW, visibleRows.length);
    let revealed = 0;
    let frame: number | null = null;
    let scheduledTask: ReturnType<typeof runAfterNativeUiInteractions> | null = null;
    let cancelled = false;
    const finishReveal = () => {
      markNativeUiPerformance('collection_projection_images_revealed', {
        interactionLatencyMs: Date.now() - startedAt,
        interaction: collectionImageRevealInteraction,
        rowCount: visibleRows.length,
      });
      setCollectionImageRevealCount(null);
      setCollectionImageRevealInteraction(null);
    };
    const revealNextBatch = () => {
      scheduledTask = runAfterNativeUiInteractions(() => {
        scheduledTask = null;
        if (cancelled) return;
        const batchSize = revealed < COLLECTION_INITIAL_VIEWPORT_IMAGE_COUNT
          ? collectionImageRevealInteraction === 'initial'
            ? COLLECTION_INITIAL_IMAGE_REVEAL_BATCH
            : COLLECTION_IMAGE_REVEAL_BATCH
          : COLLECTION_OFFSCREEN_IMAGE_REVEAL_BATCH;
        revealed = Math.min(target, revealed + batchSize);
        setCollectionImageRevealCount(revealed);
        if (revealed === Math.min(COLLECTION_INITIAL_VIEWPORT_IMAGE_COUNT, target)) {
          frame = requestAnimationFrame(() => {
            if (cancelled) return;
            frame = null;
            markNativeUiPerformance('collection_projection_viewport_images_revealed', {
              interactionLatencyMs: Date.now() - startedAt,
              interaction: collectionImageRevealInteraction,
              rowCount: visibleRows.length,
            });
            if (revealed < target) {
              revealNextBatch();
            } else {
              scheduledTask = runAfterNativeUiInteractions(() => {
                scheduledTask = null;
                if (!cancelled) finishReveal();
              });
            }
          });
          return;
        }
        if (revealed < target) {
          revealNextBatch();
          return;
        }
        // Wait for the final enabled-image batch to paint, then re-enter the
        // interaction-aware scheduler before removing the reveal gate. A bare
        // rAF here could already be queued when a swipe began and launch a
        // large FlatList update in the middle of its 120 ms handoff.
        frame = requestAnimationFrame(() => {
          if (cancelled) return;
          frame = null;
          scheduledTask = runAfterNativeUiInteractions(() => {
            scheduledTask = null;
            if (!cancelled) finishReveal();
          });
        });
      });
    };
    if (target === 0) {
      // Keep the cold-mount gate armed while data is still resolving. Once a
      // cached or network snapshot arrives, its first image window should use
      // the same bounded lazy-release path instead of decoding in one burst.
      if (isLoading) return undefined;
      setCollectionImageRevealCount(null);
      setCollectionImageRevealInteraction(null);
      return undefined;
    }
    revealNextBatch();
    return () => {
      cancelled = true;
      if (frame !== null) cancelAnimationFrame(frame);
      scheduledTask?.cancel();
    };
  }, [
    collectionImageRevealInteraction,
    isLoading,
    setCollectionImageRevealCount,
    visibleRows.length,
  ]);
  const handleRowPress = useCallback(
    (row: NativeCollectionRow) => onOpenInstance(row, visibleRowsRef.current),
    [onOpenInstance],
  );
  const handleRowLongPress = useMemo(
    () => onLongPressInstance
      ? (row: NativeCollectionRow) => onLongPressInstance(row)
      : undefined,
    [onLongPressInstance],
  );
  const sortLabel = NATIVE_SORT_OPTIONS.find((option) => option.key === sort)?.label ?? 'NUMBER';
  const theme = colorScheme === 'light' ? 'light' : 'dark';
  const previewEvolutionaryLine = useCallback(() => {
    if (stagedEvolutionCancelTimerRef.current) {
      clearTimeout(stagedEvolutionCancelTimerRef.current);
      stagedEvolutionCancelTimerRef.current = null;
    }
    const next = !showEvolutionaryLine;
    stagedEvolutionRef.current = next;
    setStagedShowEvolutionaryLine(next);
    setCollectionImageRevealCount(0);
    setCollectionImageRevealInteraction(null);
  }, [setCollectionImageRevealCount, showEvolutionaryLine]);
  const cancelEvolutionaryLinePreview = useCallback(() => {
    if (stagedEvolutionCancelTimerRef.current) {
      clearTimeout(stagedEvolutionCancelTimerRef.current);
    }
    stagedEvolutionCancelTimerRef.current = setTimeout(() => {
      stagedEvolutionCancelTimerRef.current = null;
      stagedEvolutionRef.current = null;
      setStagedShowEvolutionaryLine(null);
      setCollectionImageRevealCount(null);
      setCollectionImageRevealInteraction(null);
    }, 0);
  }, [setCollectionImageRevealCount]);
  const handleToggleEvolutionaryLine = useCallback(() => {
    if (stagedEvolutionCancelTimerRef.current) {
      clearTimeout(stagedEvolutionCancelTimerRef.current);
      stagedEvolutionCancelTimerRef.current = null;
    }
    const next = stagedEvolutionRef.current ?? !showEvolutionaryLine;
    projectionInteractionTraceRef.current = {
      event: 'collection_evolution_result_painted',
      startedAt: Date.now(),
    };
    markNativeUiPerformance('collection_evolution_toggled', { enabled: next });
    stagedEvolutionRef.current = null;
    setStagedShowEvolutionaryLine(null);
    setShowEvolutionaryLine(next);
    setCollectionImageRevealCount(0);
    setCollectionImageRevealInteraction(`evolution:${next ? 'on' : 'off'}`);
    onContextChange?.({ showEvolutionaryLine: next });
  }, [onContextChange, setCollectionImageRevealCount, showEvolutionaryLine]);
  const handleScrollOffsetChange = useCallback((scrollOffset: number) => {
    onContextChange?.({ scrollOffset });
  }, [onContextChange]);
  const previewQuery = useCallback((nextQuery: string) => {
    if (stagedQueryCancelTimerRef.current) {
      clearTimeout(stagedQueryCancelTimerRef.current);
      stagedQueryCancelTimerRef.current = null;
    }
    stagedQueryTraceRef.current = {
      paintedAt: null,
      query: nextQuery,
      startedAt: Date.now(),
    };
    markNativeUiPerformance('collection_query_preview_started', { query: nextQuery });
    setCollectionImageRevealCount(0);
    setCollectionImageRevealInteraction(null);
    stagedQueryRef.current = nextQuery;
    setStagedQuery(nextQuery);
  }, [setCollectionImageRevealCount]);
  const cancelQueryPreview = useCallback((nextQuery: string) => {
    if (stagedQueryCancelTimerRef.current) clearTimeout(stagedQueryCancelTimerRef.current);
    stagedQueryCancelTimerRef.current = setTimeout(() => {
      stagedQueryCancelTimerRef.current = null;
      if (stagedQueryRef.current !== nextQuery) return;
      stagedQueryTraceRef.current = null;
      setCollectionImageRevealCount(null);
      setCollectionImageRevealInteraction(null);
      stagedQueryRef.current = null;
      setStagedQuery(null);
    }, 0);
  }, [setCollectionImageRevealCount]);
  const changeQuery = useCallback((
    nextQuery: string,
    source: 'filter' | 'typing' = 'typing',
  ) => {
    if (stagedQueryCancelTimerRef.current) {
      clearTimeout(stagedQueryCancelTimerRef.current);
      stagedQueryCancelTimerRef.current = null;
    }
    const trace = stagedQueryTraceRef.current;
    const adoptingPreview = trace?.query === nextQuery
      && stagedQueryRef.current === nextQuery;
    if (adoptingPreview) {
      markNativeUiPerformance('collection_query_preview_released', {
        previewLeadMs: Date.now() - trace.startedAt,
        previewPaintedBeforeRelease: trace.paintedAt !== null,
        query: trace.query,
      });
    } else if (source === 'typing' && nextQuery.trim()) {
      setCollectionImageRevealCount(0);
      setCollectionImageRevealInteraction(`typing:${nextQuery}`);
    } else {
      setCollectionImageRevealCount(null);
      setCollectionImageRevealInteraction(null);
    }
    stagedQueryTraceRef.current = null;
    if (adoptingPreview) {
      // The destination is already committed behind the filter overlay. Keep
      // that staged projection as the urgent visible source, then commit the
      // Hub's query/count/session bookkeeping after the release frame.
      // Clearing it here used to put that parent reconciliation in front of
      // the menu-close paint even though none of it changed the visible cards.
      adoptedStagedQueryRef.current = nextQuery;
      if (filterReleaseFrameRef.current !== null) {
        cancelAnimationFrame(filterReleaseFrameRef.current);
      }
      filterReleaseFrameRef.current = requestAnimationFrame(() => {
        filterReleaseFrameRef.current = null;
        setCollectionImageRevealCount(0);
        setCollectionImageRevealInteraction(`filter:${nextQuery}`);
        onQueryChange(nextQuery, source);
      });
      return;
    }
    adoptedStagedQueryRef.current = null;
    stagedQueryRef.current = null;
    setStagedQuery(null);
    onQueryChange(nextQuery, source);
  }, [onQueryChange, setCollectionImageRevealCount]);
  useEffect(() => {
    if (
      stagedQuery === null
      || adoptedStagedQueryRef.current !== stagedQuery
      || query !== stagedQuery
    ) return;
    adoptedStagedQueryRef.current = null;
    stagedQueryRef.current = null;
    setStagedQuery(null);
  }, [query, stagedQuery]);
  useEffect(() => () => {
    if (filterReleaseFrameRef.current !== null) cancelAnimationFrame(filterReleaseFrameRef.current);
    if (stagedQueryCancelTimerRef.current) clearTimeout(stagedQueryCancelTimerRef.current);
    if (stagedEvolutionCancelTimerRef.current) clearTimeout(stagedEvolutionCancelTimerRef.current);
    if (sortMenuCloseTimerRef.current) clearTimeout(sortMenuCloseTimerRef.current);
    sortMenuInteractionReleaseRef.current?.();
    sortMenuInteractionReleaseRef.current = null;
  }, []);
  const closeSortMenu = useCallback(() => {
    setSortOpen(false);
    sortMenuHost?.dismiss();
    if (sortMenuCloseTimerRef.current) clearTimeout(sortMenuCloseTimerRef.current);
    sortMenuCloseTimerRef.current = setTimeout(() => {
      sortMenuCloseTimerRef.current = null;
      if (!sortMenuHost) setSortVisible(false);
      sortMenuInteractionReleaseRef.current?.();
      sortMenuInteractionReleaseRef.current = null;
    }, collectionExperienceParityContract.sortMenuMotion.overlayTransitionMs);
  }, [sortMenuHost]);
  const selectSort = useCallback((nextSort: NativeCollectionSort) => {
    const next = resolveSortSelection(sort, direction, nextSort);
    projectionInteractionTraceRef.current = {
      event: 'collection_sort_result_painted',
      startedAt: Date.now(),
    };
    markNativeUiPerformance('collection_sort_changed', next);
    closeSortMenu();
    setSort(next.sort);
    setDirection(next.direction);
    setCollectionImageRevealCount(0);
    setCollectionImageRevealInteraction(`sort:${next.sort}:${next.direction}`);
    onContextChange?.({
      sort: next.sort,
      sortDirection: next.direction,
    });
  }, [closeSortMenu, direction, onContextChange, setCollectionImageRevealCount, sort]);
  const openSortMenu = useCallback(() => {
    if (sortMenuCloseTimerRef.current) {
      clearTimeout(sortMenuCloseTimerRef.current);
      sortMenuCloseTimerRef.current = null;
    }
    sortMenuRequestStartedAtRef.current = Date.now();
    markNativeUiPerformance('collection_sort_menu_requested', {
      presentation: sortMenuHost ? 'inline' : 'modal',
    });
    sortMenuInteractionReleaseRef.current?.();
    sortMenuInteractionReleaseRef.current = beginNativeUiInteraction();
    if (sortMenuHost) {
      sortMenuHost.present({
        assetBaseUrl,
        direction,
        onClose: closeSortMenu,
        onSelect: selectSort,
        sort,
      });
    } else {
      setSortVisible(true);
    }
    setSortOpen(true);
  }, [
    assetBaseUrl,
    closeSortMenu,
    direction,
    selectSort,
    sort,
    sortMenuHost,
  ]);
  useLayoutEffect(() => {
    if (!sortOpen || sortMenuRequestStartedAtRef.current === null) return undefined;
    const startedAt = sortMenuRequestStartedAtRef.current;
    sortMenuRequestStartedAtRef.current = null;
    const frame = requestAnimationFrame(() => {
      markNativeUiPerformance('collection_sort_menu_painted', {
        interactionLatencyMs: Date.now() - startedAt,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [sortOpen]);
  const openPokemon = useCallback(() => onViewChange('pokemon'), [onViewChange]);
  const openTags = useCallback(() => onViewChange('inventory'), [onViewChange]);
  const openWishlist = useCallback(() => onViewChange('wishlist'), [onViewChange]);
  const containsOnlyCatalog = containsOnlyCatalogRows(rows);
  const projectedSelectionAction = containsOnlyCatalog ? 'add' : selectionAction;
  const scrollResetKey = activeTag?.key ?? 'catalog';

  return (
    <View style={styles.screen} testID="native-collection-parity-screen">
      <NativeCollectionParityFixture
        activeTag={activeTag?.filterName ?? activeTag?.name ?? null}
        assetBaseUrl={assetBaseUrl}
        collectionRows={visibleRows}
        collectionCount={visibleRows.length}
        collectionImageRevealController={collectionImageRevealController}
        error={error}
        isLoading={isLoading}
        onActionMenuPress={onOpenCanonicalCollection}
        onCollectionRowPress={handleRowPress}
        onCollectionRowLongPress={handleRowLongPress}
        customTagColor={activeTag?.color}
        onClearTag={onClearTag}
        onQueryChange={changeQuery}
        onQueryPreview={previewQuery}
        onCancelQueryPreview={cancelQueryPreview}
        onEvolutionPressIn={previewEvolutionaryLine}
        onEvolutionPressOut={cancelEvolutionaryLinePreview}
        onToggleEvolutionaryLine={handleToggleEvolutionaryLine}
        onRetry={onRetry}
        onSortPress={openSortMenu}
        onPokemonPress={openPokemon}
        onTagsPress={openTags}
        onWishlistPress={openWishlist}
        onClearSelection={onClearSelection}
        onSelectAll={onSelectAll}
        onSelectionActionPress={onSelectionActionPress}
        initialScrollOffset={initialScrollOffset}
        onScrollOffsetChange={handleScrollOffsetChange}
        query={query}
        ref={fixtureRef}
        scrollResetKey={scrollResetKey}
        sortDirection={direction}
        sortIconPath={SORT_ICONS[sort]}
        sortLabel={`Sort by ${sortLabel} ${direction}`}
        showEvolutionaryLine={showEvolutionaryLine}
        tagCanClear={Boolean(activeTag) && tagCanClear}
        tagTone={activeTag?.tone ?? 'caught'}
        theme={theme}
        showHeader={showHeader}
        showOwnership={Boolean(activeTag)}
        selectedIds={selectedIds}
        selectionAction={projectedSelectionAction}
      />

      {!sortMenuHost ? (
        <NativeCollectionSortMenu
          assetBaseUrl={assetBaseUrl}
          direction={direction}
          onClose={closeSortMenu}
          onSelect={selectSort}
          open={sortOpen}
          sort={sort}
          visible={sortVisible}
        />
      ) : null}
    </View>
  );
}));

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
