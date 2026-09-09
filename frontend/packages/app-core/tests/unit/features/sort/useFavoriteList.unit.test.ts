import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';

import useFavoriteList from '@/hooks/sort/useFavoriteList';

type FavoriteFixture = {
  id: string;
  favorite?: boolean;
  cp?: number | string | null;
  cp50?: number | string | null;
  pokedex_number?: number | string | null;
};

describe('useFavoriteList', () => {
  it('returns empty array for non-array input', () => {
    const { result } = renderHook(() => useFavoriteList(undefined));
    expect(result.current).toEqual([]);
  });

  it('sorts favorites first, then CP descending, then pokedex_number ascending', () => {
    const fixtures: FavoriteFixture[] = [
      { id: 'non-fav-high-cp', favorite: false, cp: 3000, pokedex_number: 6 },
      { id: 'fav-low-cp', favorite: true, cp: 1200, pokedex_number: 4 },
      { id: 'fav-high-cp', favorite: true, cp: 2500, pokedex_number: 25 },
      { id: 'non-fav-low-cp', favorite: false, cp: 500, pokedex_number: 1 },
      { id: 'fav-tie-pokedex-2', favorite: true, cp: 1500, pokedex_number: 2 },
      { id: 'fav-tie-pokedex-1', favorite: true, cp: 1500, pokedex_number: 1 },
    ];

    const { result } = renderHook(() => useFavoriteList(fixtures));

    expect(result.current.map((x) => x.id)).toEqual([
      'fav-high-cp',
      'fav-tie-pokedex-1',
      'fav-tie-pokedex-2',
      'fav-low-cp',
      'non-fav-high-cp',
      'non-fav-low-cp',
    ]);
  });

  it('falls back to cp50 when cp is absent and handles invalid values safely', () => {
    const fixtures: FavoriteFixture[] = [
      { id: 'cp50-1500', favorite: false, cp50: '1500', pokedex_number: 10 },
      { id: 'cp-invalid', favorite: false, cp: 'not-a-number', pokedex_number: 1 },
      { id: 'cp50-900', favorite: false, cp50: 900, pokedex_number: 20 },
    ];

    const { result } = renderHook(() => useFavoriteList(fixtures));

    expect(result.current.map((x) => x.id)).toEqual([
      'cp50-1500',
      'cp50-900',
      'cp-invalid',
    ]);
  });

  it('preserves zero CP, stable ties, and the original collection order', () => {
    const fixtures: FavoriteFixture[] = [
      { id: 'missing', favorite: true },
      { id: 'zero', favorite: true, cp: 0, cp50: 5000 },
      { id: 'tie-first', favorite: true, cp: 1500, pokedex_number: 6 },
      { id: 'fallback', favorite: true, cp: null, cp50: 2500 },
      { id: 'tie-second', favorite: true, cp: '1500', pokedex_number: '6' },
    ];
    const original = [...fixtures];
    const { result, rerender } = renderHook(() => useFavoriteList(fixtures));
    expect(result.current.map(({ id }) => id)).toEqual([
      'fallback', 'tie-first', 'tie-second', 'zero', 'missing',
    ]);
    expect(fixtures).toEqual(original);
    const sorted = result.current;
    rerender();
    expect(result.current).toBe(sorted);
  });
});
