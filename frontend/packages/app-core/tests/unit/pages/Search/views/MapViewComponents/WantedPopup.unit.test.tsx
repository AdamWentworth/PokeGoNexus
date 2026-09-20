import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import WantedPopup from '@/pages/Search/views/MapViewComponents/WantedPopup';

vi.mock('@/components/pokemonComponents/IV', () => ({
  default: () => <div data-testid="iv" />,
}));

vi.mock('@/components/pokemonComponents/MoveDisplay', () => ({
  default: () => <div data-testid="move-display" />,
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
  pokemonInfo: { moves: [] },
  trade_list: {
    'variant-1_uuid-1': { match: true },
  },
};

describe('WantedPopup', () => {
  const navigateToUserCatalog = vi.fn();
  const navigateToUserProfile = vi.fn();
  const findPokemonByKey = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    navigateToUserCatalog.mockReset();
    navigateToUserProfile.mockReset();
    findPokemonByKey.mockReset();
    onClose.mockReset();
    findPokemonByKey.mockReturnValue({
      currentImage: '/images/charmander.png',
      name: 'Charmander',
      form: null,
    });
  });

  const renderPopup = () =>
    render(
      <WantedPopup
        findPokemonByKey={findPokemonByKey}
        item={baseItem}
        navigateToUserCatalog={navigateToUserCatalog}
        navigateToUserProfile={navigateToUserProfile}
        onClose={onClose}
      />,
    );

  it('shows the wanted listing and representative available trade Pokémon', () => {
    renderPopup();

    expect(screen.getByText('Wanted')).toBeInTheDocument();
    expect(screen.getByText('Trainer can offer')).toBeInTheDocument();
    expect(screen.getByAltText('Charmander')).toBeInTheDocument();
  });

  it('uses direct actions and closes only when explicitly requested', () => {
    renderPopup();

    fireEvent.click(screen.getByRole('button', { name: 'Open listing' }));
    expect(navigateToUserCatalog).toHaveBeenCalledWith(
      'ash',
      'inst-1',
      'Wanted',
    );
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'View trainer' }));
    expect(navigateToUserProfile).toHaveBeenCalledWith('ash');

    fireEvent.click(screen.getByRole('button', { name: 'Close map result' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
