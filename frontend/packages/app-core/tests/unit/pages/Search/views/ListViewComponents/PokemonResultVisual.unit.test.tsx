import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

import PokemonResultVisual from '@/pages/Search/views/ListViewComponents/PokemonResultVisual';

describe('PokemonResultVisual', () => {
  it('uses valid block markup when a gender icon accompanies the name', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const view = render(
      <PokemonResultVisual
        imageUrl="/images/pikachu.png"
        pokemonDisplayName="Pikachu"
        genderValue="Male"
      />,
    );

    expect(view.container.querySelector('.pokemon-name')?.tagName).toBe('DIV');
    expect(view.container.querySelector('p .gender-container')).toBeNull();
    expect(
      consoleError.mock.calls.some(([message]) =>
        String(message).includes('cannot be a descendant of <p>'),
      ),
    ).toBe(false);
  });

  it('does not render an empty gender control when no gender is specified', () => {
    const view = render(
      <PokemonResultVisual
        imageUrl="/images/pikachu.png"
        pokemonDisplayName="Pikachu"
        genderValue={null}
      />,
    );

    expect(view.container.querySelector('.gender-container')).toBeNull();
    expect(view.container.querySelector('.pokemon-image-container')).not.toHaveClass(
      'pokemon-image-container--with-detail',
    );
  });

  it('reserves a detail row only when leading metadata is present', () => {
    const view = render(
      <PokemonResultVisual
        beforeImage={<span>CP 1200</span>}
        imageUrl="/images/pikachu.png"
        pokemonDisplayName="Pikachu"
        genderValue={null}
      />,
    );

    expect(view.container.querySelector('.pokemon-image-container')).toHaveClass(
      'pokemon-image-container--with-detail',
    );
  });
});
