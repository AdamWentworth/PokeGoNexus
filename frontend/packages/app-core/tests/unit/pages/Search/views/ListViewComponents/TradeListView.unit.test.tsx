import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import TradeListView from '@/pages/Search/views/ListViewComponents/TradeListView';

const navigateMock = vi.fn();

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>(
    'react-router',
  );
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/components/pokemonComponents/MoveDisplay', () => ({
  default: () => <div data-testid="move-display" />,
}));

vi.mock('@/components/pokemonComponents/Gender', () => ({
  default: ({ gender }: { gender?: string }) => <span data-testid="gender">{gender}</span>,
}));

vi.mock('@/components/pokemonComponents/CP', () => ({
  default: ({ cp }: { cp: number }) => <div data-testid="cp">CP:{cp}</div>,
}));

vi.mock('@/pages/Search/utils/URLSelect', () => ({
  URLSelect: () => '/images/mock.png',
}));

vi.mock('@/pages/Search/utils/getPokemonDisplayName', () => ({
  default: () => 'Bulbasaur',
}));

const baseItem = {
  username: 'ash',
  instance_id: 'inst-1',
  distance: 3.14,
  latitude: 10,
  longitude: 20,
  cp: 1400,
  gender: 'Male',
  date_caught: '2026-02-10T12:00:00.000Z',
  wanted_list: {
    'variant-1:abc': { match: true, dynamax: true },
  },
  pokemonInfo: { moves: [] },
};

describe('TradeListView', () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it('renders wanted list entries from findPokemonByKey', () => {
    const findPokemonByKey = vi.fn(() => ({
      currentImage: '/images/variant-1.png',
      name: 'Bulbasaur',
      form: null,
    }));

    render(<TradeListView item={baseItem} findPokemonByKey={findPokemonByKey} />);

    expect(screen.getByText('3.1 km away')).toBeInTheDocument();
    expect(screen.getByText('For Trade')).toBeInTheDocument();
    expect(screen.getByText('Trainer wants')).toBeInTheDocument();
    expect(screen.getByTestId('cp')).toHaveTextContent('CP:1400');
    expect(screen.getByTestId('gender')).toHaveTextContent('Male');
    const bulbasaurImages = screen.getAllByAltText('Bulbasaur');
    expect(bulbasaurImages).toHaveLength(2);
    expect(
      bulbasaurImages.some((img) =>
        img.className.includes('wanted-pokemon-image'),
      ),
    ).toBe(true);
    expect(findPokemonByKey).toHaveBeenCalledWith(
      'variant-1:abc',
      baseItem.wanted_list['variant-1:abc'],
    );
  });

  it('navigates directly to the trade listing', () => {
    const findPokemonByKey = vi.fn(() => null);
    render(
      <TradeListView item={baseItem} findPokemonByKey={findPokemonByKey} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open listing' }));
    expect(navigateMock).toHaveBeenCalledWith('/pokemon/ash?filter=trade', {
      state: {
        instanceId: 'inst-1',
        instanceData: 'Trade',
        contextBackTo: '/search',
      },
    });
  });

  it('navigates directly to the trainer profile', () => {
    const findPokemonByKey = vi.fn(() => null);
    render(
      <TradeListView item={baseItem} findPokemonByKey={findPokemonByKey} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'View trainer' }));
    expect(navigateMock).toHaveBeenCalledWith('/profile/ash', {
      state: { contextBackTo: '/search' },
    });
  });

  it('keeps secondary listing details collapsed until requested', () => {
    const findPokemonByKey = vi.fn(() => null);
    render(<TradeListView item={baseItem} findPokemonByKey={findPokemonByKey} />);
    const details = screen.getByText('Listing details').closest('details');
    expect(details).not.toHaveAttribute('open');
  });

  it('shows Unknown date when date_caught is invalid instead of crashing', () => {
    const findPokemonByKey = vi.fn(() => null);
    render(
      <TradeListView
        item={{ ...baseItem, date_caught: 'invalid-date', location_caught: 'Seattle' }}
        findPokemonByKey={findPokemonByKey}
      />,
    );
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });
});
