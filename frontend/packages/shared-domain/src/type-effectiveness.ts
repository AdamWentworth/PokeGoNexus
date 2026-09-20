export const typeEffectivenessMultipliers = {
  doubleNotVeryEffective: .391,
  doubleSuperEffective: 2.56,
  neutral: 1,
  notVeryEffective: .625,
  superEffective: 1.6,
  veryIneffective: .244,
} as const;

const typeChart: Record<string, Record<string, number>> = {
  normal: { rock: .625, ghost: .244, steel: .625 },
  fire: { fire: .625, water: .625, grass: 1.6, ice: 1.6, bug: 1.6, rock: .625, dragon: .625, steel: 1.6 },
  water: { fire: 1.6, water: .625, grass: .625, ground: 1.6, rock: 1.6, dragon: .625 },
  electric: { water: 1.6, electric: .625, grass: .625, ground: .244, flying: 1.6, dragon: .625 },
  grass: { fire: .625, water: 1.6, grass: .625, poison: .625, ground: 1.6, flying: .625, bug: .625, rock: 1.6, dragon: .625, steel: .625 },
  ice: { fire: .625, water: .625, grass: 1.6, ice: .625, ground: 1.6, flying: 1.6, dragon: 1.6, steel: .625 },
  fighting: { normal: 1.6, ice: 1.6, poison: .625, flying: .625, psychic: .625, bug: .625, rock: 1.6, ghost: .244, dark: 1.6, steel: 1.6, fairy: .625 },
  poison: { grass: 1.6, poison: .625, ground: .625, rock: .625, ghost: .625, steel: .244, fairy: 1.6 },
  ground: { fire: 1.6, electric: 1.6, grass: .625, poison: 1.6, flying: .244, bug: .625, rock: 1.6, steel: 1.6 },
  flying: { electric: .625, grass: 1.6, fighting: 1.6, bug: 1.6, rock: .625, steel: .625 },
  psychic: { fighting: 1.6, poison: 1.6, psychic: .625, dark: .244, steel: .625 },
  bug: { fire: .625, grass: 1.6, fighting: .625, poison: .625, flying: .625, psychic: 1.6, ghost: .625, dark: 1.6, steel: .625, fairy: .625 },
  rock: { fire: 1.6, ice: 1.6, fighting: .625, ground: .625, flying: 1.6, bug: 1.6, steel: .625 },
  ghost: { normal: .244, psychic: 1.6, ghost: 1.6, dark: .625 },
  dragon: { dragon: 1.6, steel: .625, fairy: .244 },
  dark: { fighting: .625, psychic: 1.6, ghost: 1.6, dark: .625, fairy: .625 },
  steel: { fire: .625, water: .625, electric: .625, ice: 1.6, rock: 1.6, steel: .625, fairy: 1.6 },
  fairy: { fire: .625, fighting: 1.6, poison: .625, dragon: 1.6, dark: 1.6, steel: .625 },
};

export const getTypeEffectivenessMultiplier = (
  attackingType: string | null | undefined,
  defendingTypes: (string | null | undefined)[],
): number => {
  const normalizedAttack = attackingType?.trim().toLocaleLowerCase() ?? '';
  if (!normalizedAttack) return 1;
  const matchups = typeChart[normalizedAttack];
  return defendingTypes.reduce((multiplier, defendingType) => {
    const normalizedDefense = defendingType?.trim().toLocaleLowerCase() ?? '';
    return multiplier * (matchups?.[normalizedDefense] ?? 1);
  }, 1);
};
