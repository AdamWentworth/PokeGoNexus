export type PokemonGender = 'Male' | 'Female' | 'Both' | 'Any' | 'Genderless';

/** Catalog rates are male_female_genderless percentages, including form rates. */
export const getPokemonGenders = (
  rate: string | null | undefined,
  searchMode = false,
): PokemonGender[] => {
  if (!rate) return [];
  const [male, female, genderless] = rate.split('_').map((value) => Number.parseFloat(value) || 0);
  if (genderless === 100) return ['Genderless'];
  if (male > 0 && female > 0) return [searchMode ? 'Any' : 'Both', 'Male', 'Female'];
  if (male > 0) return ['Male'];
  if (female > 0) return ['Female'];
  return [];
};

export const nextPokemonGender = (
  gender: string | null,
  rate: string | null | undefined,
  searchMode = false,
): string | null => {
  const allowed = getPokemonGenders(rate, searchMode);
  if (allowed.length <= 1) return gender;
  const cycle = allowed.filter((value) => value !== 'Both');
  const current = searchMode && gender == null ? 'Any' : gender;
  const next = cycle[(cycle.findIndex((value) => value === current) + 1) % cycle.length];
  return next === 'Any' ? null : next;
};
