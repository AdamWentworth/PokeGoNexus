import { act, renderHook } from '@testing-library/react-native';
import type { BasePokemon } from '@pokemongonexus/shared-contracts/pokemon';
import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import * as model from '../../../../src/features/collection/collectionModel';
import { useNativeInstanceNavigationData } from '../../../../src/features/collection/useNativeInstanceNavigationData';
import { prefetchNativeInstanceArtwork } from '../../../../src/features/collection/nativeInstanceArtwork';
import { clearNativeInstanceNavigationContext, setNativeInstanceNavigationContext } from '../../../../src/features/collection/nativeInstanceNavigationContext';

jest.mock('../../../../src/features/collection/nativeInstanceArtwork', () => ({ prefetchNativeInstanceArtwork: jest.fn().mockResolvedValue(undefined) }));
const catalog = [{ pokemon_id: 6, pokedex_number: 6, name: 'Charizard', image_url: '/charizard.png', costumes: [], megaEvolutions: [], fusion: [], max: [] }] as unknown as BasePokemon[];
const instances = Object.fromEntries(['a', 'b', 'c', 'd'].map((id) => [id, {
  instance_id: id, pokemon_id: 6, variant_id: '0006-default', is_caught: true,
}] as const)) as Record<string, PokemonInstance>;
const snapshot = { catalog, instances };
const options = { snapshot, assetBaseUrl: 'https://example.com' };

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
afterEach(() => {
  clearNativeInstanceNavigationContext();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test('prepares only the neighboring instances in the selected grid order and reuses the collection order', () => {
  setNativeInstanceNavigationContext(['c', 'a', 'b']);
  const rows = jest.spyOn(model, 'buildNativeCollectionRows');
  const { result, rerender, unmount } = renderHook<ReturnType<typeof useNativeInstanceNavigationData>, { id: string }>(({ id }) => useNativeInstanceNavigationData({ ...options, instanceId: id }), { initialProps: { id: 'a' } });
  expect(result.current.detail?.row.id).toBe('a');
  expect(result.current.neighbors).toEqual({ previousId: 'c', nextId: 'b' });
  expect(prefetchNativeInstanceArtwork).not.toHaveBeenCalled();
  act(() => jest.runOnlyPendingTimers());
  expect(jest.mocked(prefetchNativeInstanceArtwork).mock.calls.map(([detail]) => detail.row.id)).toEqual(['c', 'b']);
  const warmed = jest.mocked(prefetchNativeInstanceArtwork).mock.calls.find(([detail]) => detail.row.id === 'b')?.[0];
  const rowBuilds = rows.mock.calls.length;
  rerender({ id: 'b' });
  expect(result.current.detail).toBe(warmed);
  expect(result.current.neighbors).toEqual({ previousId: 'a', nextId: null });
  expect(rows).toHaveBeenCalledTimes(rowBuilds);
  unmount();
});

test('cancels obsolete preparation when swiping again or closing the overlay', () => {
  setNativeInstanceNavigationContext(['c', 'a', 'b']);
  const { rerender, unmount } = renderHook<ReturnType<typeof useNativeInstanceNavigationData>, { id: string }>(({ id }) => useNativeInstanceNavigationData({ ...options, instanceId: id }), { initialProps: { id: 'a' } });
  rerender({ id: 'b' });
  act(() => jest.runOnlyPendingTimers());
  expect(jest.mocked(prefetchNativeInstanceArtwork).mock.calls.map(([detail]) => detail.row.id)).toEqual(['a']);
  jest.mocked(prefetchNativeInstanceArtwork).mockClear();
  rerender({ id: 'a' });
  unmount();
  act(() => jest.runOnlyPendingTimers());
  expect(prefetchNativeInstanceArtwork).not.toHaveBeenCalled();
});
