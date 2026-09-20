export type PokemonMoveDamageMode = 'raid' | 'pvp';

export type PokemonMovePowerSource = {
  raid_power?: unknown;
  pvp_power?: unknown;
};

export const getPokemonMovePower = (
  move: PokemonMovePowerSource,
  mode: PokemonMoveDamageMode,
): number | null => {
  const power = mode === 'raid' ? move.raid_power : move.pvp_power;
  return typeof power === 'number' && Number.isFinite(power) ? power : null;
};

export const getPokemonShadowMoveBonus = (power: number): number =>
  Math.max(1, Math.round(power * 0.2));

export const normalizePokemonMoveTypeName = (value: unknown): string => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return normalized || 'normal';
};

export const buildPokemonMoveTypeIconPath = (value: unknown): string =>
  `/images/types/${normalizePokemonMoveTypeName(value)}.png`;
