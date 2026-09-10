import {
  type ReactNode,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type {
  CreateCustomTagRequest,
  CustomTagParent,
  PokemonTagOrderKey,
  UpdateCustomTagRequest,
} from '@pokemongonexus/shared-contracts/users';
import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import {
  buildClearActiveTagMessage,
  collectionExperienceParityContract,
  collectionParityTokens,
} from '@pokemongonexus/shared-ui-tokens';
import {
  NativeHorizontalPageSlider,
  NATIVE_HORIZONTAL_PAGE_TRANSITION_MS,
  type NativeHorizontalPageSliderHandle,
} from '../components/NativeHorizontalPageSlider';
import {
  prepareNativeCollectionSearchRows,
  type NativeCollectionRow,
  type NativeCollectionSort,
  type NativeCollectionSortDirection,
  type NativeTagSummary,
} from '../features/collection/collectionModel';
import {
  NativePokemonHubHeader,
  type NativePokemonHubHeaderHandle,
  type NativePokemonHubView,
} from '../features/collection/NativePokemonHubHeader';
import {
  NativeCollectionParityScreen,
  type NativeCollectionParityScreenHandle,
  type NativeCollectionSortMenuHost,
  prepareNativeCollectionParityRows,
} from './NativeCollectionParityScreen';
import {
  NativeCollectionSortMenu,
  type NativeCollectionSortMenuContentProps,
} from '../features/collection/parity/NativeCollectionSortMenu';
import { NativeTagsPanelScreen } from './NativeTagsPanelScreen';
import { NativeActionMenu } from '../components/NativeActionMenu';
import { NativeActionMenuAnchor } from '../components/NativeActionMenuAnchor';
import { NativeConfirmationDialog } from '../components/NativeConfirmationDialog';
import { NativePokemonOrganizerSheet } from '../features/collection/NativePokemonOrganizerSheet';
import type {
  NativePokemonOrganizerRequest,
} from '../features/collection/useNativePokemonOrganizerMutation';
import { useNativeColorScheme } from '../features/settings/useNativeColorScheme';
import type { NativeCollectionSession } from '../features/collection/nativeCollectionSessionCache';
import { markNativeUiPerformance } from '../observability/nativeUiPerformanceTrace';
import {
  beginNativeUiInteraction,
  runAfterNativeUiInteractions,
} from '../interaction/nativeUiInteractionScheduler';

const VIEW_ORDER: readonly NativePokemonHubView[] = (
  collectionExperienceParityContract.viewOrder
);

type Props = {
  assetBaseUrl: string;
  catalogRows: NativeCollectionRow[];
  instances: Record<string, PokemonInstance>;
  inventoryTags: NativeTagSummary[];
  wishlistTags: NativeTagSummary[];
  error: string | null;
  warning?: string | null;
  isLoading: boolean;
  /** @deprecated The hub owns its native action menu. */
  onActionMenuPress?: () => void;
  onActionMenuNavigate?: (path: string) => void;
  onOpenEntry: (row: NativeCollectionRow, orderedRows: NativeCollectionRow[]) => void;
  onRetry: () => void;
  onCreateTag?: (request: CreateCustomTagRequest) => Promise<unknown>;
  onDeleteTag?: (tagId: string) => Promise<unknown>;
  onSaveTagOrder?: (parent: CustomTagParent, tagKeys: PokemonTagOrderKey[]) => Promise<unknown>;
  onUpdateTag?: (tagId: string, request: UpdateCustomTagRequest) => Promise<unknown>;
  isSavingTags?: boolean;
  onOrganizePokemon?: (request: NativePokemonOrganizerRequest) => Promise<{ message: string }>;
  isOrganizingPokemon?: boolean;
  organizerError?: string | null;
  catalogOwner?: string | null;
  onReturnToContext?: () => void;
  requireTagSelection?: boolean;
  initialTagKey?: string | null;
  initialQuery?: string;
  initialScrollOffset?: number;
  initialShowEvolutionaryLine?: boolean;
  initialSort?: NativeCollectionSort;
  initialSortDirection?: NativeCollectionSortDirection;
  initialView?: NativePokemonHubView;
  onContextChange?: (patch: Partial<NativeCollectionSession>) => void;
  syncStatus?: ReactNode;
  signedIn?: boolean;
};

export const NativeCollectionHubScreen = memo(function NativeCollectionHubScreen({
  assetBaseUrl,
  catalogRows,
  instances,
  inventoryTags,
  wishlistTags,
  error,
  warning = null,
  isLoading,
  onActionMenuPress: _legacyActionMenuPress,
  onActionMenuNavigate,
  onOpenEntry,
  onRetry,
  onCreateTag,
  onDeleteTag,
  onSaveTagOrder,
  onUpdateTag,
  isSavingTags = false,
  onOrganizePokemon,
  isOrganizingPokemon = false,
  organizerError = null,
  catalogOwner = null,
  onReturnToContext,
  requireTagSelection = false,
  initialTagKey = null,
  initialQuery = '',
  initialScrollOffset = 0,
  initialShowEvolutionaryLine = false,
  initialSort = 'number',
  initialSortDirection = 'ascending',
  initialView = 'pokemon',
  onContextChange,
  syncStatus = null,
  signedIn = true,
}: Props) {
  const resolvedInitialTagKey = initialTagKey ?? (requireTagSelection
    ? inventoryTags.find((tag) => tag.key === 'system:caught')?.key
      ?? inventoryTags[0]?.key
      ?? wishlistTags[0]?.key
      ?? null
    : null);
  const light = useNativeColorScheme() === 'light';
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState(initialQuery);
  const [activeView, setActiveView] = useState<NativePokemonHubView>(initialView);
  const [selectedTagKey, setSelectedTagKey] = useState<string | null>(resolvedInitialTagKey);
  const [stagedTagKey, setStagedTagKey] = useState<string | null>(null);
  const [sidePanelTagKey, setSidePanelTagKey] = useState<string | null>(resolvedInitialTagKey);
  const [visibleCollectionCount, setVisibleCollectionCount] = useState(() => {
    const initialTag = [...inventoryTags, ...wishlistTags]
      .find((tag) => tag.key === resolvedInitialTagKey);
    return initialTag?.rows.length ?? (requireTagSelection ? 0 : catalogRows.length);
  });
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [actionMenuPrepared, setActionMenuPrepared] = useState(false);
  const [hostedSortMenu, setHostedSortMenu] = useState<(
    NativeCollectionSortMenuContentProps & { open: boolean }
  ) | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [organizerOpen, setOrganizerOpen] = useState(false);
  const [organizerPrepared, setOrganizerPrepared] = useState(false);
  const [clearTagConfirmationOpen, setClearTagConfirmationOpen] = useState(false);
  const [operationNotice, setOperationNotice] = useState<string | null>(null);
  const sliderRef = useRef<NativeHorizontalPageSliderHandle>(null);
  const headerRef = useRef<NativePokemonHubHeaderHandle>(null);
  const collectionSurfaceRef = useRef<NativeCollectionParityScreenHandle>(null);
  const tagSelectionTraceRef = useRef<{ key: string; startedAt: number } | null>(null);
  const querySelectionTraceRef = useRef<{
    event: 'collection_query_result_painted' | 'collection_typed_query_result_painted';
    query: string;
    startedAt: number;
  } | null>(null);
  const pendingTagMotionRef = useRef<{
    delaySidePanelTag: boolean;
    key: string;
    startedAt: number;
    touchStartedAt: number | null;
  } | null>(null);
  const pendingTagMotionReadyRef = useRef(false);
  const stagedTagKeyRef = useRef<string | null>(null);
  const stagedTagReadyRef = useRef(false);
  const stagedVisibleRowCountRef = useRef(0);
  const stagedTagPreviewStartedAtRef = useRef<number | null>(null);
  const stagedTagCancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stagedTagInteractionReleaseRef = useRef<(() => void) | null>(null);
  const sidePanelTagTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTagRequestStartedAtRef = useRef<number | null>(null);
  const selectionRequestStartedAtRef = useRef<number | null>(null);
  const organizerRequestStartedAtRef = useRef<number | null>(null);
  const actionMenuRequestStartedAtRef = useRef<number | null>(null);
  const hostedSortMenuCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeViewRef = useRef<NativePokemonHubView>(initialView);
  const selectedTagKeyRef = useRef<string | null>(resolvedInitialTagKey);
  const [pageScrollX] = useState(() => new Animated.Value(width));
  const [pageDragX] = useState(() => new Animated.Value(0));
  const availableTags = useMemo(
    () => [...inventoryTags, ...wishlistTags],
    [inventoryTags, wishlistTags],
  );
  const selectedTag = useMemo(
    () => availableTags.find((tag) => tag.key === selectedTagKey)
      ?? (requireTagSelection
        ? availableTags.find((tag) => tag.key === 'system:caught') ?? availableTags[0] ?? null
        : null),
    [availableTags, requireTagSelection, selectedTagKey],
  );
  const stagedTag = useMemo(
    () => availableTags.find((tag) => tag.key === stagedTagKey) ?? null,
    [availableTags, stagedTagKey],
  );
  const collectionTag = stagedTag ?? selectedTag;
  const sidePanelTag = useMemo(
    () => availableTags.find((tag) => tag.key === sidePanelTagKey)
      ?? (sidePanelTagKey === selectedTag?.key ? selectedTag : null),
    [availableTags, selectedTag, sidePanelTagKey],
  );
  const selectedRows = useMemo(
    () => selectedTag?.rows ?? (requireTagSelection ? [] : catalogRows),
    [catalogRows, requireTagSelection, selectedTag],
  );
  const collectionRows = useMemo(
    () => collectionTag?.rows ?? (requireTagSelection ? [] : catalogRows),
    [catalogRows, collectionTag, requireTagSelection],
  );
  const selectedRowsRef = useRef(selectedRows);
  const selectedCountRef = useRef(selectedIds.size);
  selectedRowsRef.current = selectedRows;
  selectedCountRef.current = selectedIds.size;
  const selectedOrganizerRows = useMemo(
    () => selectedIds.size === 0
      ? []
      : selectedRows.filter((row) => selectedIds.has(row.id)),
    [selectedIds, selectedRows],
  );
  const selectedRowsAreCatalog = selectedOrganizerRows.length > 0
    && selectedOrganizerRows.every((row) => row.source === 'catalog');
  useEffect(() => {
    const task = runAfterNativeUiInteractions(() => {
      setOrganizerPrepared(selectedIds.size > 0);
    });
    return task.cancel;
  }, [selectedIds.size]);
  const inventoryCount = inventoryTags.find(
    (tag) => tag.key === 'system:caught',
  )?.rows.length ?? 0;
  const palette = light
    ? collectionParityTokens.colors.light
    : collectionParityTokens.colors.dark;
  const background = palette.page;
  const text = palette.textPrimary;
  const secondary = palette.textSecondary;
  const activeIndex = VIEW_ORDER.indexOf(activeView);
  const tagEditingEnabled = Boolean(
    onCreateTag && onDeleteTag && onSaveTagOrder && onUpdateTag,
  );

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let interactionTask: ReturnType<typeof runAfterNativeUiInteractions> | null = null;
    const tagsToPrepare = availableTags.slice(0, 24);
    const searchRowGroups = [catalogRows, ...tagsToPrepare.map((tag) => tag.rows)];
    let tagIndex = 0;
    let searchGroupIndex = 0;
    let searchRowIndex = 0;
    const scheduleNext = (delay: number) => {
      timer = setTimeout(() => {
        interactionTask = runAfterNativeUiInteractions(prepareNext);
      }, delay);
    };
    const prepareNext = () => {
      if (cancelled) return;
      const tag = tagsToPrepare[tagIndex];
      if (tag) {
        prepareNativeCollectionParityRows(tag.rows);
        tagIndex += 1;
        scheduleNext(16);
        return;
      }
      const searchRows = searchRowGroups[searchGroupIndex];
      if (!searchRows) return;
      searchRowIndex = prepareNativeCollectionSearchRows(
        searchRows,
        searchRowIndex,
        128,
      );
      if (searchRowIndex >= searchRows.length) {
        searchGroupIndex += 1;
        searchRowIndex = 0;
      }
      scheduleNext(16);
    };
    // The active grid has committed before effects run. Prepare immutable tag
    // data in short idle slices so a later tag press only gives the one active
    // FlatList an already-sorted card projection. No native views are mounted
    // by this warm-up.
    scheduleNext(96);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      interactionTask?.cancel();
    };
  }, [availableTags, catalogRows]);

  useEffect(() => {
    if (actionMenuPrepared || isLoading || catalogRows.length === 0) return undefined;
    // The action button is present on every collection page. Build its
    // retained native view tree outside the tap, after the active grid has
    // committed, just as Vite keeps its overlay DOM ready and only changes
    // visibility. Its remote images are already prefetched by the anchor.
    let task: ReturnType<typeof runAfterNativeUiInteractions> | null = null;
    const timer = setTimeout(() => {
      task = runAfterNativeUiInteractions(() => setActionMenuPrepared(true));
    }, 700);
    return () => {
      clearTimeout(timer);
      task?.cancel();
    };
  }, [actionMenuPrepared, catalogRows.length, isLoading]);

  const presentSortMenu = useCallback((props: NativeCollectionSortMenuContentProps) => {
    if (hostedSortMenuCloseTimerRef.current) {
      clearTimeout(hostedSortMenuCloseTimerRef.current);
      hostedSortMenuCloseTimerRef.current = null;
    }
    // Vite portals into the existing document instead of creating a second
    // browser window. Host the native overlay at this already-mounted screen
    // root for the same reason: its first gradient frame can commit with the
    // tap while still covering the camera and gesture-bar regions.
    setHostedSortMenu({ ...props, open: true });
  }, []);
  const dismissSortMenu = useCallback(() => {
    setHostedSortMenu((current) => current ? { ...current, open: false } : null);
    if (hostedSortMenuCloseTimerRef.current) {
      clearTimeout(hostedSortMenuCloseTimerRef.current);
    }
    hostedSortMenuCloseTimerRef.current = setTimeout(() => {
      hostedSortMenuCloseTimerRef.current = null;
      setHostedSortMenu(null);
    }, collectionExperienceParityContract.sortMenuMotion.overlayTransitionMs);
  }, []);
  const sortMenuHost = useMemo<NativeCollectionSortMenuHost>(() => ({
    dismiss: dismissSortMenu,
    present: presentSortMenu,
  }), [dismissSortMenu, presentSortMenu]);

  useEffect(() => () => {
    pendingTagMotionRef.current = null;
    if (stagedTagCancelTimerRef.current) clearTimeout(stagedTagCancelTimerRef.current);
    if (sidePanelTagTimerRef.current) clearTimeout(sidePanelTagTimerRef.current);
    stagedTagInteractionReleaseRef.current?.();
    stagedTagInteractionReleaseRef.current = null;
    if (hostedSortMenuCloseTimerRef.current) {
      clearTimeout(hostedSortMenuCloseTimerRef.current);
      hostedSortMenuCloseTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    markNativeUiPerformance('collection_hub_filter_resolved', {
      activeView,
      requestedTagKey: initialTagKey,
      resolvedTagKey: selectedTag?.key ?? null,
      selectedRowCount: selectedRows.length,
    });
  }, [activeView, initialTagKey, selectedRows.length, selectedTag?.key]);

  useEffect(() => {
    const trace = tagSelectionTraceRef.current;
    if (!trace || trace.key !== selectedTag?.key || activeView !== 'pokemon') return undefined;
    const frame = requestAnimationFrame(() => {
      markNativeUiPerformance('collection_tag_result_painted', {
        interactionLatencyMs: Date.now() - trace.startedAt,
        rowCount: selectedRows.length,
        tagKey: trace.key,
      });
      tagSelectionTraceRef.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [activeView, selectedRows.length, selectedTag?.key]);

  const changeView = useCallback((view: NativePokemonHubView) => {
    // Vite's same-value state update is a no-op. Avoid starting a 300 ms
    // native animation and allocating panel textures when the selected tab is
    // tapped again.
    if (activeViewRef.current === view) return;
    // Commit both Vite animations before session bookkeeping: the underline
    // runs its independent CSS-ease equivalent while the body uses the page
    // transform's custom Bézier.
    headerRef.current?.setView(view);
    sliderRef.current?.setPage(VIEW_ORDER.indexOf(view));
    activeViewRef.current = view;
    setActiveView(view);
    onContextChange?.({ activeView: view });
  }, [onContextChange]);
  const settlePageIndex = useCallback((index: number) => {
    const view = VIEW_ORDER[index] ?? 'pokemon';
    headerRef.current?.setView(view);
    activeViewRef.current = view;
    setActiveView(view);
    onContextChange?.({ activeView: view });
  }, [onContextChange]);

  const startPendingTagMotion = useCallback(() => {
    const pending = pendingTagMotionRef.current;
    if (!pending) return;
    pendingTagMotionRef.current = null;
    pendingTagMotionReadyRef.current = false;
    if (pending.delaySidePanelTag) {
      // Vite starts this delay with its CSS transform. Keep the old side-panel
      // identity throughout motion and update it after the shared 300 ms.
      sidePanelTagTimerRef.current = setTimeout(() => {
        setSidePanelTagKey(pending.key);
        sidePanelTagTimerRef.current = null;
      }, NATIVE_HORIZONTAL_PAGE_TRANSITION_MS);
    }
    markNativeUiPerformance('collection_tag_slide_started', {
      interactionLatencyMs: Date.now() - pending.startedAt,
      tagKey: pending.key,
    });
    if (pending.touchStartedAt !== null) {
      markNativeUiPerformance('collection_tag_touch_to_slide_started', {
        interactionLatencyMs: Date.now() - pending.touchStartedAt,
        tagKey: pending.key,
      });
    }
    headerRef.current?.setView('pokemon', pending.startedAt);
    sliderRef.current?.setPage(VIEW_ORDER.indexOf('pokemon'));
  }, []);

  useLayoutEffect(() => {
    const pending = pendingTagMotionRef.current;
    if (
      !pending
      || !pendingTagMotionReadyRef.current
      || activeView !== 'pokemon'
      || selectedTag?.key !== pending.key
    ) return;
    startPendingTagMotion();
  }, [activeView, selectedTag?.key, startPendingTagMotion]);

  const commitCollectionRows = useCallback((
    visibleRowCount: number,
    committedQuery: string,
  ) => {
    if (stagedTagKeyRef.current && !pendingTagMotionRef.current) {
      stagedTagReadyRef.current = true;
      stagedVisibleRowCountRef.current = visibleRowCount;
      return;
    }
    // Filter tiles stage their immutable result into the concealed grid during
    // press-in. Do not publish its count or performance result until onPress
    // adopts the same query; the visible search UI remains unchanged if the
    // press turns into a vertical drag and is cancelled.
    if (committedQuery !== query) return;
    if (query.trim()) {
      setVisibleCollectionCount((current) => (
        current === visibleRowCount ? current : visibleRowCount
      ));
      const trace = querySelectionTraceRef.current;
      if (trace?.query === query) {
        querySelectionTraceRef.current = null;
        requestAnimationFrame(() => {
          markNativeUiPerformance(trace.event, {
            interactionLatencyMs: Date.now() - trace.startedAt,
            query: trace.query,
            rowCount: visibleRowCount,
          });
        });
      }
    }
    startPendingTagMotion();
  }, [query, startPendingTagMotion]);

  const changeQuery = useCallback((
    nextQuery: string,
    source: 'filter' | 'typing' = 'typing',
  ) => {
    if (nextQuery.trim()) {
      const event = source === 'filter'
        ? 'collection_query_result_painted'
        : 'collection_typed_query_result_painted';
      querySelectionTraceRef.current = {
        event,
        query: nextQuery,
        startedAt: Date.now(),
      };
      markNativeUiPerformance('collection_query_changed', { query: nextQuery, source });
    } else {
      querySelectionTraceRef.current = null;
    }
    setQuery(nextQuery);
    onContextChange?.({ query: nextQuery, scrollOffset: 0 });
  }, [onContextChange]);

  const previewTag = useCallback((tag: NativeTagSummary) => {
    if (
      activeViewRef.current === 'pokemon'
      || selectedTagKeyRef.current === tag.key
      || stagedTagKeyRef.current === tag.key
    ) return;
    if (stagedTagCancelTimerRef.current) {
      clearTimeout(stagedTagCancelTimerRef.current);
      stagedTagCancelTimerRef.current = null;
    }
    stagedTagInteractionReleaseRef.current?.();
    stagedTagInteractionReleaseRef.current = beginNativeUiInteraction();
    stagedTagPreviewStartedAtRef.current = Date.now();
    markNativeUiPerformance('collection_tag_preview_started', {
      rowCount: tag.rows.length,
      tagKey: tag.key,
    });
    // Pressable reports press-in before release. Use that otherwise idle finger
    // interval to reconcile the hidden middle grid, exactly as Vite keeps its
    // offscreen DOM ready. No selected-tag or page state changes yet, so a
    // cancelled press cannot navigate or alter the visible tag panel.
    collectionSurfaceRef.current?.resetScroll();
    stagedTagKeyRef.current = tag.key;
    stagedTagReadyRef.current = false;
    stagedVisibleRowCountRef.current = 0;
    setStagedTagKey(tag.key);
  }, []);

  const cancelTagPreview = useCallback((tag: NativeTagSummary) => {
    if (stagedTagCancelTimerRef.current) clearTimeout(stagedTagCancelTimerRef.current);
    // RN dispatches press-out immediately before onPress for a successful tap.
    // Defer cancellation one turn so onPress can adopt the staged rows first.
    stagedTagCancelTimerRef.current = setTimeout(() => {
      stagedTagCancelTimerRef.current = null;
      if (stagedTagKeyRef.current !== tag.key) return;
      stagedTagKeyRef.current = null;
      stagedTagReadyRef.current = false;
      stagedVisibleRowCountRef.current = 0;
      stagedTagPreviewStartedAtRef.current = null;
      setStagedTagKey(null);
      stagedTagInteractionReleaseRef.current?.();
      stagedTagInteractionReleaseRef.current = null;
    }, 0);
  }, []);

  const selectTag = useCallback((tag: NativeTagSummary) => {
    const startedAt = Date.now();
    const favoriteSort = tag.key === 'system:favorites'
      ? { sort: 'favorite' as const, sortDirection: 'descending' as const }
      : {};
    // Apply only on a confirmed tap, including reopening the same Favorites
    // tag after a manual sort. A cancelled press must preserve the current sort.
    const sortChanged = tag.key === 'system:favorites'
      && collectionSurfaceRef.current?.applySort('favorite', 'descending');
    const touchStartedAt = stagedTagPreviewStartedAtRef.current;
    tagSelectionTraceRef.current = { key: tag.key, startedAt };
    if (stagedTagCancelTimerRef.current) {
      clearTimeout(stagedTagCancelTimerRef.current);
      stagedTagCancelTimerRef.current = null;
    }
    const stagedDestinationAlreadyCommitted = (
      stagedTagKeyRef.current === tag.key && stagedTagReadyRef.current
    );
    const destinationAlreadyCommitted = !sortChanged && (
      stagedDestinationAlreadyCommitted || selectedTagKeyRef.current === tag.key
    );
    markNativeUiPerformance('collection_tag_pressed', {
      destinationAlreadyCommitted,
      previewLeadMs: stagedTagPreviewStartedAtRef.current === null
        ? null
        : startedAt - stagedTagPreviewStartedAtRef.current,
      rowCount: tag.rows.length,
      tagKey: tag.key,
    });
    const stagedVisibleRowCount = stagedVisibleRowCountRef.current;
    stagedTagKeyRef.current = null;
    stagedTagReadyRef.current = false;
    stagedVisibleRowCountRef.current = 0;
    stagedTagPreviewStartedAtRef.current = null;
    setStagedTagKey(null);
    if (stagedDestinationAlreadyCommitted && query.trim()) {
      setVisibleCollectionCount(stagedVisibleRowCount);
    }
    if (sidePanelTagTimerRef.current) {
      clearTimeout(sidePanelTagTimerRef.current);
      sidePanelTagTimerRef.current = null;
    }
    const delaySidePanelTag = activeViewRef.current !== 'pokemon';
    if (!delaySidePanelTag) {
      setSidePanelTagKey(tag.key);
    }
    // Vite changes the immutable data projection in its one virtualized grid,
    // then starts the compositor slide. Native follows that same order: the
    // cached tag projection and the UI-thread track enter one native commit.
    // Keeping one grid avoids hundreds of image/card views from
    // invisible prewarmed lists competing with the animation.
    // Reset the already-mounted offscreen grid before changing its data. This
    // prevents FlatList from reconciling both a previously scrolled window and
    // its pinned top window, then discarding the former in a layout effect.
    collectionSurfaceRef.current?.resetScroll();
    const pokemonIndex = VIEW_ORDER.indexOf('pokemon');
    // Reserve the destination so the state commit can update the middle grid
    // before its layout effect begins motion.
    sliderRef.current?.preparePage(pokemonIndex);
    // preparePage has now reserved the complete track animation. Hand off the
    // press-in reservation so background cache/image work stays paused without
    // leaving two overlapping scheduler holds alive for the same gesture.
    stagedTagInteractionReleaseRef.current?.();
    stagedTagInteractionReleaseRef.current = null;
    pendingTagMotionRef.current = {
      delaySidePanelTag,
      key: tag.key,
      startedAt,
      touchStartedAt,
    };
    pendingTagMotionReadyRef.current = destinationAlreadyCommitted;
    // Press-in has already reconciled this tag into the concealed middle
    // grid. Start the UI-thread transform directly on release instead of
    // spending another one-to-three frames waiting for the selected-tag/header
    // bookkeeping commit. The rendered destination remains the staged tag
    // until React atomically adopts the identical selected tag below.
    if (destinationAlreadyCommitted) startPendingTagMotion();
    if (selectedCountRef.current > 0) setSelectedIds(new Set());

    if (selectedTagKeyRef.current === tag.key) {
      activeViewRef.current = 'pokemon';
      setActiveView('pokemon');
      onContextChange?.({ activeView: 'pokemon', scrollOffset: 0, ...favoriteSort });
      return;
    }

    // Match Vite's handleTagSelect: commit the filter and destination in one
    // update. The slider's layout effect begins the native-driven page motion
    // immediately after that commit; no list-layout readiness gate sits in
    // front of the interaction.
    selectedTagKeyRef.current = tag.key;
    setSelectedTagKey(tag.key);
    activeViewRef.current = 'pokemon';
    setActiveView('pokemon');
    onContextChange?.({
      activeView: 'pokemon',
      selectedTagKey: tag.key,
      scrollOffset: 0,
      ...favoriteSort,
    });
  }, [onContextChange, query, startPendingTagMotion]);

  const toggleSelection = useCallback((entryId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  }, []);
  const openEntry = useCallback((
    row: NativeCollectionRow,
    orderedRows: NativeCollectionRow[],
  ) => {
    markNativeUiPerformance('collection_card_pressed', {
      entryId: row.id,
      rowSource: row.source,
      selectedCount: selectedCountRef.current,
    });
    if (selectedCountRef.current > 0 || row.source === 'catalog') {
      toggleSelection(row.id);
      return;
    }
    onOpenEntry(
      row,
      orderedRows.filter((candidate) => candidate.source !== 'catalog'),
    );
  }, [onOpenEntry, toggleSelection]);
  const longPressEntry = useCallback((row: NativeCollectionRow) => {
    selectionRequestStartedAtRef.current = Date.now();
    markNativeUiPerformance('collection_selection_requested', { entryId: row.id });
    toggleSelection(row.id);
  }, [toggleSelection]);
  useLayoutEffect(() => {
    if (selectedIds.size === 0 || selectionRequestStartedAtRef.current === null) {
      return undefined;
    }
    const startedAt = selectionRequestStartedAtRef.current;
    selectionRequestStartedAtRef.current = null;
    const frame = requestAnimationFrame(() => {
      markNativeUiPerformance('collection_selection_painted', {
        interactionLatencyMs: Date.now() - startedAt,
        selectedCount: selectedIds.size,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedIds.size]);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);
  const selectAll = useCallback(
    () => setSelectedIds(new Set(selectedRowsRef.current.map((row) => row.id))),
    [],
  );

  const requestClearTag = useCallback(() => {
    if (requireTagSelection || !selectedTagKeyRef.current) return;
    clearTagRequestStartedAtRef.current = Date.now();
    markNativeUiPerformance('collection_clear_tag_dialog_requested');
    setClearTagConfirmationOpen(true);
  }, [requireTagSelection]);
  useLayoutEffect(() => {
    if (!clearTagConfirmationOpen || clearTagRequestStartedAtRef.current === null) {
      return undefined;
    }
    const startedAt = clearTagRequestStartedAtRef.current;
    clearTagRequestStartedAtRef.current = null;
    const frame = requestAnimationFrame(() => {
      markNativeUiPerformance('collection_clear_tag_dialog_painted', {
        interactionLatencyMs: Date.now() - startedAt,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [clearTagConfirmationOpen]);
  const confirmClearTag = useCallback(() => {
    if (requireTagSelection) return;
    setClearTagConfirmationOpen(false);
    setSelectedIds(new Set());
    if (sidePanelTagTimerRef.current) {
      clearTimeout(sidePanelTagTimerRef.current);
      sidePanelTagTimerRef.current = null;
    }
    setSidePanelTagKey(null);
    selectedTagKeyRef.current = null;
    setSelectedTagKey(null);
    onContextChange?.({ selectedTagKey: null, scrollOffset: 0 });
  }, [onContextChange, requireTagSelection]);
  const openActionMenu = useCallback(() => {
    actionMenuRequestStartedAtRef.current = Date.now();
    markNativeUiPerformance('action_menu_surface_requested', { route: 'collection' });
    setActionMenuPrepared(true);
    setActionMenuOpen(true);
  }, []);
  useLayoutEffect(() => {
    if (!actionMenuOpen || actionMenuRequestStartedAtRef.current === null) return undefined;
    const startedAt = actionMenuRequestStartedAtRef.current;
    actionMenuRequestStartedAtRef.current = null;
    const frame = requestAnimationFrame(() => {
      markNativeUiPerformance('action_menu_surface_painted', {
        interactionLatencyMs: Date.now() - startedAt,
        route: 'collection',
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [actionMenuOpen]);
  const openOrganizer = useCallback(() => {
    organizerRequestStartedAtRef.current = Date.now();
    markNativeUiPerformance('collection_organizer_requested', {
      selectedCount: selectedCountRef.current,
    });
    setOrganizerPrepared(true);
    setOrganizerOpen(true);
  }, []);
  useLayoutEffect(() => {
    if (!organizerOpen || organizerRequestStartedAtRef.current === null) return undefined;
    const startedAt = organizerRequestStartedAtRef.current;
    organizerRequestStartedAtRef.current = null;
    const frame = requestAnimationFrame(() => {
      markNativeUiPerformance('collection_organizer_painted', {
        interactionLatencyMs: Date.now() - startedAt,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [organizerOpen]);
  useEffect(() => {
    if (!operationNotice) return undefined;
    const timer = setTimeout(() => setOperationNotice(null), 4200);
    return () => clearTimeout(timer);
  }, [operationNotice]);
  const inventoryPanel = useMemo(() => (
    <NativeTagsPanelScreen
      key="inventory"
      isActive={activeView === 'inventory'}
      activeTagName={null}
      assetBaseUrl={assetBaseUrl}
      collectionCount={inventoryCount}
      error={error}
      warning={warning}
      isLoading={isLoading}
      onRetry={onRetry}
      onCreateTag={onCreateTag}
      onDeleteTag={onDeleteTag}
      onSaveOrder={onSaveTagOrder}
      onSelectTag={selectTag}
      onPreviewTag={previewTag}
      onCancelPreviewTag={cancelTagPreview}
      onUpdateTag={onUpdateTag}
      onViewChange={changeView}
      parent="caught"
      isEditable={tagEditingEnabled}
      isSaving={isSavingTags}
      showHeader={false}
      tags={inventoryTags}
    />
  ), [
    assetBaseUrl,
    changeView,
    error,
    inventoryCount,
    inventoryTags,
    activeView,
    isLoading,
    onRetry,
    previewTag,
    cancelTagPreview,
    onCreateTag,
    onDeleteTag,
    onSaveTagOrder,
    onUpdateTag,
    isSavingTags,
    tagEditingEnabled,
    selectTag,
    warning,
  ]);
  const pokemonPanel = useMemo(() => (
    <NativeCollectionParityScreen
      key="pokemon"
      activeTag={collectionTag}
      assetBaseUrl={assetBaseUrl}
      rows={collectionRows}
      searchUniverseRows={catalogRows}
      query={query}
      ref={collectionSurfaceRef}
      initialScrollOffset={initialScrollOffset}
      initialShowEvolutionaryLine={initialShowEvolutionaryLine}
      initialSort={initialSort}
      initialSortDirection={initialSortDirection}
      isLoading={isLoading}
      error={error}
      onQueryChange={changeQuery}
      onRetry={onRetry}
      onClearTag={requestClearTag}
      onViewChange={changeView}
      onOpenInstance={openEntry}
      onLongPressInstance={longPressEntry}
      showHeader={false}
      selectedIds={selectedIds}
      onClearSelection={clearSelection}
      onSelectAll={selectAll}
      onSelectionActionPress={openOrganizer}
      selectionAction={selectedRowsAreCatalog ? 'add' : 'organize'}
      tagCanClear={!requireTagSelection}
      onContextChange={onContextChange}
      onRowsCommitted={commitCollectionRows}
      sortMenuHost={sortMenuHost}
    />
  ), [
    assetBaseUrl,
    changeView,
    requestClearTag,
    error,
    isLoading,
    onRetry,
    openEntry,
    query,
    changeQuery,
    catalogRows,
    collectionRows,
    collectionTag,
    selectedIds,
    selectedRowsAreCatalog,
    clearSelection,
    selectAll,
    requireTagSelection,
    longPressEntry,
    initialScrollOffset,
    initialShowEvolutionaryLine,
    initialSort,
    initialSortDirection,
    onContextChange,
    commitCollectionRows,
    openOrganizer,
    sortMenuHost,
  ]);
  const wishlistPanel = useMemo(() => (
    <NativeTagsPanelScreen
      key="wishlist"
      isActive={activeView === 'wishlist'}
      activeTagName={null}
      assetBaseUrl={assetBaseUrl}
      collectionCount={inventoryCount}
      error={error}
      isLoading={isLoading}
      onRetry={onRetry}
      onCreateTag={onCreateTag}
      onDeleteTag={onDeleteTag}
      onSaveOrder={onSaveTagOrder}
      onSelectTag={selectTag}
      onPreviewTag={previewTag}
      onCancelPreviewTag={cancelTagPreview}
      onUpdateTag={onUpdateTag}
      onViewChange={changeView}
      parent="wanted"
      isEditable={tagEditingEnabled}
      isSaving={isSavingTags}
      showHeader={false}
      tags={wishlistTags}
      warning={warning}
    />
  ), [
    assetBaseUrl,
    changeView,
    error,
    inventoryCount,
    isLoading,
    onRetry,
    previewTag,
    cancelTagPreview,
    onCreateTag,
    onDeleteTag,
    onSaveTagOrder,
    onUpdateTag,
    isSavingTags,
    tagEditingEnabled,
    selectTag,
    warning,
    wishlistTags,
    activeView,
  ]);
  // Multiple JSX children normally allocate a new array on every Hub render,
  // which defeats NativeHorizontalPageSlider's memo even when every panel is
  // unchanged. Preserve the exact children reference so overlays, notices,
  // and delayed header-label updates cannot reconcile the paging surface.
  const pagePanels = useMemo(
    () => [inventoryPanel, pokemonPanel, wishlistPanel],
    [inventoryPanel, pokemonPanel, wishlistPanel],
  );

  return (
    <View style={[styles.screen, { backgroundColor: background }]} testID="native-collection-hub">
      <NativePokemonHubHeader
        activeTag={sidePanelTag?.filterName ?? sidePanelTag?.name ?? null}
        activeTagParent={sidePanelTag?.parent ?? null}
        activeView={activeView}
        backgroundColor={background}
        collectionCount={query.trim() ? visibleCollectionCount : selectedRows.length}
        inactiveTextColor={palette.headerInactive}
        onViewChange={changeView}
        ref={headerRef}
        selectionBackgroundColor={light ? '#e3f7dc' : '#34807d'}
        selectionCount={selectedIds.size}
        onClearSelection={clearSelection}
        onSelectAll={selectAll}
        secondaryTextColor={secondary}
        textColor={text}
        catalogOwner={catalogOwner}
        onReturnToContext={onReturnToContext}
      />
      {syncStatus}
      {operationNotice ? (
        <View accessibilityLiveRegion="polite" style={styles.noticeBanner}>
          <Text style={styles.noticeText}>{operationNotice}</Text>
        </View>
      ) : null}
      <NativeHorizontalPageSlider
        activeIndex={activeIndex}
        onIndexChange={settlePageIndex}
        ref={sliderRef}
        scrollX={pageScrollX}
        dragX={pageDragX}
      >
        {pagePanels}
      </NativeHorizontalPageSlider>
      {selectedIds.size === 0 ? (
        <NativeActionMenuAnchor
          assetBaseUrl={assetBaseUrl}
          onPress={openActionMenu}
        />
      ) : null}
      {actionMenuPrepared ? (
        <NativeActionMenu
          assetBaseUrl={assetBaseUrl}
          onClose={() => setActionMenuOpen(false)}
          onNavigate={(path) => {
            setActionMenuOpen(false);
            if (path === '/pokemon') return;
            if (onActionMenuNavigate) onActionMenuNavigate(path);
          }}
          signedIn={signedIn}
          visible={actionMenuOpen}
        />
      ) : null}
      {onOrganizePokemon && organizerPrepared && selectedOrganizerRows.length > 0 ? (
        <NativePokemonOrganizerSheet
          error={organizerError}
          inventoryTags={inventoryTags}
          instances={instances}
          isSaving={isOrganizingPokemon}
          onApply={async (request) => {
            try {
              const result = await onOrganizePokemon(request);
              setOrganizerOpen(false);
              setSelectedIds(new Set());
              setOperationNotice(result.message);
            } catch {
              // The mutation error is rendered inside the still-open organizer.
            }
          }}
          onCreateTag={onCreateTag}
          onClose={() => setOrganizerOpen(false)}
          rows={selectedOrganizerRows}
          visible={organizerOpen}
          wishlistTags={wishlistTags}
        />
      ) : null}
      {clearTagConfirmationOpen ? (
        <NativeConfirmationDialog
          body={buildClearActiveTagMessage(
            selectedTag?.filterName ?? selectedTag?.name ?? 'selected',
          )}
          confirmLabel={collectionExperienceParityContract.clearTagConfirmation.confirmLabel}
          onCancel={() => setClearTagConfirmationOpen(false)}
          onConfirm={confirmClearTag}
          title={collectionExperienceParityContract.clearTagConfirmation.title}
          visible
          presentation="inline"
        />
      ) : null}
      {hostedSortMenu ? (
        <NativeCollectionSortMenu
          {...hostedSortMenu}
          presentation="inline"
          visible
        />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: 0 },
  noticeBanner: {
    position: 'absolute',
    zIndex: 40,
    top: 74,
    right: 12,
    left: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2fc17d',
    borderRadius: 12,
    padding: 11,
    backgroundColor: '#123c2c',
  },
  noticeText: { color: '#c9ffe4', fontSize: 13, fontWeight: '900', textAlign: 'center' },
});
