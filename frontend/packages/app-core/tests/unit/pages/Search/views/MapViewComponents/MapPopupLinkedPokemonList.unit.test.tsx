import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import MapPopupLinkedPokemonList from '@/pages/Search/views/MapViewComponents/MapPopupLinkedPokemonList';

describe('MapPopupLinkedPokemonList', () => {
  it('shows three resolved entries, the total, and a concise remainder', () => {
    const findPokemonByKey = vi.fn((key?: string | null) => ({
      currentImage: `/images/${key ?? 'unknown'}.png`,
      name: key ?? 'Unknown',
      form: null,
    }));
    const entries = {
      Bulbasaur: { match: true },
      Charmander: { match: false },
      Squirtle: { match: false },
      Pikachu: { match: false },
    };

    render(
      <MapPopupLinkedPokemonList
        entries={entries}
        findPokemonByKey={findPokemonByKey}
        title="Trainer wants"
      />,
    );

    expect(screen.getByText('Trainer wants')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByAltText('Bulbasaur')).toHaveClass('glowing-pokemon');
    expect(screen.getByAltText('Charmander')).toBeInTheDocument();
    expect(screen.getByAltText('Squirtle')).toBeInTheDocument();
    expect(screen.queryByAltText('Pikachu')).not.toBeInTheDocument();
    expect(screen.getByText('+1 more')).toBeInTheDocument();
  });

  it('omits unresolved or absent entries cleanly', () => {
    const findPokemonByKey = vi.fn().mockReturnValue(null);
    const { container, rerender } = render(
      <MapPopupLinkedPokemonList
        entries={{ missing: { match: false } }}
        findPokemonByKey={findPokemonByKey}
        title="Trainer can offer"
      />,
    );

    expect(container.firstChild).toBeNull();

    rerender(
      <MapPopupLinkedPokemonList
        entries={null}
        findPokemonByKey={findPokemonByKey}
        title="Trainer can offer"
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
