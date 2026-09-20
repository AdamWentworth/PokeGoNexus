import { describe, expect, it, vi } from 'vitest';

import {
  formatDexNumber,
  formatNumber,
  getDisplayName,
  getTypeChips,
  getVariantCategory,
  getVariantFamilyKey,
  isShadowVariant,
  isShinyVariant,
} from '@/pages/Pokedex/pokedexPokemonDetailModel';

import type { PokemonVariant } from '@/types/pokemonVariants';
import { getGenderOptions } from '@/pages/Pokedex/pokedexRegistrationModel';

vi.mock('@/utils/imageHelpers', () => ({
  getTypeIconPath: (type: string) => `/types/${type.toLowerCase()}.png`,
}));

function makeVariant(overrides: Partial<PokemonVariant> = {}): PokemonVariant {
  return {
    variant_id: '0001-default',
    pokemon_id: 1,
    pokedex_number: 1,
    name: 'Bulbasaur',
    species_name: 'Bulbasaur',
    form: null,
    variantType: 'default',
    currentImage: '/images/default/pokemon_1.png',
    image_url: '/images/default/pokemon_1.png',
    costumes: [],
    moves: [],
    fusion: [],
    backgrounds: [],
    megaEvolutions: [],
    max: [],
    evolves_from: [],
    evolves_to: [],
    ...overrides,
  } as PokemonVariant;
}

describe('pokedexPokemonDetailModel', () => {
  it('handles long malformed catalog fields without retrying every suffix', () => {
    const spaces = ' '.repeat(100_000);
    expect(getVariantFamilyKey(makeVariant({ variantType: `shadow${spaces}x` as PokemonVariant['variantType'] }))).toBe(`shadow${spaces}x`);
    expect(getVariantFamilyKey(makeVariant({ variantType: `shadow${spaces}shiny` as PokemonVariant['variantType'] }))).toBe('shadow');
    expect(getGenderOptions(makeVariant({ gender_rate: '0'.repeat(100_000) }))).toEqual([]);
    expect(getGenderOptions(makeVariant({ gender_rate: '50M50F' }))).toEqual(['Male', 'Female']);
    expect(getGenderOptions(makeVariant({ gender_rate: '0M100F' }))).toEqual(['Female']);
    expect(getGenderOptions(makeVariant({ gender_rate: '100M0F' }))).toEqual(['Male']);
    expect(getDisplayName(makeVariant({ variantType: `shadow_costume_${'costume_a'.repeat(20_000)}\n!` }))).toBe('Bulbasaur');
  });

  it('keeps shadow costume names and shiny prefixes intact', () => {
    const costumes = [{ costume_id: 7, name: 'party_hat' }] as PokemonVariant['costumes'];
    expect(getDisplayName(makeVariant({ variantType: 'shadow_costume_7', costumes }))).toBe('Shadow Party Hat Bulbasaur');
    expect(getDisplayName(makeVariant({ variantType: 'shiny_shadow_costume_7', costumes }))).toBe('Shiny Shadow Party Hat Bulbasaur');
  });

  it('formats National Dex numbers and falls back for invalid data', () => {
    expect(formatDexNumber(makeVariant({ pokedex_number: 25 }))).toBe('0025');
    expect(formatDexNumber(makeVariant({ pokedex_number: '150' as unknown as number }))).toBe('0150');
    expect(formatDexNumber(makeVariant({ pokedex_number: null as unknown as number }))).toBe('----');
  });

  it('classifies top-level variants and advanced combo variants', () => {
    expect(getVariantCategory(makeVariant({ variantType: 'default' }))).toBe('pokemon');
    expect(getVariantCategory(makeVariant({ variantType: 'shiny' }))).toBe('shiny');
    expect(getVariantCategory(makeVariant({ variantType: 'shadow' }))).toBe('shadow');
    expect(getVariantCategory(makeVariant({ variantType: 'shiny_shadow' }))).toBe('shiny shadow');
    expect(getVariantCategory(makeVariant({ variantType: 'costume_party_hat' }))).toBe('costume');
    expect(getVariantCategory(makeVariant({ variantType: 'costume_party_hat_shiny' }))).toBe(
      'shiny costume',
    );
    expect(getVariantCategory(makeVariant({ variantType: 'dynamax' }))).toBe('dynamax');
    expect(getVariantCategory(makeVariant({ variantType: 'shiny_gigantamax' }))).toBe(
      'shiny gigantamax',
    );
    expect(getVariantCategory(makeVariant({ variantType: 'mega_x' }))).toBe('mega');
    expect(getVariantCategory(makeVariant({ variantType: 'shiny_fusion_1' }))).toBe('shiny fusion');
  });

  it('groups shiny variants with their base family for side-by-side registration cards', () => {
    expect(getVariantFamilyKey(makeVariant({ variantType: 'shiny' }))).toBe('default');
    expect(getVariantFamilyKey(makeVariant({ variantType: 'costume_party_hat' }))).toBe(
      'costume_party_hat',
    );
    expect(getVariantFamilyKey(makeVariant({ variantType: 'costume_party_hat_shiny' }))).toBe(
      'costume_party_hat',
    );
    expect(getVariantFamilyKey(makeVariant({ variantType: 'shiny_shadow' }))).toBe('shadow');
    expect(getVariantFamilyKey(makeVariant({ variantType: 'shiny_fusion_1' }))).toBe('fusion_1');
  });

  it('identifies shiny and shadow variants for visual treatment', () => {
    expect(isShinyVariant(makeVariant({ variantType: 'shiny_shadow' }))).toBe(true);
    expect(isShadowVariant(makeVariant({ variantType: 'shiny_shadow' }))).toBe(true);
    expect(isShinyVariant(makeVariant({ variantType: 'costume_party_hat' }))).toBe(false);
    expect(isShadowVariant(makeVariant({ variantType: 'costume_party_hat' }))).toBe(false);
  });

  it('formats numbers without noisy precision artifacts', () => {
    expect(formatNumber(0.4600000000000001)).toBe('0.46');
    expect(formatNumber('1.14')).toBe('1.14');
    expect(formatNumber(null)).toBe('Unknown');
  });

  it('builds type chips with provided icons or generated fallbacks', () => {
    const chips = getTypeChips(
      makeVariant({
        type1_name: 'Grass',
        type_1_icon: '/icons/grass.svg',
        type2_name: 'Poison',
        type_2_icon: '',
      } as Partial<PokemonVariant>),
    );

    expect(chips).toEqual([
      { label: 'Grass', icon: '/icons/grass.svg' },
      { label: 'Poison', icon: '/types/poison.png' },
    ]);
  });

  it('keeps fusion display names readable without duplicating shiny text', () => {
    expect(
      getDisplayName(
        makeVariant({
          name: 'Kyurem',
          species_name: 'White Kyurem',
          variantType: 'fusion_1',
        }),
      ),
    ).toBe('White Kyurem');
    expect(
      getDisplayName(
        makeVariant({
          name: 'Kyurem',
          species_name: 'White Kyurem',
          variantType: 'shiny_fusion_1',
        }),
      ),
    ).toBe('Shiny White Kyurem');
  });
});
