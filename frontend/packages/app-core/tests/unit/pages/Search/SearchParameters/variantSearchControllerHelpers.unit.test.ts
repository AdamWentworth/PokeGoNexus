import { describe, expect, it, vi } from 'vitest';

import {
  buildBooleanValidationToggle,
  buildCostumeResetImage,
  buildPokemonChangeResetState,
  buildSelectionValidationChange,
  buildSuggestionClickDecision,
  buildVariantValidationState,
  DEFAULT_SELECTED_GENDER,
  deriveValidationOutcomeDecision,
  evaluateCostumeToggle,
  evaluatePokemonInputFocus,
  evaluatePokemonInputChange,
  runVariantValidation,
} from '@/pages/Search/SearchParameters/variantSearchControllerHelpers';
import type { PokemonVariant } from '@/types/pokemonVariants';

const pokemonData = [
  { name: 'Bulbasaur' },
] as unknown as PokemonVariant[];

describe('variantSearchControllerHelpers', () => {
  it('builds validation state with overrides', () => {
    const state = buildVariantValidationState(
      {
        name: 'Bulbasaur',
        shinyChecked: false,
        shadowChecked: false,
        selectedCostume: '',
        form: '',
        selectedGenderValue: 'Any',
        dynamaxEnabled: false,
        gigantamaxEnabled: false,
      },
      {
        shinyChecked: true,
        form: 'Rockstar',
      },
    );

    expect(state).toMatchObject({
      name: 'Bulbasaur',
      shinyChecked: true,
      shadowChecked: false,
      form: 'Rockstar',
    });
  });

  it('runs validation and returns normalized forms/sorted costumes + image URL', () => {
    const validatePokemonFn = vi.fn().mockReturnValue({
      error: null,
      availableCostumes: [
        { name: 'Late', costume_id: 2, date_available: '2025-01-01' },
        { name: 'Early', costume_id: 1, date_available: '2024-01-01' },
      ],
      availableForms: ['None', 'Rockstar', ''],
    });
    const updateImageFn = vi.fn().mockReturnValue('/images/bulbasaur.png');

    const result = runVariantValidation({
      pokemonData,
      state: {
        name: 'Bulbasaur',
        shinyChecked: false,
        shadowChecked: false,
        selectedCostume: '',
        form: '',
        selectedGenderValue: 'Any',
        dynamaxEnabled: false,
        gigantamaxEnabled: false,
      },
      validatePokemonFn,
      updateImageFn,
    });

    expect(result.error).toBeNull();
    expect(result.availableCostumes.map((item) => item.name)).toEqual(['Early', 'Late']);
    expect(result.availableForms).toEqual(['None', 'Rockstar']);
    expect(result.imageUrl).toBe('/images/bulbasaur.png');
    expect(updateImageFn).toHaveBeenCalledTimes(1);
  });

  it('does not compute image URL when validation returns an error', () => {
    const validatePokemonFn = vi.fn().mockReturnValue({
      error: 'Bad input',
      availableCostumes: [],
      availableForms: [],
    });
    const updateImageFn = vi.fn();

    const result = runVariantValidation({
      pokemonData,
      state: {
        name: 'Bulbasaur',
        shinyChecked: false,
        shadowChecked: false,
        selectedCostume: '',
        form: '',
        selectedGenderValue: 'Any',
        dynamaxEnabled: false,
        gigantamaxEnabled: false,
      },
      validatePokemonFn,
      updateImageFn,
    });

    expect(result.error).toBe('Bad input');
    expect(result.imageUrl).toBeUndefined();
    expect(updateImageFn).not.toHaveBeenCalled();
  });

  it('evaluates pokemon input changes for ignore/reset/suggestion outcomes', () => {
    expect(
      evaluatePokemonInputChange({
        nextPokemon: 'A'.repeat(65),
        pokemonData,
      }),
    ).toEqual({
      shouldIgnore: true,
      shouldResetDerivedState: false,
      suggestions: [],
    });

    expect(
      evaluatePokemonInputChange({
        nextPokemon: '   ',
        pokemonData,
      }),
    ).toEqual({
      shouldIgnore: false,
      shouldResetDerivedState: true,
      suggestions: [],
    });

    expect(
      evaluatePokemonInputChange({
        nextPokemon: 'Bu',
        pokemonData,
      }),
    ).toEqual({
      shouldIgnore: false,
      shouldResetDerivedState: false,
      suggestions: [],
    });

    expect(
      evaluatePokemonInputChange({
        nextPokemon: 'Bul',
        pokemonData,
      }),
    ).toEqual({
      shouldIgnore: false,
      shouldResetDerivedState: false,
      suggestions: ['Bulbasaur'],
    });

    expect(
      evaluatePokemonInputChange({
        nextPokemon: 'Bulbasaur',
        pokemonData,
      }),
    ).toEqual({
      shouldIgnore: false,
      shouldResetDerivedState: false,
      suggestions: [],
    });
  });

  it('evaluates pokemon input focus suggestions', () => {
    expect(
      evaluatePokemonInputFocus({
        pokemon: '',
        pokemonData,
      }),
    ).toEqual([]);

    expect(
      evaluatePokemonInputFocus({
        pokemon: 'Bu',
        pokemonData,
      }),
    ).toEqual([]);

    expect(
      evaluatePokemonInputFocus({
        pokemon: 'Bul',
        pokemonData,
      }),
    ).toEqual(['Bulbasaur']);

    expect(
      evaluatePokemonInputFocus({
        pokemon: 'Bulbasaur',
        pokemonData,
      }),
    ).toEqual([]);
  });

  it('evaluates costume toggle open/close decisions', () => {
    expect(
      evaluateCostumeToggle({
        showCostumeDropdown: false,
      }),
    ).toEqual({
      nextShowCostumeDropdown: true,
      shouldResetCostumeSelection: false,
    });

    expect(
      evaluateCostumeToggle({
        showCostumeDropdown: true,
      }),
    ).toEqual({
      nextShowCostumeDropdown: false,
      shouldResetCostumeSelection: true,
    });
  });

  it('derives validation outcome decision for error and success states', () => {
    expect(
      deriveValidationOutcomeDecision({
        error: 'Bad input',
        availableCostumes: [],
        availableForms: [],
      }),
    ).toEqual({
      errorMessage: 'Bad input',
      shouldClearError: false,
      shouldUpdateImage: false,
      nextImageUrl: null,
    });

    expect(
      deriveValidationOutcomeDecision({
        error: null,
        availableCostumes: [],
        availableForms: [],
        imageUrl: '/images/bulbasaur.png',
      }),
    ).toEqual({
      errorMessage: null,
      shouldClearError: true,
      shouldUpdateImage: true,
      nextImageUrl: '/images/bulbasaur.png',
    });
  });

  it('builds pokemon-change reset state with canonical defaults', () => {
    expect(buildPokemonChangeResetState()).toEqual({
      selectedForm: '',
      selectedGender: DEFAULT_SELECTED_GENDER,
      selectedMoves: {
        fastMove: null,
        chargedMove1: null,
        chargedMove2: null,
      },
      dynamax: false,
      gigantamax: false,
    });
  });

  it('builds costume reset image using empty costume selector', () => {
    const updateImageFn = vi.fn().mockReturnValue('/images/reset.png');
    const result = buildCostumeResetImage({
      pokemonData,
      pokemon: 'Bulbasaur',
      isShiny: true,
      isShadow: false,
      selectedForm: 'None',
      selectedGender: 'Any',
      dynamax: true,
      gigantamax: false,
      updateImageFn,
    });

    expect(result).toBe('/images/reset.png');
    expect(updateImageFn).toHaveBeenCalledWith(
      pokemonData,
      'Bulbasaur',
      true,
      false,
      '',
      'None',
      'Any',
      true,
      false,
    );
  });

  it('builds boolean validation toggles for shiny and shadow fields', () => {
    expect(
      buildBooleanValidationToggle({
        currentValue: false,
        field: 'shinyChecked',
      }),
    ).toEqual({
      nextValue: true,
      validationPatch: {
        shinyChecked: true,
      },
    });

    expect(
      buildBooleanValidationToggle({
        currentValue: true,
        field: 'shadowChecked',
      }),
    ).toEqual({
      nextValue: false,
      validationPatch: {
        shadowChecked: false,
      },
    });
  });

  it('builds typed selection validation changes for costume and form', () => {
    expect(
      buildSelectionValidationChange({
        value: 'Party',
        field: 'selectedCostume',
      }),
    ).toEqual({
      value: 'Party',
      validationPatch: {
        selectedCostume: 'Party',
      },
    });

    expect(
      buildSelectionValidationChange({
        value: 'Origin',
        field: 'form',
      }),
    ).toEqual({
      value: 'Origin',
      validationPatch: {
        form: 'Origin',
      },
    });
  });

  it('builds suggestion click decision with pokemon + validation patch', () => {
    expect(
      buildSuggestionClickDecision({
        suggestion: 'Bulbasaur',
      }),
    ).toEqual({
      nextPokemon: 'Bulbasaur',
      nextSuggestions: [],
      validationPatch: {
        name: 'Bulbasaur',
      },
    });
  });
});
