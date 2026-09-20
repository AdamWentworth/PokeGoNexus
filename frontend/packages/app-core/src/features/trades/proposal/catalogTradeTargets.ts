import wantedFilters from '@/pages/Pokemon/features/instances/utils/wantedFilters';
import {
  EXCLUDE_IMAGES_wanted,
  FILTER_NAMES,
} from '@/pages/Pokemon/features/instances/utils/constants';

import type { SelectedPokemon } from './proposalCandidateHelpers';

type TargetMap = Record<string, SelectedPokemon>;
type FilterFn = (targets: TargetMap) => TargetMap;

const filterFunctions = wantedFilters as unknown as Record<string, FilterFn>;

export const resolveCatalogTradeTargets = (
  wanted: Record<string, unknown> | null | undefined,
  rules: Record<string, boolean> | null | undefined,
  excluded: Record<string, boolean> | null | undefined,
): SelectedPokemon[] => {
  const source = Object.fromEntries(
    Object.entries(wanted ?? {}).flatMap(([key, value]) =>
      value && typeof value === 'object'
        ? [[key, { ...(value as SelectedPokemon), key }]]
        : [],
    ),
  ) as TargetMap;

  let filtered = { ...source };
  EXCLUDE_IMAGES_wanted.forEach((_image, index) => {
    const filterName = FILTER_NAMES[index];
    if (!rules?.[filterName]) return;
    filtered = filterFunctions[filterName]?.(filtered) ?? filtered;
  });

  const includeIndexes = FILTER_NAMES.slice(EXCLUDE_IMAGES_wanted.length)
    .map((filterName, offset) => ({ filterName, offset }))
    .filter(({ filterName }) => Boolean(rules?.[filterName]));
  if (includeIndexes.length > 0) {
    const included: TargetMap = {};
    includeIndexes.forEach(({ filterName }) => {
      const matching = filterFunctions[filterName]?.(source) ?? {};
      Object.entries(matching).forEach(([key, value]) => {
        if (filtered[key]) included[key] = value;
      });
    });
    filtered = included;
  }

  return Object.entries(filtered)
    .filter(([key]) => !excluded?.[key])
    .map(([, value]) => value)
    .sort((left, right) => {
      const leftNumber = Number(left.pokedex_number ?? Number.MAX_SAFE_INTEGER);
      const rightNumber = Number(right.pokedex_number ?? Number.MAX_SAFE_INTEGER);
      return leftNumber - rightNumber ||
        String(left.name ?? left.species_name ?? '').localeCompare(
          String(right.name ?? right.species_name ?? ''),
        );
    });
};
