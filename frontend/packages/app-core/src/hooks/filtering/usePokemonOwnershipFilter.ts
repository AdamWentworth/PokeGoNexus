// usePokemonOwnershipFilter.ts

import type { PokemonVariant } from '@/types/pokemonVariants';
import type { Instances } from '@/types/instances';
import type { TagBuckets } from '@/types/tags';
import type { PokemonInstance } from '@/types/pokemonInstance';
import { createScopedLogger } from '@/utils/logger';
import { fromCustomTagFilter, toCustomTagFilter } from '@/features/tags/utils/customTagSelectors';
import { getInstanceVariantResolver } from '@pokemongonexus/shared-domain/instance-variant';

const log = createScopedLogger('usePokemonOwnershipFilter');

// Base filters the UI should treat as parents
const VALID_FILTERS = ['caught', 'wanted'] as const;
export type OwnershipFilter = typeof VALID_FILTERS[number];

// Derived (children) – treat 'trade' like 'favorites' / 'most wanted'
type SpecialFilter = 'favorites' | 'most wanted' | 'trade';

export function getFilteredPokemonsByOwnership(
  variants: PokemonVariant[],
  instancesData: Instances,
  filter: string,
  tagBuckets: TagBuckets
) {
  const normalizedFilter = (filter || '').toLowerCase().trim();
  if (normalizedFilter === 'missing') {
    return [] as Array<PokemonVariant & { instanceData: PokemonInstance }>;
  }

  const resolveVariant = getInstanceVariantResolver(variants);

  // helper: instance_ids -> hydrated rows
  const mapIds = (ids: string[]) => {
    const mapped: Array<PokemonVariant & { instanceData: PokemonInstance }> = [];

    for (const instanceId of ids) {
      const instance = instancesData[instanceId];
      if (!instance || instance.disabled) continue;
      const variant = resolveVariant(instance);
      if (!variant) continue;

      mapped.push({
        ...variant,
        instanceData: { ...instance, instance_id: instanceId } as PokemonInstance,
      });
    }

    return mapped;
  };

  const customTagId = fromCustomTagFilter(filter);
  if (customTagId) {
    const bucket =
      tagBuckets[toCustomTagFilter(customTagId)] ??
      tagBuckets[toCustomTagFilter(customTagId.toLowerCase())] ??
      {};
    return mapIds(Object.keys(bucket));
  }

  // ---- derived children ----
  if ((normalizedFilter as SpecialFilter) === 'favorites') {
    const bucket = tagBuckets.caught ?? {};
    const ids = Object.entries(bucket)
      .filter(([, item]) => item.favorite)
      .map(([id]) => id);
    return mapIds(ids);
  }

  if ((normalizedFilter as SpecialFilter) === 'most wanted') {
    const bucket = tagBuckets.wanted ?? {};
    const ids = Object.entries(bucket)
      .filter(([, item]) => item.most_wanted)
      .map(([id]) => id);
    return mapIds(ids);
  }

  if ((normalizedFilter as SpecialFilter) === 'trade') {
    // ✅ Trade is derived strictly from Caught
    const bucket = tagBuckets.caught ?? {};
    const ids = Object.entries(bucket)
      .filter(([, item]) => item.is_for_trade)
      .map(([id]) => id);
    return mapIds(ids);
  }

  // ---- base parents ----
  const filterKey = normalizedFilter as OwnershipFilter;
  if (!VALID_FILTERS.includes(filterKey)) {
    log.warn(`Unknown filter "${filter}". Returning empty array.`);
    return [];
  }

  const bucket = tagBuckets[filterKey] ?? {};
  return mapIds(Object.keys(bucket));
}
