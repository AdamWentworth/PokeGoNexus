import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import AppearanceFilters from '@/pages/Search/SearchParameters/AppearanceFilters';
import type { UseVariantSearchControllerResult } from '@/pages/Search/SearchParameters/useVariantSearchController';
import type { PokemonVariant } from '@/types/pokemonVariants';

const variant = {
  name: 'Bulbasaur',
  gender_rate: '50_50_0',
  moves: [
    { move_id: 1, name: 'Vine Whip', is_fast: 1, legacy: false },
    { move_id: 2, name: 'Power Whip', is_fast: 0, legacy: false },
    { move_id: 3, name: 'Sludge Bomb', is_fast: 0, legacy: true },
  ],
} as unknown as PokemonVariant;

const makeController = (
  overrides: Partial<UseVariantSearchControllerResult> = {},
): UseVariantSearchControllerResult =>
  ({
    currentPokemonData: variant,
    availableForms: ['Normal', 'Mega'],
    availableCostumes: [
      { name: 'Party', costume_id: 7, date_available: '2024-01-01' },
    ],
    imageUrl: '/images/bulbasaur.png',
    imageError: false,
    showCostumeDropdown: true,
    selectedBackground: null,
    showBackgroundOverlay: false,
    suggestions: [],
    backgroundAllowed: true,
    selectedCostumeId: 7,
    canDynamax: true,
    hasDynamax: true,
    hasGigantamax: true,
    setMaxMode: vi.fn(),
    toggleMax: vi.fn(),
    setShowBackgroundOverlay: vi.fn(),
    handleImageError: vi.fn(),
    handleBackgroundChange: vi.fn(),
    handleClearPokemon: vi.fn(),
    handleGenderChange: vi.fn(),
    handlePokemonChange: vi.fn(),
    handleInputFocus: vi.fn(),
    handleInputBlur: vi.fn(),
    handleShinyChange: vi.fn(),
    handleShadowChange: vi.fn(),
    handleCostumeToggle: vi.fn(),
    handleCostumeChange: vi.fn(),
    handleFormChange: vi.fn(),
    handleMovesChange: vi.fn(),
    handleSuggestionClick: vi.fn(),
    resetVariantFilters: vi.fn(),
    ...overrides,
  }) as UseVariantSearchControllerResult;

const renderFilters = (
  controller: UseVariantSearchControllerResult = makeController(),
  overrides: Partial<React.ComponentProps<typeof AppearanceFilters>> = {},
) =>
  render(
    <AppearanceFilters
      controller={controller}
      costume="Party"
      dynamax={false}
      gigantamax={false}
      isShadow={false}
      isShiny={false}
      pokemon="Bulbasaur"
      selectedForm=""
      selectedGender="Any"
      selectedMoves={{
        fastMove: null,
        chargedMove1: null,
        chargedMove2: null,
      }}
      {...overrides}
    />,
  );

describe('AppearanceFilters', () => {
  it('presents all appearance filter groups with a selected Pokémon preview', () => {
    renderFilters();

    expect(screen.getByText('Variant')).toBeInTheDocument();
    expect(screen.getByText('Gender and moves')).toBeInTheDocument();
    expect(screen.getByText('Location background')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Bulbasaur' })).toBeInTheDocument();
    expect(screen.getByLabelText('Fast move')).toBeInTheDocument();
    expect(screen.getByLabelText('Charged move')).toBeInTheDocument();
    expect(screen.getByLabelText('Second charged move')).toBeInTheDocument();
  });

  it('enables move filters after the selected Pokémon receives its hydrated moves', () => {
    renderFilters();

    expect(screen.getByLabelText('Fast move')).toBeEnabled();
    expect(screen.getByLabelText('Charged move')).toBeEnabled();
    expect(screen.getByLabelText('Second charged move')).toBeEnabled();
  });

  it('keeps move filters unavailable when the moves chunk has no matching data', () => {
    renderFilters(
      makeController({
        currentPokemonData: {
          ...variant,
          moves: [],
        } as PokemonVariant,
      }),
    );

    expect(screen.getByLabelText('Fast move')).toBeDisabled();
    expect(screen.getByLabelText('Charged move')).toBeDisabled();
    expect(screen.getByLabelText('Second charged move')).toBeDisabled();
  });

  it('anchors Max badges to the shared Pokémon artwork instead of the preview frame', () => {
    renderFilters(makeController(), { gigantamax: true });

    const pokemon = screen.getByRole('img', { name: 'Bulbasaur' });
    const badge = screen.getByRole('img', { name: 'Gigantamax' });
    expect(pokemon.parentElement).toHaveClass(
      'pokemon-artwork',
      'appearance-preview__artwork',
    );
    expect(badge.parentElement).toBe(pokemon.parentElement);
    expect(badge.closest('.appearance-preview')).toBeInTheDocument();
  });

  it('dispatches variant, Max, gender, and background selections', () => {
    const controller = makeController();
    renderFilters(controller);

    fireEvent.click(screen.getByRole('button', { name: /Shiny/ }));
    fireEvent.click(screen.getByRole('button', { name: /Shadow/ }));
    fireEvent.click(screen.getByRole('button', { name: 'CostumeParty' }));
    fireEvent.click(screen.getByLabelText('Form'));
    fireEvent.click(screen.getByRole('option', { name: 'Mega' }));
    fireEvent.click(screen.getByLabelText('Costume'));
    fireEvent.click(screen.getByRole('option', { name: 'Party' }));
    fireEvent.click(screen.getByRole('button', { name: 'Gigantamax' }));
    fireEvent.click(screen.getByRole('button', { name: 'Female' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose' }));

    expect(controller.handleShinyChange).toHaveBeenCalledTimes(1);
    expect(controller.handleShadowChange).toHaveBeenCalledTimes(1);
    expect(controller.handleCostumeToggle).toHaveBeenCalledTimes(1);
    expect(controller.handleFormChange).toHaveBeenCalledTimes(1);
    expect(controller.handleCostumeChange).toHaveBeenCalledTimes(1);
    expect(controller.setMaxMode).toHaveBeenCalledWith('gigantamax');
    expect(controller.handleGenderChange).toHaveBeenCalledWith('Female');
    expect(controller.setShowBackgroundOverlay).toHaveBeenCalledWith(true);
  });

  it('shows the exact costume paired with a selected background', () => {
    const controller = makeController({
      selectedBackground: {
        background_id: 42,
        costume_id: 7,
        image_url: '/images/party-bg.png',
        name: 'Party City',
        location: 'Seattle',
        date: '2025-01-02',
      },
    });
    const { container } = renderFilters(controller);

    const summary = container.querySelector('.appearance-background-summary');
    expect(summary).toHaveTextContent('Party City');
    expect(summary).toHaveTextContent('Seattle');
    expect(summary).toHaveTextContent('Party');
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(controller.handleBackgroundChange).toHaveBeenCalledWith(null);
  });

  it('updates each move slot without changing the other selections', () => {
    const controller = makeController();
    renderFilters(controller);

    fireEvent.click(screen.getByLabelText('Fast move'));
    fireEvent.click(screen.getByRole('option', { name: 'Vine Whip' }));
    fireEvent.click(screen.getByLabelText('Charged move'));
    fireEvent.click(screen.getByRole('option', { name: 'Power Whip' }));
    fireEvent.click(screen.getByLabelText('Second charged move'));
    fireEvent.click(screen.getByRole('option', { name: 'Sludge Bomb*' }));

    expect(controller.handleMovesChange).toHaveBeenNthCalledWith(1, {
      fastMove: 1,
      chargedMove1: null,
      chargedMove2: null,
    });
    expect(controller.handleMovesChange).toHaveBeenNthCalledWith(2, {
      fastMove: null,
      chargedMove1: 2,
      chargedMove2: null,
    });
    expect(controller.handleMovesChange).toHaveBeenNthCalledWith(3, {
      fastMove: null,
      chargedMove1: null,
      chargedMove2: 3,
    });
  });
});
