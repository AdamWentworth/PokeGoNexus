import type { PokemonTagOrderKey } from '@pokemongonexus/shared-contracts/users';

export const nativeCollectionTagKeyForFilter = (
  filter: string | null | undefined,
): PokemonTagOrderKey | null => {
  const normalized = filter?.trim().toLocaleLowerCase().replaceAll('_', '-') ?? '';
  if (normalized === 'caught' || normalized === 'all-caught') return 'system:caught';
  if (normalized === 'trade' || normalized === 'for-trade') return 'system:trade';
  if (normalized === 'wanted' || normalized === 'all-wanted') return 'system:wanted';
  if (normalized === 'most-wanted') return 'system:most-wanted';
  if (normalized === 'favorites') return 'system:favorites';
  return null;
};
