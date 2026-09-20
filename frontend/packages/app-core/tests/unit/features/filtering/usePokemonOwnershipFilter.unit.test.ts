import { describe, expect, it } from 'vitest';

import { getFilteredPokemonsByOwnership } from '@/hooks/filtering/usePokemonOwnershipFilter';

import type { Instances } from '@/types/instances';
import type { TagBuckets } from '@/types/tags';

function makeVariants() {
  return [
    {
      variant_id: '0001-default',
      pokemon_id: 1,
      species_name: 'Bulbasaur',
      variantType: 'default',
      currentImage: undefined,
      costumes: [],
    },
    {
      variant_id: '0002-default',
      pokemon_id: 2,
      species_name: 'Ivysaur',
      variantType: 'default',
      currentImage: undefined,
      costumes: [],
    },
  ] as any[];
}

function makeInstances(): Instances {
  return {
    'inst-1': { variant_id: '0001-default', pokemon_id: 1 } as any,
    'inst-2': { variant_id: '0002-default', pokemon_id: 2 } as any,
    'inst-missing': { variant_id: '9999-default', pokemon_id: 9999 } as any,
  };
}

function makeTags(): TagBuckets {
  return {
    caught: {
      'inst-1': { instance_id: 'inst-1', pokemon_id: 1, favorite: true, is_for_trade: false } as any,
      'inst-2': { instance_id: 'inst-2', pokemon_id: 2, favorite: false, is_for_trade: true } as any,
      'inst-missing': { instance_id: 'inst-missing', pokemon_id: 9999, favorite: true, is_for_trade: true } as any,
    },
    wanted: {
      'inst-2': { instance_id: 'inst-2', pokemon_id: 2, most_wanted: true } as any,
    },
  };
}

describe('getFilteredPokemonsByOwnership', () => {
  it('returns hydrated caught rows and skips rows with missing variant mappings', () => {
    const result = getFilteredPokemonsByOwnership(
      makeVariants() as any,
      makeInstances(),
      'caught',
      makeTags(),
    );

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.instanceData?.instance_id)).toEqual(['inst-1', 'inst-2']);
  });

  it('returns empty for deprecated/unknown aliases', () => {
    const result = getFilteredPokemonsByOwnership(
      makeVariants() as any,
      makeInstances(),
      'legacy-alias',
      makeTags(),
    );

    expect(result).toEqual([]);
  });

  it('returns trade as a derived filter from caught', () => {
    const result = getFilteredPokemonsByOwnership(
      makeVariants() as any,
      makeInstances(),
      'trade',
      makeTags(),
    );

    expect(result).toHaveLength(1);
    expect(result[0].instanceData?.instance_id).toBe('inst-2');
  });

  it('returns favorites as a derived filter from caught', () => {
    const result = getFilteredPokemonsByOwnership(
      makeVariants() as any,
      makeInstances(),
      'favorites',
      makeTags(),
    );

    expect(result).toHaveLength(1);
    expect(result[0].instanceData?.instance_id).toBe('inst-1');
  });

  it('returns most wanted from wanted bucket', () => {
    const result = getFilteredPokemonsByOwnership(
      makeVariants() as any,
      makeInstances(),
      'most wanted',
      makeTags(),
    );

    expect(result).toHaveLength(1);
    expect(result[0].instanceData?.instance_id).toBe('inst-2');
  });

  it('returns instances from a custom tag selector', () => {
    const tags = makeTags();
    tags['custom:tag-community-day'] = {
      'inst-2': tags.caught['inst-2'],
    };

    const result = getFilteredPokemonsByOwnership(
      makeVariants() as any,
      makeInstances(),
      'custom:tag-community-day',
      tags,
    );

    expect(result).toHaveLength(1);
    expect(result[0].instanceData?.instance_id).toBe('inst-2');
  });

  it('returns empty for unknown filters and missing', () => {
    expect(
      getFilteredPokemonsByOwnership(makeVariants() as any, makeInstances(), 'unknown', makeTags()),
    ).toEqual([]);

    expect(
      getFilteredPokemonsByOwnership(makeVariants() as any, makeInstances(), 'missing', makeTags()),
    ).toEqual([]);
  });
});
