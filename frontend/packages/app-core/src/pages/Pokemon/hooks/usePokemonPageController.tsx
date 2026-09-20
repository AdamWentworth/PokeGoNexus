import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Location, NavigateFunction } from 'react-router';

import { useVariantsStore } from '@/features/variants/store/useVariantsStore';
import { useInstancesStore } from '@/features/instances/store/useInstancesStore';
import { useTagsStore } from '@/features/tags/store/useTagsStore';
import { useUserSearchStore } from '@/stores/useUserSearchStore';
import { emptyTagBuckets } from '@/features/tags/utils/initializePokemonTags';
import { useModal } from '@/contexts/ModalContext';
import { useContextBackHandler } from '@/contexts/ContextBackContext';

import type { PokemonVariant } from '@/types/pokemonVariants';
import type {
  InstanceStatus,
  Instances,
  InstanceStatusMutationOutcome,
  InstanceStatusResultPatch,
} from '@/types/instances';
import type { TagBuckets } from '@/types/tags';
import type { SortMode, SortType } from '@/types/sort';
import type { SwipeHandlers } from './useSwipeHandler';
import type { PokemonOverlaySelection } from './useInstanceIdProcessor';
import type {
  MegaSelectionData,
  MegaSelectionResult,
} from '../features/mega/hooks/useMegaPokemonHandler';
import type { FusionSelectionData } from '@/types/fusion';

import useInstanceIdProcessor from './useInstanceIdProcessor';
import useUIControls from './useUIControls';
import useHandleChangeTags, {
  type ConfirmInstanceStatusOptions,
} from '../services/changeInstanceTag/hooks/useHandleChangeTags';
import usePokemonProcessing from './usePokemonProcessing';
import useMegaPokemonHandler from '../features/mega/hooks/useMegaPokemonHandler';
import useFusionPokemonHandler from '../features/fusion/hooks/useFusionPokemonHandler';
import useSwipeHandler from './useSwipeHandler';
import { getNextActiveView } from '../utils/swipeNavigation';
import {
  buildSelectAllIds,
  buildSliderTransform,
  clampDragOffset,
  toInstanceStatus,
  type ActiveView,
} from '../utils/pokemonPageHelpers';
import {
  readPokemonCatalogFilter,
  readPokemonCatalogSearch,
  readPokemonCatalogStateFilter,
} from '../utils/pokemonCatalogNavigation';
import { createScopedLogger } from '@/utils/logger';
import { toCustomTagFilter } from '@/features/tags/utils/customTagSelectors';

const log = createScopedLogger('PokemonPage');
const SIDE_PANEL_TAG_FILTER_SYNC_DELAY_MS = 300;
const DEFAULT_FOREIGN_CATALOG_TAG = 'Caught';

type UsePokemonPageControllerArgs = {
  isOwnCollection: boolean;
  urlUsername?: string;
  location: Location;
  navigate: NavigateFunction;
};

type UsePokemonPageControllerResult = {
  isPageLoading: boolean;
  isUsernamePath: boolean;
  userExists: boolean | null;
  activeView: ActiveView;
  setActiveView: React.Dispatch<React.SetStateAction<ActiveView>>;
  handleListsButtonClick: () => void;
  handleClearTagFilter: () => void;
  sortedPokemons: PokemonVariant[];
  highlightedCards: Set<string>;
  handleClearSelection: () => void;
  handleSelectAll: () => void;
  tagFilter: string;
  sidePanelTagFilter: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  swipeHandlers: SwipeHandlers;
  transform: string;
  isDragging: boolean;
  variants: PokemonVariant[];
  isEditable: boolean;
  selectedPokemon: PokemonOverlaySelection;
  setSelectedPokemon: React.Dispatch<React.SetStateAction<PokemonOverlaySelection>>;
  isFastSelectEnabled: boolean;
  toggleCardHighlight: (pokemonId: string) => void;
  activeTags: TagBuckets;
  instances: Instances;
  sortType: SortType;
  setSortType: React.Dispatch<React.SetStateAction<SortType>>;
  sortMode: SortMode;
  setSortMode: React.Dispatch<React.SetStateAction<SortMode>>;
  displayUsername: string;
  setIsFastSelectEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  showEvolutionaryLine: boolean;
  toggleEvolutionaryLine: () => void;
  handleTagSelect: (filter: string) => void;
  handleConfirmChangeTags: (
    filter: InstanceStatus,
    options?: ConfirmInstanceStatusOptions,
  ) => Promise<InstanceStatusMutationOutcome[]>;
  activeStatusFilter: InstanceStatus | null;
  isUpdating: boolean;
  isMegaSelectionOpen: boolean;
  megaSelectionData: MegaSelectionData | null;
  handleMegaSelectionResolve: (result: MegaSelectionResult) => void;
  handleMegaSelectionReject: (error: unknown) => void;
  isFusionSelectionOpen: boolean;
  fusionSelectionData: FusionSelectionData | null;
  handleFusionSelectionResolve: (
    choice: string,
    leftInstanceId: string,
    rightInstanceId: string,
  ) => Promise<void>;
  closeFusionSelection: () => void;
  handleCreateNewLeft: () => Promise<void>;
  handleCreateNewRight: () => Promise<void>;
  returnToContext?: () => void;
};

export default function usePokemonPageController({
  isOwnCollection,
  urlUsername,
  location,
  navigate,
}: UsePokemonPageControllerArgs): UsePokemonPageControllerResult {
  const isUsernamePath = !isOwnCollection && Boolean(urlUsername);

  const foreignInstances = useInstancesStore((s) => s.foreignInstances);
  const userExists = useUserSearchStore((s) => s.userExists);
  const viewedLoading = useUserSearchStore((s) => s.foreignInstancesLoading);
  const loadForeignProfile = useUserSearchStore((s) => s.loadForeignProfile);
  const canonicalUsername = useUserSearchStore((s) => s.canonicalUsername);

  const variants = useVariantsStore((s) => s.variants);
  const loading = useVariantsStore((s) => s.variantsLoading);
  const updateInstanceStatus = useInstancesStore((s) => s.updateInstanceStatus);
  const updateInstanceDetails = useInstancesStore((s) => s.updateInstanceDetails);
  const { alert } = useModal();
  const contextInstanceData = useInstancesStore((s) => s.instances);

  const tags = useTagsStore((s) => s.tags);
  const customTags = useTagsStore((s) => s.customTags);
  const foreignTags = useTagsStore((s) => s.foreignTags);
  const requestedTagFilter =
    readPokemonCatalogFilter(location.search ?? '') ??
    readPokemonCatalogStateFilter(location.state);
  const requestedSearchTerm = readPokemonCatalogSearch(location.search ?? '');
  const contextBackTo =
    location.state &&
    typeof location.state === 'object' &&
    'contextBackTo' in location.state &&
    typeof location.state.contextBackTo === 'string' &&
    location.state.contextBackTo.startsWith('/')
      ? location.state.contextBackTo
      : null;

  const instances = (isOwnCollection
    ? contextInstanceData
    : foreignInstances || contextInstanceData) as Instances;

  const initialTagFilter =
    requestedTagFilter ?? (isUsernamePath ? DEFAULT_FOREIGN_CATALOG_TAG : '');
  const [tagFilter, setTagFilter] = useState<string>(initialTagFilter);
  const [sidePanelTagFilter, setSidePanelTagFilter] = useState<string>(
    initialTagFilter,
  );
  const [selectedPokemon, setSelectedPokemon] = useState<PokemonOverlaySelection>(null);
  const [hasProcessedInstanceId, setHasProcessedInstanceId] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>(requestedSearchTerm);
  const [activeView, setActiveView] = useState<ActiveView>('pokemon');
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const isOverlayOpen = selectedPokemon !== null;
  const sidePanelTagFilterSyncRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncSidePanelTagFilter = useCallback((nextFilter: string, delay: boolean) => {
    if (sidePanelTagFilterSyncRef.current) {
      clearTimeout(sidePanelTagFilterSyncRef.current);
      sidePanelTagFilterSyncRef.current = null;
    }

    if (!delay) {
      setSidePanelTagFilter(nextFilter);
      return;
    }

    sidePanelTagFilterSyncRef.current = setTimeout(() => {
      setSidePanelTagFilter(nextFilter);
      sidePanelTagFilterSyncRef.current = null;
    }, SIDE_PANEL_TAG_FILTER_SYNC_DELAY_MS);
  }, []);

  useEffect(
    () => () => {
      if (sidePanelTagFilterSyncRef.current) {
        clearTimeout(sidePanelTagFilterSyncRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    setSearchTerm(requestedSearchTerm);
  }, [requestedSearchTerm]);

  const {
    showEvolutionaryLine,
    toggleEvolutionaryLine,
    isFastSelectEnabled,
    setIsFastSelectEnabled,
    sortType,
    setSortType,
    sortMode,
    setSortMode,
    highlightedCards,
    setHighlightedCards,
    toggleCardHighlight,
  } = useUIControls({
    showEvolutionaryLine: false,
    isFastSelectEnabled: false,
    sortType: 'number',
    sortMode: 'ascending',
  });

  useEffect(() => {
    if (!isUsernamePath) return;
    setHighlightedCards(new Set());
    setActiveView('pokemon');
  }, [isUsernamePath, urlUsername, setHighlightedCards]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    log.debug('Active view changed to:', activeView);
  }, [activeView]);

  useEffect(() => {
    if (!isUsernamePath || !urlUsername) return;
    void loadForeignProfile(urlUsername, () => {
      const initialFilter = requestedTagFilter ?? DEFAULT_FOREIGN_CATALOG_TAG;
      setTagFilter(initialFilter);
      syncSidePanelTagFilter(initialFilter, false);
    });
  }, [
    isUsernamePath,
    urlUsername,
    loadForeignProfile,
    requestedTagFilter,
    syncSidePanelTagFilter,
  ]);

  useEffect(() => {
    if (!isUsernamePath || tagFilter.trim()) return;
    setTagFilter(DEFAULT_FOREIGN_CATALOG_TAG);
    syncSidePanelTagFilter(DEFAULT_FOREIGN_CATALOG_TAG, false);
  }, [isUsernamePath, tagFilter, syncSidePanelTagFilter]);

  useEffect(() => {
    if (!requestedTagFilter) return;
    setHighlightedCards(new Set());
    setTagFilter(requestedTagFilter);
    setActiveView('pokemon');
    syncSidePanelTagFilter(requestedTagFilter, false);
  }, [
    requestedTagFilter,
    setHighlightedCards,
    syncSidePanelTagFilter,
  ]);

  const activeTags = useMemo<TagBuckets>(() => {
    if (isUsernamePath) return foreignTags ?? (emptyTagBuckets as TagBuckets);
    const merged: TagBuckets = { ...tags };
    for (const parent of [customTags.caught, customTags.wanted]) {
      for (const bucket of Object.values(parent)) {
        merged[toCustomTagFilter(bucket.tag.tag_id)] = bucket.items;
      }
    }
    return merged;
  }, [customTags, foreignTags, isUsernamePath, tags]);

  const baseVariants = variants;
  const activeStatusFilter = toInstanceStatus(tagFilter);

  const { filteredVariants, sortedPokemons } = usePokemonProcessing(
    baseVariants,
    instances,
    tagFilter,
    activeTags,
    searchTerm,
    showEvolutionaryLine,
    sortType,
    sortMode,
  );

  useInstanceIdProcessor({
    variantsLoading: loading,
    filteredVariants,
    instances,
    location: location as unknown as Parameters<typeof useInstanceIdProcessor>[0]['location'],
    selectedPokemon,
    isOwnCollection,
    hasProcessedInstanceId,
    navigate,
    setSelectedPokemon,
    setHasProcessedInstanceId,
  });

  const handleClearSelection = useCallback(() => {
    setIsFastSelectEnabled(false);
    setHighlightedCards(new Set());
  }, [setIsFastSelectEnabled, setHighlightedCards]);

  const handleSelectAll = useCallback(() => {
    setHighlightedCards(new Set(buildSelectAllIds(sortedPokemons)));
    setIsFastSelectEnabled(true);
  }, [sortedPokemons, setHighlightedCards, setIsFastSelectEnabled]);

  const handleListsButtonClick = useCallback(() => {
    setActiveView((prev) => (prev === 'wishlist' ? 'pokemon' : 'wishlist'));
  }, []);

  const handleClearTagFilter = useCallback(() => {
    const shouldDelaySidePanelUpdate = activeView !== 'pokemon';
    const nextFilter = isUsernamePath
      ? tagFilter.trim() || DEFAULT_FOREIGN_CATALOG_TAG
      : '';
    setHighlightedCards(new Set());
    setTagFilter(nextFilter);
    setActiveView('pokemon');
    syncSidePanelTagFilter(nextFilter, shouldDelaySidePanelUpdate);
  }, [
    activeView,
    isUsernamePath,
    setHighlightedCards,
    syncSidePanelTagFilter,
    tagFilter,
  ]);

  const handleTagSelect = useCallback(
    (filter: string) => {
      const shouldDelaySidePanelUpdate = activeView !== 'pokemon';
      const nextFilter =
        filter.trim() || (isUsernamePath ? DEFAULT_FOREIGN_CATALOG_TAG : '');
      setHighlightedCards(new Set());
      if (nextFilter.toLowerCase() === 'favorites') {
        setSortType('favorite');
        setSortMode('descending');
      }
      setTagFilter(nextFilter);
      setActiveView('pokemon');
      syncSidePanelTagFilter(nextFilter, shouldDelaySidePanelUpdate);
    },
    [activeView, isUsernamePath, setHighlightedCards, setSortMode, setSortType, syncSidePanelTagFilter],
  );

  const setStatusFilter = useCallback((filter: string) => {
    setTagFilter(filter);
    syncSidePanelTagFilter(filter, false);
  }, [syncSidePanelTagFilter]);

  const updateInstanceStatusBatch = useCallback(
    (
      keys: string[],
      filter: InstanceStatus,
      resultPatch?: InstanceStatusResultPatch,
    ) =>
      updateInstanceStatus(keys, filter, (message) => {
        void alert(message);
      }, resultPatch),
    [alert, updateInstanceStatus],
  );

  const {
    promptMegaPokemonSelection,
    isMegaSelectionOpen,
    megaSelectionData,
    handleMegaSelectionResolve,
    handleMegaSelectionReject,
  } = useMegaPokemonHandler();
  const {
    promptFusionPokemonSelection,
    isFusionSelectionOpen,
    fusionSelectionData,
    handleFusionSelectionResolve,
    closeFusionSelection,
    handleCreateNewLeft,
    handleCreateNewRight,
  } = useFusionPokemonHandler();

  const { handleConfirmChangeTags } = useHandleChangeTags({
    setTagFilter: setStatusFilter,
    setHighlightedCards,
    highlightedCards,
    updateInstanceStatus: updateInstanceStatusBatch,
    variants,
    instances,
    updateInstanceDetails,
    setIsUpdating,
    promptMegaPokemonSelection,
    promptFusionPokemonSelection,
    setIsFastSelectEnabled,
  });

  const returnToContext = useCallback(() => {
    if (!contextBackTo) return;
    void navigate(-1);
  }, [contextBackTo, navigate]);

  useContextBackHandler(
    highlightedCards.size > 0,
    handleClearSelection,
    'pokemon-selection',
    'mobile',
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const maxPeekDistance = 0.3;

  useEffect(() => {
    if (!isOverlayOpen) return;
    setDragOffset(0);
    setIsDragging(false);
  }, [isOverlayOpen]);

  const swipeHandlers = useSwipeHandler({
    disabled: isOverlayOpen,
    onSwipe: (dir) => {
      if (dir) setActiveView(getNextActiveView(activeView, dir));
      setDragOffset(0);
      setIsDragging(false);
    },
    onDrag: (dx) => {
      if (!containerRef.current) return;
      const width = containerRef.current.offsetWidth;
      setDragOffset(clampDragOffset(dx, width, maxPeekDistance));
      setIsDragging(true);
    },
  });

  const width =
    containerRef.current?.offsetWidth || (typeof window === 'undefined' ? 0 : window.innerWidth);
  const transform = buildSliderTransform(activeView, dragOffset, width);

  const displayUsername = canonicalUsername || urlUsername || '';
  const isEditable = isOwnCollection;

  const isPageLoading = loading || viewedLoading || isUpdating;

  return {
    isPageLoading,
    isUsernamePath,
    userExists,
    activeView,
    setActiveView,
    handleListsButtonClick,
    handleClearTagFilter,
    sortedPokemons,
    highlightedCards,
    handleClearSelection,
    handleSelectAll,
    tagFilter,
    sidePanelTagFilter,
    containerRef,
    swipeHandlers,
    transform,
    isDragging,
    variants,
    isEditable,
    selectedPokemon,
    setSelectedPokemon,
    isFastSelectEnabled,
    toggleCardHighlight,
    activeTags,
    instances,
    sortType,
    setSortType,
    sortMode,
    setSortMode,
    displayUsername,
    setIsFastSelectEnabled,
    searchTerm,
    setSearchTerm,
    showEvolutionaryLine,
    toggleEvolutionaryLine,
    handleTagSelect,
    handleConfirmChangeTags,
    activeStatusFilter,
    isUpdating,
    isMegaSelectionOpen,
    megaSelectionData,
    handleMegaSelectionResolve,
    handleMegaSelectionReject,
    isFusionSelectionOpen,
    fusionSelectionData,
    handleFusionSelectionResolve,
    closeFusionSelection,
    handleCreateNewLeft,
    handleCreateNewRight,
    returnToContext: contextBackTo ? returnToContext : undefined,
  };
}
