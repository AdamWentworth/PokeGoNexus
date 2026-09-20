import React, { useState, useEffect } from 'react';
import './TradeTargetsPanel.css';
import { useInstancesStore } from '@/features/instances/store/useInstancesStore';
import type { Instances } from '@/types/instances';
import type { PokemonInstance } from '@/types/pokemonInstance';
import type { PokemonVariant } from '@/types/pokemonVariants';
import type { SortMode, SortType } from '@/types/sort';

import TradeTargetsList from './TradeTargetsList';

import TradeTargetsHeader from './TradeTargetsHeader';
import TradePreferenceFilters from './TradePreferenceFilters';
import MirrorManager from './MirrorManager';
import {
  TradeTargetsIntro,
  TradeTargetsWantedPanel,
} from './TradeTargetsPanelSections';

import useImageSelection from '../../utils/useImageSelection';
import { updateDisplayedList } from '../../utils/listUtils';

import {
  EXCLUDE_IMAGES_wanted,
  INCLUDE_IMAGES_wanted,
  FILTER_NAMES,
} from '../../utils/constants';

import useTradeTargetFiltering from '../../hooks/useTradeTargetFiltering';
import useToggleEditModeTrade from '../../hooks/useToggleEditModeTrade';

import {
  buildWantedOverlayPokemon,
  countVisibleWantedItems,
  initializeSelection,
} from './tradeTargetsHelpers';
import { createScopedLogger } from '@/utils/logger';
import { useViewportBelow, VIEWPORT_BREAKPOINTS } from '@/hooks/useViewport';
import {
  normalizeListsState,
  type TradeTargetsPanelListsState,
} from './tradeTargetsPanelState';

type BooleanMap = Record<string, boolean>;

interface TradeTargetsPanelProps {
  pokemon: PokemonVariant & {
    instanceData: Partial<PokemonInstance> & {
      not_wanted_list?: BooleanMap;
      wanted_filters?: BooleanMap;
      mirror?: boolean;
    };
  };
  lists: Record<string, Record<string, unknown>>;
  instances: Instances;
  sortType: SortType;
  sortMode: SortMode;
  openTradeTargetOverlay: (pokemon: Record<string, unknown>) => void;
  variants: PokemonVariant[];
  isEditable: boolean;
  onEditingChange?: (editing: boolean) => void;
  summaryMode?: boolean;
}

const log = createScopedLogger('TradeTargetsPanel');

const TradeTargetsPanel: React.FC<TradeTargetsPanelProps> = ({
  pokemon,
  lists,
  instances,
  sortType,
  sortMode,
  openTradeTargetOverlay,
  variants,
  isEditable,
  onEditingChange,
  summaryMode = false,
}) => {
  const instancesMap = (instances ?? {}) as Record<string, PokemonInstance>;
  const { not_wanted_list = {}, wanted_filters = {} } = pokemon.instanceData;
  const [localNotWantedList, setLocalNotWantedList] = useState({
    ...not_wanted_list,
  });
  const [localWantedFilters, setLocalWantedFilters] = useState({
    ...wanted_filters,
  });
  const updateDetails = useInstancesStore((s) => s.updateInstanceDetails);
  const [isMirror, setIsMirror] = useState(pokemon.instanceData.mirror);
  const [mirrorKey, setMirrorKey] = useState<string | null>(null);
  const [listsState, setListsState] = useState<TradeTargetsPanelListsState>(
    () => normalizeListsState(lists),
  );
  const [, setPendingUpdates] = useState<Record<string, boolean>>({});
  const [saveStatus, setSaveStatus] = useState<
    'idle' | 'dirty' | 'saving' | 'saved' | 'error'
  >('idle');
  const isSmallScreen = useViewportBelow(VIEWPORT_BREAKPOINTS.desktop);

  const {
    selectedImages: selectedExcludeImages,
    toggleImageSelection: toggleExcludeImageSelection,
    setSelectedImages: setSelectedExcludeImages,
  } = useImageSelection(EXCLUDE_IMAGES_wanted);

  const {
    selectedImages: selectedIncludeOnlyImages,
    toggleImageSelection: toggleIncludeOnlyImageSelection,
    setSelectedImages: setSelectedIncludeOnlyImages,
  } = useImageSelection(INCLUDE_IMAGES_wanted);

  useEffect(() => {
    if (wanted_filters) {
      setSelectedExcludeImages(
        initializeSelection(
          FILTER_NAMES.slice(0, EXCLUDE_IMAGES_wanted.length),
          wanted_filters
        )
      );
      setSelectedIncludeOnlyImages(
        initializeSelection(
          FILTER_NAMES.slice(EXCLUDE_IMAGES_wanted.length),
          wanted_filters
        )
      );
    }
    setIsMirror(pokemon.instanceData.mirror);
  }, [
    pokemon.instanceData.mirror,
    setSelectedExcludeImages,
    setSelectedIncludeOnlyImages,
    wanted_filters,
  ]);

  const tradeTargetFilteringInput =
    listsState as unknown as Parameters<typeof useTradeTargetFiltering>[0];

  const { filteredWantedList, filteredOutPokemon, updatedLocalWantedFilters } =
    useTradeTargetFiltering(
      tradeTargetFilteringInput,
      selectedExcludeImages,
      selectedIncludeOnlyImages,
      localWantedFilters,
      setLocalNotWantedList,
      localNotWantedList,
      false,
    );

  useEffect(() => {
    setLocalWantedFilters(updatedLocalWantedFilters);
  }, [updatedLocalWantedFilters]);

  useEffect(() => {
    setLocalNotWantedList({ ...(pokemon.instanceData.not_wanted_list ?? {}) });
  }, [pokemon.instanceData.not_wanted_list]);

  const persistDetails: typeof updateDetails = async (...args) => {
    setSaveStatus('saving');
    try {
      await updateDetails(...args);
      setSaveStatus('saved');
    } catch (error) {
      setSaveStatus('error');
      throw error;
    }
  };

  const { editMode, toggleEditMode } = useToggleEditModeTrade(
    pokemon,
    isMirror,
    mirrorKey,
    setMirrorKey,
    setIsMirror,
    normalizeListsState(lists),
    listsState,
    (updater) => setListsState((prev) => updater(prev)),
    localNotWantedList,
    setLocalNotWantedList,
    localWantedFilters,
    persistDetails,
    filteredOutPokemon
  );

  useEffect(() => {
    onEditingChange?.(editMode);
    if (editMode) setSaveStatus('dirty');
  }, [editMode, onEditingChange]);

  useEffect(() => {
    if (saveStatus !== 'saved') return undefined;
    const timeout = window.setTimeout(() => setSaveStatus('idle'), 1600);
    return () => window.clearTimeout(timeout);
  }, [saveStatus]);

  const toggleReciprocalUpdates = (key: string, updatedNotTrade: boolean) => {
    setPendingUpdates((prev) => ({ ...prev, [key]: updatedNotTrade }));
  };

  const filteredWantedListCount = countVisibleWantedItems(
    filteredWantedList,
    localNotWantedList,
    {
      editMode,
      isMirror,
      mirrorKey,
    },
  );

  const handlePokemonClick = (instanceId: string) => {
    const merged = buildWantedOverlayPokemon(instanceId, variants, instancesMap);
    if (!merged.ok) {
      if (merged.error === 'variantNotFound') {
        log.error(`Variant not found for instance id: ${instanceId}`);
      } else {
        log.error(`No instance data found for key: ${instanceId}`);
      }
      return;
    }

    openTradeTargetOverlay(merged.pokemon as unknown as Record<string, unknown>);
  };

  const shouldShowFewLayout = isSmallScreen || filteredWantedListCount <= 15;

  const handleResetFilters = () => {
    setSelectedExcludeImages(EXCLUDE_IMAGES_wanted.map(() => false));
    setSelectedIncludeOnlyImages(INCLUDE_IMAGES_wanted.map(() => false));
    setLocalWantedFilters({});
    setLocalNotWantedList({});
  };

  const handleMirrorDisplayedListUpdate = (newData: Record<string, PokemonInstance>) => {
    updateDisplayedList(
      newData,
      localNotWantedList,
      (updater) => setListsState((prev) => updater(prev)),
    );
  };

  if (summaryMode) {
    return (
      <section className="preference-target-summary preference-target-summary--trade">
        <header>
          <strong>Wanted Pokémon</strong>
          <span>{filteredWantedListCount}</span>
        </header>
        <TradeTargetsList
          pokemon={pokemon}
          lists={{ wanted: filteredWantedList }}
          localNotWantedList={localNotWantedList}
          isMirror={isMirror}
          mirrorKey={mirrorKey}
          setLocalNotWantedList={setLocalNotWantedList}
          editMode={false}
          toggleReciprocalUpdates={toggleReciprocalUpdates}
          sortType={sortType}
          sortMode={sortMode}
          compact
        />
      </section>
    );
  }

  return (
    <div className="trade-details-root">
      <div className="trade-details-container">
        <TradeTargetsIntro isMirror={isMirror} />

        <div className="trade-details-container__filters-panel">
          <TradeTargetsHeader
            isMirror={isMirror}
            isEditable={isEditable}
            editMode={editMode}
            shouldShowFewLayout={shouldShowFewLayout}
            filtersSlot={(
              <TradePreferenceFilters
                context="wanted"
                editMode={editMode}
                isMirror={Boolean(isMirror)}
                mirrorControl={(
                  <MirrorManager
                    pokemon={pokemon}
                    instances={instancesMap}
                    lists={lists}
                    isMirror={Boolean(isMirror)}
                    setIsMirror={setIsMirror}
                    setMirrorKey={setMirrorKey}
                    editMode={editMode}
                    updateDisplayedList={handleMirrorDisplayedListUpdate}
                    updateDetails={updateDetails}
                  />
                )}
                selectedExcludeImages={selectedExcludeImages}
                selectedIncludeOnlyImages={selectedIncludeOnlyImages}
                toggleExcludeImageSelection={toggleExcludeImageSelection}
                toggleIncludeOnlyImageSelection={toggleIncludeOnlyImageSelection}
              />
            )}
            toggleEditMode={toggleEditMode}
            saveStatus={saveStatus}
          />
        </div>

        <TradeTargetsWantedPanel
          isMirror={isMirror}
          isEditable={isEditable}
          editMode={editMode}
          visibleCount={filteredWantedListCount}
          activeRuleCount={Object.values(localWantedFilters).filter(Boolean).length}
          onResetFilters={handleResetFilters}
        >
          <TradeTargetsList
            pokemon={pokemon}
            lists={{ wanted: filteredWantedList }}
            localNotWantedList={localNotWantedList}
            isMirror={isMirror}
            mirrorKey={mirrorKey}
            setLocalNotWantedList={setLocalNotWantedList}
            editMode={editMode}
            toggleReciprocalUpdates={toggleReciprocalUpdates}
            sortType={sortType}
            sortMode={sortMode}
            onPokemonClick={(key) => {
              if (!filteredWantedList[key]) return;
              handlePokemonClick(key);
            }}
          />
        </TradeTargetsWantedPanel>
      </div>

    </div>
  );
};

export default TradeTargetsPanel;
