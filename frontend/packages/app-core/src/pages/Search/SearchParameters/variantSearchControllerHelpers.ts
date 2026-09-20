import validatePokemon from '../utils/validatePokemon';
import { updateImage } from '../utils/updateImage';
import {
  getPokemonSuggestions,
  normalizeAvailableForms,
  sortCostumesByDate,
  type SortableCostume,
} from './variantSearchHelpers';
import type { PokemonVariant } from '@/types/pokemonVariants';

export type VariantValidationState = {
  name: string;
  shinyChecked: boolean;
  shadowChecked: boolean;
  selectedCostume: string | null;
  form: string;
  selectedGenderValue: string | null;
  dynamaxEnabled: boolean;
  gigantamaxEnabled: boolean;
};

type VariantValidationOutcome = {
  error: string | null;
  availableCostumes: SortableCostume[];
  availableForms: string[];
  imageUrl?: string | null;
};

export type ValidationOutcomeDecision = {
  errorMessage: string | null;
  shouldClearError: boolean;
  shouldUpdateImage: boolean;
  nextImageUrl: string | null;
};

export type PokemonChangeResetState = {
  selectedForm: string;
  selectedGender: string;
  selectedMoves: typeof EMPTY_SELECTED_MOVES;
  dynamax: boolean;
  gigantamax: boolean;
};

type EvaluatePokemonInputFocusArgs = {
  pokemon: string;
  pokemonData: PokemonVariant[];
  minSuggestionChars?: number;
};

type EvaluatePokemonInputChangeArgs = {
  nextPokemon: string;
  pokemonData: PokemonVariant[];
  minSuggestionChars?: number;
  maxPokemonLength?: number;
};

type EvaluateCostumeToggleArgs = {
  showCostumeDropdown: boolean;
};

type BuildBooleanValidationToggleArgs<
  K extends BooleanValidationToggleField,
> = {
  currentValue: boolean;
  field: K;
};

type BuildSelectionValidationChangeArgs<
  K extends SelectionValidationField,
> = {
  value: VariantValidationState[K];
  field: K;
};

type BuildSuggestionClickDecisionArgs = {
  suggestion: string;
};

type BooleanValidationToggleField = 'shinyChecked' | 'shadowChecked';
type SelectionValidationField = 'selectedCostume' | 'form' | 'name';

export type CostumeToggleDecision = {
  nextShowCostumeDropdown: boolean;
  shouldResetCostumeSelection: boolean;
};

export type BooleanValidationToggleDecision<
  K extends BooleanValidationToggleField,
> = {
  nextValue: boolean;
  validationPatch: Pick<VariantValidationState, K>;
};

export type SelectionValidationChangeDecision<
  K extends SelectionValidationField,
> = {
  value: VariantValidationState[K];
  validationPatch: Pick<VariantValidationState, K>;
};

export type SuggestionClickDecision = {
  nextPokemon: string;
  nextSuggestions: [];
  validationPatch: Pick<VariantValidationState, 'name'>;
};

export type PokemonInputChangeDecision = {
  shouldIgnore: boolean;
  shouldResetDerivedState: boolean;
  suggestions: string[];
};

type RunVariantValidationArgs = {
  pokemonData: PokemonVariant[];
  state: VariantValidationState;
  validatePokemonFn?: typeof validatePokemon;
  updateImageFn?: typeof updateImage;
};

type BuildCostumeResetImageArgs = {
  pokemonData: PokemonVariant[];
  pokemon: string;
  isShiny: boolean;
  isShadow: boolean;
  selectedForm: string;
  selectedGender: string | null;
  dynamax: boolean;
  gigantamax: boolean;
  updateImageFn?: typeof updateImage;
};

type ValidatePokemonResult = ReturnType<typeof validatePokemon>;

const toValidatePokemonInput = (
  pokemonData: PokemonVariant[],
): Parameters<typeof validatePokemon>[0] =>
  pokemonData as unknown as Parameters<typeof validatePokemon>[0];

export const buildVariantValidationState = (
  base: VariantValidationState,
  overrides: Partial<VariantValidationState> = {},
): VariantValidationState => ({
  ...base,
  ...overrides,
});

export const runVariantValidation = ({
  pokemonData,
  state,
  validatePokemonFn = validatePokemon,
  updateImageFn = updateImage,
}: RunVariantValidationArgs): VariantValidationOutcome => {
  const {
    error,
    availableCostumes: validatedCostumes,
    availableForms: validatedForms,
  } = validatePokemonFn(
    toValidatePokemonInput(pokemonData),
    state.name,
    state.shinyChecked,
    state.shadowChecked,
    state.selectedCostume,
    state.form,
    state.dynamaxEnabled,
    state.gigantamaxEnabled,
  ) as ValidatePokemonResult;

  const availableCostumes = sortCostumesByDate(
    validatedCostumes as unknown as SortableCostume[],
  );
  const availableForms = normalizeAvailableForms(validatedForms);

  if (error) {
    return {
      error,
      availableCostumes,
      availableForms,
    };
  }

  const imageUrl = updateImageFn(
    pokemonData,
    state.name,
    state.shinyChecked,
    state.shadowChecked,
    state.selectedCostume,
    state.form,
    state.selectedGenderValue,
    state.dynamaxEnabled,
    state.gigantamaxEnabled,
  );

  return {
    error: null,
    availableCostumes,
    availableForms,
    imageUrl,
  };
};

export const deriveValidationOutcomeDecision = (
  result: VariantValidationOutcome,
): ValidationOutcomeDecision => {
  if (result.error) {
    return {
      errorMessage: result.error,
      shouldClearError: false,
      shouldUpdateImage: false,
      nextImageUrl: null,
    };
  }

  return {
    errorMessage: null,
    shouldClearError: true,
    shouldUpdateImage: true,
    nextImageUrl: result.imageUrl ?? null,
  };
};

export const evaluatePokemonInputChange = ({
  nextPokemon,
  pokemonData,
  minSuggestionChars = 3,
  maxPokemonLength = 64,
}: EvaluatePokemonInputChangeArgs): PokemonInputChangeDecision => {
  if (nextPokemon.length > maxPokemonLength) {
    return {
      shouldIgnore: true,
      shouldResetDerivedState: false,
      suggestions: [],
    };
  }

  const normalized = nextPokemon.trim();
  if (!normalized) {
    return {
      shouldIgnore: false,
      shouldResetDerivedState: true,
      suggestions: [],
    };
  }

  if (nextPokemon.length < minSuggestionChars) {
    return {
      shouldIgnore: false,
      shouldResetDerivedState: false,
      suggestions: [],
    };
  }

  return {
    shouldIgnore: false,
    shouldResetDerivedState: false,
    suggestions: getPokemonSuggestions(pokemonData, nextPokemon),
  };
};

export const evaluatePokemonInputFocus = ({
  pokemon,
  pokemonData,
  minSuggestionChars = 3,
}: EvaluatePokemonInputFocusArgs): string[] => {
  if (!pokemon || pokemon.length < minSuggestionChars) {
    return [];
  }

  return getPokemonSuggestions(pokemonData, pokemon);
};

export const evaluateCostumeToggle = ({
  showCostumeDropdown,
}: EvaluateCostumeToggleArgs): CostumeToggleDecision => {
  const nextShowCostumeDropdown = !showCostumeDropdown;
  return {
    nextShowCostumeDropdown,
    shouldResetCostumeSelection: !nextShowCostumeDropdown,
  };
};

export const buildBooleanValidationToggle = <
  K extends BooleanValidationToggleField,
>({
  currentValue,
  field,
}: BuildBooleanValidationToggleArgs<K>): BooleanValidationToggleDecision<K> => {
  const nextValue = !currentValue;
  return {
    nextValue,
    validationPatch: {
      [field]: nextValue,
    } as Pick<VariantValidationState, K>,
  };
};

export const buildSelectionValidationChange = <
  K extends SelectionValidationField,
>({
  value,
  field,
}: BuildSelectionValidationChangeArgs<K>): SelectionValidationChangeDecision<K> => ({
  value,
  validationPatch: {
    [field]: value,
  } as Pick<VariantValidationState, K>,
});

export const buildSuggestionClickDecision = ({
  suggestion,
}: BuildSuggestionClickDecisionArgs): SuggestionClickDecision => ({
  nextPokemon: suggestion,
  nextSuggestions: [],
  validationPatch: {
    name: suggestion,
  },
});

export const buildCostumeResetImage = ({
  pokemonData,
  pokemon,
  isShiny,
  isShadow,
  selectedForm,
  selectedGender,
  dynamax,
  gigantamax,
  updateImageFn = updateImage,
}: BuildCostumeResetImageArgs): string | null =>
  updateImageFn(
    pokemonData,
    pokemon,
    isShiny,
    isShadow,
    '',
    selectedForm,
    selectedGender,
    dynamax,
    gigantamax,
  );

export const EMPTY_SELECTED_MOVES = {
  fastMove: null,
  chargedMove1: null,
  chargedMove2: null,
} as const;

export const DEFAULT_SELECTED_GENDER = 'Any';

export const buildPokemonChangeResetState = (): PokemonChangeResetState => ({
  selectedForm: '',
  selectedGender: DEFAULT_SELECTED_GENDER,
  selectedMoves: EMPTY_SELECTED_MOVES,
  dynamax: false,
  gigantamax: false,
});
