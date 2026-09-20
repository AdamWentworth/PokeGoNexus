import type { PokemonVariant } from '@/types/pokemonVariants';
import { resolveBackgroundCostume } from '@/utils/backgroundCostume';

export type SortableCostume = {
  name: string;
  costume_id?: number;
  date_available?: string;
  [key: string]: unknown;
};

export interface MaxAvailability {
  hasDynamax: boolean;
  hasGigantamax: boolean;
}

export interface MaxState {
  dynamax: boolean;
  gigantamax: boolean;
}

type BackgroundRow = {
  costume_id?: number | null;
};

export const toDateMillis = (value: unknown): number => {
  if (typeof value !== 'string' || value.length === 0) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const sortCostumesByDate = (costumes: SortableCostume[]): SortableCostume[] =>
  [...costumes].sort((a, b) => toDateMillis(a.date_available) - toDateMillis(b.date_available));

export const normalizeAvailableForms = (validatedForms: unknown[]): string[] => {
  const filteredForms = validatedForms
    .filter(
      (candidate): candidate is string =>
        typeof candidate === 'string' && candidate.trim().toLowerCase() !== '',
    )
    .map((candidate) => (candidate.toLowerCase() === 'none' ? 'None' : candidate));

  return filteredForms.length > 0 ? filteredForms : [];
};

export const getPokemonSuggestions = (
  pokemonData: PokemonVariant[],
  query: string,
  limit = 6,
): string[] => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  return Array.from(
    new Set(
      pokemonData
        .filter((entry) => {
          const normalizedName = entry.name.toLowerCase();
          return (
            normalizedName.startsWith(normalizedQuery) &&
            normalizedName !== normalizedQuery
          );
        })
        .map((entry) => entry.name),
    ),
  ).slice(0, limit);
};

export const computeMaxAvailability = (
  currentPokemonData?: PokemonVariant,
): MaxAvailability => ({
  hasDynamax:
    currentPokemonData?.max?.some((maxForm) => Number(maxForm.dynamax) === 1) ?? false,
  hasGigantamax:
    currentPokemonData?.max?.some((maxForm) => Number(maxForm.gigantamax) === 1) ?? false,
});

export const cycleMaxState = ({
  dynamax,
  gigantamax,
  hasDynamax,
  hasGigantamax,
}: MaxState & MaxAvailability): MaxState => {
  if (!dynamax && !gigantamax) {
    if (hasDynamax) {
      return { dynamax: true, gigantamax: false };
    }
    if (hasGigantamax) {
      return { dynamax: false, gigantamax: true };
    }
    return { dynamax: false, gigantamax: false };
  }

  if (dynamax) {
    if (hasGigantamax) {
      return { dynamax: false, gigantamax: true };
    }
    return { dynamax: false, gigantamax: false };
  }

  return { dynamax: false, gigantamax: false };
};

export const getSelectedCostumeId = (
  availableCostumes: SortableCostume[],
  costume: string | null,
): number | undefined => availableCostumes.find((entry) => entry.name === costume)?.costume_id;

export const isBackgroundAllowedForSelection = (
  currentPokemonData: PokemonVariant | undefined,
  _costume: string | null,
  availableCostumes: SortableCostume[],
): boolean => {
  const backgrounds = currentPokemonData?.backgrounds as BackgroundRow[] | undefined;
  if (!backgrounds || backgrounds.length === 0) {
    return false;
  }

  return backgrounds.some(
    (background) => resolveBackgroundCostume(background, availableCostumes) !== null,
  );
};
