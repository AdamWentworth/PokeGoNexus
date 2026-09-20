// WantedDetails.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { FaUndoAlt } from 'react-icons/fa';
import './WantedDetails.css';
import '../Trade/TradeTargetsPanel.css';
import { useInstancesStore } from '@/features/instances/store/useInstancesStore';
import TradeListDisplay from './TradeListDisplay';
import TradePreferenceFilters from '../Trade/TradePreferenceFilters';
import PreferenceEditAction from '../Trade/PreferenceEditAction';

import { toggleEditMode } from '../../hooks/useToggleEditModeWanted';
import useImageSelection from '../../utils/useImageSelection';

import {
  EXCLUDE_IMAGES_trade,
  FILTER_NAMES_TRADE,
  INCLUDE_IMAGES_trade,
} from '../../utils/constants';

import useTradeFiltering from '../../hooks/useTradeFiltering';
import type { Instances } from '@/types/instances';
import type { PokemonVariant } from '@/types/pokemonVariants';
import type { SortMode, SortType } from '@/types/sort';
import { createScopedLogger } from '@/utils/logger';

const log = createScopedLogger('WantedDetails');

type BooleanMap = Record<string, boolean>;
type GenericMap = Record<string, unknown>;
type InstanceReciprocalMap = Record<string, { not_wanted_list?: BooleanMap } | undefined>;
type UpdateDetailsAdapter = (
  keyOrKeysOrMap: string | string[] | Record<string, Record<string, unknown>>,
  patch?: Record<string, unknown>,
) => Promise<void> | void;

interface WantedDetailsListsState {
  trade: Record<string, GenericMap>;
  [key: string]: unknown;
}

const isTradeCandidate = (
  value: unknown,
): value is { is_for_trade?: boolean } =>
  !!value && typeof value === 'object' && 'is_for_trade' in value;

interface WantedDetailsProps {
  pokemon: PokemonVariant & {
    instanceData?: {
      not_trade_list?: BooleanMap;
      trade_filters?: BooleanMap;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  lists: Record<string, Record<string, unknown>>;
  instances: Instances;
  sortType: SortType;
  sortMode: SortMode;
  openTradeOverlay: (pokemon: Record<string, unknown>) => void;
  variants: PokemonVariant[];
  isEditable: boolean;
  onEditingChange?: (editing: boolean) => void;
  summaryMode?: boolean;
}

const WantedDetails: React.FC<WantedDetailsProps> = ({
  pokemon,
  lists,
  instances,
  sortType,
  sortMode,
  openTradeOverlay,
  variants,
  isEditable,
  onEditingChange,
  summaryMode = false,
}) => {
  const instancesMap = instances ?? {};
  // Defensive defaults in case instanceData is not ready yet.
  const not_trade_list = useMemo(
    () => pokemon?.instanceData?.not_trade_list ?? {},
    [pokemon?.instanceData?.not_trade_list],
  );
  const trade_filters = useMemo(
    () => pokemon?.instanceData?.trade_filters ?? {},
    [pokemon?.instanceData?.trade_filters],
  );

  const [editMode, setEditMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    'idle' | 'dirty' | 'saving' | 'saved' | 'error'
  >('idle');
  const [localNotTradeList, setLocalNotTradeList] = useState({ ...not_trade_list });
  const [localTradeFilters, setLocalTradeFilters] = useState({ ...trade_filters });
  const updateDetails = useInstancesStore((s) => s.updateInstanceDetails);

  // Synthesize a top-level "trade" bucket if it doesn’t exist by selecting
  // items from CAUGHT that have is_for_trade = true.
  const listsWithTrade = useMemo(() => {
    const caught = lists?.caught ?? {};
    const trade = lists?.trade ?? Object.fromEntries(
      Object.entries(caught).filter(([, it]) => isTradeCandidate(it) && it.is_for_trade)
    );
    return { ...(lists || {}), trade } as WantedDetailsListsState;
  }, [lists]);

  const [listsState, setListsState] = useState<WantedDetailsListsState>(listsWithTrade);
  useEffect(() => { setListsState(listsWithTrade); }, [listsWithTrade]);

  // Image selection states
  const {
    selectedImages: selectedExcludeImages,
    toggleImageSelection: toggleExcludeImageSelection,
    setSelectedImages: setSelectedExcludeImages
  } = useImageSelection(EXCLUDE_IMAGES_trade);

  const {
    selectedImages: selectedIncludeOnlyImages,
    toggleImageSelection: toggleIncludeOnlyImageSelection,
    setSelectedImages: setSelectedIncludeOnlyImages
  } = useImageSelection(INCLUDE_IMAGES_trade);

  const initializeSelection = (filterNames: string[], filters: Record<string, unknown>) => {
    return filterNames.map((name) => !!filters[name]);
  };

  useEffect(() => {
    if (trade_filters) {
      setSelectedExcludeImages(
        initializeSelection(
          FILTER_NAMES_TRADE.slice(0, EXCLUDE_IMAGES_trade.length),
          trade_filters,
        )
      );
      setSelectedIncludeOnlyImages(
        initializeSelection(
          FILTER_NAMES_TRADE.slice(EXCLUDE_IMAGES_trade.length),
          trade_filters,
        )
      );
    }
  }, [trade_filters, setSelectedExcludeImages, setSelectedIncludeOnlyImages]);

  const {
    filteredTradeList,
    filteredOutPokemon,
    updatedLocalTradeFilters
  } = useTradeFiltering(
    listsState,
    selectedExcludeImages,
    selectedIncludeOnlyImages,
    localTradeFilters,
    setLocalNotTradeList,
    localNotTradeList,
      editMode,
    );

  useEffect(() => {
    setLocalTradeFilters(updatedLocalTradeFilters);
  }, [updatedLocalTradeFilters]);

  useEffect(() => {
    setLocalNotTradeList({ ...(pokemon?.instanceData?.not_trade_list ?? {}) });
  }, [pokemon?.instanceData?.not_trade_list]);

  const persistDetails: UpdateDetailsAdapter = async (...args) => {
    setSaveStatus('saving');
    try {
      await updateDetails(...args);
      setSaveStatus('saved');
    } catch (error) {
      setSaveStatus('error');
      throw error;
    }
  };

  const handleToggleEditMode = () =>
    toggleEditMode({
      editMode,
      setEditMode,
      localNotTradeList,
      setLocalNotTradeList,
      pokemon,
      instances: instances as unknown as InstanceReciprocalMap,
      filteredOutPokemon,
      localTradeFilters,
      updateDetails: persistDetails,
    });

  useEffect(() => {
    onEditingChange?.(editMode);
    if (editMode) setSaveStatus('dirty');
  }, [editMode, onEditingChange]);

  useEffect(() => {
    if (saveStatus !== 'saved') return undefined;
    const timeout = window.setTimeout(() => setSaveStatus('idle'), 1600);
    return () => window.clearTimeout(timeout);
  }, [saveStatus]);

  const [, setPendingUpdates] = useState<Record<string, boolean>>({});

  const toggleReciprocalUpdates = (key: string, updatedNotTrade: boolean) => {
    setPendingUpdates((prev) => ({ ...prev, [key]: updatedNotTrade }));
  };

  const filteredTradeListCount = Object.keys(filteredTradeList || {}).filter(
    (key) => !(localNotTradeList || {})[key]
  ).length;

  const handleResetFilters = () => {
    if (!editMode) return;
    setSelectedExcludeImages(EXCLUDE_IMAGES_trade.map(() => false));
    setSelectedIncludeOnlyImages(INCLUDE_IMAGES_trade.map(() => false));
    setLocalTradeFilters({});
    setLocalNotTradeList({});
  };

  const extractBaseKey = (instanceId: string) => {
    const parts = String(instanceId).split('_');
    parts.pop(); // Remove UUID part if present
    return parts.join('_');
  };

  const handlePokemonClick = (instanceId: string) => {
    const baseKey = extractBaseKey(instanceId);
    const variantData =
      (variants || []).find((variant) => variant.variant_id === baseKey);
    if (!variantData) {
      log.error(`Variant not found for instance id: ${instanceId}`);
      return;
    }
    const instanceEntry = (instancesMap as Record<string, GenericMap>)?.[instanceId];
    if (!instanceEntry) {
      log.error(`Pokemon instance not found for key: ${instanceId}`);
      return;
    }
    const variantRecord = variantData as unknown as Record<string, unknown>;
    const variantOwnership =
      variantRecord.ownershipStatus &&
      typeof variantRecord.ownershipStatus === 'object'
        ? (variantRecord.ownershipStatus as Record<string, unknown>)
        : {};

    const mergedPokemonData = {
      ...variantData,
      variant_id: variantData.variant_id ?? baseKey,
      ownershipStatus: {
        ...variantOwnership,
        ...instanceEntry
      }
    };
    openTradeOverlay(mergedPokemonData);
  };

  if (summaryMode) {
    return (
      <section className="preference-target-summary preference-target-summary--wanted">
        <header>
          <strong>For Trade Pokémon</strong>
          <span>{filteredTradeListCount}</span>
        </header>
        <TradeListDisplay
          pokemon={pokemon}
          lists={{ trade: filteredTradeList || {} }}
          localNotTradeList={localNotTradeList}
          setLocalNotTradeList={setLocalNotTradeList}
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
    <div className="trade-details-root wanted-preferences-root">
      <div className="trade-details-container">
        <div className="trade-details-container__intro">
          <div className="trade-details-container__eyebrow">Wanted preferences</div>
          <h2>For Trade Pokémon</h2>
          <p>Choose which of your For Trade Pokémon can be offered for this wanted entry.</p>
        </div>

        <div className="trade-details-container__filters-panel">
          <div className="top-row">
            {isEditable ? (
              <div className="trade-target-actions">
                <div className="edit-save-container">
                  <PreferenceEditAction
                    editMode={editMode}
                    onToggle={handleToggleEditMode}
                    saveStatus={saveStatus}
                  />
                </div>
              </div>
            ) : null}
            <div className="trade-target-filters-inline">
              <TradePreferenceFilters
                context="trade"
                editMode={editMode}
                selectedExcludeImages={selectedExcludeImages}
                selectedIncludeOnlyImages={selectedIncludeOnlyImages}
                toggleExcludeImageSelection={toggleExcludeImageSelection}
                toggleIncludeOnlyImageSelection={toggleIncludeOnlyImageSelection}
              />
            </div>
          </div>
        </div>

        <div className="trade-details-container__wanted-panel wanted-preferences-offers">
          <div className="trade-details-container__wanted-header">
            <div>
              <h3>For Trade Pokémon</h3>
              <span>
                {filteredTradeListCount} available ·{' '}
                {Object.values(localTradeFilters).filter(Boolean).length === 0
                  ? 'no advanced rules'
                  : `${Object.values(localTradeFilters).filter(Boolean).length} active ${
                    Object.values(localTradeFilters).filter(Boolean).length === 1
                      ? 'rule'
                      : 'rules'
                  }`}
              </span>
            </div>
            {isEditable ? (
              <button
                type="button"
                className={`trade-target-reset-button ${editMode ? 'editable' : ''}`}
                disabled={!editMode}
                onClick={handleResetFilters}
              >
                <FaUndoAlt aria-hidden="true" />
                <span>Reset</span>
              </button>
            ) : null}
          </div>
          <TradeListDisplay
            pokemon={pokemon}
            lists={{ trade: filteredTradeList || {} }}
            localNotTradeList={localNotTradeList}
            setLocalNotTradeList={setLocalNotTradeList}
            editMode={editMode}
            toggleReciprocalUpdates={toggleReciprocalUpdates}
            sortType={sortType}
            sortMode={sortMode}
            onPokemonClick={handlePokemonClick}
          />
        </div>
      </div>
    </div>
  );
};

export default WantedDetails;
