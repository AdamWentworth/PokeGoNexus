import React, { useEffect } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import PokemonSearchBar, {
  type PokemonSearchQueryParams,
} from '@/pages/Search/PokemonSearchBar';
import type { SearchOwnershipMode } from '@/pages/Search/utils/ownershipMode';
import type { PokemonVariant } from '@/types/pokemonVariants';
import { createDefaultPokemonSearchDraft } from '@/pages/Search/searchSessionCache';

type SearchView = 'list' | 'map';

type MockConfig = {
  pokemon: string;
  isShiny: boolean;
  isShadow: boolean;
  costume: string;
  selectedForm: string;
  selectedMoves: {
    fastMove: number | string | null;
    chargedMove1: number | string | null;
    chargedMove2: number | string | null;
  };
  selectedGender: string;
  selectedBackgroundId: number | null;
  dynamax: boolean;
  gigantamax: boolean;
  city: string;
  useCurrentLocation: boolean;
  coordinates: {
    latitude: number | null;
    longitude: number | null;
  };
  range: number;
  resultsLimit: number;
  ownershipMode: SearchOwnershipMode;
  ivs: {
    Attack: number | null;
    Defense: number | null;
    Stamina: number | null;
  };
  isHundo: boolean;
  onlyMatchingTrades: boolean;
  prefLucky: boolean;
  alreadyRegistered: boolean;
  tradeInWantedList: boolean;
  friendshipLevel: number;
};

const defaultMockConfig: MockConfig = {
  pokemon: 'Bulbasaur',
  isShiny: false,
  isShadow: false,
  costume: '',
  selectedForm: '',
  selectedMoves: {
    fastMove: null,
    chargedMove1: null,
    chargedMove2: null,
  },
  selectedGender: 'Any',
  selectedBackgroundId: null,
  dynamax: false,
  gigantamax: false,
  city: 'Seattle, WA, USA',
  useCurrentLocation: false,
  coordinates: {
    latitude: 47.6062,
    longitude: -122.3321,
  },
  range: 5,
  resultsLimit: 10,
  ownershipMode: 'caught',
  ivs: {
    Attack: 15,
    Defense: 14,
    Stamina: 13,
  },
  isHundo: false,
  onlyMatchingTrades: false,
  prefLucky: false,
  alreadyRegistered: false,
  tradeInWantedList: false,
  friendshipLevel: 0,
};

let mockConfig: MockConfig = { ...defaultMockConfig };

vi.mock('@/pages/Search/SearchParameters/VariantSearch', () => ({
  default: () => <div data-testid="legacy-variant-search" />,
  VariantSearchPrimaryInput: () => <div data-testid="primary-pokemon-input" />,
}));

vi.mock('@/pages/Search/SearchParameters/AppearanceFilters', () => ({
  default: () => <div data-testid="variant-search" />,
}));

vi.mock('@/pages/Search/SearchParameters/useVariantSearchController', () => ({
  default: ({
    setPokemon,
    setIsShiny,
    setIsShadow,
    setCostume,
    setSelectedForm,
    setSelectedMoves,
    setSelectedGender,
    setSelectedBackgroundId,
    setDynamax,
    setGigantamax,
  }: {
    setPokemon: (value: string) => void;
    setIsShiny: (value: boolean) => void;
    setIsShadow: (value: boolean) => void;
    setCostume: (value: string | null) => void;
    setSelectedForm: (value: string) => void;
    setSelectedMoves: (value: MockConfig['selectedMoves']) => void;
    setSelectedGender: (value: string) => void;
    setSelectedBackgroundId: (value: number | null) => void;
    setDynamax: (value: boolean) => void;
    setGigantamax: (value: boolean) => void;
  }) => {
    useEffect(() => {
      setPokemon(mockConfig.pokemon);
      setIsShiny(mockConfig.isShiny);
      setIsShadow(mockConfig.isShadow);
      setCostume(mockConfig.costume);
      setSelectedForm(mockConfig.selectedForm);
      setSelectedMoves(mockConfig.selectedMoves);
      setSelectedGender(mockConfig.selectedGender);
      setSelectedBackgroundId(mockConfig.selectedBackgroundId);
      setDynamax(mockConfig.dynamax);
      setGigantamax(mockConfig.gigantamax);
    }, [
      setPokemon,
      setIsShiny,
      setIsShadow,
      setCostume,
      setSelectedForm,
      setSelectedMoves,
      setSelectedGender,
      setSelectedBackgroundId,
      setDynamax,
      setGigantamax,
    ]);

    return {
      handleImageError: vi.fn(),
      imageError: false,
      imageUrl: '/images/bulbasaur.png',
      selectedBackground: null,
      resetVariantFilters: () => {
        setIsShiny(false);
        setIsShadow(false);
        setCostume(null);
        setSelectedForm('');
        setSelectedMoves({
          fastMove: null,
          chargedMove1: null,
          chargedMove2: null,
        });
        setSelectedGender('Any');
        setSelectedBackgroundId(null);
        setDynamax(false);
        setGigantamax(false);
      },
    };
  },
}));

vi.mock('@/pages/Search/SearchParameters/OwnershipSearch', () => ({
  default: ({
    setOwnershipMode,
    setIvs,
    setIsHundo,
    setOnlyMatchingTrades,
    setPrefLucky,
    setAlreadyRegistered,
    setTradeInWantedList,
    setFriendshipLevel,
  }: {
    setOwnershipMode: (value: SearchOwnershipMode) => void;
    setIvs: (value: MockConfig['ivs']) => void;
    setIsHundo: (value: boolean) => void;
    setOnlyMatchingTrades: (value: boolean) => void;
    setPrefLucky: (value: boolean) => void;
    setAlreadyRegistered: (value: boolean) => void;
    setTradeInWantedList: (value: boolean) => void;
    setFriendshipLevel: (value: number) => void;
  }) => {
    useEffect(() => {
      setOwnershipMode(mockConfig.ownershipMode);
      setIvs(mockConfig.ivs);
      setIsHundo(mockConfig.isHundo);
      setOnlyMatchingTrades(mockConfig.onlyMatchingTrades);
      setPrefLucky(mockConfig.prefLucky);
      setAlreadyRegistered(mockConfig.alreadyRegistered);
      setTradeInWantedList(mockConfig.tradeInWantedList);
      setFriendshipLevel(mockConfig.friendshipLevel);
    }, [
      setOwnershipMode,
      setIvs,
      setIsHundo,
      setOnlyMatchingTrades,
      setPrefLucky,
      setAlreadyRegistered,
      setTradeInWantedList,
      setFriendshipLevel,
    ]);

    return <div data-testid="ownership-search" />;
  },
}));

vi.mock('@/pages/Search/SearchParameters/LocationSearch', () => ({
  default: ({
    setCity,
    setUseCurrentLocation,
    setCoordinates,
    setRange,
    setResultsLimit,
    handleSearch,
  }: {
    setCity: (value: string) => void;
    setUseCurrentLocation: (value: boolean) => void;
    setCoordinates: (value: MockConfig['coordinates']) => void;
    setRange: (value: number) => void;
    setResultsLimit: (value: number) => void;
    handleSearch: () => Promise<void>;
  }) => {
    useEffect(() => {
      setCity(mockConfig.city);
      setUseCurrentLocation(mockConfig.useCurrentLocation);
      setCoordinates(mockConfig.coordinates);
      setRange(mockConfig.range);
      setResultsLimit(mockConfig.resultsLimit);
    }, [setCity, setUseCurrentLocation, setCoordinates, setRange, setResultsLimit]);

    return (
      <button type="button" onClick={handleSearch}>
        trigger-search
      </button>
    );
  },
}));

const onSearchMock = vi.fn<
  (
    queryParams: PokemonSearchQueryParams,
    boundaryWKT?: string | null,
  ) => Promise<void>
>().mockResolvedValue(undefined);

const setViewMock = vi.fn<(nextValue: React.SetStateAction<SearchView>) => void>();

const pokemonCache = [
  {
    pokemon_id: 1,
    name: 'Bulbasaur',
    form: null,
    costumes: [{ name: 'Party', costume_id: 7 }],
    backgrounds: [
      {
        background_id: 42,
        costume_id: 7,
        image_url: '/images/party-bg.png',
        name: 'Party City',
        location: 'Seattle',
        date: '2025-01-02',
      },
    ],
    max: [],
  },
] as unknown as PokemonVariant[];

describe('PokemonSearchBar', () => {
  beforeAll(() => {
    vi.stubGlobal('scrollTo', vi.fn());
    vi.stubGlobal(
      'ResizeObserver',
      class ResizeObserver {
        observe() {
          return undefined;
        }

        disconnect() {
          return undefined;
        }

        unobserve() {
          return undefined;
        }
      },
    );
  });

  beforeEach(() => {
    mockConfig = {
      ...defaultMockConfig,
      selectedMoves: { ...defaultMockConfig.selectedMoves },
      coordinates: { ...defaultMockConfig.coordinates },
      ivs: { ...defaultMockConfig.ivs },
    };
    onSearchMock.mockClear();
    setViewMock.mockClear();
  });

  const mountAdvancedSearchState = async () => {
    fireEvent.click(screen.getByRole('button', { name: /Filters/ }));
    expect(await screen.findByTestId('variant-search')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Location' }));
    expect(await screen.findByRole('button', { name: 'trigger-search' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Matching' }));
    expect(await screen.findByTestId('ownership-search')).toBeInTheDocument();
  };

  it('keeps advanced controls out of the primary search surface', async () => {
    render(
      <PokemonSearchBar
        onSearch={onSearchMock}
        isLoading={false}
        view="list"
        setView={setViewMock}
        pokemonCache={pokemonCache}
      />,
    );

    expect(screen.getByTestId('primary-pokemon-input')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Caught' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByTestId('variant-search')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Location/ }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'trigger-search' })).toBeInTheDocument();
    expect(screen.queryByTestId('variant-search')).not.toBeInTheDocument();
  });

  it('summarizes active filters and resets them from the compact surface', () => {
    render(
      <PokemonSearchBar
        onSearch={onSearchMock}
        isLoading={false}
        view="list"
        setView={setViewMock}
        pokemonCache={pokemonCache}
      />,
    );

    const caughtButton = screen.getByRole('button', { name: 'Caught' });
    const forTradeButton = screen.getByRole('button', { name: 'For Trade' });
    fireEvent.click(forTradeButton);

    expect(forTradeButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Current search filters')).toHaveTextContent(
      'For Trade',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(caughtButton).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.queryByLabelText('Current search filters'),
    ).not.toBeInTheDocument();
  });

  it('blocks shadow trade/wanted queries before dispatching search', async () => {
    mockConfig.ownershipMode = 'trade';
    mockConfig.isShadow = true;

    render(
      <PokemonSearchBar
        onSearch={onSearchMock}
        isLoading={false}
        view="list"
        setView={setViewMock}
        pokemonCache={pokemonCache}
      />,
    );

    await mountAdvancedSearchState();
    fireEvent.click(screen.getByRole('button', { name: 'Apply and search' }));

    expect(onSearchMock).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog.querySelector('[role="alert"]')).toHaveTextContent(
      'Check these filtersShadow Pokemon cannot be listed for trade or wanted',
    );
    expect(
      screen.getByLabelText('Current Pokémon search').closest('.pokemon-search-bar'),
    ).not.toHaveClass('pokemon-search-bar--compact');
  });

  it('collapses a submitted mobile search into a useful editable summary', async () => {
    render(
      <PokemonSearchBar
        onSearch={onSearchMock}
        isLoading={false}
        view="list"
        setView={setViewMock}
        pokemonCache={pokemonCache}
      />,
    );

    await mountAdvancedSearchState();
    fireEvent.click(screen.getByRole('button', { name: 'Apply and search' }));

    await waitFor(() => {
      expect(onSearchMock).toHaveBeenCalledTimes(1);
    });

    const summary = screen.getByLabelText('Current Pokémon search');
    const searchBar = summary.closest('.pokemon-search-bar');
    expect(searchBar).toHaveClass('pokemon-search-bar--compact');
    expect(summary).toHaveTextContent('Bulbasaur');
    expect(summary).toHaveTextContent('Caught');
    expect(summary).toHaveTextContent('Seattle, WA, USA');
    expect(summary).toHaveTextContent('2 filters');
    expect(screen.getByAltText('Bulbasaur preview')).toHaveAttribute(
      'src',
      '/images/bulbasaur.png',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Modify search' }));
    expect(searchBar).not.toHaveClass('pokemon-search-bar--compact');
  });

  it('restores a cached search directly into its compact submitted state', async () => {
    render(
      <PokemonSearchBar
        initialDraft={{
          ...createDefaultPokemonSearchDraft(),
          pokemon: 'Bulbasaur',
          city: 'Seattle, WA, USA',
          coordinates: { latitude: 47.6062, longitude: -122.3321 },
          resultsLimit: 10,
        }}
        onSearch={onSearchMock}
        isLoading={false}
        view="list"
        setView={setViewMock}
        pokemonCache={pokemonCache}
      />,
    );

    const summary = screen.getByLabelText('Current Pokémon search');
    await waitFor(() => {
      expect(summary.closest('.pokemon-search-bar')).toHaveClass(
        'pokemon-search-bar--compact',
      );
    });
    expect(summary).toHaveTextContent('Bulbasaur');
    expect(summary).toHaveTextContent('Seattle, WA, USA');
    expect(onSearchMock).not.toHaveBeenCalled();
  });

  it('closes valid filters immediately while the search continues', async () => {
    let resolveSearch: (() => void) | undefined;
    onSearchMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveSearch = resolve;
        }),
    );

    render(
      <PokemonSearchBar
        onSearch={onSearchMock}
        isLoading={false}
        view="list"
        setView={setViewMock}
        pokemonCache={pokemonCache}
      />,
    );

    await mountAdvancedSearchState();
    expect(screen.getByTestId('pokemon-filter-icon')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Apply and search' }));

    await waitFor(() => {
      expect(onSearchMock).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    resolveSearch?.();
  });

  it('builds trade query params with caught-only and wanted-only fields normalized', async () => {
    mockConfig.ownershipMode = 'trade';
    mockConfig.costume = 'Party';
    mockConfig.selectedGender = 'Female';
    mockConfig.selectedBackgroundId = 42;
    mockConfig.selectedMoves = {
      fastMove: 1,
      chargedMove1: 2,
      chargedMove2: 3,
    };
    mockConfig.onlyMatchingTrades = true;
    mockConfig.ivs = {
      Attack: 15,
      Defense: 14,
      Stamina: 13,
    };
    mockConfig.prefLucky = true;
    mockConfig.alreadyRegistered = true;
    mockConfig.tradeInWantedList = true;
    mockConfig.friendshipLevel = 4;

    render(
      <PokemonSearchBar
        onSearch={onSearchMock}
        isLoading={false}
        view="list"
        setView={setViewMock}
        pokemonCache={pokemonCache}
      />,
    );

    await mountAdvancedSearchState();
    fireEvent.click(screen.getByRole('button', { name: 'Apply and search' }));

    await waitFor(() => {
      expect(onSearchMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    const [queryParams, boundaryWKT] = onSearchMock.mock.calls[0];

    expect(boundaryWKT).toBeNull();
    expect(queryParams).toMatchObject({
      pokemon_id: 1,
      shiny: false,
      shadow: false,
      costume_id: 7,
      fast_move_id: 1,
      charged_move_1_id: 2,
      charged_move_2_id: 3,
      gender: 'Female',
      background_id: 42,
      ownership: 'trade',
      only_matching_trades: true,
      attack_iv: null,
      defense_iv: null,
      stamina_iv: null,
      pref_lucky: null,
      friendship_level: null,
      already_registered: null,
      trade_in_wanted_list: null,
      range_km: 5,
      limit: 10,
    });
  });

  it('uses list/map controls with canonical view keys', () => {
    render(
      <PokemonSearchBar
        onSearch={onSearchMock}
        isLoading={false}
        view="list"
        setView={setViewMock}
        pokemonCache={pokemonCache}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    fireEvent.click(screen.getByRole('button', { name: 'Map view' }));

    expect(setViewMock).toHaveBeenNthCalledWith(1, 'list');
    expect(setViewMock).toHaveBeenNthCalledWith(2, 'map');
  });
});
