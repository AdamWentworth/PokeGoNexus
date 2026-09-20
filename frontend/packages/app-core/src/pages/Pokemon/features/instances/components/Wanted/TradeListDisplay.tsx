import React, { useMemo, useState } from 'react';
import './TradeListDisplay.css';
import useSortManager from '@/hooks/sort/useSortManager';
import { useViewportBelow, VIEWPORT_BREAKPOINTS } from '@/hooks/useViewport';
import type { SortMode, SortType } from '@/types/sort';
import type { PokemonVariant } from '@/types/pokemonVariants';

type BooleanMap = Record<string, boolean>;

interface ParentPokemonRef {
  currentImage?: string;
  instanceData?: {
    instance_id?: string;
    variant_id?: string;
  };
}

interface TradeEntry {
  pokemon_id?: number;
  name?: string;
  species_name?: string;
  pokedex_number?: number;
  currentImage?: string;
  image_url?: string;
  image_url_shiny?: string;
  variant_id?: string;
  variantType?: string;
  form?: string | null;
  mirror?: boolean;
  [key: string]: unknown;
}

interface TradeDisplayItem extends TradeEntry {
  key: string;
  species_name: string;
}

interface TradeLists {
  trade?: Record<string, TradeEntry>;
}

interface TradeListDisplayProps {
  pokemon?: ParentPokemonRef;
  lists?: TradeLists;
  localNotTradeList: BooleanMap;
  setLocalNotTradeList: React.Dispatch<React.SetStateAction<BooleanMap>>;
  editMode: boolean;
  toggleReciprocalUpdates: (key: string, updatedNotTrade: boolean) => void;
  sortType: SortType;
  sortMode: SortMode;
  onPokemonClick?: (key: string) => void;
  compact?: boolean;
}

const extractBaseKey = (instanceId: string): string => {
  const parts = String(instanceId).split('_');
  parts.pop();
  return parts.join('_');
};

const resolveVariantKey = (
  fullKey: string,
  details?: { variant_id?: unknown } | null,
): string => {
  if (typeof details?.variant_id === 'string' && details.variant_id.length > 0) {
    return details.variant_id;
  }
  return extractBaseKey(fullKey);
};

const TradeListDisplay = ({
  pokemon,
  lists,
  localNotTradeList,
  setLocalNotTradeList,
  editMode,
  toggleReciprocalUpdates,
  sortType,
  sortMode,
  onPokemonClick,
  compact = false,
}: TradeListDisplayProps) => {
  const isSmallScreen = useViewportBelow(VIEWPORT_BREAKPOINTS.desktop);
  const notTradeMap = localNotTradeList || {};
  const [query, setQuery] = useState('');
  const [allowedOnly, setAllowedOnly] = useState(false);
  const [undoSelection, setUndoSelection] = useState<BooleanMap | null>(null);
  const pokemonFullKey = pokemon?.instanceData?.instance_id ?? '';
  const pokemonBaseKey =
    pokemon?.instanceData?.variant_id ?? extractBaseKey(pokemonFullKey);

  const handleNotTradeToggle = (fullKey: string) => {
    if (!editMode) {
      return;
    }

    const updated = !notTradeMap[fullKey];
    setLocalNotTradeList((prev) => ({ ...prev, [fullKey]: updated }));
    toggleReciprocalUpdates(fullKey, updated);
  };

  const tradeEntries = useMemo(
    () => Object.entries(lists?.trade ?? {}),
    [lists],
  );

  const tradeListToDisplay = tradeEntries.filter(([fullKey, details]) => {
    const itemBaseKey = resolveVariantKey(fullKey, details);
    const mirrorOk = !details?.mirror || itemBaseKey === pokemonBaseKey;
    const isHidden =
      Boolean(notTradeMap[fullKey]) || Boolean(notTradeMap[itemBaseKey]);

    return (editMode || !isHidden) && mirrorOk;
  });

  const transformedTradeList: TradeDisplayItem[] = tradeListToDisplay.map(
    ([key, details]) => ({
      ...details,
      key,
      pokemon_id: details?.pokemon_id,
      name: details?.name,
      species_name: details?.species_name ?? details?.name ?? '',
      pokedex_number: details?.pokedex_number,
      image_url: details?.currentImage || pokemon?.currentImage,
      currentImage: details?.currentImage || pokemon?.currentImage,
      image_url_shiny:
        details?.image_url_shiny ||
        details?.currentImage ||
        pokemon?.currentImage,
    }),
  );

  const sortedTradeListToDisplay = (useSortManager(
    transformedTradeList as unknown as PokemonVariant[],
    sortType,
    sortMode,
  ) as unknown as TradeDisplayItem[]).filter((item) => {
    const isNotTrade =
      Boolean(notTradeMap[item.key]) ||
      Boolean(notTradeMap[extractBaseKey(item.key)]);
    if (allowedOnly && isNotTrade) return false;
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return true;
    return `${item.name ?? ''} ${item.species_name ?? ''}`
      .toLocaleLowerCase()
      .includes(normalizedQuery);
  });
  if (!lists || tradeEntries.length === 0) {
    return <div>No Pokemon currently for trade.</div>;
  }
  if (!editMode && !query.trim() && sortedTradeListToDisplay.length === 0) {
    return <div>No Pokemon currently for trade.</div>;
  }

  let containerClass = '';
  if (sortedTradeListToDisplay.length > 30) {
    containerClass = 'xxlarge-list';
  } else if (sortedTradeListToDisplay.length > 15) {
    containerClass = 'xlarge-list';
  } else if (sortedTradeListToDisplay.length > 9) {
    containerClass = 'large-list';
  }

  const gridClass = isSmallScreen ? 'max-3-per-row' : '';

  return (
    <>
      {!compact ? <div className="preference-candidate-tools">
        <label>
          <input
            type="search"
            aria-label="Search offered Pokémon"
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
              setUndoSelection({ ...notTradeMap });
              setLocalNotTradeList({});
            }}>
              Allow all
            </button>
            <button
              type="button"
              onClick={() => {
                setUndoSelection({ ...notTradeMap });
                setLocalNotTradeList(
                  Object.fromEntries(tradeEntries.map(([key]) => [key, true])),
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
                  setLocalNotTradeList(undoSelection);
                  setUndoSelection(null);
                }}
              >
                Undo
              </button>
            ) : null}
          </>
        ) : null}
      </div> : null}
      {sortedTradeListToDisplay.length > 0 ? (
      <div className={`trade-list-container ${containerClass} ${gridClass}${compact ? ' preference-target-summary__list' : ''}`}>
      {sortedTradeListToDisplay.map((tradePokemon) => {
        const isNotTrade =
          Boolean(notTradeMap[tradePokemon.key]) ||
          Boolean(notTradeMap[extractBaseKey(tradePokemon.key)]);
        const imageClasses = `trade-item-img ${isNotTrade ? 'grey-out' : ''}`;
        const displayName = `${tradePokemon.form ? `${tradePokemon.form} ` : ''}${tradePokemon.name ?? 'Pokémon'}`;
        const pokedexLabel = tradePokemon.pokedex_number
          ? `#${String(tradePokemon.pokedex_number).padStart(4, '0')}`
          : null;
        const handleOpenTrade = () => {
          if (!editMode) {
            onPokemonClick?.(tradePokemon.key);
          }
        };
        const isInteractive = !editMode && Boolean(onPokemonClick);

        return (
          <div
            key={tradePokemon.key}
            className={`trade-item ${isNotTrade ? 'is-not-trade' : ''}`}
            onClick={handleOpenTrade}
            role={isInteractive ? 'button' : undefined}
            tabIndex={isInteractive ? 0 : undefined}
            onKeyDown={(event) => {
              if (isInteractive && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                handleOpenTrade();
              }
            }}
          >
            <div className="trade-item__media">
              {tradePokemon.variantType?.includes('dynamax') && (
                <img
                  src="/images/dynamax.png"
                  alt="Dynamax"
                  className="trade-item__max-badge"
                />
              )}

              {tradePokemon.variantType?.includes('gigantamax') && (
                <img
                  src="/images/gigantamax.png"
                  alt="Gigantamax"
                  className="trade-item__max-badge"
                />
              )}

              <img
                src={tradePokemon.image_url ?? tradePokemon.currentImage}
                alt={displayName}
                className={imageClasses}
                title={displayName}
              />

              {editMode && (
                <button
                  type="button"
                  className="toggle-not-trade"
                  aria-label={
                    isNotTrade
                      ? `Allow ${displayName}`
                      : `Remove ${displayName}`
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    handleNotTradeToggle(tradePokemon.key);
                  }}
                >
                  <span aria-hidden="true">{isNotTrade ? '+' : '\u2713'}</span>
                  <span>{isNotTrade ? 'Allow' : 'Allowed'}</span>
                </button>
              )}
            </div>

            <div className="trade-item__body">
              <div className="trade-item__name" title={displayName}>{displayName}</div>
              {pokedexLabel ? <div className="trade-item__meta">{pokedexLabel}</div> : null}
            </div>
          </div>
        );
      })}
      </div>
      ) : (
        <p className="preference-candidate-empty">No Pokémon match this view.</p>
      )}
    </>
  );
};

export default TradeListDisplay;
