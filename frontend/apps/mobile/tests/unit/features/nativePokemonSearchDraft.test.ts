import type { BasePokemon } from '@pokemongonexus/shared-contracts/pokemon';
import {
  countNativePokemonSearchFilters,
  createNativePokemonSearchDraft,
  nativePokemonSearchGenderOptions,
  normalizeNativePokemonSelection,
  prepareNativePokemonSearch,
  selectNativePokemonSearchBackground,
  setNativePokemonSearchMaxMode,
  setNativePokemonSearchOwnership,
} from '../../../src/features/search/nativePokemonSearchDraft';

const pokemon = {
  pokemon_id: 25,
  name: 'Pikachu',
  form: null,
  backgrounds: [
    { background_id: 4, costume_id: 8, name: 'Special Event', image_url: '' },
    { background_id: 5, costume_id: null, name: 'City', image_url: '' },
  ],
  costumes: [{ costume_id: 8, name: 'Detective' }],
  image_url: 'pikachu.png',
  image_url_shiny: 'shiny.png',
  image_url_shadow: 'shadow.png',
  image_url_shiny_shadow: 'shiny-shadow.png',
} as unknown as BasePokemon;

describe('native Pokémon search draft', () => {
  it('shares Vite\'s five-result default and counts a changed limit as a filter', () => {
    const draft = createNativePokemonSearchDraft();
    expect(draft.limit).toBe(5);
    expect(draft.useCurrentLocation).toBe(false);
    expect(countNativePokemonSearchFilters(draft)).toBe(0);
    expect(countNativePokemonSearchFilters({ ...draft, limit: 20 })).toBe(1);
  });

  it('offers only the canonical genders and selects a single supported gender', () => {
    expect(nativePokemonSearchGenderOptions({ gender_rate: '50_50_0' })).toEqual([
      'Any', 'Male', 'Female',
    ]);
    expect(nativePokemonSearchGenderOptions({ gender_rate: '0_0_100' })).toEqual([
      'Genderless',
    ]);
    expect(nativePokemonSearchGenderOptions({ gender_rate: 'M/M' })).toEqual(['Male']);

    const maleOnly = { ...pokemon, gender_rate: 'M/M' };
    expect(normalizeNativePokemonSelection(createNativePokemonSearchDraft(), maleOnly).gender)
      .toBe('Male');
  });

  it('resets incompatible details when the selected Pokémon or Max mode changes', () => {
    const dirty = {
      ...createNativePokemonSearchDraft(),
      costumeId: 8,
      backgroundId: 4,
      shadow: true,
      fastMoveId: 1,
    };
    expect(normalizeNativePokemonSelection(dirty, pokemon)).toEqual(expect.objectContaining({
      pokemonId: 25,
      pokemonName: 'Pikachu',
      costumeId: null,
      backgroundId: null,
      fastMoveId: null,
    }));
    expect(setNativePokemonSearchMaxMode(dirty, 'gigantamax')).toEqual(expect.objectContaining({
      gigantamax: true,
      dynamax: false,
      shadow: false,
      costumeId: null,
      backgroundId: null,
    }));
  });

  it('corrects costume selection to the exact background combination and explains it', () => {
    const selected = selectNativePokemonSearchBackground(
      createNativePokemonSearchDraft(),
      pokemon,
      4,
    );
    expect(selected.draft).toEqual(expect.objectContaining({ backgroundId: 4, costumeId: 8 }));
    expect(selected.notice).toContain('Detective');

    const removed = selectNativePokemonSearchBackground(selected.draft, pokemon, 5);
    expect(removed.draft.costumeId).toBeNull();
    expect(removed.notice).toContain('removed');

    const unavailable = selectNativePokemonSearchBackground(
      createNativePokemonSearchDraft(),
      {
        ...pokemon,
        backgrounds: [{ background_id: 9, costume_id: 99, name: 'Missing costume', image_url: '' }],
      } as BasePokemon,
      9,
    );
    expect(unavailable.draft.backgroundId).toBeNull();
    expect(unavailable.notice).toBe('This background’s required costume is unavailable.');
  });

  it('builds the canonical query and clears mode-specific filters', () => {
    let draft = normalizeNativePokemonSelection(createNativePokemonSearchDraft({
      city: 'Burnaby, British Columbia, Canada', latitude: 49.24, longitude: -122.98,
    }), pokemon);
    draft = setNativePokemonSearchOwnership({
      ...draft,
      attackIv: 15,
      prefLucky: true,
      friendshipLevel: 5,
      tradeInWantedList: true,
    }, 'wanted');
    const prepared = prepareNativePokemonSearch(draft, pokemon);
    expect(prepared).toEqual({
      ok: true,
      query: expect.objectContaining({
        pokemon_id: 25,
        ownership: 'wanted',
        attack_iv: null,
        friendship_level: 5,
        pref_lucky: true,
        trade_in_wanted_list: true,
        latitude: 49.24,
        longitude: -122.98,
      }),
    });
  });

  it('returns focused errors for missing Pokémon, invalid shadow listings, and location', () => {
    expect(prepareNativePokemonSearch(createNativePokemonSearchDraft(), null)).toEqual(
      expect.objectContaining({ ok: false, section: 'pokemon' }),
    );
    const selected = normalizeNativePokemonSelection(createNativePokemonSearchDraft(), pokemon);
    expect(prepareNativePokemonSearch({ ...selected, shadow: true, ownership: 'trade' }, pokemon))
      .toEqual(expect.objectContaining({ ok: false, section: 'pokemon' }));
    expect(prepareNativePokemonSearch(selected, pokemon))
      .toEqual(expect.objectContaining({ ok: false, section: 'location' }));
  });
});
