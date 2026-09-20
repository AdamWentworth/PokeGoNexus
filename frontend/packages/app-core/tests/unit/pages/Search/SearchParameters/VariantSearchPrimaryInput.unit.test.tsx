import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { VariantSearchPrimaryInput } from '@/pages/Search/SearchParameters/VariantSearch';
import type { UseVariantSearchControllerResult } from '@/pages/Search/SearchParameters/useVariantSearchController';
import type { PokemonVariant } from '@/types/pokemonVariants';

const buildController = (
  overrides: Partial<UseVariantSearchControllerResult> = {},
): UseVariantSearchControllerResult =>
  ({
    handleImageError: vi.fn(),
    handleInputBlur: vi.fn(),
    handleInputFocus: vi.fn(),
    handlePokemonChange: vi.fn(),
    handleSuggestionClick: vi.fn(),
    imageError: false,
    imageUrl: '/images/bulbasaur.png',
    selectedBackground: {
      background_id: 1,
      costume_id: undefined,
      date: '2026-08-19',
      image_url: '/images/location-background.png',
      location: 'Vancouver',
      name: 'Vancouver background',
    },
    suggestions: [],
    ...overrides,
  }) as UseVariantSearchControllerResult;

describe('VariantSearchPrimaryInput', () => {
  it('shows the exact selected Pokémon appearance beside the input', () => {
    const controller = buildController();

    render(
      <VariantSearchPrimaryInput
        controller={controller}
        dynamax
        gigantamax={false}
        pokemon="Bulbasaur"
        pokemonCache={[]}
      />,
    );

    expect(screen.getByPlaceholderText('Enter Pokemon name')).toHaveValue(
      'Bulbasaur',
    );
    const preview = screen.getByAltText('Bulbasaur preview');
    expect(preview).toHaveAttribute('src', '/images/bulbasaur.png');
    expect(preview.closest('.search-primary-pokemon-control')).toHaveClass(
      'has-preview',
    );
    const previewFrame = preview.closest('.selected-pokemon-preview');
    expect(previewFrame).toHaveClass('has-background');
    expect(previewFrame).toHaveStyle({
      backgroundImage: 'url(/images/location-background.png)',
    });
    expect(screen.getByAltText('Dynamax').parentElement).toBe(
      preview.parentElement,
    );
    expect(screen.getByAltText('Dynamax')).toHaveAttribute(
      'src',
      '/images/dynamax.png',
    );

    fireEvent.error(preview);
    expect(controller.handleImageError).toHaveBeenCalledTimes(1);
  });

  it('does not reserve preview space before a valid image is available', () => {
    render(
      <VariantSearchPrimaryInput
        controller={buildController({ imageUrl: null })}
        dynamax={false}
        gigantamax={false}
        pokemon="Bul"
        pokemonCache={[]}
      />,
    );

    expect(screen.getByPlaceholderText('Enter Pokemon name')).toBeInTheDocument();
    expect(
      screen
        .getByPlaceholderText('Enter Pokemon name')
        .closest('.search-primary-pokemon-control'),
    ).not.toHaveClass('has-preview');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('enriches matching names with catalog imagery and Pokédex details', () => {
    const pokemonCache = [
      {
        image_url: '/images/bulbasaur.png',
        name: 'Bulbasaur',
        pokedex_number: 1,
        type1_name: 'Grass',
        type2_name: 'Poison',
        variant_id: '0001-default',
      } as PokemonVariant,
    ];

    render(
      <VariantSearchPrimaryInput
        controller={buildController({
          imageUrl: null,
          suggestions: ['Bulbasaur'],
        })}
        dynamax={false}
        gigantamax={false}
        pokemon="Bul"
        pokemonCache={pokemonCache}
      />,
    );

    expect(screen.getByRole('option', { name: /Bulbasaur/ }))
      .toBeInTheDocument();
    expect(screen.getByText('#0001')).toBeInTheDocument();
    expect(screen.getByText('Grass · Poison')).toBeInTheDocument();
  });
});
