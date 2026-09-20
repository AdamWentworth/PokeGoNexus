import { describe, expect, it } from 'vitest';

import {
  projectPokemonCollectionSortSource,
  sortPokemonCollectionItems,
  type PokemonCollectionSortSource,
} from '@pokemongonexus/shared-domain/collection-sort';

type Fixture = PokemonCollectionSortSource & { id: string };

const fixture = (id: string, patch: Partial<Fixture> = {}): Fixture => ({
  id,
  pokedex_number: 1,
  name: id,
  species_name: id,
  variantType: 'default',
  form: null,
  date_available: '2020-01-01',
  date_shiny_available: null,
  date_shadow_available: null,
  date_shiny_shadow_available: null,
  stamina: 100,
  cp50: 1000,
  costumes: [],
  megaEvolutions: [],
  fusion: [],
  max: [],
  ...patch,
});

const ids = (
  rows: Fixture[],
  sort: Parameters<typeof sortPokemonCollectionItems<Fixture>>[1],
  direction: Parameters<typeof sortPokemonCollectionItems<Fixture>>[2],
) => sortPokemonCollectionItems(
  rows,
  sort,
  direction,
  projectPokemonCollectionSortSource,
).map(({ id }) => id);

describe('canonical Vite/native Pokémon collection sorting', () => {
  it('keeps favorites first in both directions and applies direction to CP inside each group', () => {
    const rows = [
      fixture('ordinary-high', { pokedex_number: 4, instanceData: { favorite: false, cp: 400 } }),
      fixture('favorite-low', { pokedex_number: 2, instanceData: { favorite: true, cp: 200 } }),
      fixture('favorite-high', { pokedex_number: 3, instanceData: { favorite: true, cp: 300 } }),
      fixture('ordinary-low', { pokedex_number: 1, instanceData: { favorite: false, cp: 100 } }),
    ];

    expect(ids(rows, 'favorite', 'ascending')).toEqual([
      'favorite-low', 'favorite-high', 'ordinary-low', 'ordinary-high',
    ]);
    expect(ids(rows, 'favorite', 'descending')).toEqual([
      'favorite-high', 'favorite-low', 'ordinary-high', 'ordinary-low',
    ]);
  });

  it('uses recorded instance CP including null, catalog CP50, and ascending dex ties', () => {
    const rows = [
      fixture('catalog', { pokedex_number: 3, cp50: 2500 }),
      fixture('recorded', { pokedex_number: 2, instanceData: { cp: 1200 } }),
      fixture('unknown', { pokedex_number: 1, instanceData: { cp: null } }),
      fixture('recorded-tie', { pokedex_number: 4, instanceData: { cp: 1200 } }),
    ];

    expect(ids(rows, 'combatPower', 'ascending')).toEqual([
      'unknown', 'recorded', 'recorded-tie', 'catalog',
    ]);
    expect(ids(rows, 'combatPower', 'descending')).toEqual([
      'catalog', 'recorded', 'recorded-tie', 'unknown',
    ]);
  });

  it('sorts Recent by variant release metadata rather than instance creation time', () => {
    const rows = [
      fixture('newer-species-old-instance', {
        pokedex_number: 2,
        date_available: '2025-02-01',
        instanceData: { cp: 1 },
      }),
      fixture('older-species-new-instance', {
        pokedex_number: 1,
        date_available: '2020-02-01',
        instanceData: { cp: 1 },
      }),
      fixture('mega-release', {
        pokedex_number: 3,
        variantType: 'mega_x',
        form: 'X',
        megaEvolutions: [{ form: 'X', date_available: '2024-06-01' }],
      }),
    ];

    expect(ids(rows, 'releaseDate', 'ascending')).toEqual([
      'older-species-new-instance', 'mega-release', 'newer-species-old-instance',
    ]);
  });

  it('uses the Vite species-name token, variant stamina, and fixed within-species form order', () => {
    const rows = [
      fixture('mega-x', {
        name: 'Mega Alpha X',
        species_name: 'Alpha',
        variantType: 'mega_x',
        form: 'X',
        stamina: 220,
      }),
      fixture('shiny', {
        name: 'Shiny Zubat',
        species_name: 'Zubat',
        variantType: 'shiny',
        stamina: 90,
      }),
      fixture('default', {
        name: 'Alpha',
        species_name: 'Alpha',
        variantType: 'default',
        stamina: 100,
      }),
    ];

    expect(ids(rows, 'name', 'ascending')).toEqual(['mega-x', 'default', 'shiny']);
    expect(ids(rows, 'hp', 'descending')).toEqual(['mega-x', 'default', 'shiny']);
    expect(ids(rows, 'number', 'descending')).toEqual(['default', 'shiny', 'mega-x']);
  });
});
