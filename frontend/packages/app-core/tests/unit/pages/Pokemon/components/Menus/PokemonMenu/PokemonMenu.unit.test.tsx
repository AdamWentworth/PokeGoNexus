import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildClearActiveTagMessage } from '@pokemongonexus/shared-ui-tokens';

import { AppLoadingProvider } from '@/contexts/AppLoadingContext';
import { useTagsStore } from '@/features/tags/store/useTagsStore';
import PokemonMenu from '@/pages/Pokemon/components/Menus/PokemonMenu/PokemonMenu';

vi.mock('@/components/LoadingSpinner', () => ({
  default: () => <div data-testid="loading-spinner" />,
}));

const { confirmMock } = vi.hoisted(() => ({
  confirmMock: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/contexts/ModalContext', () => ({
  useModal: () => ({ alert: () => undefined, confirm: confirmMock }),
}));

vi.mock('@/pages/Pokemon/components/Menus/PokemonMenu/PokemonGrid', () => ({
  default: ({
    sortedPokemons,
    handleSelect,
  }: {
    sortedPokemons: Array<{ variant_id: string; name: string }>;
    handleSelect: (pokemon: { variant_id: string; name: string }) => void;
  }) => (
    <div>
      {sortedPokemons.map((pokemon) => (
        <button
          key={pokemon.variant_id}
          type="button"
          onClick={() => handleSelect(pokemon)}
        >
          activate {pokemon.name}
        </button>
      ))}
    </div>
  ),
}));

function makePokemon(
  overrides: Record<string, unknown> = {},
): React.ComponentProps<typeof PokemonMenu>['sortedPokemons'][number] {
  return {
    pokemon_id: 1,
    name: 'Bulbasaur',
    species_name: 'Bulbasaur',
    variant_id: '0001-default',
    variantType: 'default',
    currentImage: '/images/1.png',
    pokedex_number: 1,
    ...overrides,
  } as React.ComponentProps<typeof PokemonMenu>['sortedPokemons'][number];
}

const makeProps = (
  overrides: Partial<React.ComponentProps<typeof PokemonMenu>> = {},
): React.ComponentProps<typeof PokemonMenu> => ({
  isEditable: true,
  sortedPokemons: [],
  allPokemons: [],
  loading: false,
  selectedPokemon: null,
  setSelectedPokemon: vi.fn(),
  isFastSelectEnabled: false,
  toggleCardHighlight: vi.fn(),
  highlightedCards: new Set(),
  tagFilter: '',
  onClearTagFilter: vi.fn(),
  lists: {},
  instances: {},
  sortType: 'number',
  setSortType: vi.fn(),
  sortMode: 'ascending',
  setSortMode: vi.fn(),
  variants: [],
  username: 'ash',
  setIsFastSelectEnabled: vi.fn(),
  searchTerm: '',
  setSearchTerm: vi.fn(),
  showEvolutionaryLine: false,
  toggleEvolutionaryLine: vi.fn(),
  activeView: 'pokemon',
  ...overrides,
});

describe('PokemonMenu', () => {
  beforeEach(() => {
    confirmMock.mockClear();
    confirmMock.mockResolvedValue(true);
    useTagsStore.setState({ customTags: { caught: {}, wanted: {} } });
  });

  it('uses the shared loading spinner for its loading fallback', () => {
    render(
      <AppLoadingProvider>
        <PokemonMenu {...makeProps({ loading: true })} />
      </AppLoadingProvider>,
    );

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('shows an active tag filter chip and confirms before clearing it', async () => {
    const onClearTagFilter = vi.fn();

    render(
      <AppLoadingProvider>
        <PokemonMenu
          {...makeProps({
            tagFilter: 'Caught',
            onClearTagFilter,
          })}
        />
      </AppLoadingProvider>,
    );

    expect(screen.getByText('Caught').closest('.active-tag-filter-row')).toHaveClass(
      'active-tag-filter-caught',
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /clear caught tag filter/i,
      }),
    );

    await waitFor(() => {
      expect(confirmMock).toHaveBeenCalledWith(buildClearActiveTagMessage('Caught'));
      expect(onClearTagFilter).toHaveBeenCalledTimes(1);
    });
  });

  it('uses the favorite star icon for the Favorites tag chip', () => {
    render(
      <AppLoadingProvider>
        <PokemonMenu
          {...makeProps({
            tagFilter: 'Favorites',
          })}
        />
      </AppLoadingProvider>,
    );

    const chip = screen.getByText('Favorites').closest('.active-tag-filter-row');
    expect(chip).toHaveClass('active-tag-filter-favorites');
    expect(chip).toHaveClass('active-tag-filter-with-icon');
    expect(chip?.querySelector('.active-tag-filter-icon')).toHaveClass(
      'collection-priority-star--favorite',
    );
  });

  it('uses the assigned color for a custom tag filter chip', () => {
    useTagsStore.setState({
      customTags: {
        caught: {
          'tag-shadow-shinies': {
            tag: {
              tag_id: 'tag-shadow-shinies',
              parent: 'caught',
              name: 'Shadow Shinies',
              color: '#7C3AED',
              sort: 10,
            },
            items: {},
          },
        },
        wanted: {},
      },
    });

    const { container } = render(
      <AppLoadingProvider>
        <PokemonMenu
          {...makeProps({ tagFilter: 'custom:tag-shadow-shinies' })}
        />
      </AppLoadingProvider>,
    );

    const chip = container.querySelector('.active-tag-filter-row');
    expect(chip?.querySelector('.active-tag-filter-name')).toHaveTextContent('Shadow Shinies');
    expect(chip).toHaveAttribute('data-custom', 'true');
    expect(chip).toHaveStyle({ '--active-custom-tag-color': '#7C3AED' });
    expect(container.querySelector('.active-tag-filter-color')).not.toBeInTheDocument();
  });

  it('shows a required tag without a clear control for foreign catalogs', () => {
    render(
      <AppLoadingProvider>
        <PokemonMenu
          {...makeProps({
            isEditable: false,
            tagFilter: 'Caught',
            onClearTagFilter: undefined,
          })}
        />
      </AppLoadingProvider>,
    );

    expect(screen.getByText('Caught')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /clear caught tag filter/i }),
    ).not.toBeInTheDocument();
  });

  it('selects a catalog Pokemon instead of opening the legacy Pokedex overlay', () => {
    const pokemon = makePokemon();
    const setSelectedPokemon = vi.fn();
    const setIsFastSelectEnabled = vi.fn();
    const toggleCardHighlight = vi.fn();

    render(
      <AppLoadingProvider>
        <PokemonMenu
          {...makeProps({
            sortedPokemons: [pokemon],
            variants: [pokemon],
            setSelectedPokemon,
            setIsFastSelectEnabled,
            toggleCardHighlight,
          })}
        />
      </AppLoadingProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'activate Bulbasaur' }));

    expect(toggleCardHighlight).toHaveBeenCalledWith('0001-default');
    expect(setIsFastSelectEnabled).toHaveBeenCalledWith(true);
    expect(setSelectedPokemon).not.toHaveBeenCalled();
  });

  it('continues to open owned Pokemon instances for editing', () => {
    const pokemon = makePokemon({
      instanceData: { instance_id: 'instance-123' },
    });
    const setSelectedPokemon = vi.fn();

    render(
      <AppLoadingProvider>
        <PokemonMenu
          {...makeProps({
            sortedPokemons: [pokemon],
            variants: [pokemon],
            setSelectedPokemon,
          })}
        />
      </AppLoadingProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'activate Bulbasaur' }));

    expect(setSelectedPokemon).toHaveBeenCalledWith({
      pokemon,
      overlayType: 'instance',
    });
  });
});
