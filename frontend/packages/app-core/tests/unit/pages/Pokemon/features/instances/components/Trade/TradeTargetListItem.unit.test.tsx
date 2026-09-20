import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import TradeTargetListItem from '@/pages/Pokemon/features/instances/components/Trade/TradeTargetListItem';
import type { TradeTargetDisplayItem } from '@/pages/Pokemon/features/instances/components/Trade/tradeTargetsListState';

const makeTarget = (
  overrides: Partial<TradeTargetDisplayItem> = {},
): TradeTargetDisplayItem => ({
  key: 'variant-1_uuid-1',
  name: 'Bulbasaur',
  species_name: 'Bulbasaur',
  pokedex_number: 1,
  currentImage: '/images/bulbasaur.png',
  ...overrides,
});

describe('TradeTargetListItem', () => {
  it('opens the pokemon in read-only mode by click and keyboard', () => {
    const onPokemonClick = vi.fn();
    render(
      <TradeTargetListItem
        wantedPokemon={makeTarget()}
        isNotWanted={false}
        editMode={false}
        onPokemonClick={onPokemonClick}
        onNotWantedToggle={vi.fn()}
      />,
    );

    const item = screen.getByRole('button');
    fireEvent.click(item);
    fireEvent.keyDown(item, { key: 'Enter' });
    fireEvent.keyDown(item, { key: ' ' });

    expect(onPokemonClick).toHaveBeenCalledTimes(3);
    expect(onPokemonClick).toHaveBeenCalledWith('variant-1_uuid-1');
  });

  it('renders badges, labels, and not-wanted styling', () => {
    render(
      <TradeTargetListItem
        wantedPokemon={makeTarget({
          form: 'Mega',
          pref_lucky: true,
          variantType: 'dynamax-gigantamax',
        })}
        isNotWanted={true}
        editMode={false}
        onPokemonClick={vi.fn()}
        onNotWantedToggle={vi.fn()}
      />,
    );

    expect(screen.getByAltText('Lucky backdrop')).toHaveClass('grey-out');
    expect(screen.getByAltText('Dynamax')).toBeInTheDocument();
    expect(screen.getByAltText('Gigantamax')).toBeInTheDocument();
    expect(screen.getByAltText('Wanted Pokémon Bulbasaur')).toHaveClass('grey-out');
    expect(screen.getByText('Mega Bulbasaur')).toBeInTheDocument();
    expect(screen.getByText('#001')).toBeInTheDocument();
  });

  it('toggles not-wanted state in edit mode without opening the pokemon', () => {
    const onPokemonClick = vi.fn();
    const onNotWantedToggle = vi.fn();
    render(
      <TradeTargetListItem
        wantedPokemon={makeTarget()}
        isNotWanted={false}
        editMode={true}
        onPokemonClick={onPokemonClick}
        onNotWantedToggle={onNotWantedToggle}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Trade Target Bulbasaur' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Bulbasaur' }));

    expect(onNotWantedToggle).toHaveBeenCalledWith('variant-1_uuid-1');
    expect(onPokemonClick).not.toHaveBeenCalled();
  });

  it('shows a check mark for excluded items while editing', () => {
    render(
      <TradeTargetListItem
        wantedPokemon={makeTarget()}
        isNotWanted={true}
        editMode={true}
        onPokemonClick={vi.fn()}
        onNotWantedToggle={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Allow Bulbasaur' })).toBeInTheDocument();
  });
});
