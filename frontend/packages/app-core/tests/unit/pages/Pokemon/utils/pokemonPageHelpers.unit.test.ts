import { describe, expect, it } from 'vitest';

import {
  buildSelectAllIds,
  buildSliderTransform,
  clampDragOffset,
  getHaveTagsSubLabel,
  getWishlistSubLabel,
  isActiveView,
  toInstanceStatus,
} from '@/pages/Pokemon/utils/pokemonPageHelpers';
import type { PokemonVariant } from '@/types/pokemonVariants';

describe('pokemonPageHelpers', () => {
  it('validates active view values', () => {
    expect(isActiveView('inventory')).toBe(true);
    expect(isActiveView('pokemon')).toBe(true);
    expect(isActiveView('wishlist')).toBe(true);
    expect(isActiveView('pokedex')).toBe(false);
    expect(isActiveView('tags')).toBe(false);
    expect(isActiveView('unknown')).toBe(false);
  });

  it('normalizes tag filter to known instance status values', () => {
    expect(toInstanceStatus('Caught')).toBe('Caught');
    expect(toInstanceStatus('Trade')).toBe('Trade');
    expect(toInstanceStatus('Wanted')).toBe('Wanted');
    expect(toInstanceStatus('Missing')).toBe('Missing');
    expect(toInstanceStatus('favorites')).toBeNull();
  });

  it('builds bulk-selection ids with instance_id priority over variant_id', () => {
    const variants = [
      {
        variant_id: '0001-default',
        instanceData: { instance_id: 'inst-1' },
      },
      {
        variant_id: '0002-default',
      },
      {
        variant_id: '',
      },
    ] as unknown as PokemonVariant[];

    expect(buildSelectAllIds(variants)).toEqual(['inst-1', '0002-default']);
  });

  it('clamps drag offset to configured max peek distance', () => {
    expect(clampDragOffset(400, 1000, 0.3)).toBe(300);
    expect(clampDragOffset(-400, 1000, 0.3)).toBe(-300);
    expect(clampDragOffset(120, 1000, 0.3)).toBe(120);
  });

  it('builds slider transform from active view index and drag offset', () => {
    expect(buildSliderTransform('inventory', 0, 1000)).toBe('translate3d(0px,0,0)');
    expect(buildSliderTransform('pokemon', 0, 1000)).toBe('translate3d(-1000px,0,0)');
    expect(buildSliderTransform('wishlist', 100, 1000)).toBe('translate3d(-1900px,0,0)');
  });

  it('returns expected sub-labels for inventory and wishlist tag panels', () => {
    expect(getHaveTagsSubLabel('Caught')).toBe('(CAUGHT)');
    expect(getHaveTagsSubLabel('Trade')).toBe('(TRADE)');
    expect(getHaveTagsSubLabel('Favorites')).toBe('(FAVORITES)');
    expect(getHaveTagsSubLabel('Wanted')).toBeUndefined();
    expect(getHaveTagsSubLabel('')).toBeUndefined();
    expect(
      getHaveTagsSubLabel('custom:shadow', {
        name: 'Shadow Shinies',
        parent: 'caught',
      }),
    ).toBe('(SHADOW SHINIES)');
    expect(
      getHaveTagsSubLabel('custom:raid', {
        name: 'Raid targets',
        parent: 'wanted',
      }),
    ).toBeUndefined();

    expect(getWishlistSubLabel('Wanted')).toBe('(WANTED)');
    expect(getWishlistSubLabel('Most Wanted')).toBe('(MOST WANTED)');
    expect(getWishlistSubLabel('Caught')).toBeUndefined();
    expect(getWishlistSubLabel('')).toBeUndefined();
    expect(
      getWishlistSubLabel('custom:raid', {
        name: 'Raid targets',
        parent: 'wanted',
      }),
    ).toBe('(RAID TARGETS)');
    expect(
      getWishlistSubLabel('custom:shadow', {
        name: 'Shadow Shinies',
        parent: 'caught',
      }),
    ).toBeUndefined();
  });
});
