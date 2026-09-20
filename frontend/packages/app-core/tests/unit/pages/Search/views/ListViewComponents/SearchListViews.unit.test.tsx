import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, within } from '@testing-library/react';

import TradeListView from '@/pages/Search/views/ListViewComponents/TradeListView';
import WantedListView from '@/pages/Search/views/ListViewComponents/WantedListView';

const navigateMock = vi.fn();

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/pages/Search/utils/URLSelect', () => ({
  URLSelect: () => '/images/mock.png',
}));

vi.mock('@/pages/Search/utils/getPokemonDisplayName', () => ({
  default: () => 'Bulbasaur',
}));

vi.mock('@/components/pokemonComponents/Gender', () => ({
  default: ({ gender }: { gender?: string }) => <span data-testid="gender-chip">{gender}</span>,
}));

const baseItem = {
  username: 'ash',
  instance_id: 'inst-1',
  gender: 'Male',
  cp: 0,
  weight: 0,
  height: 0,
  fast_move_id: null,
  charged_move1_id: null,
  charged_move2_id: null,
  location_caught: '',
  date_caught: '',
  distance: 0,
  latitude: 0,
  longitude: 0,
  lucky: false,
  pref_lucky: false,
  dynamax: false,
  gigantamax: false,
  wanted_list: null,
  trade_list: null,
  pokemonInfo: {
    moves: [],
  },
};

describe('Search list view components', () => {
  it('TradeListView renders the gender component in single-column mode', () => {
    const view = render(
      <TradeListView
        item={baseItem}
        findPokemonByKey={vi.fn()}
      />,
    );

    expect(within(view.container).getByTestId('gender-chip')).toHaveTextContent('Male');
  });

  it('WantedListView renders the gender component in single-column mode', () => {
    const view = render(
      <WantedListView
        item={baseItem}
        findPokemonByKey={vi.fn()}
      />,
    );

    expect(within(view.container).getByTestId('gender-chip')).toHaveTextContent('Male');
  });
});
