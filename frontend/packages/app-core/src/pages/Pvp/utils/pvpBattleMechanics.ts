import type {
  PokemonPvPBattleMechanics,
  PokemonPvPFormat,
} from '@pokemongonexus/shared-contracts/pokemon';

const LEGACY_FORMAT_PATTERN = /\bcompetitors?\b/i;

export const resolvePvPBattleMechanics = (
  formatKey: string,
  format?: Pick<PokemonPvPFormat, 'key' | 'label' | 'cup' | 'mechanics'> | null,
): PokemonPvPBattleMechanics => {
  if (format?.mechanics) return format.mechanics;

  const identity = [
    formatKey,
    format?.key,
    format?.label,
    format?.cup,
  ].filter(Boolean).join(' ');

  return LEGACY_FORMAT_PATTERN.test(identity)
    ? 'pvpoke-legacy'
    : 'current-2026';
};

export const pvpBattleMechanicsLabel = (
  mechanics: PokemonPvPBattleMechanics,
): string =>
  mechanics === 'current-2026'
    ? 'June 2026 rules'
    : '2026 championship rules';
