import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import PokemonViewSlider from '@/pages/Pokemon/components/PokemonViewSlider';
import type { PokemonOverlaySelection } from '@/pages/Pokemon/hooks/useInstanceIdProcessor';
import type { Instances } from '@/types/instances';
import type { PokemonVariant } from '@/types/pokemonVariants';
import type { TagBuckets } from '@/types/tags';
import type { SortMode, SortType } from '@/types/sort';

vi.mock('@/pages/Pokemon/components/Menus/PokemonMenu/PokemonMenu', () => ({
  default: ({ activeView }: { activeView: string }) => (
    <div data-testid="pokemon-menu">{activeView}</div>
  ),
}));

vi.mock('@/pages/Pokemon/components/Menus/TagsMenu/TagsMenu', () => ({
  default: ({
    onSelectTag,
    panel,
    tagFilter,
    onClearTagFilter,
  }: {
    onSelectTag: (filter: string) => void;
    panel: 'inventory' | 'wishlist';
    tagFilter?: string;
    onClearTagFilter?: () => void;
  }) => (
    <button
      data-testid={`tags-menu-${panel}`}
      data-tag-filter={tagFilter}
      data-can-clear-tag={onClearTagFilter ? 'true' : 'false'}
      onClick={() => onSelectTag(panel === 'wishlist' ? 'Wanted' : 'Trade')}
    >
      Tags Menu {panel}
    </button>
  ),
}));

const toSetter = <T,>() => vi.fn() as unknown as React.Dispatch<React.SetStateAction<T>>;

type Props = React.ComponentProps<typeof PokemonViewSlider>;

const makeProps = (overrides: Partial<Props> = {}): Props => {
  const variants = [{ variant_id: '0001-default' } as PokemonVariant];

  return {
    containerRef: React.createRef<HTMLDivElement>(),
    swipeHandlers: {
      onTouchStart: vi.fn(),
      onTouchMove: vi.fn(),
      onTouchEnd: vi.fn(),
    },
    transform: 'translate3d(-1000px,0,0)',
    isDragging: false,
    variants,
    isEditable: true,
    sortedPokemons: variants,
    loading: false,
    selectedPokemon: null as PokemonOverlaySelection,
    setSelectedPokemon: vi.fn(),
    isFastSelectEnabled: false,
    toggleCardHighlight: vi.fn(),
    highlightedCards: new Set<string>(),
    tagFilter: '',
    sidePanelTagFilter: '',
    onClearTagFilter: vi.fn(),
    activeTags: {} as TagBuckets,
    instances: {} as Instances,
    sortType: 'number' as SortType,
    setSortType: toSetter<SortType>(),
    sortMode: 'ascending' as SortMode,
    setSortMode: toSetter<SortMode>(),
    username: 'ash',
    setIsFastSelectEnabled: toSetter<boolean>(),
    searchTerm: '',
    setSearchTerm: toSetter<string>(),
    showEvolutionaryLine: false,
    toggleEvolutionaryLine: vi.fn(),
    activeView: 'pokemon',
    onTagSelect: vi.fn(),
    ...overrides,
  };
};

describe('PokemonViewSlider', () => {
  it('renders slider with transform and transition styles', () => {
    const { rerender } = render(<PokemonViewSlider {...makeProps()} />);

    const slider = document.querySelector('.view-slider') as HTMLDivElement | null;
    expect(slider).not.toBeNull();
    expect(slider?.style.transform).toBe('translate3d(-1000px,0,0)');
    expect(slider?.style.transition).toContain('--motion-page-duration');

    rerender(<PokemonViewSlider {...makeProps({ isDragging: true })} />);
    const draggingSlider = document.querySelector('.view-slider') as HTMLDivElement | null;
    expect(draggingSlider?.style.transition).toBe('none');
  });

  it('renders inventory and wishlist tag panels around the pokemon catalog', () => {
    render(<PokemonViewSlider {...makeProps()} />);

    expect(screen.getByTestId('tags-menu-inventory')).toBeInTheDocument();
    expect(screen.getByTestId('pokemon-menu')).toHaveTextContent('pokemon');
    expect(screen.getByTestId('tags-menu-wishlist')).toBeInTheDocument();
  });

  it('forwards tag selection from both tag side panels', () => {
    const onTagSelect = vi.fn();
    render(<PokemonViewSlider {...makeProps({ onTagSelect })} />);

    fireEvent.click(screen.getByTestId('tags-menu-inventory'));
    fireEvent.click(screen.getByTestId('tags-menu-wishlist'));

    expect(onTagSelect).toHaveBeenNthCalledWith(1, 'Trade');
    expect(onTagSelect).toHaveBeenNthCalledWith(2, 'Wanted');
  });

  it('forwards active tag clearing controls to both tag side panels', () => {
    const onClearTagFilter = vi.fn();
    render(
      <PokemonViewSlider
        {...makeProps({
          tagFilter: 'Favorites',
          sidePanelTagFilter: 'Favorites',
          onClearTagFilter,
        })}
      />,
    );

    expect(screen.getByTestId('tags-menu-inventory')).toHaveAttribute(
      'data-tag-filter',
      'Favorites',
    );
    expect(screen.getByTestId('tags-menu-inventory')).toHaveAttribute(
      'data-can-clear-tag',
      'true',
    );
    expect(screen.getByTestId('tags-menu-wishlist')).toHaveAttribute(
      'data-tag-filter',
      'Favorites',
    );
    expect(screen.getByTestId('tags-menu-wishlist')).toHaveAttribute(
      'data-can-clear-tag',
      'true',
    );
  });
});
