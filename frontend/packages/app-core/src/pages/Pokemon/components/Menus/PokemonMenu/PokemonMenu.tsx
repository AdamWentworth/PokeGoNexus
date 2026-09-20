// src/pages/Pokemon/components/Menus/PokemonMenu/PokemonMenu.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo, useTransition } from 'react';

// Types
import type { PokemonVariant } from '@/types/pokemonVariants';
import type { PokemonInstance } from '@/types/pokemonInstance';
import type { SortType, SortMode } from '@/types/sort';

import PokemonGrid from './PokemonGrid';
import PokedexOverlay from '@/pages/Pokemon/features/pokedex/PokedexOverlay';
import InstanceOverlay from '@/pages/Pokemon/features/instances/InstanceOverlay';
import CustomScrollbar from './CustomScrollbar';
import './PokemonMenu.css';
import ActiveTagFilterChip from '../../ActiveTagFilterChip';
import { useContextBackHandler } from '@/contexts/ContextBackContext';
import { useModal } from '@/contexts/ModalContext';
import { AppLoadingFallback } from '@/contexts/AppLoadingContext';
import SearchUI from './SearchUI';
import SearchMenu from './SearchMenu';
import SortMenu from './SortMenu';

type SelectedPokemon =
  | PokemonVariant
  | { pokemon: PokemonVariant; overlayType: 'instance' };

interface PokemonMenuProps {
  isEditable: boolean;
  sortedPokemons: PokemonVariant[];
  allPokemons: PokemonVariant[];
  loading: boolean;
  selectedPokemon: SelectedPokemon | null;
  setSelectedPokemon: (p: SelectedPokemon | null) => void;
  isFastSelectEnabled: boolean;
  toggleCardHighlight: (key: string) => void;
  highlightedCards: Set<string>;
  tagFilter: string;
  onClearTagFilter?: () => void;
  lists: Record<string, Record<string, unknown>>;
  instances: Record<string, PokemonInstance>;
  sortType: SortType;
  setSortType: React.Dispatch<React.SetStateAction<SortType>>;
  sortMode: SortMode;
  setSortMode: React.Dispatch<React.SetStateAction<SortMode>>;
  variants: PokemonVariant[];
  username: string;
  setIsFastSelectEnabled: (enabled: boolean) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  showEvolutionaryLine: boolean;
  toggleEvolutionaryLine: () => void;
  onSearchMenuStateChange?: (visible: boolean) => void;
  activeView: string;
}

const PokemonMenu: React.FC<PokemonMenuProps> = ({
  isEditable,
  sortedPokemons,
  allPokemons,
  loading,
  selectedPokemon,
  setSelectedPokemon,
  isFastSelectEnabled,
  toggleCardHighlight,
  highlightedCards,
  tagFilter,
  onClearTagFilter,
  lists,
  instances,
  sortType,
  setSortType,
  sortMode,
  setSortMode,
  variants,
  username,
  setIsFastSelectEnabled,
  searchTerm,
  setSearchTerm,
  showEvolutionaryLine,
  toggleEvolutionaryLine,
  onSearchMenuStateChange,
  activeView,
}) => {
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [hasGridCompletedInitialLayout, setHasGridCompletedInitialLayout] = useState(false);
  const { alert } = useModal();

  // Use non-nullable ref for grid container
  const searchAreaRef = useRef<HTMLDivElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null!);

  const [, startTransition] = useTransition();
  const renderablePokemons = useMemo(
    () =>
      sortedPokemons.filter(
        (pokemon): pokemon is PokemonVariant & { currentImage: string } =>
          typeof pokemon.currentImage === 'string' && pokemon.currentImage.length > 0
      ),
    [sortedPokemons]
  );
  const renderableInstancePokemons = useMemo(
    () =>
      renderablePokemons.filter(
        (pokemon) =>
          Boolean(
            pokemon.instanceData &&
              typeof pokemon.instanceData.instance_id === 'string' &&
              pokemon.instanceData.instance_id.length > 0,
          ),
      ),
    [renderablePokemons],
  );

  const handleSelect = useCallback(
    (pokemon: PokemonVariant) => {
      const isInstance = !!pokemon?.instanceData?.instance_id;

      if (!isEditable) {
        setSelectedPokemon(isInstance ? { pokemon, overlayType: 'instance' } : pokemon);
        return;
      }

      // Catalog entries are blueprints for creating collection records, so activating one
      // selects it. Owned instances retain their detail/edit overlay outside selection mode.
      if (isFastSelectEnabled || !isInstance) {
        const key = pokemon.instanceData?.instance_id ?? pokemon.variant_id;
        const was = highlightedCards.has(key);
        toggleCardHighlight(key);

        if (!was && !isFastSelectEnabled) {
          setIsFastSelectEnabled(true);
        } else if (was && highlightedCards.size === 1) {
          setIsFastSelectEnabled(false);
        }
        return;
      }

      if (pokemon.instanceData?.disabled) {
        alert('This Pokémon is fused and disabled until unfused.');
        return;
      }

      setSelectedPokemon({ pokemon, overlayType: 'instance' });
    },
    [
      isEditable,
      isFastSelectEnabled,
      highlightedCards,
      toggleCardHighlight,
      setIsFastSelectEnabled,
      alert,
      setSelectedPokemon,
    ]
  );

  // Dismiss search menu when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchAreaRef.current && !searchAreaRef.current.contains(e.target as Node)) {
        setIsMenuVisible(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleFilterClick = (filter: string) => {
    const newTerm = searchTerm.trim() ? `${searchTerm}&${filter}` : filter;
    setSearchTerm(newTerm);
    searchAreaRef.current?.querySelector('input')?.blur();
    setIsMenuVisible(false);
  };

  const handleSearchChange = useCallback(
    (val: string) => {
      setIsMenuVisible(false);
      startTransition(() => setSearchTerm(val));
    },
    [setSearchTerm]
  );

  const handleGridInitialLayoutReady = useCallback(() => {
    setHasGridCompletedInitialLayout(true);
  }, []);

  useEffect(() => {
    onSearchMenuStateChange?.(isMenuVisible);
  }, [isMenuVisible, onSearchMenuStateChange]);

  useContextBackHandler(
    isMenuVisible,
    () => {
      setIsMenuVisible(false);
      searchAreaRef.current?.querySelector('input')?.blur();
    },
    'pokemon-search-menu',
    'mobile',
  );

  if (loading) return <AppLoadingFallback source="pokemon-menu" />;

  const hasTagFilter = tagFilter.trim().length > 0;
  const containerClassName = [
    'pokemon-container',
    searchTerm.trim() ? 'has-checkbox' : '',
    hasTagFilter ? 'has-tag-filter' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClassName}>
      <header className="search-header" ref={searchAreaRef}>
        <SearchUI
          searchTerm={searchTerm}
          onSearchChange={handleSearchChange}
          showEvolutionaryLine={showEvolutionaryLine}
          toggleEvolutionaryLine={toggleEvolutionaryLine}
          onFocusChange={(focus) => focus && setIsMenuVisible(true)}
          onArrowClick={() => {
            setIsMenuVisible(false);
            setSearchTerm('');
          }}
        />
        {hasTagFilter && (
          <ActiveTagFilterChip
            tagFilter={tagFilter}
            onClearTagFilter={onClearTagFilter}
          />
        )}
        {isMenuVisible && (
          <SearchMenu onFilterClick={handleFilterClick} onCloseMenu={() => setIsMenuVisible(false)} />
        )}
      </header>

      {!isMenuVisible && (
        <div className="grid-wrapper">
          <div className="grid-container" ref={gridContainerRef}>
            <PokemonGrid
              sortedPokemons={renderablePokemons}
              highlightedCards={highlightedCards}
              handleSelect={handleSelect}
              tagFilter={tagFilter}
              sortType={sortType}
              isEditable={isEditable}
              toggleCardHighlight={toggleCardHighlight}
              setIsFastSelectEnabled={setIsFastSelectEnabled}
              isFastSelectEnabled={isFastSelectEnabled}
              variants={variants}
              gridContainerRef={gridContainerRef}
              activeView={activeView}
              enableInitialLayoutLoader={!hasGridCompletedInitialLayout}
              onInitialLayoutReady={handleGridInitialLayoutReady}
            />
          </div>
          <CustomScrollbar containerRef={gridContainerRef} totalItems={renderablePokemons.length} />
        </div>
      )}

      {!highlightedCards.size && (
        <SortMenu
          sortType={sortType}
          setSortType={setSortType}
          sortMode={sortMode}
          setSortMode={setSortMode}
        />
      )}

      {selectedPokemon && 'overlayType' in selectedPokemon && selectedPokemon.overlayType === 'instance' ? (
        <InstanceOverlay
          pokemon={selectedPokemon.pokemon}
          onClose={() => setSelectedPokemon(null)}
          tagFilter={tagFilter}
          lists={lists}
          instances={instances}
          sortType={sortType}
          sortMode={sortMode}
          variants={variants}
          isEditable={isEditable}
          username={username}
          navigationPokemons={renderableInstancePokemons}
          onNavigatePokemon={(nextPokemon) =>
            setSelectedPokemon({ pokemon: nextPokemon as PokemonVariant, overlayType: 'instance' })
          }
        />
      ) : selectedPokemon ? (
        <PokedexOverlay
          pokemon={'overlayType' in selectedPokemon ? selectedPokemon.pokemon : selectedPokemon}
          onClose={() => setSelectedPokemon(null)}
          allPokemons={allPokemons}
          setSelectedPokemon={(p) => setSelectedPokemon(p)}
        />
      ) : null}
    </div>
  );
};

export default React.memo(PokemonMenu);
