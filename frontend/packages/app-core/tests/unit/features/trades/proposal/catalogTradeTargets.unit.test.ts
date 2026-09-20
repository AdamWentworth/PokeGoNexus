import { describe, expect, it } from 'vitest';

import { resolveCatalogTradeTargets } from '@/features/trades/proposal/catalogTradeTargets';

describe('resolveCatalogTradeTargets', () => {
  const wanted = {
    '0001-default': {
      name: 'Bulbasaur',
      key: '0001-default',
      pokedex_number: 1,
      variantType: 'default',
    },
    '0001-shiny': {
      name: 'Shiny Bulbasaur',
      key: '0001-shiny',
      pokedex_number: 1,
      variantType: 'shiny',
    },
    '0025-costume': {
      name: 'Costume Pikachu',
      key: '0025-costume',
      pokedex_number: 25,
      variantType: 'costume',
    },
  };

  it('applies explicit exclusions and preserves Pokedex ordering', () => {
    const result = resolveCatalogTradeTargets(
      wanted,
      {},
      { '0001-shiny': true },
    );

    expect(result.map((target) => target.key)).toEqual([
      '0001-default',
      '0025-costume',
    ]);
  });

  it('unions active include-only rules', () => {
    const result = resolveCatalogTradeTargets(
      wanted,
      {
        shinyIconFilter: true,
        costumeIconFilter: true,
      },
      {},
    );

    expect(result.map((target) => target.key)).toEqual([
      '0001-shiny',
      '0025-costume',
    ]);
  });
});
