import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import Search from '@/pages/Search/Search';
import { clearSearchSession } from '@/pages/Search/searchSessionCache';

const mockedSearchPokemon = vi.fn();
const alertMock = vi.fn().mockResolvedValue(undefined);

const variantsState = {
  variants: [
    {
      pokemon_id: 1,
      name: 'Bulbasaur',
      variantType: 'default',
      moves: [{ move_id: 1, name: 'Vine Whip', is_fast: 1 }],
    },
    {
      pokemon_id: 1,
      name: 'Shiny Bulbasaur',
      variantType: 'shiny',
      moves: [{ move_id: 1, name: 'Vine Whip', is_fast: 1 }],
    },
  ],
};

vi.mock('@/services/searchService', () => ({
  searchPokemon: (...args: unknown[]) => mockedSearchPokemon(...args),
}));

vi.mock('@/features/variants/store/useVariantsStore', () => ({
  useVariantsStore: (selector: (state: typeof variantsState) => unknown) =>
    selector(variantsState),
}));

vi.mock('@/contexts/ModalContext', () => ({
  useModal: () => ({
    alert: alertMock,
  }),
}));

vi.mock('@/pages/Search/SearchModeToggle', () => ({
  default: ({
    searchMode,
    setSearchMode,
  }: {
    searchMode: 'pokemon' | 'trainer';
    setSearchMode: (mode: 'pokemon' | 'trainer') => void;
  }) => (
    <div data-testid="search-toggle-active" data-mode={searchMode}>
      <button onClick={() => setSearchMode('pokemon')}>mode-pokemon</button>
      <button onClick={() => setSearchMode('trainer')}>mode-trainer</button>
    </div>
  ),
}));

vi.mock('@/pages/Search/PokemonSearchBar', () => ({
  default: ({
    onSearch,
    pokemonCache,
    setView,
  }: {
    onSearch: (query: Record<string, string>, boundary: string) => Promise<void>;
    pokemonCache: Array<{ moves?: unknown[] }>;
    setView: (view: 'list' | 'map') => void;
  }) => (
    <div
      data-cache-count={pokemonCache.length}
      data-move-count={pokemonCache[0]?.moves?.length ?? 0}
      data-testid="pokemon-search-bar"
    >
      <button
        onClick={() => onSearch({ ownership: 'owned' }, 'BOUNDARY-WKT')}
      >
        search-owned
      </button>
      <button
        onClick={() => onSearch({ ownership: 'trade' }, 'BOUNDARY-WKT')}
      >
        search-trade
      </button>
      <button onClick={() => setView('map')}>switch-map</button>
      <button onClick={() => setView('list')}>switch-list</button>
    </div>
  ),
}));

vi.mock('@/pages/Search/TrainerSearchBar', () => ({
  default: () => <div data-testid="trainer-search-bar" />,
}));

vi.mock('@/pages/Search/views/ListView', () => ({
  default: ({
    data,
    instanceData,
    hasSearched,
  }: {
    data: Array<{ username?: string }>;
    instanceData: string;
    hasSearched: boolean;
  }) => (
    <div data-testid="list-view">
      {`${instanceData}|${data.length}|${data[0]?.username ?? ''}|${hasSearched}`}
    </div>
  ),
}));

vi.mock('@/pages/Search/views/MapView', () => ({
  default: ({
    data,
    instanceData,
  }: {
    data: Array<{ username?: string }>;
    instanceData: string;
  }) => <div data-testid="map-view">{`${instanceData}|${data.length}`}</div>,
}));

vi.mock('@/components/LoadingSpinner', () => ({
  default: () => <div data-testid="loading-spinner" />,
}));

vi.mock('@/components/ActionMenu', () => ({
  default: () => <div data-testid="action-menu" />,
}));

describe('Search', () => {
  beforeEach(() => {
    mockedSearchPokemon.mockReset();
    alertMock.mockClear();
    clearSearchSession();
    window.history.replaceState({}, '', '/search');
  });

  it('renders a persistent header with Pokemon selected by default', () => {
    const { container } = render(<Search />);

    expect(screen.getByRole('heading', { name: 'Search' })).toBeInTheDocument();
    expect(screen.getByTestId('search-toggle-active')).toHaveAttribute(
      'data-mode',
      'pokemon',
    );
    expect(screen.getByTestId('pokemon-search-bar')).toBeInTheDocument();
    expect(
      container.querySelector('.horizontal-page-slider__track'),
    ).toHaveStyle({ transform: 'translate3d(calc(0% + 0px), 0, 0)' });
  });

  it('feeds Search the live move-hydrated default variants', () => {
    render(<Search />);

    expect(screen.getByTestId('pokemon-search-bar')).toHaveAttribute(
      'data-cache-count',
      '1',
    );
    expect(screen.getByTestId('pokemon-search-bar')).toHaveAttribute(
      'data-move-count',
      '1',
    );
  });

  it('slides to trainer search while preserving the Pokemon panel', () => {
    const { container } = render(<Search />);

    fireEvent.click(screen.getByText('mode-trainer'));

    expect(screen.getByTestId('search-toggle-active')).toHaveAttribute(
      'data-mode',
      'trainer',
    );
    expect(screen.getByTestId('trainer-search-bar')).toBeInTheDocument();
    expect(screen.getByTestId('pokemon-search-bar')).toBeInTheDocument();
    expect(
      container.querySelector('.horizontal-page-slider__track'),
    ).toHaveStyle({ transform: 'translate3d(calc(-100% + 0px), 0, 0)' });
  });

  it('restores trainer mode from a trainer-search return URL', () => {
    window.history.replaceState({}, '', '/search?mode=trainer&q=misty');

    const { container } = render(<Search />);

    expect(screen.getByTestId('search-toggle-active')).toHaveAttribute(
      'data-mode',
      'trainer',
    );
    expect(
      container.querySelector('.horizontal-page-slider__track'),
    ).toHaveStyle({ transform: 'translate3d(calc(-100% + 0px), 0, 0)' });
  });

  it('normalizes owned -> caught and renders sorted/enriched list results', async () => {
    mockedSearchPokemon.mockResolvedValueOnce([
      { pokemon_id: 1, distance: 5, username: 'far' },
      { pokemon_id: 1, distance: 2, username: 'near' },
      { pokemon_id: 999, distance: 1, username: 'ignored' },
    ]);

    render(<Search />);

    fireEvent.click(screen.getByText('search-owned'));

    await waitFor(() => {
      expect(screen.getByTestId('list-view')).toHaveTextContent('caught|2|near|true');
    });

    expect(mockedSearchPokemon).toHaveBeenCalledWith(
      expect.objectContaining({ ownership: 'owned' }),
    );
  });

  it('prioritizes reciprocal matches ahead of nearer unmatched listings', async () => {
    mockedSearchPokemon.mockResolvedValueOnce([
      {
        pokemon_id: 1,
        distance: 1,
        username: 'near-unmatched',
        wanted_list: { wanted: { match: false } },
      },
      {
        pokemon_id: 1,
        distance: 8,
        username: 'far-matched',
        wanted_list: { wanted: { match: true } },
      },
    ]);

    render(<Search />);
    fireEvent.click(screen.getByText('search-trade'));

    await waitFor(() => {
      expect(screen.getByTestId('list-view')).toHaveTextContent(
        'trade|2|far-matched|true',
      );
    });
  });

  it('shows a centered, descriptive loading state while search is pending', () => {
    mockedSearchPokemon.mockReturnValueOnce(new Promise(() => undefined));

    const view = render(<Search />);
    fireEvent.click(screen.getByText('search-trade'));

    expect(screen.getByText('Searching community listings')).toBeInTheDocument();
    expect(
      screen.getByText('Checking nearby trainers for the Pokémon you selected…'),
    ).toBeInTheDocument();
    expect(view.container.querySelector('.search-loading-state')).toBeInTheDocument();
  });

  it('switches to map view and passes trade ownership mode', async () => {
    mockedSearchPokemon.mockResolvedValueOnce([
      { pokemon_id: 1, distance: 3, username: 'ash' },
    ]);

    render(<Search />);

    fireEvent.click(screen.getByText('search-trade'));

    await waitFor(() => {
      expect(screen.getByTestId('list-view')).toHaveTextContent('trade|1|ash|true');
    });

    fireEvent.click(screen.getByText('switch-map'));

    await waitFor(() => {
      expect(screen.getByTestId('map-view')).toHaveTextContent('trade|1');
    });
  });

  it('restores completed results after leaving Search without another request', async () => {
    mockedSearchPokemon.mockResolvedValueOnce([
      { pokemon_id: 1, distance: 3, username: 'cached-trainer' },
    ]);

    const firstVisit = render(<Search />);
    fireEvent.click(screen.getByText('search-trade'));

    await waitFor(() => {
      expect(screen.getByTestId('list-view')).toHaveTextContent(
        'trade|1|cached-trainer|true',
      );
    });
    expect(mockedSearchPokemon).toHaveBeenCalledTimes(1);

    firstVisit.unmount();
    render(<Search />);

    await waitFor(() => {
      expect(screen.getByTestId('list-view')).toHaveTextContent(
        'trade|1|cached-trainer|true',
      );
    });
    expect(mockedSearchPokemon).toHaveBeenCalledTimes(1);
  });

  it('restores the selected results view with the cached search', async () => {
    mockedSearchPokemon.mockResolvedValueOnce([
      { pokemon_id: 1, distance: 3, username: 'map-trainer' },
    ]);

    const firstVisit = render(<Search />);
    fireEvent.click(screen.getByText('search-trade'));
    await screen.findByText('trade|1|map-trainer|true');
    fireEvent.click(screen.getByText('switch-map'));
    await screen.findByText('trade|1');

    firstVisit.unmount();
    render(<Search />);

    await waitFor(() => {
      expect(screen.getByTestId('map-view')).toHaveTextContent('trade|1');
    });
    expect(mockedSearchPokemon).toHaveBeenCalledTimes(1);
  });

  it('explains when a Pokemon search times out', async () => {
    mockedSearchPokemon.mockRejectedValueOnce(
      new Error('Request timed out after 30000ms'),
    );

    render(<Search />);
    fireEvent.click(screen.getByText('search-trade'));

    const message = await screen.findByRole('alert');
    expect(message).toHaveTextContent(
      "Search couldn't be completedSearch took too long to respond",
    );
    expect(alertMock).toHaveBeenCalledWith(
      expect.stringContaining('smaller distance or fewer results'),
    );
  });

  it('identifies non-timeout failures as connection or service errors', async () => {
    mockedSearchPokemon.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    render(<Search />);
    fireEvent.click(screen.getByText('search-owned'));

    const message = await screen.findByRole('alert');
    expect(message).toHaveTextContent('Search is temporarily unavailable');
    expect(alertMock).toHaveBeenCalledWith(
      expect.stringContaining('Check your connection'),
    );
  });
});
