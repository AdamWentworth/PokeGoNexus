import { pokedexCatalog } from '../../helpers/pokedexCatalog';
import {
  buildNativePokedexEntries, buildNativePokedexRegistrationId,
} from '../../../src/features/tools/nativePokedexModel';
import {
  buildNativePokedexRegistrationSlots, buildNativePokedexCombinationSections,
  filterNativePokedexCombinations, getNativePokedexComboSectionForSlot, getNativePokedexMoves,
} from '../../../src/features/tools/nativePokedexDetailModel';

const bulbasaur = pokedexCatalog.find(({ pokemon_id }) => pokemon_id === 1)!;
const caught = {
  audit: { instance_id: 'audit', pokemon_id: 1, variant_id: '0001-default', is_caught: true,
    lucky: true, gender: 'Male', attack_iv: 15, defense_iv: 15, stamina_iv: 15 },
};

describe('Pokédex migration regressions with the Vite catalog', () => {
  it('recognizes subsets of a caught copy without treating manual marks as caught copies', () => {
    const entries = buildNativePokedexEntries([bulbasaur], caught as never);
    const slots = buildNativePokedexRegistrationSlots(entries, 1);
    for (const label of ['Lucky', '100%']) expect(slots.find((slot) => slot.label === label)).toMatchObject({ registered: true, lockedByInstance: true });
    expect(buildNativePokedexCombinationSections(entries, bulbasaur)[0].registeredCount).toBe(8);
    const caughtAndManual = buildNativePokedexEntries([bulbasaur], caught as never, [{
      entryId: '0001-default', facets: { lucky: true }, registrationId: '0001-default|lucky:true',
    }]);
    // An explicit manual mark may still be cleared; the caught copy continues to prove it.
    expect(buildNativePokedexRegistrationSlots(caughtAndManual, 1).find(({ label }) => label === 'Lucky'))
      .toMatchObject({ registered: true, lockedByInstance: false });
    const facets = { gender: 'Male' as const, lucky: true as const, appraisal: '4-star' as const };
    const manual = buildNativePokedexEntries([bulbasaur], {}, [{
      entryId: '0001-default', facets, registrationId: buildNativePokedexRegistrationId('0001-default', facets),
    }]);
    expect(buildNativePokedexRegistrationSlots(manual, 1).find(({ label }) => label === 'Lucky')?.registered).toBe(false);
    expect(buildNativePokedexCombinationSections(manual, bulbasaur)[0].combinations.filter(({ lockedByInstance }) => lockedByInstance)).toHaveLength(0);
  });

  it('pairs costume families and provides separate purified combination roots', () => {
    const entries = buildNativePokedexEntries([bulbasaur]);
    const sections = buildNativePokedexCombinationSections(entries, bulbasaur);
    const purified = sections.find(({ label }) => label === 'Purified')!;
    expect(purified.combinations).toHaveLength(120);
    expect(purified.combinations.every(({ facets }) => facets.purified)).toBe(true);
    expect(new Set(purified.combinations.map(({ id }) => id)).size).toBe(120);
    expect(sections.find(({ label }) => label === 'Fall Bulbasaur')?.combinations).toHaveLength(120);
    expect(sections.some(({ label }) => label === 'Shiny Fall Bulbasaur')).toBe(false);
    const slots = buildNativePokedexRegistrationSlots(entries, 1);
    expect(getNativePokedexComboSectionForSlot(slots.find(({ label }) => label === 'Purified'), sections)?.id).toBe(purified.id);
    expect(getNativePokedexComboSectionForSlot(slots.find(({ label }) => label === 'Lucky'), sections)).toBeUndefined();
  });

  it('supports canonical quality and normal-form search aliases', () => {
    const combinations = buildNativePokedexCombinationSections(buildNativePokedexEntries([bulbasaur]), bulbasaur)[0].combinations;
    for (const query of ['hundo', 'perfect', '4-star', '100%']) expect(filterNativePokedexCombinations(combinations, query, [])).toHaveLength(30);
    expect(filterNativePokedexCombinations(combinations, 'normal', [])).toHaveLength(60);
    expect(filterNativePokedexCombinations(combinations, 'female hundo', ['lucky'])).toHaveLength(5);
  });

  it('orders normal and shiny costumes together by their original family release', () => {
    const pikachu = pokedexCatalog.find(({ pokemon_id }) => pokemon_id === 25)!;
    const costumes = buildNativePokedexRegistrationSlots(buildNativePokedexEntries([pikachu]), 25).filter(({ section }) => section === 'costume');
    expect(costumes.slice(0, 8).map(({ entry }) => entry.id)).toEqual([
      '0025-santa_default', '0025-santa_shiny', '0025-party_hat_default', '0025-party_hat_shiny',
      '0025-ash_default', '0025-ash_shiny', '0025-witch_hat_default', '0025-witch_hat_shiny',
    ]);
  });

  it('filters fusion-specific moves while retaining shared moves', () => {
    const pokemon = { ...bulbasaur, fusion_id: 2, moves: [
      { move_id: 1, fusion_id: null }, { move_id: 2, fusion_id: 1 }, { move_id: 3, fusion_id: 2 },
    ] } as unknown as typeof bulbasaur;
    expect(getNativePokedexMoves(pokemon).map(({ move_id }) => move_id)).toEqual([1, 3]);
    expect(getNativePokedexMoves({ ...pokemon, fusion_id: undefined }).map(({ move_id }) => move_id)).toEqual([1, 2, 3]);
  });
});
