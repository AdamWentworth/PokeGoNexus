import type { OverlayPokemon, TypeCandidate } from './overlayTypes';

const TYPE_SET = new Set([
  'bug',
  'dark',
  'dragon',
  'electric',
  'fairy',
  'fighting',
  'fire',
  'flying',
  'ghost',
  'grass',
  'ground',
  'ice',
  'normal',
  'poison',
  'psychic',
  'rock',
  'steel',
  'water',
]);

const isTypeCandidateObject = (
  value: unknown,
): value is { name?: string; type?: { name?: string }; typeName?: string } =>
  typeof value === 'object' && value !== null;

const normalizeTypeName = (candidate: unknown): string | null => {
  if (!candidate) return null;
  if (typeof candidate === 'string' || typeof candidate === 'number') {
    return String(candidate).toLowerCase();
  }
  if (isTypeCandidateObject(candidate)) {
    if (typeof candidate.name === 'string') return candidate.name.toLowerCase();
    if (typeof candidate.type?.name === 'string') return candidate.type.name.toLowerCase();
    if (typeof candidate.typeName === 'string') return candidate.typeName.toLowerCase();
  }
  return null;
};

const extractTypeName = (candidate: TypeCandidate): unknown => {
  if (isTypeCandidateObject(candidate)) {
    return candidate.name ?? candidate.type?.name ?? candidate.typeName;
  }
  return candidate;
};

export const getCaughtBgColor = (_pokemon?: OverlayPokemon | null) => '#0f2b2b';

export const getPrimaryTypeName = (pokemon: OverlayPokemon | null): string => {
  if (!pokemon) return 'normal';

  const prioritized = [pokemon.instanceData?.type1_name, pokemon.type1_name];
  for (const value of prioritized) {
    const normalized = normalizeTypeName(value);
    if (normalized && TYPE_SET.has(normalized)) return normalized;
  }

  const candidates = [
    extractTypeName(pokemon.primaryType),
    extractTypeName(pokemon.primary_type),
    extractTypeName(pokemon.type1),
    Array.isArray(pokemon.types) ? pokemon.types[0] : null,
    Array.isArray(pokemon.type) ? pokemon.type[0] : null,
    Array.isArray(pokemon.types) ? extractTypeName(pokemon.types[0]) : null,
  ];
  for (const value of candidates) {
    const normalized = normalizeTypeName(value);
    if (normalized && TYPE_SET.has(normalized)) return normalized;
  }

  const variantType = pokemon.variantType?.toString().toLowerCase();
  if (variantType) {
    const maybeType = variantType.replace(/^type_/, '');
    if (TYPE_SET.has(maybeType)) return maybeType;
  }

  return 'normal';
};

export const getBackgroundImageSrc = (pokemon: OverlayPokemon | null): string => {
  if (!pokemon) return '/images/backgrounds/bg_normal.png';

  const isPurified = Boolean(pokemon.instanceData?.purified);
  const isShadow = Boolean(pokemon.instanceData?.shadow) && !isPurified;
  const isLucky = Boolean(
    pokemon.instanceData?.lucky ||
      (pokemon.instanceData?.is_wanted && pokemon.instanceData?.pref_lucky),
  );

  if (isShadow) return '/images/backgrounds/bg_shadow.png';
  if (isLucky) return '/images/backgrounds/bg_lucky.png';

  const typeName = getPrimaryTypeName(pokemon);
  return `/images/backgrounds/bg_${typeName}.png`;
};
