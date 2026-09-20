import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import TradeTargetsList from '@/pages/Pokemon/features/instances/components/Trade/TradeTargetsList';
import useSortManager from '@/hooks/sort/useSortManager';

vi.mock('@/hooks/sort/useSortManager', () => ({
  default: vi.fn((items: unknown[]) => items),
}));

const useSortManagerMock = vi.mocked(useSortManager);

const buildProps = (
  overrides: Partial<React.ComponentProps<typeof TradeTargetsList>> = {},
): React.ComponentProps<typeof TradeTargetsList> => ({
  pokemon: { currentImage: '/images/fallback.png' },
  lists: {
    wanted: {
      'variant-1_uuid-1': {
        name: 'Bulbasaur',
        species_name: 'Bulbasaur',
        pokedex_number: 1,
        pokemon_id: 1,
        currentImage: '/images/bulbasaur.png',
      },
    },
  },
  localNotWantedList: {},
  setLocalNotWantedList: vi.fn(),
  isMirror: false,
  mirrorKey: null,
  editMode: false,
  toggleReciprocalUpdates: vi.fn(),
  sortType: 'name' as const,
  sortMode: 'ascending' as const,
  onPokemonClick: vi.fn(),
  ...overrides,
});

describe('TradeTargetsList', () => {
  beforeEach(() => {
    useSortManagerMock.mockClear();
  });

  it('calls click handler with selected key when not in edit mode', () => {
    const props = buildProps();
    render(<TradeTargetsList {...props} />);

    fireEvent.click(screen.getByAltText('Wanted Pokémon Bulbasaur'));

    expect(props.onPokemonClick).toHaveBeenCalledWith('variant-1_uuid-1');
    expect(useSortManagerMock.mock.calls[0]).toHaveLength(3);
  });

  it('hides locally excluded wanted entries when not editing', () => {
    const props = buildProps({
      localNotWantedList: { 'variant-1_uuid-1': true },
    });
    render(<TradeTargetsList {...props} />);

    expect(screen.getByText('No Wanted Pokémon are currently selected.')).toBeInTheDocument();
  });

  it('falls back to parent current image when item image is missing', () => {
    const props = buildProps({
      lists: {
        wanted: {
          'variant-2_uuid-2': {
            name: 'Ivysaur',
            pokedex_number: 2,
            pokemon_id: 2,
          },
        },
      },
    });

    render(<TradeTargetsList {...props} />);

    const image = screen.getByAltText('Wanted Pokémon Ivysaur') as HTMLImageElement;
    expect(image.src).toContain('/images/fallback.png');
  });

  it('renders card labeling for the wanted pokemon', () => {
    const props = buildProps();
    render(<TradeTargetsList {...props} />);

    expect(screen.getByText('Bulbasaur')).toBeInTheDocument();
    expect(screen.getByText('#001')).toBeInTheDocument();
  });

  it('renders compact summary targets as read-only cards', () => {
    render(
      <TradeTargetsList
        {...buildProps({ onPokemonClick: undefined })}
        compact
      />,
    );

    expect(screen.queryByRole('button', { name: /Bulbasaur/ })).not.toBeInTheDocument();
    expect(screen.getByText('Bulbasaur')).toBeInTheDocument();
  });

  it('supports candidate search and bulk selection while editing', () => {
    const props = buildProps({ editMode: true });
    render(<TradeTargetsList {...props} />);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search Wanted Pokémon' }), {
      target: { value: 'squirtle' },
    });
    expect(screen.getByText('No Pokémon match this view.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Allow all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));

    expect(props.setLocalNotWantedList).toHaveBeenNthCalledWith(1, {});
    expect(props.setLocalNotWantedList).toHaveBeenNthCalledWith(2, {
      'variant-1_uuid-1': true,
    });
  });
});
