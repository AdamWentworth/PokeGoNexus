import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PokemonGrid from '@/pages/Pokemon/components/Menus/PokemonMenu/PokemonGrid';

vi.mock('@/contexts/AppLoadingContext', () => ({
  AppLoadingFallback: ({ source }: { source: string }) => (
    <div data-testid="grid-loading-source" data-source={source} />
  ),
}));

vi.mock('@/pages/Pokemon/components/Menus/PokemonMenu/PokemonCard', () => ({
  default: ({ pokemon }: { pokemon: { mockCardHeight?: number; name: string } }) => (
    <div
      className="pokemon-card"
      data-card-height={pokemon.mockCardHeight ?? 180}
      data-testid="pokemon-card"
    >
      {pokemon.name}
    </div>
  ),
}));

type GridPokemon = NonNullable<
  React.ComponentProps<typeof PokemonGrid>['sortedPokemons'][number]
>;

class ResizeObserverMock {
  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element) {
    const height = target.classList.contains('pokemon-grid-row') ? 180 : 600;
    this.callback(
      [
        {
          target,
          contentRect: { height },
        } as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver,
    );
  }

  unobserve() {}

  disconnect() {}
}

const makePokemon = (index: number) =>
  ({
    pokemon_id: index,
    pokedex_number: index,
    name: `Pokemon ${index}`,
    variant_id: `pokemon-${index}`,
    currentImage: `/images/${index}.png`,
  }) as GridPokemon;

const GridHarness = ({
  activeView = 'pokemon',
  enableInitialLayoutLoader,
  onInitialLayoutReady,
  pokemons,
}: {
  activeView?: string;
  enableInitialLayoutLoader?: boolean;
  onInitialLayoutReady?: () => void;
  pokemons: GridPokemon[];
}) => {
  const gridContainerRef = React.useRef<HTMLDivElement>(null);

  return (
    <div ref={gridContainerRef}>
      <PokemonGrid
        sortedPokemons={pokemons}
        highlightedCards={new Set()}
        handleSelect={vi.fn()}
        tagFilter=""
        sortType="number"
        isEditable={true}
        toggleCardHighlight={vi.fn()}
        setIsFastSelectEnabled={vi.fn()}
        isFastSelectEnabled={false}
        variants={pokemons}
        gridContainerRef={gridContainerRef as React.RefObject<HTMLDivElement>}
        activeView={activeView}
        enableInitialLayoutLoader={enableInitialLayoutLoader}
        onInitialLayoutReady={onInitialLayoutReady}
      />
    </div>
  );
};

const makePokemons = (count = 12) =>
  Array.from({ length: count }, (_, index) => makePokemon(index + 1));

const renderGrid = (count = 12) => {
  const pokemons = makePokemons(count);

  return render(<GridHarness pokemons={pokemons} />);
};

describe('PokemonGrid', () => {
  let getBoundingClientRectSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1440,
    });

    getBoundingClientRectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function getBoundingClientRectMock(this: HTMLElement) {
        if (this.classList.contains('pokemon-card')) {
          const height = Number(this.dataset.cardHeight) || 180;
          return {
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            right: 0,
            bottom: height,
            width: 0,
            height,
            toJSON: () => ({}),
          };
        }

        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          right: 0,
          bottom: this.classList.contains('pokemon-grid-row') ? 180 : 0,
          width: 0,
          height: this.classList.contains('pokemon-grid-row') ? 180 : 0,
          toJSON: () => ({}),
        };
      });
  });

  afterEach(() => {
    getBoundingClientRectSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('keeps the layout loader active until measured rows are ready to reveal', () => {
    const onInitialLayoutReady = vi.fn();
    const { container } = render(<GridHarness pokemons={makePokemons()} onInitialLayoutReady={onInitialLayoutReady} />);

    expect(screen.getByTestId('grid-loading-source')).toHaveAttribute(
      'data-source',
      'pokemon-grid-layout',
    );
    expect(container.querySelector('.pokemon-grid-cell.visible')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(149);
    });
    expect(screen.getByTestId('grid-loading-source')).toBeInTheDocument();
    expect(onInitialLayoutReady).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.queryByTestId('grid-loading-source')).not.toBeInTheDocument();
    expect(container.querySelector('.pokemon-grid-cell.visible')).toBeInTheDocument();
    expect(onInitialLayoutReady).toHaveBeenCalledTimes(1);
  });

  it('can skip the initial layout loader for soft remounts', () => {
    const { container } = render(
      <GridHarness pokemons={makePokemons()} enableInitialLayoutLoader={false} />,
    );

    expect(screen.queryByTestId('grid-loading-source')).not.toBeInTheDocument();
    expect(container.querySelector('.pokemon-grid-cell.visible')).toBeInTheDocument();
  });

  it('positions virtual rows from the measured rendered-row height before reveal', () => {
    const { container } = renderGrid();

    const rows = container.querySelectorAll<HTMLElement>('.pokemon-grid-row');
    expect(rows).toHaveLength(2);
    expect(rows[1]).toHaveStyle({ top: '188px' });
  });

  it('uses the tallest rendered card height for virtual row spacing', () => {
    const pokemons = makePokemons(18).map((pokemon, index) =>
      index === 12 ? ({ ...pokemon, mockCardHeight: 220 } as GridPokemon) : pokemon,
    );
    const { container } = render(<GridHarness pokemons={pokemons} />);

    const rows = container.querySelectorAll<HTMLElement>('.pokemon-grid-row');
    expect(rows).toHaveLength(2);
    expect(rows[1]).toHaveStyle({ top: '228px' });
  });

  it('does not shrink observed row height for the same grid shape', () => {
    const tallPokemons = makePokemons(18).map((pokemon, index) =>
      index === 12 ? ({ ...pokemon, mockCardHeight: 220 } as GridPokemon) : pokemon,
    );
    const shortPokemons = makePokemons(18);
    const { container, rerender } = render(<GridHarness pokemons={tallPokemons} />);

    expect(container.querySelectorAll<HTMLElement>('.pokemon-grid-row')[1]).toHaveStyle({
      top: '228px',
    });

    rerender(<GridHarness pokemons={shortPokemons} />);

    expect(container.querySelectorAll<HTMLElement>('.pokemon-grid-row')[1]).toHaveStyle({
      top: '228px',
    });
  });

  it('does not restart the layout loader when switching slider views', () => {
    const pokemons = makePokemons();
    const { rerender } = render(<GridHarness activeView="pokemon" pokemons={pokemons} />);

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(screen.queryByTestId('grid-loading-source')).not.toBeInTheDocument();

    rerender(<GridHarness activeView="inventory" pokemons={pokemons} />);
    expect(screen.queryByTestId('grid-loading-source')).not.toBeInTheDocument();

    rerender(<GridHarness activeView="wishlist" pokemons={pokemons} />);
    expect(screen.queryByTestId('grid-loading-source')).not.toBeInTheDocument();

    rerender(<GridHarness activeView="pokemon" pokemons={pokemons} />);
    expect(screen.queryByTestId('grid-loading-source')).not.toBeInTheDocument();
  });

  it('does not restart the layout loader for soft list changes after initial reveal', () => {
    const initialPokemons = makePokemons(18);
    const filteredPokemons = makePokemons(6);
    const tallerFilteredPokemons = makePokemons(18).map((pokemon, index) =>
      index === 12 ? ({ ...pokemon, mockCardHeight: 220 } as GridPokemon) : pokemon,
    );
    const { container, rerender } = render(<GridHarness pokemons={initialPokemons} />);

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(screen.queryByTestId('grid-loading-source')).not.toBeInTheDocument();

    rerender(<GridHarness pokemons={filteredPokemons} />);
    expect(screen.queryByTestId('grid-loading-source')).not.toBeInTheDocument();
    expect(container.querySelector('.pokemon-grid-cell.visible')).toBeInTheDocument();

    rerender(<GridHarness pokemons={tallerFilteredPokemons} />);
    expect(screen.queryByTestId('grid-loading-source')).not.toBeInTheDocument();
    expect(container.querySelectorAll<HTMLElement>('.pokemon-grid-row')[1]).toHaveStyle({
      top: '228px',
    });
  });

  it('uses the layout loader when the initial data arrives after an empty boot state', () => {
    const { rerender } = render(<GridHarness pokemons={[]} />);

    expect(screen.queryByTestId('grid-loading-source')).not.toBeInTheDocument();

    rerender(<GridHarness pokemons={makePokemons()} />);
    expect(screen.getByTestId('grid-loading-source')).toHaveAttribute(
      'data-source',
      'pokemon-grid-layout',
    );

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(screen.queryByTestId('grid-loading-source')).not.toBeInTheDocument();
  });
});
