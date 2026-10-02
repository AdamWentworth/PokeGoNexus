import type { PokemonVariant } from '@/types/pokemonVariants';
import type {
  PokemonSizeClass,
  WantedSizePreferences,
  WantedSizeRange,
} from '@/types/pokemonInstance';

export type WantedSizeMetric = 'weight' | 'height';
export type WantedSizePreference = PokemonSizeClass | null;

type SizeThresholds = PokemonVariant['sizes'];

const getThresholds = (sizes: SizeThresholds, metric: WantedSizeMetric) => ({
  xxs: sizes[`${metric}_xxs_threshold`],
  xs: sizes[`${metric}_xs_threshold`],
  xl: sizes[`${metric}_xl_threshold`],
  xxl: sizes[`${metric}_xxl_threshold`],
});

export const getWantedSizePreference = (
  value: number | null | undefined,
  sizes: SizeThresholds | null | undefined,
  metric: WantedSizeMetric,
): WantedSizePreference => {
  if (value == null || !Number.isFinite(value) || !sizes) return null;

  const { xxs, xs, xl, xxl } = getThresholds(sizes, metric);
  if (value < xxs) return 'XXS';
  if (value < xs) return 'XS';
  if (value > xxl) return 'XXL';
  if (value > xl) return 'XL';
  return null;
};

const isWantedSizePreference = (value: unknown): value is PokemonSizeClass =>
  value === 'XXS' || value === 'XS' || value === 'XL' || value === 'XXL';

export const getStoredWantedSizePreference = (
  preferences: WantedSizePreferences | null | undefined,
  legacyValue: number | null | undefined,
  sizes: SizeThresholds | null | undefined,
  metric: WantedSizeMetric,
): WantedSizePreference => {
  const category = preferences?.[metric]?.category;
  return isWantedSizePreference(category)
    ? category
    : getWantedSizePreference(legacyValue, sizes, metric);
};

export const buildWantedSizeRange = (
  preference: WantedSizePreference,
  sizes: SizeThresholds | null | undefined,
  metric: WantedSizeMetric,
): WantedSizeRange | null => {
  if (preference == null || !sizes) return null;

  const { xxs, xs, xl, xxl } = getThresholds(sizes, metric);
  switch (preference) {
    case 'XXS':
      return {
        category: preference,
        min: null,
        max: xxs,
        min_inclusive: false,
        max_inclusive: false,
      };
    case 'XS':
      return {
        category: preference,
        min: xxs,
        max: xs,
        min_inclusive: true,
        max_inclusive: false,
      };
    case 'XL':
      return {
        category: preference,
        min: xl,
        max: xxl,
        min_inclusive: false,
        max_inclusive: true,
      };
    case 'XXL':
      return {
        category: preference,
        min: xxl,
        max: null,
        min_inclusive: false,
        max_inclusive: false,
      };
  }
};

export const buildWantedSizePreferences = (
  weight: WantedSizePreference,
  height: WantedSizePreference,
  sizes: SizeThresholds | null | undefined,
): WantedSizePreferences | null => {
  const preferences = {
    weight: buildWantedSizeRange(weight, sizes, 'weight'),
    height: buildWantedSizeRange(height, sizes, 'height'),
  };
  return preferences.weight || preferences.height ? preferences : null;
};
