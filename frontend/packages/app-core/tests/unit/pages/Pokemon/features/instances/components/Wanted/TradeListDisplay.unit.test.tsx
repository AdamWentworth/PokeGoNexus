import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import TradeListDisplay from '@/pages/Pokemon/features/instances/components/Wanted/TradeListDisplay';
import useSortManager from '@/hooks/sort/useSortManager';

vi.mock('@/hooks/sort/useSortManager', () => ({
  default: vi.fn((items: unknown[]) => items),
}));

const useSortManagerMock = vi.mocked(useSortManager);

const buildProps = (
  overrides: Partial<React.ComponentProps<typeof TradeListDisplay>> = {},
): React.ComponentProps<typeof TradeListDisplay> => ({
  pokemon: { instanceData: { instance_id: 'variant-1_uuid-parent' } },
  lists: {
    trade: {
      'variant-2_uuid-1': {
        name: 'Charmander',
        species_name: 'Charmander',
        pokedex_number: 4,
        pokemon_id: 4,
        currentImage: '/images/charmander.png',
      },
    },
  },
  localNotTradeList: {},
  setLocalNotTradeList: vi.fn(),
  editMode: false,
  toggleReciprocalUpdates: vi.fn(),
  sortType: 'name' as const,
  sortMode: 'ascending' as const,
  onPokemonClick: vi.fn(),
  ...overrides,
});

describe('TradeListDisplay', () => {
  beforeEach(() => {
    useSortManagerMock.mockClear();
  });

  it('calls click handler with selected key when not in edit mode', () => {
    const props = buildProps();
    render(<TradeListDisplay {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /Charmander/ }));

    expect(props.onPokemonClick).toHaveBeenCalledWith('variant-2_uuid-1');
    expect(useSortManagerMock.mock.calls[0]).toHaveLength(3);
  });

  it('hides entries blocked by base key when not editing', () => {
    const props = buildProps({
      localNotTradeList: { 'variant-2': true },
    });
    render(<TradeListDisplay {...props} />);

    expect(screen.getByText('No Pokemon currently for trade.')).toBeInTheDocument();
  });

  it('matches mirror trade entries by variant_id for UUID-only instance ids', () => {
    const props = buildProps({
      pokemon: { instanceData: { instance_id: 'wanted-uuid', variant_id: '0001-default' } },
      lists: {
        trade: {
          'trade-uuid-match': {
            name: 'Bulbasaur',
            species_name: 'Bulbasaur',
            variant_id: '0001-default',
            mirror: true,
          },
          'trade-uuid-other': {
            name: 'Charmander',
            species_name: 'Charmander',
            variant_id: '0004-default',
            mirror: true,
          },
        },
      },
    });

    render(<TradeListDisplay {...props} />);

    expect(screen.getByAltText('Bulbasaur')).toBeInTheDocument();
    expect(screen.queryByAltText('Charmander')).not.toBeInTheDocument();
  });

  it('allows toggle updates in edit mode', () => {
    const props = buildProps({ editMode: true });
    render(<TradeListDisplay {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove Charmander' }));

    expect(props.setLocalNotTradeList).toHaveBeenCalled();
    expect(props.toggleReciprocalUpdates).toHaveBeenCalledWith(
      'variant-2_uuid-1',
      true,
    );
  });

  it('renders compact summary offers as read-only cards', () => {
    render(
      <TradeListDisplay
        {...buildProps({ onPokemonClick: undefined })}
        compact
      />,
    );

    expect(screen.queryByRole('button', { name: /Charmander/ })).not.toBeInTheDocument();
    expect(screen.getByText('Charmander')).toBeInTheDocument();
  });

  it('supports candidate search and bulk selection while editing', () => {
    const props = buildProps({ editMode: true });
    render(<TradeListDisplay {...props} />);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search offered Pokémon' }), {
      target: { value: 'bulbasaur' },
    });
    expect(screen.getByText('No Pokémon match this view.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Allow all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));

    expect(props.setLocalNotTradeList).toHaveBeenNthCalledWith(1, {});
    expect(props.setLocalNotTradeList).toHaveBeenNthCalledWith(2, {
      'variant-2_uuid-1': true,
    });
  });

});
