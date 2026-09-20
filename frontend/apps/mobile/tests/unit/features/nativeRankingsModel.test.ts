import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import {
  buildNativeRankingRows,
  countNativeRankingCollectionFilters,
  filterNativeRankingRowsByCollection,
  getNativeRankingCatalogSearch,
  getNativeRankingCollectionDestination,
  getNativeRankingDisplayName,
  getNativeRankingsErrorMessage,
  matchesNativeRankingCategory,
} from '../../../src/features/tools/nativeRankingsModel';

const catalog = [{ id: '0001-shiny', pokemonId: 1, pokedexNumber: 1, name: 'Shiny Bulbasaur', imageUri: '/bulbasaur.png', typeIconUris: [] as string[], maxKind: null }];
const payload = { privacy_threshold: 3, snapshot: { collector_users: 5, wishlist_users: 4, updated_at: '2026-01-01' }, most_wanted: [{ variant_id: '0001-shiny', wanted_users: 4, most_wanted_users: 2, caught_users: 3 }], rarest: [{ variant_id: '0001-shiny', wanted_users: 4, most_wanted_users: 2, caught_users: 3 }] };
describe('native rankings model', () => {
  it('turns technical ranking failures into the same actionable copy as Vite', () => {
    expect(getNativeRankingsErrorMessage('Network request failed', false)).toContain('offline');
    expect(getNativeRankingsErrorMessage('Request timed out')).toContain('took too long');
    expect(getNativeRankingsErrorMessage('503 Service Unavailable')).toContain('temporarily unavailable');
    expect(getNativeRankingsErrorMessage('opaque failure')).toContain('could not be refreshed');
  });
  it('joins rankings to catalog entries and applies personal filters', () => {
    const instance = { variant_id: '0001-shiny', is_caught: true, is_for_trade: true, is_wanted: false } as PokemonInstance;
    expect(buildNativeRankingRows({ catalog: [...catalog], instances: { one: instance }, mode: 'wanted', payload, collectionFilter: 'trade' })).toMatchObject([{ rank: 1, personal: { registered: true, tradeCount: 1 } }]);
    expect(buildNativeRankingRows({ catalog: [...catalog], instances: { one: instance }, mode: 'wanted', payload, collectionFilter: 'missing' })).toEqual([]);
  });
  it('filters category and search without changing canonical rank', () => {
    expect(buildNativeRankingRows({ catalog: [...catalog], mode: 'rarest', payload, category: 'shiny', query: 'bulba' })[0]?.rank).toBe(1);
    expect(buildNativeRankingRows({ catalog: [...catalog], mode: 'rarest', payload, category: 'max' })).toEqual([]);
  });
  it('matches every combined Vite category instead of forcing one classification', () => {
    const combinedCatalog = [
      { ...catalog[0], id: '0052-shiny_shadow', name: 'Shiny Shadow Meowth', variantType: 'shiny_shadow' },
      { ...catalog[0], id: '0006-shiny_gigantamax', name: 'Shiny Gigantamax Charizard', variantType: 'shiny_gigantamax', maxKind: 'gigantamax' as const },
      { ...catalog[0], id: '0025-party_hat_shiny', name: 'Shiny Party Hat Pikachu', variantType: 'costume_12_shiny' },
      { ...catalog[0], id: '0006-mega_x', name: 'Mega Charizard X', variantType: 'mega_x' },
    ];
    expect(matchesNativeRankingCategory(combinedCatalog[0], 'shiny')).toBe(true);
    expect(matchesNativeRankingCategory(combinedCatalog[0], 'shadow')).toBe(true);
    expect(matchesNativeRankingCategory(combinedCatalog[1], 'shiny')).toBe(true);
    expect(matchesNativeRankingCategory(combinedCatalog[1], 'max')).toBe(true);
    expect(matchesNativeRankingCategory(combinedCatalog[2], 'shiny')).toBe(true);
    expect(matchesNativeRankingCategory(combinedCatalog[2], 'costume')).toBe(true);
    expect(matchesNativeRankingCategory(combinedCatalog[3], 'costume')).toBe(false);
  });
  it('builds the same compound Pokémon catalog search as Vite', () => {
    const entry = {
      ...catalog[0],
      id: '0006-shiny_gigantamax',
      name: 'Shiny Gigantamax Charizard',
      speciesName: 'Charizard',
      variantType: 'shiny_gigantamax',
      maxKind: 'gigantamax' as const,
    };
    expect(getNativeRankingCatalogSearch(entry)).toBe('charizard&shiny&gigantamax');
    expect(getNativeRankingCollectionDestination({ entry, personal: { caughtCount: 1, registered: true, tradeCount: 1, wanted: true } }))
      .toEqual({ filter: 'trade', search: 'charizard&shiny&gigantamax' });
    expect(getNativeRankingCollectionDestination({ entry, personal: { caughtCount: 0, registered: false, tradeCount: 0, wanted: false } }))
      .toEqual({});
  });
  it('shows canonical forms exactly once like Vite', () => {
    expect(getNativeRankingDisplayName({ ...catalog[0], form: 'origin', name: 'Giratina' }))
      .toBe('Giratina Origin');
    expect(getNativeRankingDisplayName({ ...catalog[0], form: 'origin', name: 'Giratina (Origin)' }))
      .toBe('Giratina (Origin)');
  });
  it('counts and applies personal filters after category and search matching', () => {
    const instance = { variant_id: '0001-shiny', is_caught: true, is_for_trade: true } as PokemonInstance;
    const rows = buildNativeRankingRows({ catalog: [...catalog], instances: { one: instance }, mode: 'wanted', payload });
    expect(countNativeRankingCollectionFilters(rows)).toEqual({ all: 1, missing: 0, owned: 1, trade: 1, wanted: 0 });
    expect(filterNativeRankingRowsByCollection(rows, 'trade')).toEqual(rows);
    expect(filterNativeRankingRowsByCollection(rows, 'wanted')).toEqual([]);
  });
  it('collapses ordinary evolution families in rarity rankings while preserving collectibles', () => {
    const familyCatalog = [
      { ...catalog[0], evolvesFrom: [], evolvesTo: [2] },
      { ...catalog[0], id: '0002-shiny', pokemonId: 2, pokedexNumber: 2, name: 'Shiny Ivysaur', evolvesFrom: [1], evolvesTo: [] },
      { ...catalog[0], id: '0001-party_hat_shiny', name: 'Shiny Party Hat Bulbasaur', evolvesFrom: [], evolvesTo: [2] },
    ];
    const familyPayload = {
      ...payload,
      rarest: [
        { variant_id: '0002-shiny', wanted_users: 1, most_wanted_users: 1, caught_users: 1 },
        { variant_id: '0001-shiny', wanted_users: 2, most_wanted_users: 2, caught_users: 2 },
        { variant_id: '0001-party_hat_shiny', wanted_users: 3, most_wanted_users: 3, caught_users: 3 },
      ],
    };
    expect(buildNativeRankingRows({ catalog: familyCatalog, mode: 'rarest', payload: familyPayload }))
      .toMatchObject([
        { entry: { id: '0001-shiny' }, rank: 1 },
        { entry: { id: '0001-party_hat_shiny' }, rank: 2 },
      ]);
  });
});
