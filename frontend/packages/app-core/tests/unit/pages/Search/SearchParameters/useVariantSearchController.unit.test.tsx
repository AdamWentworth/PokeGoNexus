import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import useVariantSearchController from '@/pages/Search/SearchParameters/useVariantSearchController';
import type { BackgroundSelection } from '@/pages/Search/SearchParameters/VariantSearchBackgroundOverlay';
import type { SelectedMoves } from '@/pages/Search/utils/buildPokemonSearchQuery';
import type { PokemonVariant } from '@/types/pokemonVariants';

const validatePokemonMock = vi.fn();
const updateImageMock = vi.fn();
const { toastInfoMock } = vi.hoisted(() => ({ toastInfoMock: vi.fn() }));

vi.mock('@/components/feedback', () => ({
  feedback: {
    info: toastInfoMock,
  },
}));

vi.mock('@/pages/Search/utils/validatePokemon', () => ({
  default: (...args: unknown[]) => validatePokemonMock(...args),
}));

vi.mock('@/pages/Search/utils/updateImage', () => ({
  updateImage: (...args: unknown[]) => updateImageMock(...args),
}));

type Args = Parameters<typeof useVariantSearchController>[0];

const toSetter = <T,>() => vi.fn() as unknown as React.Dispatch<React.SetStateAction<T>>;

const baseVariant = {
  variant_id: '0001-default',
  name: 'Bulbasaur',
  moves: [],
  costumes: [
    {
      name: 'Party',
      costume_id: 7,
      date_available: '2024-01-01',
      date_shiny_available: null,
      shiny_available: 1,
    },
  ],
  backgrounds: [
    {
      background_id: 101,
      costume_id: null,
      image_url: '/images/bg.png',
      name: 'City',
      location: 'Seattle',
      date: '2025-01-01',
    },
    {
      background_id: 102,
      costume_id: 7,
      image_url: '/images/party-bg.png',
      name: 'Party City',
      location: 'Seattle',
      date: '2025-01-02',
    },
  ],
  max: [
    {
      pokemon_id: 1,
      dynamax: 1,
      gigantamax: 1,
      dynamax_release_date: null,
      gigantamax_release_date: null,
    },
  ],
} as unknown as PokemonVariant;

const makeArgs = (overrides: Partial<Args> = {}): Args => ({
  pokemon: '',
  setPokemon: toSetter<string>(),
  isShiny: false,
  setIsShiny: toSetter<boolean>(),
  isShadow: false,
  setIsShadow: toSetter<boolean>(),
  costume: '',
  setCostume: toSetter<string | null>(),
  selectedForm: '',
  setSelectedForm: toSetter<string>(),
  selectedMoves: {
    fastMove: null,
    chargedMove1: null,
    chargedMove2: null,
  } as SelectedMoves,
  setSelectedMoves: toSetter<SelectedMoves>(),
  selectedGender: 'Any',
  setSelectedGender: toSetter<string | null>(),
  setErrorMessage: toSetter<string | null>(),
  setSelectedBackgroundId: toSetter<number | null>(),
  dynamax: false,
  setDynamax: toSetter<boolean>(),
  gigantamax: false,
  setGigantamax: toSetter<boolean>(),
  pokemonCache: [baseVariant],
  ...overrides,
});

describe('useVariantSearchController', () => {
  beforeEach(() => {
    validatePokemonMock.mockReset();
    updateImageMock.mockReset();
    toastInfoMock.mockReset();

    validatePokemonMock.mockReturnValue({
      error: null,
      availableCostumes: [
        {
          name: 'Party',
          costume_id: 7,
          date_available: '2024-01-01',
        },
      ],
      availableForms: ['None'],
    });
    updateImageMock.mockReturnValue('/images/default.png');
  });

  it('updates suggestions for 3+ character input and clears on shorter values', () => {
    const setSelectedForm = toSetter<string>();
    const setSelectedGender = toSetter<string | null>();
    const setSelectedMoves = toSetter<SelectedMoves>();
    const setCostume = toSetter<string | null>();
    const setSelectedBackgroundId = toSetter<number | null>();
    const setErrorMessage = toSetter<string | null>();
    const setDynamax = toSetter<boolean>();
    const setGigantamax = toSetter<boolean>();
    const args = makeArgs({
      setSelectedForm,
      setSelectedGender,
      setSelectedMoves,
      setCostume,
      setSelectedBackgroundId,
      setErrorMessage,
      setDynamax,
      setGigantamax,
      pokemonCache: [
        baseVariant,
        { ...baseVariant, variant_id: '0012-default', name: 'Butterfree' } as PokemonVariant,
      ],
    });
    const { result } = renderHook(() => useVariantSearchController(args));

    act(() => {
      result.current.handlePokemonChange({
        target: { value: 'Bul' },
      } as React.ChangeEvent<HTMLInputElement>);
    });

    expect(args.setPokemon).toHaveBeenCalledWith('Bul');
    expect(result.current.suggestions).toEqual(['Bulbasaur']);
    expect(setSelectedForm).toHaveBeenCalledWith('');
    expect(setSelectedGender).toHaveBeenCalledWith('Any');
    expect(setSelectedMoves).toHaveBeenCalledWith({
      fastMove: null,
      chargedMove1: null,
      chargedMove2: null,
    });
    expect(setDynamax).toHaveBeenCalledWith(false);
    expect(setGigantamax).toHaveBeenCalledWith(false);
    expect(setCostume).toHaveBeenCalledWith(null);
    expect(setSelectedBackgroundId).toHaveBeenCalledWith(null);
    expect(setErrorMessage).toHaveBeenCalledWith(null);
    expect(result.current.imageUrl).toBeNull();
    expect(validatePokemonMock).not.toHaveBeenCalled();

    act(() => {
      result.current.handlePokemonChange({
        target: { value: 'Bu' },
      } as React.ChangeEvent<HTMLInputElement>);
    });

    expect(result.current.suggestions).toEqual([]);

    act(() => {
      result.current.handlePokemonChange({
        target: { value: 'Bulbasaur' },
      } as React.ChangeEvent<HTMLInputElement>);
    });

    expect(validatePokemonMock).toHaveBeenCalled();
    expect(result.current.imageUrl).toBe('/images/default.png');
  });

  it('cycles max state from dynamax to gigantamax when both are available', () => {
    const setDynamax = toSetter<boolean>();
    const setGigantamax = toSetter<boolean>();

    const initialArgs = makeArgs({
      pokemon: 'Bulbasaur',
      dynamax: false,
      gigantamax: false,
      setDynamax,
      setGigantamax,
    });

    const { result, rerender } = renderHook((hookArgs: Args) => useVariantSearchController(hookArgs), {
      initialProps: initialArgs,
    });

    act(() => {
      result.current.toggleMax();
    });

    expect(setDynamax).toHaveBeenCalledWith(true);

    rerender({
      ...initialArgs,
      dynamax: true,
      gigantamax: false,
    });

    act(() => {
      result.current.toggleMax();
    });

    expect(setDynamax).toHaveBeenCalledWith(false);
    expect(setGigantamax).toHaveBeenCalledWith(true);
  });

  it('uses backgrounds from the exact selected Pokémon form', () => {
    const megaVariant = {
      ...baseVariant,
      variant_id: '0001-mega',
      form: 'Mega',
      backgrounds: [
        {
          background_id: 201,
          costume_id: null,
          image_url: '/images/mega-bg.png',
          name: 'Mega City',
          location: 'Seattle',
          date: '2025-02-01',
        },
      ],
    } as PokemonVariant;
    const args = makeArgs({
      pokemon: 'Bulbasaur',
      selectedForm: 'Mega',
      pokemonCache: [baseVariant, megaVariant],
    });
    const { result } = renderHook(() => useVariantSearchController(args));

    expect(result.current.currentPokemonData?.variant_id).toBe('0001-mega');
    expect(result.current.currentPokemonData?.backgrounds?.[0]?.background_id).toBe(201);
  });

  it('sets an explicit Max mode without relying on the cycle order', () => {
    const setDynamax = toSetter<boolean>();
    const setGigantamax = toSetter<boolean>();
    const args = makeArgs({ setDynamax, setGigantamax });
    const { result } = renderHook(() => useVariantSearchController(args));

    act(() => result.current.setMaxMode('gigantamax'));
    expect(setDynamax).toHaveBeenLastCalledWith(false);
    expect(setGigantamax).toHaveBeenLastCalledWith(true);

    act(() => result.current.setMaxMode('standard'));
    expect(setDynamax).toHaveBeenLastCalledWith(false);
    expect(setGigantamax).toHaveBeenLastCalledWith(false);
  });

  it('clears incompatible costume, shadow, and background state for gigantamax', async () => {
    const setCostume = toSetter<string | null>();
    const setIsShadow = toSetter<boolean>();
    const setSelectedBackgroundId = toSetter<number | null>();
    const setDynamax = toSetter<boolean>();
    const setGigantamax = toSetter<boolean>();
    updateImageMock.mockImplementation((...call: unknown[]) => {
      if (call[8]) return '/images/gigantamax.png';
      if (call[4]) return '/images/costume.png';
      return '/images/default.png';
    });
    const args = makeArgs({
      pokemon: 'Bulbasaur',
      costume: 'Party',
      isShadow: true,
      setCostume,
      setIsShadow,
      setSelectedBackgroundId,
      setDynamax,
      setGigantamax,
    });
    const { result } = renderHook(() => useVariantSearchController(args));

    await waitFor(() => expect(result.current.imageUrl).toBe('/images/costume.png'));
    act(() => {
      result.current.handleBackgroundChange({
        background_id: 101,
        image_url: '/images/bg.png',
        name: 'City',
        location: 'Seattle',
        date: '2025-01-01',
      });
      result.current.setMaxMode('gigantamax');
    });

    expect(setCostume).toHaveBeenLastCalledWith(null);
    expect(setIsShadow).toHaveBeenLastCalledWith(false);
    expect(setSelectedBackgroundId).toHaveBeenLastCalledWith(null);
    expect(setDynamax).toHaveBeenLastCalledWith(false);
    expect(setGigantamax).toHaveBeenLastCalledWith(true);
    expect(result.current.selectedBackground).toBeNull();
    expect(result.current.showCostumeDropdown).toBe(false);
    expect(result.current.imageUrl).toBe('/images/gigantamax.png');
    expect(updateImageMock).toHaveBeenLastCalledWith(
      expect.any(Array),
      'Bulbasaur',
      false,
      false,
      null,
      '',
      'Any',
      false,
      true,
    );
  });

  it('restores base artwork when dynamax replaces a costume selection', async () => {
    const setCostume = toSetter<string | null>();
    updateImageMock.mockImplementation((...call: unknown[]) =>
      call[4] ? '/images/costume.png' : '/images/default.png',
    );
    const args = makeArgs({
      pokemon: 'Bulbasaur',
      costume: 'Party',
      setCostume,
    });
    const { result } = renderHook(() => useVariantSearchController(args));

    await waitFor(() => expect(result.current.imageUrl).toBe('/images/costume.png'));
    act(() => result.current.setMaxMode('dynamax'));

    expect(setCostume).toHaveBeenLastCalledWith(null);
    expect(result.current.imageUrl).toBe('/images/default.png');
    expect(validatePokemonMock).toHaveBeenLastCalledWith(
      expect.any(Array),
      'Bulbasaur',
      false,
      false,
      null,
      '',
      true,
      false,
    );
  });

  it('returns to standard mode when a costume is selected from a Max state', () => {
    const setCostume = toSetter<string | null>();
    const setDynamax = toSetter<boolean>();
    const setGigantamax = toSetter<boolean>();
    const args = makeArgs({
      pokemon: 'Bulbasaur',
      dynamax: true,
      setCostume,
      setDynamax,
      setGigantamax,
    });
    const { result } = renderHook(() => useVariantSearchController(args));

    act(() => result.current.handleCostumeChange('Party'));

    expect(setCostume).toHaveBeenLastCalledWith('Party');
    expect(setDynamax).toHaveBeenLastCalledWith(false);
    expect(setGigantamax).toHaveBeenLastCalledWith(false);
    expect(validatePokemonMock).toHaveBeenLastCalledWith(
      expect.any(Array),
      'Bulbasaur',
      false,
      false,
      'Party',
      '',
      false,
      false,
    );
  });

  it('returns to standard mode when shadow is selected from a Max state', () => {
    const setIsShadow = toSetter<boolean>();
    const setDynamax = toSetter<boolean>();
    const setGigantamax = toSetter<boolean>();
    const args = makeArgs({
      pokemon: 'Bulbasaur',
      gigantamax: true,
      setIsShadow,
      setDynamax,
      setGigantamax,
    });
    const { result } = renderHook(() => useVariantSearchController(args));

    act(() => result.current.handleShadowChange());

    expect(setIsShadow).toHaveBeenLastCalledWith(true);
    expect(setDynamax).toHaveBeenLastCalledWith(false);
    expect(setGigantamax).toHaveBeenLastCalledWith(false);
    expect(validatePokemonMock).toHaveBeenLastCalledWith(
      expect.any(Array),
      'Bulbasaur',
      false,
      true,
      '',
      '',
      false,
      false,
    );
  });

  it('resets costume when costume dropdown is closed', () => {
    const setCostume = toSetter<string | null>();
    const args = makeArgs({
      pokemon: 'Bulbasaur',
      costume: 'Party',
      setCostume,
    });

    const { result } = renderHook(() => useVariantSearchController(args));

    act(() => {
      result.current.handleCostumeToggle();
    });
    expect(result.current.showCostumeDropdown).toBe(true);

    act(() => {
      result.current.handleCostumeToggle();
    });

    expect(result.current.showCostumeDropdown).toBe(false);
    expect(setCostume).toHaveBeenCalledWith(null);
    expect(
      updateImageMock.mock.calls.some((call) => call[4] === ''),
    ).toBe(true);
  });

  it('recomputes suggestions on input focus when pokemon has 3+ chars', () => {
    const args = makeArgs({
      pokemon: 'Bul',
    });
    const { result } = renderHook(() => useVariantSearchController(args));

    act(() => {
      result.current.handleInputFocus();
    });

    expect(result.current.suggestions).toEqual(['Bulbasaur']);
  });

  it('recomputes focused suggestions when the Pokemon catalog hydrates', async () => {
    const initialArgs = makeArgs({
      pokemon: 'Bul',
      pokemonCache: null,
    });
    const { result, rerender } = renderHook(
      (hookArgs: Args) => useVariantSearchController(hookArgs),
      { initialProps: initialArgs },
    );

    act(() => result.current.handleInputFocus());
    expect(result.current.suggestions).toEqual([]);

    rerender({
      ...initialArgs,
      pokemonCache: [baseVariant],
    });

    await waitFor(() => {
      expect(result.current.suggestions).toEqual(['Bulbasaur']);
    });

    act(() => result.current.handleInputBlur());
    rerender({
      ...initialArgs,
      pokemonCache: [
        baseVariant,
        {
          ...baseVariant,
          variant_id: '0012-default',
          name: 'Butterfree',
        } as PokemonVariant,
      ],
    });

    expect(result.current.suggestions).toEqual([]);
  });

  it('toggles shiny and shadow flags through dedicated handlers', () => {
    const setIsShiny = toSetter<boolean>();
    const setIsShadow = toSetter<boolean>();
    const args = makeArgs({
      pokemon: 'Bulbasaur',
      isShiny: false,
      isShadow: true,
      setIsShiny,
      setIsShadow,
    });
    const { result } = renderHook(() => useVariantSearchController(args));

    act(() => {
      result.current.handleShinyChange();
    });
    expect(setIsShiny).toHaveBeenCalledWith(true);

    act(() => {
      result.current.handleShadowChange();
    });
    expect(setIsShadow).toHaveBeenCalledWith(false);
  });

  it('applies costume/form changes and suggestion clicks', () => {
    const setCostume = toSetter<string | null>();
    const setSelectedForm = toSetter<string>();
    const setPokemon = toSetter<string>();
    const args = makeArgs({
      pokemon: 'Bul',
      setCostume,
      setSelectedForm,
      setPokemon,
    });
    const { result } = renderHook(() => useVariantSearchController(args));

    act(() => {
      result.current.handleInputFocus();
    });
    expect(result.current.suggestions).toEqual(['Bulbasaur']);

    act(() => {
      result.current.handleCostumeChange('Party');
      result.current.handleFormChange('Origin');
      result.current.handleSuggestionClick('Bulbasaur');
    });

    expect(setCostume).toHaveBeenCalledWith('Party');
    expect(setSelectedForm).toHaveBeenCalledWith('Origin');
    expect(setPokemon).toHaveBeenCalledWith('Bulbasaur');
    expect(result.current.suggestions).toEqual([]);
  });

  it('applies selected background and closes background overlay', () => {
    const setCostume = toSetter<string | null>();
    const setSelectedBackgroundId = toSetter<number | null>();
    const args = makeArgs({
      pokemon: 'Bulbasaur',
      costume: 'Party',
      setCostume,
      setSelectedBackgroundId,
    });
    const { result } = renderHook(() => useVariantSearchController(args));

    const background: BackgroundSelection = {
      background_id: 101,
      image_url: '/images/bg.png',
      name: 'City',
      location: 'Seattle',
      date: '2025-01-01',
      costume_id: undefined,
    };

    act(() => {
      result.current.setShowBackgroundOverlay(true);
    });
    expect(result.current.showBackgroundOverlay).toBe(true);

    act(() => {
      result.current.handleBackgroundChange(background);
    });

    expect(result.current.selectedBackground).toEqual(background);
    expect(result.current.showBackgroundOverlay).toBe(false);
    expect(setSelectedBackgroundId).toHaveBeenCalledWith(101);
    expect(setCostume).toHaveBeenCalledWith(null);
    expect(result.current.showCostumeDropdown).toBe(false);
    expect(toastInfoMock).toHaveBeenCalledWith(
      'Costume removed because City requires no costume.',
    );
  });

  it('automatically applies the one costume required by a selected background', async () => {
    const setCostume = toSetter<string | null>();
    const setSelectedBackgroundId = toSetter<number | null>();
    const args = makeArgs({
      pokemon: 'Bulbasaur',
      setCostume,
      setSelectedBackgroundId,
    });
    const { result } = renderHook(() => useVariantSearchController(args));

    await waitFor(() => expect(result.current.availableCostumes).toHaveLength(1));

    const background: BackgroundSelection = {
      background_id: 102,
      image_url: '/images/party-bg.png',
      name: 'Party City',
      location: 'Seattle',
      date: '2025-01-02',
      costume_id: 7,
    };

    act(() => result.current.handleBackgroundChange(background));

    expect(setCostume).toHaveBeenLastCalledWith('Party');
    expect(setSelectedBackgroundId).toHaveBeenLastCalledWith(102);
    expect(result.current.selectedBackground).toEqual(background);
    expect(result.current.showCostumeDropdown).toBe(true);
    expect(toastInfoMock).toHaveBeenCalledWith(
      'Costume set to Party to match Party City.',
    );
    expect(updateImageMock).toHaveBeenLastCalledWith(
      expect.any(Array),
      'Bulbasaur',
      false,
      false,
      'Party',
      '',
      'Any',
      false,
      false,
    );
  });

  it('does not notify when a selected background already matches the costume', async () => {
    const args = makeArgs({
      pokemon: 'Bulbasaur',
      costume: 'Party',
    });
    const { result } = renderHook(() => useVariantSearchController(args));

    await waitFor(() => expect(result.current.availableCostumes).toHaveLength(1));
    toastInfoMock.mockClear();

    act(() => {
      result.current.handleBackgroundChange({
        background_id: 102,
        image_url: '/images/party-bg.png',
        name: 'Party City',
        location: 'Seattle',
        date: '2025-01-02',
        costume_id: 7,
      });
    });

    expect(toastInfoMock).not.toHaveBeenCalled();
  });

  it('names both costumes when correcting one costume to another', async () => {
    const args = makeArgs({
      pokemon: 'Bulbasaur',
      costume: 'Holiday Hat',
    });
    const { result } = renderHook(() => useVariantSearchController(args));

    await waitFor(() => expect(result.current.availableCostumes).toHaveLength(1));
    toastInfoMock.mockClear();

    act(() => {
      result.current.handleBackgroundChange({
        background_id: 102,
        image_url: '/images/party-bg.png',
        name: 'Party City',
        location: 'Seattle',
        date: '2025-01-02',
        costume_id: 7,
      });
    });

    expect(toastInfoMock).toHaveBeenCalledWith(
      'Costume changed from Holiday Hat to Party to match Party City.',
    );
  });

  it('rejects a background whose required costume is missing from the catalog', async () => {
    const setErrorMessageMock = vi.fn();
    const setSelectedBackgroundIdMock = vi.fn();
    const setErrorMessage =
      setErrorMessageMock as React.Dispatch<React.SetStateAction<string | null>>;
    const setSelectedBackgroundId =
      setSelectedBackgroundIdMock as React.Dispatch<React.SetStateAction<number | null>>;
    const args = makeArgs({
      pokemon: 'Bulbasaur',
      setErrorMessage,
      setSelectedBackgroundId,
    });
    const { result } = renderHook(() => useVariantSearchController(args));

    await waitFor(() => expect(result.current.availableCostumes).toHaveLength(1));
    setErrorMessageMock.mockClear();
    setSelectedBackgroundIdMock.mockClear();

    act(() => {
      result.current.handleBackgroundChange({
        background_id: 103,
        image_url: '/images/missing-bg.png',
        name: 'Missing Costume',
        location: 'Seattle',
        date: '2025-01-03',
        costume_id: 9,
      });
    });

    expect(setErrorMessage).toHaveBeenCalledWith(
      'This background’s required costume is unavailable.',
    );
    expect(setSelectedBackgroundId).not.toHaveBeenCalled();
    expect(result.current.selectedBackground).toBeNull();
  });

  it('clears the Pokémon and its derived state through the clear action', async () => {
    const setCostume = toSetter<string | null>();
    const args = makeArgs({
      pokemon: 'Bulbasaur',
      costume: 'Party',
      setCostume,
    });

    const { result } = renderHook(() => useVariantSearchController(args));

    await waitFor(() => {
      expect(result.current.imageUrl).toBe('/images/default.png');
      expect(result.current.availableForms).toEqual(['None']);
      expect(result.current.availableCostumes).toHaveLength(1);
    });

    act(() => {
      result.current.handleClearPokemon();
    });

    expect(args.setPokemon).toHaveBeenCalledWith('');
    expect(result.current.imageUrl).toBeNull();
    expect(result.current.availableForms).toEqual([]);
    expect(result.current.availableCostumes).toEqual([]);
    expect(setCostume).toHaveBeenCalledWith(null);
  });

  it('resets every advanced variant filter without clearing the Pokemon', () => {
    const setIsShiny = toSetter<boolean>();
    const setIsShadow = toSetter<boolean>();
    const setCostume = toSetter<string | null>();
    const setSelectedForm = toSetter<string>();
    const setSelectedGender = toSetter<string | null>();
    const setSelectedMoves = toSetter<SelectedMoves>();
    const setSelectedBackgroundId = toSetter<number | null>();
    const setDynamax = toSetter<boolean>();
    const setGigantamax = toSetter<boolean>();
    const setErrorMessage = toSetter<string | null>();
    const args = makeArgs({
      pokemon: 'Bulbasaur',
      isShiny: true,
      isShadow: true,
      costume: 'Party',
      selectedForm: 'Origin',
      selectedGender: 'Female',
      dynamax: true,
      gigantamax: true,
      setIsShiny,
      setIsShadow,
      setCostume,
      setSelectedForm,
      setSelectedGender,
      setSelectedMoves,
      setSelectedBackgroundId,
      setDynamax,
      setGigantamax,
      setErrorMessage,
    });
    const { result } = renderHook(() => useVariantSearchController(args));

    act(() => {
      result.current.resetVariantFilters();
    });

    expect(setIsShiny).toHaveBeenCalledWith(false);
    expect(setIsShadow).toHaveBeenCalledWith(false);
    expect(setCostume).toHaveBeenCalledWith(null);
    expect(setSelectedForm).toHaveBeenCalledWith('');
    expect(setSelectedGender).toHaveBeenCalledWith('Any');
    expect(setSelectedMoves).toHaveBeenCalledWith({
      fastMove: null,
      chargedMove1: null,
      chargedMove2: null,
    });
    expect(setSelectedBackgroundId).toHaveBeenCalledWith(null);
    expect(setDynamax).toHaveBeenCalledWith(false);
    expect(setGigantamax).toHaveBeenCalledWith(false);
    expect(setErrorMessage).toHaveBeenCalledWith(null);
    expect(args.setPokemon).not.toHaveBeenCalled();
  });
});
