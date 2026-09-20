import React, { useMemo, useState } from 'react';
import './TradeTargetsList.css';
import useSortManager from '@/hooks/sort/useSortManager';
import { useViewportBelow, VIEWPORT_BREAKPOINTS } from '@/hooks/useViewport';
import type { SortMode, SortType } from '@/types/sort';
import type { PokemonVariant } from '@/types/pokemonVariants';
import TradeTargetListItem from './TradeTargetListItem';
import {
  filterVisibleTradeTargetEntries,
  resolveTradeTargetContainerClass,
  toTradeTargetDisplayItems,
  type LocalPokemonRef,
  type TradeTargetDisplayItem,
  type TradeTargetLists,
} from './tradeTargetsListState';

type BooleanMap = Record<string, boolean>;

interface TradeTargetsListProps {
  pokemon?: LocalPokemonRef;
  lists?: TradeTargetLists;
  localNotWantedList: BooleanMap;
  setLocalNotWantedList: React.Dispatch<React.SetStateAction<BooleanMap>>;
  isMirror: boolean;
  mirrorKey: string | null;
  editMode: boolean;
  toggleReciprocalUpdates: (key: string, updatedNotWanted: boolean) => void;
  sortType: SortType;
  sortMode: SortMode;
  onPokemonClick?: (key: string) => void;
  compact?: boolean;
}

const TradeTargetsList = ({
  pokemon,
  lists,
  localNotWantedList,
  setLocalNotWantedList,
  isMirror,
  mirrorKey,
  editMode,
  toggleReciprocalUpdates,
  sortType,
  sortMode,
  onPokemonClick,
  compact = false,
}: TradeTargetsListProps) => {
  const isSmallScreen = useViewportBelow(VIEWPORT_BREAKPOINTS.desktop);
  const notWantedMap = localNotWantedList || {};
  const [query, setQuery] = useState('');
  const [allowedOnly, setAllowedOnly] = useState(false);
  const [undoSelection, setUndoSelection] = useState<BooleanMap | null>(null);

  const handleNotWantedToggle = (key: string) => {
    if (!editMode) {
      return;
    }

    const updatedNotWanted = !(notWantedMap[key] || false);
    setLocalNotWantedList((prev) => {
      if (updatedNotWanted) {
        return { ...prev, [key]: true };
      }
      const next = { ...prev };
      delete next[key];
      return next;
    });
    toggleReciprocalUpdates(key, updatedNotWanted);
  };

  const wantedEntries = useMemo(
    () => Object.entries(lists?.wanted ?? {}),
    [lists],
  );

  const transformedWantedList: TradeTargetDisplayItem[] = toTradeTargetDisplayItems(
    filterVisibleTradeTargetEntries(
      wantedEntries,
      notWantedMap,
      editMode,
      isMirror,
      mirrorKey,
    ),
    pokemon?.currentImage,
  );

  const sortedWantedListToDisplay = useSortManager(
    transformedWantedList as unknown as PokemonVariant[],
    sortType,
    sortMode,
  ) as unknown as TradeTargetDisplayItem[];

  const finalWantedListToDisplay = (isMirror
    ? transformedWantedList
    : sortedWantedListToDisplay).filter((item) => {
      if (allowedOnly && notWantedMap[item.key]) return false;
      const normalizedQuery = query.trim().toLocaleLowerCase();
      if (!normalizedQuery) return true;
      return `${item.name ?? ''} ${item.species_name ?? ''}`
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    });
  if (!lists || wantedEntries.length === 0) {
    return <div>No Wanted Pokémon are currently selected.</div>;
  }
  if (!editMode && !query.trim() && finalWantedListToDisplay.length === 0) {
    return <div>No Wanted Pokémon are currently selected.</div>;
  }

  const containerClass = resolveTradeTargetContainerClass(
    isMirror,
    finalWantedListToDisplay.length,
  );
  const gridClass = isSmallScreen ? 'max-3-per-row' : '';

  return (
    <>
      {!compact ? <div className="preference-candidate-tools">
        <label>
          <input
            type="search"
            aria-label="Search Wanted Pokémon"
            value={query}
            placeholder="Search Pokémon"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        {editMode ? (
          <>
            <button type="button" onClick={() => setAllowedOnly((value) => !value)}>
              {allowedOnly ? 'Show all' : 'Allowed only'}
            </button>
            <button type="button" onClick={() => {
              setUndoSelection({ ...notWantedMap });
              setLocalNotWantedList({});
            }}>
              Allow all
            </button>
            <button
              type="button"
              onClick={() => {
                setUndoSelection({ ...notWantedMap });
                setLocalNotWantedList(
                  Object.fromEntries(wantedEntries.map(([key]) => [key, true])),
                );
              }}
            >
              Clear all
            </button>
            {undoSelection ? (
              <button
                type="button"
                className="preference-undo-action"
                onClick={() => {
                  setLocalNotWantedList(undoSelection);
                  setUndoSelection(null);
                }}
              >
                Undo
              </button>
            ) : null}
          </>
        ) : null}
      </div> : null}
      {finalWantedListToDisplay.length > 0 ? (
        <div className={`wanted-list-container ${containerClass} ${gridClass}${compact ? ' preference-target-summary__list' : ''}`}>
          {finalWantedListToDisplay.map((wantedPokemon) => (
            <TradeTargetListItem
              key={wantedPokemon.key}
              wantedPokemon={wantedPokemon}
              isNotWanted={Boolean(notWantedMap[wantedPokemon.key])}
              editMode={editMode}
              onPokemonClick={onPokemonClick}
              onNotWantedToggle={handleNotWantedToggle}
            />
          ))}
        </div>
      ) : (
        <p className="preference-candidate-empty">No Pokémon match this view.</p>
      )}
    </>
  );
};

export default TradeTargetsList;
