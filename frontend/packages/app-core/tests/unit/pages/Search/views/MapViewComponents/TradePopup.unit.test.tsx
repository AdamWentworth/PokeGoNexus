import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import TradePopup from '@/pages/Search/views/MapViewComponents/TradePopup';

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
  default: () => 'Charizard',
}));

const baseItem = {
  username: 'misty',
  instance_id: 'inst-2',
  pokemonInfo: { moves: [] },
  wanted_list: {
    'variant-1_uuid-9': { match: true },
    'variant-2_uuid-8': { match: false },
  },
};

describe('TradePopup', () => {
  const navigateToUserCatalog = vi.fn();
  const navigateToUserProfile = vi.fn();
  const findPokemonByKey = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    navigateToUserCatalog.mockReset();
    navigateToUserProfile.mockReset();
    findPokemonByKey.mockReset();
    onClose.mockReset();
    findPokemonByKey.mockImplementation((key: string) => ({
      currentImage: `/images/${key}.png`,
      name: key.includes('variant-1') ? 'Bulbasaur' : 'Squirtle',
      form: null,
    }));
  });

  const renderPopup = () =>
    render(
      <TradePopup
        findPokemonByKey={findPokemonByKey}
        item={baseItem}
        navigateToUserCatalog={navigateToUserCatalog}
        navigateToUserProfile={navigateToUserProfile}
        onClose={onClose}
      />,
    );

  it('summarizes what the trainer wants without crowding the popup', () => {
    renderPopup();

    expect(screen.getByText('For Trade')).toBeInTheDocument();
    expect(screen.getByText('Trainer wants')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByAltText('Bulbasaur')).toHaveClass('glowing-pokemon');
    expect(screen.getByAltText('Squirtle')).not.toHaveClass('glowing-pokemon');
  });

  it('opens the exact trade listing directly', () => {
    renderPopup();

    fireEvent.click(screen.getByRole('button', { name: 'Open listing' }));
    expect(navigateToUserCatalog).toHaveBeenCalledWith(
      'misty',
      'inst-2',
      'Trade',
    );
  });
});
