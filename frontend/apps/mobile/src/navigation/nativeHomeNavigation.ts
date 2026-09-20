import type { PokemonTagOrderKey } from '@pokemongonexus/shared-contracts/users';
import { nativeCollectionTagKeyForFilter } from '../features/collection/nativeCollectionRouteFilter';
import { resolveNativeDeepLink } from './nativeDeepLink';

export const NATIVE_HOME_NAVIGATION_SOURCE = 'home-navigation';

type RunWithLoading = (source: string, action: () => void) => void;

export type NativeHomeCollectionEntry = {
  destination: string;
  selectedTagKey: PokemonTagOrderKey | null;
};

/**
 * Home summary cards enter through the same parameter-free route as the
 * action-menu Pokémon button. The caller primes selectedTagKey in the native
 * collection session before pushing destination. Instance links keep their
 * direct detail destination and do not alter the saved collection context.
 */
export const resolveNativeHomeCollectionEntry = (
  path: string,
): NativeHomeCollectionEntry => {
  const [, search = ''] = path.split('?');
  const params = new URLSearchParams(search);

  if (params.get('instanceId')?.trim()) {
    return {
      destination: resolveNativeDeepLink(path),
      selectedTagKey: null,
    };
  }

  return {
    destination: '/native/collection',
    selectedTagKey: nativeCollectionTagKeyForFilter(params.get('filter')),
  };
};

/**
 * Start the loader and Expo Router navigation in the same interaction. The
 * retained root overlay can paint while the destination commits, but Home
 * must not make every link wait through two otherwise idle frame boundaries.
 * This matches Vite's navigation handoff and keeps the first tap responsive.
 */
export const runNativeHomeNavigationWithLoading = (
  runWithLoading: RunWithLoading,
  navigate: () => void,
): void => {
  runWithLoading(NATIVE_HOME_NAVIGATION_SOURCE, navigate);
};
