// utils/calculateCP.ts

import { calculatePokemonCombatPower } from '@pokemongonexus/shared-domain/combat-power';

export const calculateCP = (
  baseAttack: number,
  baseDefense: number,
  baseStamina: number,
  ivAttack: number,
  ivDefense: number,
  ivStamina: number,
  cpMultiplier: number
): number => {
  return calculatePokemonCombatPower(
    { attack: baseAttack, defense: baseDefense, stamina: baseStamina },
    { attack: ivAttack, defense: ivDefense, stamina: ivStamina },
    cpMultiplier,
    'multiplier',
  ) ?? 10;
};
