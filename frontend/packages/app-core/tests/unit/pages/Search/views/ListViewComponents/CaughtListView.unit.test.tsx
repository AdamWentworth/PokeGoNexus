import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import CaughtListView from '@/pages/Search/views/ListViewComponents/CaughtListView';

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

vi.mock('@/components/pokemonComponents/CP', () => ({
  default: ({ cp }: { cp: number }) => <div data-testid="cp">CP:{cp}</div>,
}));

vi.mock('@/components/pokemonComponents/IV', () => ({
  default: () => <div data-testid="ivs" />,
}));

vi.mock('@/components/pokemonComponents/MoveDisplay', () => ({
  default: () => <div data-testid="move-display" />,
}));

vi.mock('@/components/pokemonComponents/Gender', () => ({
  default: ({ gender }: { gender?: string }) => <span data-testid="gender">{gender}</span>,
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
  distance: 1.234,
  latitude: 10,
  longitude: 20,
  cp: 1500,
  lucky: true,
  dynamax: true,
  gigantamax: false,
  gender: 'Male',
  weight: 12.3,
  height: 1.1,
  fast_move_id: 1,
  charged_move1_id: 2,
  charged_move2_id: 3,
  attack_iv: 15,
  defense_iv: 14,
  stamina_iv: 13,
  location_caught: 'Seattle',
  date_caught: '2026-02-10T12:00:00.000Z',
  pokemonInfo: { moves: [] },
};

describe('CaughtListView', () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it('renders key caught details', () => {
    render(<CaughtListView item={baseItem} />);

    expect(screen.getByText('1.2 km away')).toBeInTheDocument();
    expect(screen.getByText('Caught')).toBeInTheDocument();
    expect(screen.getByTestId('cp')).toHaveTextContent('CP:1500');
    expect(screen.getByAltText('Bulbasaur')).toBeInTheDocument();
    expect(screen.getByTestId('gender')).toHaveTextContent('Male');
    expect(screen.getByTestId('move-display')).toBeInTheDocument();
    expect(screen.getByTestId('ivs')).toBeInTheDocument();
    expect(screen.getByText('Caught in')).toBeInTheDocument();
    expect(screen.getByText('Seattle')).toBeInTheDocument();
    expect(screen.getByText('Caught on')).toBeInTheDocument();
    expect(screen.getByText('2026-02-10')).toBeInTheDocument();
  });

  it('opens and closes the progressively disclosed Pokémon details', () => {
    render(<CaughtListView item={baseItem} />);
    const summary = screen.getByText('Pokémon details');
    const details = summary.closest('details');
    expect(details).not.toHaveAttribute('open');
    fireEvent.click(summary);
    expect(details).toHaveAttribute('open');
  });

  it('shows Unknown when date is invalid instead of crashing', () => {
    render(<CaughtListView item={{ ...baseItem, date_caught: 'invalid-date' }} />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('navigates directly to the Pokémon listing', () => {
    render(<CaughtListView item={baseItem} />);
    fireEvent.click(screen.getByRole('button', { name: 'View Pokémon' }));
    expect(navigateMock).toHaveBeenCalledWith('/pokemon/ash?filter=caught', {
      state: {
        instanceId: 'inst-1',
        instanceData: 'Caught',
        contextBackTo: '/search',
      },
    });
  });

  it('navigates directly to the trainer profile', () => {
    render(<CaughtListView item={baseItem} />);
    fireEvent.click(screen.getByRole('button', { name: 'View trainer' }));
    expect(navigateMock).toHaveBeenCalledWith('/profile/ash', {
      state: { contextBackTo: '/search' },
    });
  });
});
