import { describe, expect, it } from 'vitest';

import type { PokemonVariant } from '@/types/pokemonVariants';
import {
  computeMaxAvailability,
  cycleMaxState,
  getPokemonSuggestions,
  getSelectedCostumeId,
  isBackgroundAllowedForSelection,
  normalizeAvailableForms,
  sortCostumesByDate,
} from '@/pages/Search/SearchParameters/variantSearchHelpers';

const makeVariant = (overrides: Partial<PokemonVariant> = {}): PokemonVariant =>
  ({
    name: 'Bulbasaur',
    max: [],
    backgrounds: [],
    ...overrides,
  } as unknown as PokemonVariant);

describe('variantSearchHelpers', () => {
  it('sortCostumesByDate returns a new array sorted by availability date', () => {
    const costumes = [
      { name: 'Late', date_available: '2025-03-01' },
      { name: 'Missing' },
      { name: 'Early', date_available: '2024-01-01' },
    ];

    const sorted = sortCostumesByDate(costumes);
    expect(sorted.map((item) => item.name)).toEqual(['Missing', 'Early', 'Late']);
    expect(sorted).not.toBe(costumes);
  });

  it('normalizeAvailableForms filters blanks and normalizes "none"', () => {
    expect(normalizeAvailableForms(['none', 'Mega', '', '   ', null])).toEqual([
      'None',
      'Mega',
    ]);
  });

  it('getPokemonSuggestions matches by prefix and de-duplicates names', () => {
    const variants = [
      makeVariant({ name: 'Bulbasaur' }),
      makeVariant({ name: 'Bulbasaur' }),
      makeVariant({ name: 'Butterfree' }),
      makeVariant({ name: 'Ivysaur' }),
    ];

    expect(getPokemonSuggestions(variants, 'Bu')).toEqual(['Bulbasaur', 'Butterfree']);
    expect(getPokemonSuggestions(variants, 'iv')).toEqual(['Ivysaur']);
    expect(getPokemonSuggestions(variants, 'Bulbasaur')).toEqual([]);
  });

  it('limits broad autocomplete matches to a manageable visual list', () => {
    const variants = Array.from({ length: 8 }, (_, index) =>
      makeVariant({ name: `Char-${index + 1}` }),
    );

    expect(getPokemonSuggestions(variants, 'Cha')).toHaveLength(6);
  });

  it('computeMaxAvailability reports dynamax and gigantamax flags', () => {
    const variant = makeVariant({
      max: [
        { dynamax: 1, gigantamax: 0 },
        { dynamax: 0, gigantamax: 1 },
      ] as PokemonVariant['max'],
    });

    expect(computeMaxAvailability(variant)).toEqual({
      hasDynamax: true,
      hasGigantamax: true,
    });
    expect(computeMaxAvailability(undefined)).toEqual({
      hasDynamax: false,
      hasGigantamax: false,
    });
  });

  it('cycleMaxState follows none -> dynamax -> gigantamax -> none flow when both exist', () => {
    const none = cycleMaxState({
      dynamax: false,
      gigantamax: false,
      hasDynamax: true,
      hasGigantamax: true,
    });
    const toGmax = cycleMaxState({
      dynamax: true,
      gigantamax: false,
      hasDynamax: true,
      hasGigantamax: true,
    });
    const backToNone = cycleMaxState({
      dynamax: false,
      gigantamax: true,
      hasDynamax: true,
      hasGigantamax: true,
    });

    expect(none).toEqual({ dynamax: true, gigantamax: false });
    expect(toGmax).toEqual({ dynamax: false, gigantamax: true });
    expect(backToNone).toEqual({ dynamax: false, gigantamax: false });
  });

  it('getSelectedCostumeId resolves costume id by name', () => {
    const availableCostumes = [
      { name: 'Party', costume_id: 7 },
      { name: 'Holiday', costume_id: 8 },
    ];
    expect(getSelectedCostumeId(availableCostumes, 'Holiday')).toBe(8);
    expect(getSelectedCostumeId(availableCostumes, 'Missing')).toBeUndefined();
  });

  it('allows backgrounds only when their exact costume can be resolved', () => {
    const variant = makeVariant({
      backgrounds: [
        { background_id: 1, costume_id: null },
        { background_id: 2, costume_id: 7 },
      ] as PokemonVariant['backgrounds'],
    });
    const availableCostumes = [{ name: 'Party', costume_id: 7 }];

    expect(isBackgroundAllowedForSelection(variant, null, availableCostumes)).toBe(true);
    expect(isBackgroundAllowedForSelection(variant, 'Party', availableCostumes)).toBe(true);
    expect(
      isBackgroundAllowedForSelection(
        makeVariant({
          backgrounds: [{ background_id: 2, costume_id: 7 }] as PokemonVariant['backgrounds'],
        }),
        null,
        availableCostumes,
      ),
    ).toBe(true);
    expect(
      isBackgroundAllowedForSelection(
        makeVariant({ backgrounds: [{ background_id: 3, costume_id: 9 }] as PokemonVariant['backgrounds'] }),
        'Party',
        availableCostumes,
      ),
    ).toBe(false);
  });
});
