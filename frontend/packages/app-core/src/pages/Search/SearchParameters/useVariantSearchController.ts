import { useEffect, useRef, useState } from 'react';
import { feedback } from '@/components/feedback';

import validatePokemon from '../utils/validatePokemon';
import { updateImage } from '../utils/updateImage';
import { formatCostumeName } from '../utils/formatCostumeName';
import useErrorHandler from '../hooks/useErrorHandler';
import {
  computeMaxAvailability,
  cycleMaxState,
  getSelectedCostumeId,
  isBackgroundAllowedForSelection,
  type SortableCostume,
} from './variantSearchHelpers';
import {
  buildBooleanValidationToggle,
  buildCostumeResetImage,
  buildPokemonChangeResetState,
  buildSelectionValidationChange,
  buildSuggestionClickDecision,
  buildVariantValidationState,
  deriveValidationOutcomeDecision,
  evaluateCostumeToggle,
  evaluatePokemonInputChange,
  evaluatePokemonInputFocus,
  runVariantValidation,
  type VariantValidationState,
} from './variantSearchControllerHelpers';
import type { BackgroundSelection } from './VariantSearchBackgroundOverlay';
import type { SelectedMoves } from '../utils/buildPokemonSearchQuery';
import type { PokemonVariant } from '@/types/pokemonVariants';
import { resolveBackgroundCostume } from '@/utils/backgroundCostume';

export interface UseVariantSearchControllerArgs {
  pokemon: string;
  setPokemon: React.Dispatch<React.SetStateAction<string>>;
  isShiny: boolean;
  setIsShiny: React.Dispatch<React.SetStateAction<boolean>>;
  isShadow: boolean;
  setIsShadow: React.Dispatch<React.SetStateAction<boolean>>;
  costume: string | null;
  setCostume: React.Dispatch<React.SetStateAction<string | null>>;
  selectedForm: string;
  setSelectedForm: React.Dispatch<React.SetStateAction<string>>;
  selectedMoves: SelectedMoves;
  setSelectedMoves: React.Dispatch<React.SetStateAction<SelectedMoves>>;
  selectedGender: string | null;
  setSelectedGender: React.Dispatch<React.SetStateAction<string | null>>;
  setErrorMessage: React.Dispatch<React.SetStateAction<string | null>>;
  selectedBackgroundId?: number | null;
  setSelectedBackgroundId: React.Dispatch<React.SetStateAction<number | null>>;
  dynamax: boolean;
  setDynamax: React.Dispatch<React.SetStateAction<boolean>>;
  gigantamax: boolean;
  setGigantamax: React.Dispatch<React.SetStateAction<boolean>>;
  pokemonCache: PokemonVariant[] | null;
}

export interface UseVariantSearchControllerResult {
  currentPokemonData: PokemonVariant | undefined;
  availableForms: string[];
  availableCostumes: SortableCostume[];
  imageUrl: string | null;
  imageError: boolean;
  showCostumeDropdown: boolean;
  selectedBackground: BackgroundSelection | null;
  showBackgroundOverlay: boolean;
  suggestions: string[];
  backgroundAllowed: boolean;
  selectedCostumeId: number | undefined;
  canDynamax: boolean;
  hasDynamax: boolean;
  hasGigantamax: boolean;
  setMaxMode: (mode: 'standard' | 'dynamax' | 'gigantamax') => void;
  toggleMax: () => void;
  setShowBackgroundOverlay: React.Dispatch<React.SetStateAction<boolean>>;
  handleImageError: () => void;
  handleBackgroundChange: (background: BackgroundSelection | null) => void;
  handleClearPokemon: () => void;
  handleGenderChange: (gender: string | null) => void;
  handlePokemonChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleInputFocus: () => void;
  handleInputBlur: () => void;
  handleShinyChange: () => void;
  handleShadowChange: () => void;
  handleCostumeToggle: () => void;
  handleCostumeChange: (value: string) => void;
  handleFormChange: (value: string) => void;
  handleMovesChange: (moves: SelectedMoves) => void;
  handleSuggestionClick: (suggestion: string) => void;
  resetVariantFilters: () => void;
}

const useVariantSearchController = ({
  pokemon,
  setPokemon,
  isShiny,
  setIsShiny,
  isShadow,
  setIsShadow,
  costume,
  setCostume,
  selectedForm,
  setSelectedForm,
  selectedMoves: _selectedMoves,
  setSelectedMoves,
  selectedGender,
  setSelectedGender,
  setErrorMessage,
  selectedBackgroundId,
  setSelectedBackgroundId,
  dynamax,
  setDynamax,
  gigantamax,
  setGigantamax,
  pokemonCache,
}: UseVariantSearchControllerArgs): UseVariantSearchControllerResult => {
  const { handleError, clearError } = useErrorHandler<string>();
  const [availableForms, setAvailableForms] = useState<string[]>([]);
  const [availableCostumes, setAvailableCostumes] = useState<SortableCostume[]>([]);
  const pokemonData = pokemonCache ?? [];
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [showCostumeDropdown, setShowCostumeDropdown] = useState(false);
  const [selectedBackground, setSelectedBackground] =
    useState<BackgroundSelection | null>(null);
  const [showBackgroundOverlay, setShowBackgroundOverlay] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [pokemonInputFocused, setPokemonInputFocused] = useState(false);

  const currentPokemonData = pokemonData.find(
    (entry) =>
      entry.name.toLowerCase() === (pokemon || '').toLowerCase() &&
      (!selectedForm ||
        (entry.form ?? '').toLowerCase() === selectedForm.toLowerCase()),
  );
  const { hasDynamax, hasGigantamax } = computeMaxAvailability(currentPokemonData);
  const backgroundAllowed = isBackgroundAllowedForSelection(
    currentPokemonData,
    costume,
    availableCostumes,
  );
  const selectedCostumeId = getSelectedCostumeId(availableCostumes, costume);
  const canDynamax = hasDynamax || hasGigantamax;
  const validationState: VariantValidationState = {
    name: pokemon,
    shinyChecked: isShiny,
    shadowChecked: isShadow,
    selectedCostume: costume,
    form: selectedForm,
    selectedGenderValue: selectedGender,
    dynamaxEnabled: dynamax,
    gigantamaxEnabled: gigantamax,
  };

  const handleValidation = (overrides: Partial<VariantValidationState> = {}) => {
    const nextState = buildVariantValidationState(validationState, overrides);
    const result = runVariantValidation({
      pokemonData,
      state: nextState,
      validatePokemonFn: validatePokemon,
      updateImageFn: updateImage,
    });
    const validationDecision = deriveValidationOutcomeDecision(result);
    setErrorMessage(validationDecision.errorMessage);
    if (validationDecision.shouldClearError) {
      clearError();
    } else if (validationDecision.errorMessage) {
      handleError(validationDecision.errorMessage);
    }

    setAvailableCostumes(result.availableCostumes);
    setAvailableForms(result.availableForms);

    if (validationDecision.shouldUpdateImage) {
      setImageUrl(validationDecision.nextImageUrl);
      setImageError(false);
    }
  };

  const handleValidationRef = useRef(handleValidation);
  handleValidationRef.current = handleValidation;

  const applyMaxMode = (nextDynamax: boolean, nextGigantamax: boolean) => {
    const maxEnabled = nextDynamax || nextGigantamax;
    const nextCostume = maxEnabled ? null : costume;
    const nextShadow = maxEnabled ? false : isShadow;

    setDynamax(nextDynamax);
    setGigantamax(nextGigantamax);

    if (maxEnabled) {
      setCostume(null);
      setIsShadow(false);
      setShowCostumeDropdown(false);
      setSelectedBackground(null);
      setSelectedBackgroundId(null);
    }

    clearError();
    handleValidation({
      selectedCostume: nextCostume,
      shadowChecked: nextShadow,
      dynamaxEnabled: nextDynamax,
      gigantamaxEnabled: nextGigantamax,
    });
  };

  const toggleMax = () => {
    const next = cycleMaxState({
      dynamax,
      gigantamax,
      hasDynamax,
      hasGigantamax,
    });

    applyMaxMode(next.dynamax, next.gigantamax);
  };

  const setMaxMode = (mode: 'standard' | 'dynamax' | 'gigantamax') => {
    applyMaxMode(mode === 'dynamax', mode === 'gigantamax');
  };

  const handleGenderChange = (gender: string | null) => {
    setSelectedGender(gender);
  };

  useEffect(() => {
    if (pokemon && currentPokemonData) {
      handleValidationRef.current();
    }
  }, [
    costume,
    currentPokemonData,
    dynamax,
    gigantamax,
    isShadow,
    isShiny,
    pokemon,
    selectedForm,
    selectedGender,
  ]);

  useEffect(() => {
    if (!pokemonInputFocused) return;

    const hydratedPokemonData = pokemonCache ?? [];
    const normalizedPokemon = pokemon.trim().toLowerCase();
    const hasExactMatch = hydratedPokemonData.some(
      (entry) => entry.name.toLowerCase() === normalizedPokemon,
    );

    setSuggestions(
      hasExactMatch
        ? []
        : evaluatePokemonInputFocus({
            pokemon,
            pokemonData: hydratedPokemonData,
          }),
    );
  }, [pokemon, pokemonCache, pokemonInputFocused]);

  useEffect(() => {
    if (selectedBackgroundId == null) {
      setSelectedBackground(null);
      return;
    }
    const restoredBackground = currentPokemonData?.backgrounds?.find(
      (background) =>
        Number(background.background_id) === Number(selectedBackgroundId),
    );
    setSelectedBackground(restoredBackground ?? null);
  }, [currentPokemonData, selectedBackgroundId]);

  const handleBackgroundChange = (background: BackgroundSelection | null) => {
    if (!background) {
      setSelectedBackground(null);
      setSelectedBackgroundId(null);
      setShowBackgroundOverlay(false);
      return;
    }

    const resolvedCostume = resolveBackgroundCostume(background, availableCostumes);
    if (!resolvedCostume) {
      const message = 'This background’s required costume is unavailable.';
      setErrorMessage(message);
      handleError(message);
      return;
    }

    const nextCostume = resolvedCostume.costume?.name ?? null;
    const shouldExitMax = resolvedCostume.costumeId !== null && (dynamax || gigantamax);
    const currentCostume = costume || null;

    if (currentCostume !== nextCostume) {
      if (nextCostume) {
        const nextCostumeLabel = formatCostumeName(nextCostume);
        const correction = currentCostume
          ? `Costume changed from ${formatCostumeName(currentCostume)} to ${nextCostumeLabel}`
          : `Costume set to ${nextCostumeLabel}`;
        feedback.info(`${correction} to match ${background.name}.`);
      } else {
        feedback.info(`Costume removed because ${background.name} requires no costume.`);
      }
    }

    setCostume(nextCostume);
    setShowCostumeDropdown(resolvedCostume.costumeId !== null);
    if (shouldExitMax) {
      setDynamax(false);
      setGigantamax(false);
    }
    setSelectedBackground(background);
    setSelectedBackgroundId(background.background_id);
    setShowBackgroundOverlay(false);
    setErrorMessage(null);
    clearError();
    handleValidation({
      selectedCostume: nextCostume,
      dynamaxEnabled: shouldExitMax ? false : dynamax,
      gigantamaxEnabled: shouldExitMax ? false : gigantamax,
    });
  };

  const handleImageError = () => {
    setImageError(true);
  };

  const updatePokemonInput = (newPokemon: string) => {
    const inputDecision = evaluatePokemonInputChange({
      nextPokemon: newPokemon,
      pokemonData,
    });
    if (inputDecision.shouldIgnore) return;
    const resetState = buildPokemonChangeResetState();
    const normalizedPokemon = newPokemon.trim().toLowerCase();
    const hasExactMatch = pokemonData.some(
      (entry) => entry.name.toLowerCase() === normalizedPokemon,
    );

    setPokemon(newPokemon);
    setCostume(null);
    setSelectedForm(resetState.selectedForm);
    setSelectedGender(resetState.selectedGender);
    setSelectedMoves(resetState.selectedMoves);
    setSelectedBackground(null);
    setSelectedBackgroundId(null);
    setDynamax(resetState.dynamax);
    setGigantamax(resetState.gigantamax);
    setShowCostumeDropdown(false);

    setSuggestions(inputDecision.suggestions);
    if (inputDecision.shouldResetDerivedState || !hasExactMatch) {
      setImageUrl(null);
      setImageError(false);
      setAvailableForms([]);
      setAvailableCostumes([]);
      setErrorMessage(null);
      clearError();
      return;
    }

    handleValidation({
      name: newPokemon,
      form: '',
      selectedCostume: null,
      selectedGenderValue: resetState.selectedGender,
      dynamaxEnabled: resetState.dynamax,
      gigantamaxEnabled: resetState.gigantamax,
    });
  };

  const handlePokemonChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    updatePokemonInput(event.target.value);
  };

  const handleClearPokemon = () => {
    updatePokemonInput('');
  };

  const handleInputFocus = () => {
    setPokemonInputFocused(true);
    setSuggestions(
      evaluatePokemonInputFocus({
        pokemon,
        pokemonData,
      }),
    );
  };

  const handleInputBlur = () => {
    setPokemonInputFocused(false);
    setSuggestions([]);
  };

  const handleShinyChange = () => {
    const shinyDecision = buildBooleanValidationToggle({
      currentValue: isShiny,
      field: 'shinyChecked',
    });
    setIsShiny(shinyDecision.nextValue);
    handleValidation(shinyDecision.validationPatch);
  };

  const handleShadowChange = () => {
    const shadowDecision = buildBooleanValidationToggle({
      currentValue: isShadow,
      field: 'shadowChecked',
    });
    const shouldExitMax = shadowDecision.nextValue && (dynamax || gigantamax);
    setIsShadow(shadowDecision.nextValue);
    if (shouldExitMax) {
      setDynamax(false);
      setGigantamax(false);
    }
    handleValidation({
      ...shadowDecision.validationPatch,
      dynamaxEnabled: shouldExitMax ? false : dynamax,
      gigantamaxEnabled: shouldExitMax ? false : gigantamax,
    });
  };

  const handleCostumeToggle = () => {
    const toggleDecision = evaluateCostumeToggle({ showCostumeDropdown });
    setShowCostumeDropdown(toggleDecision.nextShowCostumeDropdown);

    if (toggleDecision.shouldResetCostumeSelection) {
      setCostume(null);
      setSelectedBackground(null);
      setSelectedBackgroundId(null);
      clearError();
      handleValidation({ selectedCostume: '' });
      const defaultImage = buildCostumeResetImage({
        pokemonData,
        pokemon,
        isShiny,
        isShadow,
        selectedForm,
        selectedGender,
        dynamax,
        gigantamax,
      });
      setImageUrl(defaultImage);
      setImageError(false);
    }
  };

  const handleCostumeChange = (value: string) => {
    const costumeDecision = buildSelectionValidationChange({
      value,
      field: 'selectedCostume',
    });
    const shouldExitMax = Boolean(value) && (dynamax || gigantamax);
    setCostume(costumeDecision.value);
    setSelectedBackground(null);
    setSelectedBackgroundId(null);
    if (shouldExitMax) {
      setDynamax(false);
      setGigantamax(false);
    }
    handleValidation({
      ...costumeDecision.validationPatch,
      dynamaxEnabled: shouldExitMax ? false : dynamax,
      gigantamaxEnabled: shouldExitMax ? false : gigantamax,
    });
  };

  const handleFormChange = (value: string) => {
    const formDecision = buildSelectionValidationChange({
      value,
      field: 'form',
    });
    setSelectedForm(formDecision.value);
    handleValidation(formDecision.validationPatch);
  };

  const handleMovesChange = (moves: SelectedMoves) => {
    setSelectedMoves(moves);
  };

  const handleSuggestionClick = (suggestion: string) => {
    const suggestionDecision = buildSuggestionClickDecision({ suggestion });
    setPokemon(suggestionDecision.nextPokemon);
    setSuggestions(suggestionDecision.nextSuggestions);
    handleValidation(suggestionDecision.validationPatch);
  };

  const resetVariantFilters = () => {
    const resetState = buildPokemonChangeResetState();
    setIsShiny(false);
    setIsShadow(false);
    setCostume(null);
    setSelectedForm(resetState.selectedForm);
    setSelectedGender(resetState.selectedGender);
    setSelectedMoves(resetState.selectedMoves);
    setSelectedBackground(null);
    setSelectedBackgroundId(null);
    setDynamax(resetState.dynamax);
    setGigantamax(resetState.gigantamax);
    setShowCostumeDropdown(false);
    setImageError(false);
    setErrorMessage(null);

    if (pokemon) {
      handleValidation({
        shinyChecked: false,
        shadowChecked: false,
        selectedCostume: null,
        form: resetState.selectedForm,
        selectedGenderValue: resetState.selectedGender,
        dynamaxEnabled: resetState.dynamax,
        gigantamaxEnabled: resetState.gigantamax,
      });
    }
  };

  return {
    currentPokemonData,
    availableForms,
    availableCostumes,
    imageUrl,
    imageError,
    showCostumeDropdown,
    selectedBackground,
    showBackgroundOverlay,
    suggestions,
    backgroundAllowed,
    selectedCostumeId,
    canDynamax,
    hasDynamax,
    hasGigantamax,
    setMaxMode,
    toggleMax,
    setShowBackgroundOverlay,
    handleImageError,
    handleBackgroundChange,
    handleClearPokemon,
    handleGenderChange,
    handlePokemonChange,
    handleInputFocus,
    handleInputBlur,
    handleShinyChange,
    handleShadowChange,
    handleCostumeToggle,
    handleCostumeChange,
    handleFormChange,
    handleMovesChange,
    handleSuggestionClick,
    resetVariantFilters,
  };
};

export default useVariantSearchController;
