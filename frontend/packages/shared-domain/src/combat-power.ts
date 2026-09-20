export type PokemonCombatStats = {
  attack: number;
  defense: number;
  stamina: number;
};

export type PokemonCombatIvs = {
  attack: number;
  defense: number;
  stamina: number;
};

export type PokemonCombatFields = {
  cp?: number | null;
  level?: number | null;
  ivs?: Partial<PokemonCombatIvs> | null;
};

export type PokemonCombatValidation = {
  errors: {
    cp?: string;
    level?: string;
    ivs?: string;
    general?: string;
  };
  computed: {
    cp?: number;
    level?: number;
    ivs?: PokemonCombatIvs;
  };
};

export const MIN_POKEMON_LEVEL = 1;
export const MAX_POKEMON_LEVEL = 51;

export const cpMultipliers = {
  1: 0.094,
  1.5: 0.135137432,
  2: 0.16639787,
  2.5: 0.192650919,
  3: 0.21573247,
  3.5: 0.236572661,
  4: 0.25572005,
  4.5: 0.273530381,
  5: 0.29024988,
  5.5: 0.306057377,
  6: 0.3210876,
  6.5: 0.335445036,
  7: 0.34921268,
  7.5: 0.362457751,
  8: 0.37523559,
  8.5: 0.387592406,
  9: 0.39956728,
  9.5: 0.411193551,
  10: 0.42250001,
  10.5: 0.432926419,
  11: 0.44310755,
  11.5: 0.4530599578,
  12: 0.46279839,
  12.5: 0.472336083,
  13: 0.48168495,
  13.5: 0.4908558,
  14: 0.49985844,
  14.5: 0.508701765,
  15: 0.51739395,
  15.5: 0.525942511,
  16: 0.53435433,
  16.5: 0.542635767,
  17: 0.55079269,
  17.5: 0.558830576,
  18: 0.56675452,
  18.5: 0.574569153,
  19: 0.58227891,
  19.5: 0.589887917,
  20: 0.59740001,
  20.5: 0.604818814,
  21: 0.61215729,
  21.5: 0.619404122,
  22: 0.62656713,
  22.5: 0.633649143,
  23: 0.64065295,
  23.5: 0.647580966,
  24: 0.65443563,
  24.5: 0.661219252,
  25: 0.667934,
  25.5: 0.674581895,
  26: 0.68116492,
  26.5: 0.687684903,
  27: 0.69414365,
  27.5: 0.70054287,
  28: 0.7068842,
  28.5: 0.713169109,
  29: 0.71939909,
  29.5: 0.72557561,
  30: 0.7317,
  30.5: 0.734741009,
  31: 0.73776948,
  31.5: 0.740785574,
  32: 0.74378943,
  32.5: 0.746781211,
  33: 0.74976104,
  33.5: 0.752729087,
  34: 0.7556855,
  34.5: 0.758630368,
  35: 0.76156384,
  35.5: 0.764486065,
  36: 0.76739717,
  36.5: 0.770297266,
  37: 0.7731865,
  37.5: 0.776064962,
  38: 0.77893275,
  38.5: 0.78179006,
  39: 0.78463697,
  39.5: 0.787473578,
  40: 0.79030001,
  40.5: 0.792803968,
  41: 0.79530001,
  41.5: 0.797800015,
  42: 0.8003,
  42.5: 0.802799995,
  43: 0.8053,
  43.5: 0.8078,
  44: 0.81029999,
  44.5: 0.812799985,
  45: 0.81529999,
  45.5: 0.81779999,
  46: 0.82029999,
  46.5: 0.82279999,
  47: 0.82529999,
  47.5: 0.82779999,
  48: 0.83029999,
  48.5: 0.83279999,
  49: 0.83529999,
  49.5: 0.83779999,
  50: 0.84029999,
  50.5: 0.84279999,
  51: 0.84529999,
} as const;

export const isValidPokemonLevel = (level: number): boolean => (
  Number.isFinite(level)
  && level >= MIN_POKEMON_LEVEL
  && level <= MAX_POKEMON_LEVEL
  && Number.isInteger(level * 2)
);

export const getPokemonCpMultiplier = (level: number): number | undefined => {
  if (!isValidPokemonLevel(level)) return undefined;
  return (cpMultipliers as Record<string, number>)[String(level)];
};

export const calculatePokemonCombatPower = (
  baseStats: PokemonCombatStats,
  ivs: PokemonCombatIvs,
  levelOrMultiplier: number,
  inputKind: 'level' | 'multiplier' = 'level',
): number | null => {
  const multiplier = inputKind === 'level'
    ? getPokemonCpMultiplier(levelOrMultiplier)
    : levelOrMultiplier;
  if (multiplier == null || !Number.isFinite(multiplier) || multiplier <= 0) return null;
  const values = [
    baseStats.attack,
    baseStats.defense,
    baseStats.stamina,
    ivs.attack,
    ivs.defense,
    ivs.stamina,
  ];
  if (values.some((value) => !Number.isFinite(value))) return null;
  const attack = baseStats.attack + ivs.attack;
  const defense = baseStats.defense + ivs.defense;
  const stamina = baseStats.stamina + ivs.stamina;
  return Math.floor(
    (attack * Math.sqrt(defense) * Math.sqrt(stamina) * multiplier ** 2) / 10,
  );
};

export const getPokemonLevelArcProgress = (level: number): number => {
  const boundedLevel = Math.max(MIN_POKEMON_LEVEL, Math.min(50, level));
  const low = Math.floor(boundedLevel * 2) / 2;
  const high = Math.ceil(boundedLevel * 2) / 2;
  const lowMultiplier = getPokemonCpMultiplier(low) ?? cpMultipliers[MIN_POKEMON_LEVEL];
  const highMultiplier = getPokemonCpMultiplier(high) ?? lowMultiplier;
  const current = high === low ? lowMultiplier
    : lowMultiplier + (highMultiplier - lowMultiplier) * (boundedLevel - low) / (high - low);
  return Math.max(0, Math.min(1, current / cpMultipliers[50]));
};

const completeIvs = (
  ivs: Partial<PokemonCombatIvs> | null | undefined,
): ivs is PokemonCombatIvs => (
  ivs != null
  && Number.isInteger(ivs.attack)
  && Number.isInteger(ivs.defense)
  && Number.isInteger(ivs.stamina)
  && (ivs.attack as number) >= 0
  && (ivs.attack as number) <= 15
  && (ivs.defense as number) >= 0
  && (ivs.defense as number) <= 15
  && (ivs.stamina as number) >= 0
  && (ivs.stamina as number) <= 15
);

export const validatePokemonCombatDetails = (
  fields: PokemonCombatFields,
  baseStats: PokemonCombatStats,
): PokemonCombatValidation => {
  const errors: PokemonCombatValidation['errors'] = {};
  const computed: PokemonCombatValidation['computed'] = {};
  const level = fields.level ?? null;
  const cp = fields.cp ?? null;
  const hasLevel = level != null && Number.isFinite(level) && level > 0;
  const hasCp = cp != null && Number.isFinite(cp) && cp > 0;
  const rawIvs = fields.ivs ?? null;
  const hasAnyIv = rawIvs != null && Object.values(rawIvs).some((value) => value != null);
  const hasIvs = completeIvs(rawIvs);

  if (hasLevel && !isValidPokemonLevel(level)) {
    errors.level = `Level must be ${MIN_POKEMON_LEVEL}–${MAX_POKEMON_LEVEL} in 0.5 increments.`;
  }
  if (cp != null && (!Number.isInteger(cp) || cp <= 0)) {
    errors.cp = 'CP must be a positive whole number.';
  }
  if (hasAnyIv && !hasIvs) {
    errors.ivs = 'Enter all three IVs as whole numbers from 0–15.';
  }
  if (Object.keys(errors).length > 0) return { errors, computed };
  if (!hasLevel && !hasCp && !hasAnyIv) return { errors, computed };

  if (hasLevel && hasIvs) {
    const calculated = calculatePokemonCombatPower(baseStats, rawIvs, level);
    if (calculated != null) computed.cp = calculated;
    return { errors, computed };
  }

  if (hasLevel && hasCp) {
    const matches: PokemonCombatIvs[] = [];
    for (let attack = 0; attack <= 15; attack += 1) {
      for (let defense = 0; defense <= 15; defense += 1) {
        for (let stamina = 0; stamina <= 15; stamina += 1) {
          const ivs = { attack, defense, stamina };
          if (calculatePokemonCombatPower(baseStats, ivs, level) === cp) matches.push(ivs);
        }
      }
    }
    if (matches.length === 1) computed.ivs = matches[0];
    else if (matches.length > 1) errors.ivs = 'Multiple IV combinations match this level and CP. Enter the IVs.';
    else errors.cp = 'No IV combination matches this level and CP.';
    return { errors, computed };
  }

  if (hasCp && hasIvs) {
    const matches = Object.keys(cpMultipliers)
      .map(Number)
      .filter((candidateLevel) => (
        calculatePokemonCombatPower(baseStats, rawIvs, candidateLevel) === cp
      ));
    if (matches.length === 1) computed.level = matches[0];
    else if (matches.length > 1) errors.level = 'Multiple levels match this CP and IV appraisal. Enter the level.';
    else errors.cp = 'No level matches this CP and IV appraisal.';
    return { errors, computed };
  }

  errors.general = 'Enter at least two of level, CP, or the complete IV appraisal.';
  return { errors, computed };
};
