import type { PokemonTagOrderKey, PokemonTagOrders } from '@shared-contracts/users';

import { createScopedLogger } from '@/utils/logger';

const log = createScopedLogger('tagOrderCache');
const CACHE_PREFIX = 'pokegonexus:tag-orders:v1:';

const isOrderKey = (value: unknown): value is PokemonTagOrderKey =>
  typeof value === 'string' &&
  (value.startsWith('system:') || value.startsWith('custom:'));

const readKeys = (value: unknown): PokemonTagOrderKey[] | null => {
  if (!Array.isArray(value) || !value.every(isOrderKey)) return null;
  return value;
};

const cacheKey = (userId: string): string =>
  `${CACHE_PREFIX}${encodeURIComponent(userId)}`;

export function readCachedTagOrders(userId: string | null): PokemonTagOrders | null {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { caught?: unknown; wanted?: unknown };
    const caught = readKeys(parsed?.caught);
    const wanted = readKeys(parsed?.wanted);
    return caught && wanted ? { caught, wanted } : null;
  } catch (error) {
    log.warn('Could not read cached tag order', error);
    return null;
  }
}

export function writeCachedTagOrders(
  userId: string | null,
  orders: PokemonTagOrders,
): void {
  if (!userId || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(cacheKey(userId), JSON.stringify(orders));
  } catch (error) {
    log.warn('Could not cache tag order', error);
  }
}

