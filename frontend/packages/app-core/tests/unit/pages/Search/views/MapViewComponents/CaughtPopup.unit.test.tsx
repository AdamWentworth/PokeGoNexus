import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import CaughtPopup from '@/pages/Search/views/MapViewComponents/CaughtPopup';

vi.mock('@/components/pokemonComponents/IV', () => ({
  default: () => <div data-testid="iv" />,
}));

const moveDisplaySpy = vi.fn((_: unknown) => <div data-testid="move-display" />);

vi.mock('@/components/pokemonComponents/MoveDisplay', () => ({
  default: (props: unknown) => moveDisplaySpy(props),
}));

vi.mock('@/pages/Search/utils/URLSelect', () => ({
  URLSelect: () => '/images/mock.png',
}));

vi.mock('@/pages/Search/utils/getPokemonDisplayName', () => ({
  default: () => 'Eevee',
}));

const baseItem = {
  username: 'brock',
  instance_id: 'inst-3',
  distance: 1.24,
  fast_move_id: 1,
  charged_move1Id: 11,
  charged_move2_id: 3,
  pokemonInfo: { moves: [] },
};

describe('CaughtPopup', () => {
  const navigateToUserCatalog = vi.fn();
  const navigateToUserProfile = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    navigateToUserCatalog.mockReset();
    navigateToUserProfile.mockReset();
    onClose.mockReset();
    moveDisplaySpy.mockClear();
  });

  const renderPopup = () =>
    render(
      <CaughtPopup
        item={baseItem}
        navigateToUserCatalog={navigateToUserCatalog}
        navigateToUserProfile={navigateToUserProfile}
        onClose={onClose}
      />,
    );

  it('renders a concise caught result with distance and progressive details', () => {
    renderPopup();

    expect(screen.getByText('Caught')).toBeInTheDocument();
    expect(screen.getByText('brock')).toBeInTheDocument();
    expect(screen.getByText('1.2 km away')).toBeInTheDocument();
    expect(screen.getByAltText('Eevee')).toHaveAttribute('src', '/images/mock.png');
    expect(screen.getByText('Pokémon details').closest('details')).not.toHaveAttribute(
      'open',
    );

    fireEvent.click(screen.getByText('Pokémon details'));

    expect(screen.getByText('Pokémon details').closest('details')).toHaveAttribute(
      'open',
    );
    expect(screen.getByTestId('move-display')).toBeInTheDocument();
    expect(screen.getByTestId('iv')).toBeInTheDocument();
    expect(moveDisplaySpy).toHaveBeenCalledWith(
      expect.objectContaining({ chargedMove1Id: 11 }),
    );
  });

  it('uses explicit listing, trainer, and close actions without a confirmation step', () => {
    renderPopup();

    fireEvent.click(screen.getByRole('button', { name: 'View Pokémon' }));
    expect(navigateToUserCatalog).toHaveBeenCalledWith(
      'brock',
      'inst-3',
      'Caught',
    );

    fireEvent.click(screen.getByRole('button', { name: 'View trainer' }));
    expect(navigateToUserProfile).toHaveBeenCalledWith('brock');

    fireEvent.click(screen.getByRole('button', { name: 'Close map result' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
