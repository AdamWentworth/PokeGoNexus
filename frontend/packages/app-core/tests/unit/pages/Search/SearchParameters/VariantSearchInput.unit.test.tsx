import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import VariantSearchInput from '@/pages/Search/SearchParameters/VariantSearchInput';

describe('VariantSearchInput', () => {
  it('forwards input/focus/blur callbacks', () => {
    const onPokemonChange = vi.fn();
    const onInputFocus = vi.fn();
    const onInputBlur = vi.fn();

    render(
      <VariantSearchInput
        pokemon="Bul"
        suggestions={[]}
        onClear={vi.fn()}
        onDismissSuggestions={vi.fn()}
        onPokemonChange={onPokemonChange}
        onInputFocus={onInputFocus}
        onInputBlur={onInputBlur}
        onSuggestionClick={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText('Enter Pokemon name');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Bulb' } });
    fireEvent.blur(input);

    expect(onInputFocus).toHaveBeenCalledTimes(1);
    expect(onPokemonChange).toHaveBeenCalledTimes(1);
    expect(onInputBlur).toHaveBeenCalledTimes(1);
  });

  it('renders suggestions and forwards selection callback', () => {
    const onSuggestionClick = vi.fn();
    render(
      <VariantSearchInput
        pokemon="Bul"
        suggestions={[
          {
            imageUrl: '/images/bulbasaur.png',
            name: 'Bulbasaur',
            pokedexNumber: 1,
            types: ['Grass', 'Poison'],
          },
          { name: 'Bulbizarre', pokedexNumber: 2 },
        ]}
        onClear={vi.fn()}
        onDismissSuggestions={vi.fn()}
        onPokemonChange={vi.fn()}
        onInputFocus={vi.fn()}
        onInputBlur={vi.fn()}
        onSuggestionClick={onSuggestionClick}
      />,
    );

    expect(screen.getByRole('listbox', { name: 'Pokémon suggestions' }))
      .toBeInTheDocument();
    expect(screen.getByAltText('')).toHaveAttribute(
      'src',
      '/images/bulbasaur.png',
    );
    expect(screen.getByText('#0001')).toBeInTheDocument();
    expect(screen.getByText('Grass · Poison')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('option', { name: /Bulbasaur/ }));
    expect(onSuggestionClick).toHaveBeenCalledWith('Bulbasaur');
    expect(screen.getByRole('option', { name: /Bulbizarre/ }))
      .toBeInTheDocument();
  });

  it('supports keyboard selection, dismissal, and clearing', () => {
    const onSuggestionClick = vi.fn();
    const onDismissSuggestions = vi.fn();
    const onClear = vi.fn();

    render(
      <VariantSearchInput
        pokemon="Bul"
        suggestions={[
          { name: 'Bulbasaur', pokedexNumber: 1 },
          { name: 'Bulbizarre', pokedexNumber: 2 },
        ]}
        onClear={onClear}
        onDismissSuggestions={onDismissSuggestions}
        onPokemonChange={vi.fn()}
        onInputFocus={vi.fn()}
        onInputBlur={vi.fn()}
        onSuggestionClick={onSuggestionClick}
      />,
    );

    const input = screen.getByRole('combobox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByRole('option', { name: /Bulbasaur/ }))
      .toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSuggestionClick).toHaveBeenCalledWith('Bulbasaur');

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onDismissSuggestions).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Clear Pokémon' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
