import React, { useMemo, useRef, useState } from 'react';
import {
  FaGlobe,
  FaList,
  FaMapMarkerAlt,
  FaSearch,
  FaSlidersH,
} from 'react-icons/fa';

import { VariantSearchPrimaryInput } from './SearchParameters/VariantSearch';
import AppearanceFilters from './SearchParameters/AppearanceFilters';
import useVariantSearchController from './SearchParameters/useVariantSearchController';
import LocationSearch from './SearchParameters/LocationSearch';
import OwnershipSearch from './SearchParameters/OwnershipSearch';
import SearchFilterSheet, { type FilterSection } from './SearchFilterSheet';
import SelectedPokemonPreview from './SearchParameters/SelectedPokemonPreview';
import './PokemonSearchBar.css';
import { createScopedLogger } from '@/utils/logger';
import type { PokemonVariant } from '@/types/pokemonVariants';
import { type SearchOwnershipMode } from './utils/ownershipMode';
import {
  preparePokemonSearchQuery,
  type Coordinates,
  type IvFilters,
  type PokemonSearchQueryParams,
  type SelectedMoves,
} from './utils/buildPokemonSearchQuery';
import {
  createDefaultPokemonSearchDraft,
  type PokemonSearchDraft,
  type SearchView,
} from './searchSessionCache';

type PokemonSearchBarProps = {
  onSearch: (
    queryParams: PokemonSearchQueryParams,
    boundaryWKT?: string | null,
    draft?: PokemonSearchDraft,
  ) => void | Promise<void>;
  isLoading: boolean;
  view: SearchView;
  setView: React.Dispatch<React.SetStateAction<SearchView>>;
  pokemonCache: PokemonVariant[] | null;
  initialDraft?: PokemonSearchDraft | null;
};

const log = createScopedLogger('PokemonSearchBar');

const PokemonSearchBar: React.FC<PokemonSearchBarProps> = ({
  onSearch,
  isLoading,
  view,
  setView,
  pokemonCache,
  initialDraft,
}) => {
  const initialSearch = initialDraft ?? createDefaultPokemonSearchDraft();
  const [pokemon, setPokemon] = useState(initialSearch.pokemon);
  const [isShiny, setIsShiny] = useState(initialSearch.isShiny);
  const [isShadow, setIsShadow] = useState(initialSearch.isShadow);
  const [costume, setCostume] = useState<string | null>(initialSearch.costume);
  const [selectedForm, setSelectedForm] = useState(initialSearch.selectedForm);
  const [selectedMoves, setSelectedMoves] = useState<SelectedMoves>(() => ({
    ...initialSearch.selectedMoves,
  }));
  const [selectedGender, setSelectedGender] = useState<string | null>(
    initialSearch.selectedGender,
  );
  const [selectedBackgroundId, setSelectedBackgroundId] = useState<number | null>(
    initialSearch.selectedBackgroundId,
  );
  const [dynamax, setDynamax] = useState(initialSearch.dynamax);
  const [gigantamax, setGigantamax] = useState(initialSearch.gigantamax);
  const [city, setCity] = useState(initialSearch.city);
  const [useCurrentLocation, setUseCurrentLocation] = useState(
    initialSearch.useCurrentLocation,
  );
  const [ownershipMode, setOwnershipMode] =
    useState<SearchOwnershipMode>(initialSearch.ownershipMode);
  const [coordinates, setCoordinates] = useState<Coordinates>(() => ({
    ...initialSearch.coordinates,
  }));
  const [range, setRange] = useState(initialSearch.range);
  const [resultsLimit, setResultsLimit] = useState(initialSearch.resultsLimit);
  const [ivs, setIvs] = useState<IvFilters>(() => ({ ...initialSearch.ivs }));
  const [isHundo, setIsHundo] = useState(initialSearch.isHundo);
  const [onlyMatchingTrades, setOnlyMatchingTrades] = useState(
    initialSearch.onlyMatchingTrades,
  );

  const [prefLucky, setPrefLucky] = useState(initialSearch.prefLucky);
  const [alreadyRegistered, setAlreadyRegistered] = useState(
    initialSearch.alreadyRegistered,
  );
  const [tradeInWantedList, setTradeInWantedList] = useState(
    initialSearch.tradeInWantedList,
  );
  const [friendshipLevel, setFriendshipLevel] = useState(
    initialSearch.friendshipLevel,
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [hasSubmittedSearch, setHasSubmittedSearch] = useState(
    Boolean(initialDraft),
  );
  const [isEditingSubmittedSearch, setIsEditingSubmittedSearch] = useState(false);
  const [initialFilterSection, setInitialFilterSection] =
    useState<FilterSection>('appearance');

  const [errorMessage, setErrorMessage] = useState<string | null>('');
  const [, setSelectedBoundary] = useState<string | null>(null);
  const searchBarRef = useRef<HTMLDivElement | null>(null);
  const variantController = useVariantSearchController({
    pokemon,
    setPokemon,
    isShiny,
    setIsShiny,
    isShadow,
    setIsShadow,
    costume,
    setCostume,
    selectedForm,
    setSelectedForm,
    selectedMoves,
    setSelectedMoves,
    selectedGender,
    setSelectedGender,
    setErrorMessage,
    selectedBackgroundId,
    setSelectedBackgroundId,
    dynamax,
    setDynamax,
    gigantamax,
    setGigantamax,
    pokemonCache,
  });

  const handleSearch = (): boolean => {
    setErrorMessage('');
    const preparedSearch = preparePokemonSearchQuery({
      pokemon,
      selectedForm,
      isShiny,
      isShadow,
      costume,
      selectedMoves,
      selectedGender,
      selectedBackgroundId,
      dynamax,
      gigantamax,
      city,
      useCurrentLocation,
      ownershipMode,
      coordinates,
      range,
      resultsLimit,
      ivs,
      onlyMatchingTrades,
      prefLucky,
      friendshipLevel,
      alreadyRegistered,
      tradeInWantedList,
      pokemonCache,
    });
    if (!preparedSearch.ok) {
      setErrorMessage(preparedSearch.errorMessage);
      if (preparedSearch.shouldExpandSearchBar) {
        setFiltersOpen(true);
      }
      return false;
    }
    const queryParams: PokemonSearchQueryParams = preparedSearch.queryParams;
    const draft: PokemonSearchDraft = {
      pokemon,
      isShiny,
      isShadow,
      costume,
      selectedForm,
      selectedMoves: { ...selectedMoves },
      selectedGender,
      selectedBackgroundId,
      dynamax,
      gigantamax,
      city,
      useCurrentLocation,
      ownershipMode,
      coordinates: { ...coordinates },
      range,
      resultsLimit,
      ivs: { ...ivs },
      isHundo,
      onlyMatchingTrades,
      prefLucky,
      alreadyRegistered,
      tradeInWantedList,
      friendshipLevel,
    };

    log.debug('Search query parameters', queryParams);
    setHasSubmittedSearch(true);
    setIsEditingSubmittedSearch(false);
    void Promise.resolve(onSearch(queryParams, null, draft)).catch((error) => {
      log.error('Search execution failed outside the page handler', error);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return true;
  };

  const locationProps: React.ComponentProps<typeof LocationSearch> = {
    city,
    setCity,
    useCurrentLocation,
    setUseCurrentLocation,
    setCoordinates,
    range,
    setRange,
    resultsLimit,
    setResultsLimit,
    handleSearch: () => {
      void handleSearch();
    },
    isLoading,
    view,
    setView,
    setSelectedBoundary,
    showSearchButton: false,
  };
  const ownershipProps: React.ComponentProps<typeof OwnershipSearch> = {
    ownershipMode,
    setOwnershipMode,
    ivs,
    setIvs,
    isHundo,
    setIsHundo,
    onlyMatchingTrades,
    setOnlyMatchingTrades,
    prefLucky,
    setPrefLucky,
    alreadyRegistered,
    setAlreadyRegistered,
    trade_in_wanted_list: tradeInWantedList,
    setTradeInWantedList,
    friendshipLevel,
    setFriendshipLevel,
  };

  const selectedMoveCount = Object.values(selectedMoves).filter(
    (move) => move != null && move !== '',
  ).length;
  const hasIvFilter =
    isHundo || Object.values(ivs).some((iv) => iv != null && iv !== '');
  const hasActiveFilters = Boolean(
    isShiny ||
      isShadow ||
      costume ||
      selectedForm ||
      selectedMoveCount ||
      (selectedGender && selectedGender !== 'Any') ||
      selectedBackgroundId != null ||
      dynamax ||
      gigantamax ||
      city ||
      useCurrentLocation ||
      range !== 5 ||
      resultsLimit !== 5 ||
      ownershipMode !== 'caught' ||
      hasIvFilter ||
      onlyMatchingTrades ||
      prefLucky ||
      alreadyRegistered ||
      tradeInWantedList ||
      friendshipLevel > 0,
  );

  const ownershipLabel =
    ownershipMode === 'trade'
      ? 'For Trade'
      : ownershipMode === 'wanted'
        ? 'Wanted'
        : 'Caught';
  const locationLabel = useCurrentLocation
    ? 'Current location'
    : city || `Within ${range} km`;
  const compactPokemonLabel = [
    isShiny ? 'Shiny' : '',
    isShadow ? 'Shadow' : '',
    gigantamax ? 'Gigantamax' : dynamax ? 'Dynamax' : '',
    costume || '',
    selectedForm || '',
    pokemon || 'Any Pokémon',
  ]
    .filter(Boolean)
    .join(' ');
  const additionalFilterCount = [
    isShiny,
    isShadow,
    Boolean(costume),
    Boolean(selectedForm),
    selectedMoveCount > 0,
    Boolean(selectedGender && selectedGender !== 'Any'),
    selectedBackgroundId != null,
    dynamax,
    gigantamax,
    resultsLimit !== 5,
    hasIvFilter,
    onlyMatchingTrades,
    prefLucky,
    alreadyRegistered,
    tradeInWantedList,
    friendshipLevel > 0,
  ].filter(Boolean).length;
  const showMobileSearchSummary =
    hasSubmittedSearch && !isEditingSubmittedSearch;

  const filterChips = useMemo(() => {
    const chips: string[] = [];
    if (ownershipMode !== 'caught') {
      chips.push(ownershipMode === 'trade' ? 'For Trade' : 'Wanted');
    }
    if (useCurrentLocation) chips.push('Current location');
    else if (city) chips.push(city);
    else if (range !== 5) chips.push(`Within ${range} km`);
    if (resultsLimit !== 5) chips.push(`${resultsLimit} results`);
    if (isShiny) chips.push('Shiny');
    if (isShadow) chips.push('Shadow');
    if (gigantamax) chips.push('Gigantamax');
    else if (dynamax) chips.push('Dynamax');
    if (selectedForm) chips.push(selectedForm);
    if (costume) chips.push(costume);
    if (selectedGender && selectedGender !== 'Any') chips.push(selectedGender);
    if (selectedMoveCount) {
      chips.push(
        `${selectedMoveCount} move filter${selectedMoveCount === 1 ? '' : 's'}`,
      );
    }
    if (selectedBackgroundId != null) chips.push('Background');
    if (hasIvFilter) chips.push(isHundo ? 'Perfect IV' : 'IV filters');
    if (onlyMatchingTrades) chips.push('Reciprocal matches');
    if (prefLucky) chips.push('Lucky preferred');
    if (alreadyRegistered) chips.push('Registered only');
    if (tradeInWantedList) chips.push('Wanted-list matches');
    if (friendshipLevel > 0) chips.push(`${friendshipLevel}/5 hearts`);
    return chips;
  }, [
    alreadyRegistered,
    city,
    costume,
    dynamax,
    friendshipLevel,
    gigantamax,
    hasIvFilter,
    isHundo,
    isShadow,
    isShiny,
    onlyMatchingTrades,
    ownershipMode,
    prefLucky,
    range,
    resultsLimit,
    selectedBackgroundId,
    selectedForm,
    selectedGender,
    selectedMoveCount,
    tradeInWantedList,
    useCurrentLocation,
  ]);

  const resetFilters = () => {
    variantController.resetVariantFilters();
    setCity('');
    setUseCurrentLocation(false);
    setCoordinates({ latitude: null, longitude: null });
    setRange(5);
    setResultsLimit(5);
    setOwnershipMode('caught');
    setIvs({ Attack: null, Defense: null, Stamina: null });
    setIsHundo(false);
    setOnlyMatchingTrades(false);
    setPrefLucky(false);
    setAlreadyRegistered(false);
    setTradeInWantedList(false);
    setFriendshipLevel(0);
  };

  const handleModifySearch = () => {
    setIsEditingSubmittedSearch(true);
    window.requestAnimationFrame(() => {
      searchBarRef.current
        ?.querySelector<HTMLInputElement>(
          '.search-primary-pokemon-field input[type="text"]',
        )
        ?.focus();
    });
  };

  return (
    <div
      className={`pokemon-search-bar${showMobileSearchSummary ? ' pokemon-search-bar--compact' : ''}`}
      ref={searchBarRef}
    >
      <section
        aria-label="Current Pokémon search"
        aria-live="polite"
        className="search-mobile-summary"
      >
        <SelectedPokemonPreview
          className="search-mobile-summary__preview"
          controller={variantController}
          dynamax={dynamax}
          gigantamax={gigantamax}
          pokemon={pokemon}
        />
        <div className="search-mobile-summary__content">
          <span>Current search</span>
          <strong>{compactPokemonLabel}</strong>
          <div className="search-mobile-summary__meta">
            <span className={`search-mobile-summary__ownership search-mobile-summary__ownership--${ownershipMode}`}>
              {ownershipLabel}
            </span>
            <span>
              <FaMapMarkerAlt aria-hidden="true" />
              {locationLabel}
            </span>
            {additionalFilterCount > 0 ? (
              <span>
                <FaSlidersH aria-hidden="true" />
                {additionalFilterCount}{' '}
                {additionalFilterCount === 1 ? 'filter' : 'filters'}
              </span>
            ) : null}
          </div>
        </div>
        <button
          aria-controls="pokemon-search-primary-controls"
          aria-label="Modify search"
          onClick={handleModifySearch}
          type="button"
        >
          <FaSlidersH aria-hidden="true" />
          Modify
        </button>
      </section>

      <div className="search-primary-surface" id="pokemon-search-primary-controls">
        <VariantSearchPrimaryInput
          controller={variantController}
          dynamax={dynamax}
          gigantamax={gigantamax}
          pokemon={pokemon}
          pokemonCache={pokemonCache}
        />

        <fieldset className="search-primary-ownership">
          <legend>Looking for</legend>
          {(['caught', 'trade', 'wanted'] as const).map((option) => (
            <button
              aria-pressed={ownershipMode === option}
              className={`search-primary-ownership__button search-primary-ownership__button--${option}`}
              key={option}
              onClick={() => setOwnershipMode(option)}
              type="button"
            >
              {option === 'caught'
                ? 'Caught'
                : option === 'trade'
                  ? 'For Trade'
                  : 'Wanted'}
            </button>
          ))}
        </fieldset>

        <button
          className="search-primary-location"
          onClick={() => {
            setInitialFilterSection('location');
            setFiltersOpen(true);
          }}
          type="button"
        >
          <FaMapMarkerAlt aria-hidden="true" />
          <span>
            <small>Location</small>
            <strong>
              {locationLabel}
            </strong>
          </span>
        </button>

        <button
          className="search-primary-filter-button"
          onClick={() => {
            setInitialFilterSection('appearance');
            setFiltersOpen(true);
          }}
          type="button"
        >
          <FaSlidersH aria-hidden="true" />
          Filters
          {hasActiveFilters ? <span aria-label="Filters active">•</span> : null}
        </button>

        <button
          className="search-primary-submit"
          disabled={isLoading}
          onClick={() => void handleSearch()}
          type="button"
        >
          <FaSearch aria-hidden="true" />
          {isLoading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {hasActiveFilters ? (
        <div
          aria-label="Current search filters"
          className="search-filter-summary"
        >
          <div className="search-filter-summary__chips">
            {filterChips.map((chip) => (
              <span key={chip}>{chip}</span>
            ))}
          </div>
          <button onClick={resetFilters} type="button">
            Reset
          </button>
        </div>
      ) : null}

      <div className="search-results-toolbar">
        <div
          className="error-message"
          role={errorMessage && !filtersOpen ? 'alert' : undefined}
        >
          {filtersOpen ? null : errorMessage}
        </div>
        <div className="view-controls">
          <button
            type="button"
            className={`view-button ${view === 'list' ? 'active' : ''}`}
            aria-label="List view"
            onClick={() => setView('list')}
          >
            <FaList aria-hidden="true" />
            <span>List</span>
          </button>
          <button
            type="button"
            className={`view-button ${view === 'map' ? 'active' : ''}`}
            aria-label="Map view"
            onClick={() => setView('map')}
          >
            <FaGlobe aria-hidden="true" />
            <span>Map</span>
          </button>
        </div>
      </div>

      <SearchFilterSheet
        appearance={
          <AppearanceFilters
            controller={variantController}
            costume={costume}
            dynamax={dynamax}
            gigantamax={gigantamax}
            isShadow={isShadow}
            isShiny={isShiny}
            pokemon={pokemon}
            selectedForm={selectedForm}
            selectedGender={selectedGender}
            selectedMoves={selectedMoves}
          />
        }
        canReset={hasActiveFilters}
        errorMessage={errorMessage}
        isLoading={isLoading}
        isOpen={filtersOpen}
        initialSection={initialFilterSection}
        location={<LocationSearch {...locationProps} />}
        matching={<OwnershipSearch {...ownershipProps} />}
        onClose={() => setFiltersOpen(false)}
        onReset={resetFilters}
        onSearch={handleSearch}
      />
    </div>
  );
};

export default PokemonSearchBar;
export type { PokemonSearchQueryParams };
