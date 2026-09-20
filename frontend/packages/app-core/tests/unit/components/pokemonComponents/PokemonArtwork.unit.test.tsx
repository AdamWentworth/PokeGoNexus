import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import PokemonArtwork from '@/components/pokemonComponents/PokemonArtwork';

describe('PokemonArtwork', () => {
  it('renders the Pokémon without a Max badge by default', () => {
    render(
      <PokemonArtwork
        alt="Pikachu"
        imageUrl="/images/pikachu.png"
      />,
    );

    expect(screen.getByAltText('Pikachu')).toHaveAttribute(
      'src',
      '/images/pikachu.png',
    );
    expect(screen.queryByAltText('Dynamax')).not.toBeInTheDocument();
    expect(screen.queryByAltText('Gigantamax')).not.toBeInTheDocument();
  });

  it('anchors the Dynamax badge inside the shared artwork wrapper', () => {
    render(
      <PokemonArtwork
        alt="Pikachu"
        dynamax
        imageUrl="/images/pikachu.png"
      />,
    );

    const pokemon = screen.getByAltText('Pikachu');
    const badge = screen.getByAltText('Dynamax');
    expect(pokemon.parentElement).toHaveClass('pokemon-artwork');
    expect(badge.parentElement).toBe(pokemon.parentElement);
    expect(badge).toHaveClass('pokemon-artwork__max-badge');
    expect(badge).toHaveAttribute('src', '/images/dynamax.png');
  });

  it('renders one Gigantamax badge when stale flags contain both Max forms', () => {
    render(
      <PokemonArtwork
        alt="Pikachu"
        dynamax
        gigantamax
        imageUrl="/images/pikachu.png"
      />,
    );

    expect(screen.queryByAltText('Dynamax')).not.toBeInTheDocument();
    expect(screen.getByAltText('Gigantamax')).toHaveAttribute(
      'src',
      '/images/gigantamax.png',
    );
  });

  it('forwards image errors through the reusable presentation', () => {
    const onError = vi.fn();
    render(
      <PokemonArtwork
        alt="Pikachu"
        imageUrl="/images/missing.png"
        onError={onError}
      />,
    );

    fireEvent.error(screen.getByAltText('Pikachu'));
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
