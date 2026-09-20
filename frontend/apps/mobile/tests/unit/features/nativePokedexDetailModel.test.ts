import type { BasePokemon } from '@pokemongonexus/shared-contracts/pokemon';
import {
  buildNativePokedexCombinationSections,
  buildNativePokedexEvolutionLine,
  buildNativePokedexRegistrationSlots,
  filterNativePokedexCombinations,
  getNativePokedexTypeEffectiveness,
  toggleNativePokedexComboFilter,
} from '../../../src/features/tools/nativePokedexDetailModel';
import type { NativePokedexEntry } from '../../../src/features/tools/nativePokedexModel';

const entry = (overrides: Partial<NativePokedexEntry>): NativePokedexEntry => ({
  id: '0001-default', pokemonId: 1, pokedexNumber: 1, name: 'Bulbasaur', imageUri: '/bulbasaur.png',
  typeIconUris: [], maxKind: null, category: 'pokemon', generation: 1, instanceRegistered: false,
  manualRegistrationIds: [], registered: false, registeredFacets: [], released: true, registeredSpecies: false,
  ...overrides,
});
const pokemon = { pokemon_id: 1, gender_rate: 'M/F' } as BasePokemon;

describe('native Pokédex detail model', () => {
  it('builds the canonical primary, form, and purified registration slots', () => {
    const slots = buildNativePokedexRegistrationSlots([
      entry({}),
      entry({ id: '0001-shiny', name: 'Shiny Bulbasaur', category: 'shiny' }),
      entry({ id: '0001-shadow', name: 'Shadow Bulbasaur', category: 'shadow' }),
    ], 1);

    expect(slots.map(({ label }) => label)).toEqual(expect.arrayContaining([
      'Pokemon', 'Shiny', '100%', 'Lucky', 'XXL', 'XXS', 'Shadow', 'Purified',
    ]));
    expect(slots.find(({ label }) => label === 'Lucky')?.registration.registrationId).toBe('0001-default|lucky:true');
  });

  it('creates exact variant combinations and locks collection-derived combinations', () => {
    const luckyId = '0001-default|lucky:true';
    const sections = buildNativePokedexCombinationSections([
      entry({ instanceRegistered: true, registered: true, registeredFacets: [{ lucky: true }] }),
      entry({ id: '0001-shiny', name: 'Shiny Bulbasaur', category: 'shiny', manualRegistrationIds: [luckyId] }),
    ], pokemon);
    const baseCombos = sections.find(({ id }) => id === '0001-default')?.combinations ?? [];
    const lucky = baseCombos.find(({ facets }) => facets.lucky && !facets.gender && !facets.size && !facets.appraisal);

    expect(baseCombos).toHaveLength(60);
    expect(lucky).toMatchObject({ registered: true, lockedByInstance: true });
  });

  it('filters within exclusive groups while allowing multiple required quality filters', () => {
    const combinations = buildNativePokedexCombinationSections([entry({})], pokemon)[0]?.combinations ?? [];
    const filters = toggleNativePokedexComboFilter(
      toggleNativePokedexComboFilter([], 'lucky'),
      'perfect',
    );
    const filtered = filterNativePokedexCombinations(combinations, 'female', filters);
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every(({ facets }) => facets.gender === 'Female' && facets.lucky && facets.appraisal === '4-star')).toBe(true);
    expect(toggleNativePokedexComboFilter(['male'], 'female')).toEqual(['female']);
  });

  it('builds the complete ordered evolution family and canonical defensive type chart', () => {
    const bulbasaur = { pokemon_id: 1, pokedex_number: 1, name: 'Bulbasaur', evolves_to: [2], type1_name: 'Grass', type2_name: 'Poison' } as BasePokemon;
    const ivysaur = { pokemon_id: 2, pokedex_number: 2, name: 'Ivysaur', evolves_from: [1], evolves_to: [3] } as BasePokemon;
    const venusaur = { pokemon_id: 3, pokedex_number: 3, name: 'Venusaur', evolves_from: [2] } as BasePokemon;

    expect(buildNativePokedexEvolutionLine([bulbasaur, ivysaur, venusaur], ivysaur).map(({ name }) => name)).toEqual([
      'Bulbasaur', 'Ivysaur', 'Venusaur',
    ]);
    expect(getNativePokedexTypeEffectiveness(bulbasaur)).toEqual({
      resistantTo: expect.arrayContaining(['Electric', 'Grass', 'Water', 'Fairy']),
      weakTo: expect.arrayContaining(['Fire', 'Ice', 'Flying', 'Psychic']),
    });
  });
});
