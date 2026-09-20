import type { Move } from '@pokemongonexus/shared-contracts/pokemon';
import type { PokemonVariant } from '@pokemongonexus/shared-contracts/variants';
import {
  getSpecialMaxAttacker,
  type SpecialMaxAttacker,
} from '@pokemongonexus/shared-domain/special-max-pokemon';
import { cpMultipliers } from '@pokemongonexus/shared-domain/combat-power';
import {
  buildSharedRaidIncomingPressureScenarios as buildRaidIncomingPressureScenarios,
  calculateSharedRaidAttackerCp as calculateRaidAttackerCp,
  calculateSharedRaidIncomingPressure as calculateRaidIncomingPressure,
  getSharedRaidAttackerIvPercent as getRaidAttackerIvPercent,
  getSharedRaidAttackerIvs as getRaidAttackerIvs,
  getSharedRaidAttackerLevelLabel as getRaidAttackerLevelLabel,
  resolveSharedRaidAttackerLevel as resolveRaidAttackerLevel,
} from '@pokemongonexus/shared-domain/raid-combat';
import { getTypeEffectivenessMultiplier } from '@pokemongonexus/shared-domain/type-effectiveness';

export type MaxRole = 'damage' | 'tank' | 'healing';
export type MaxMoveLevel = 0 | 1 | 2 | 3;

export type MaxBossBenchmark = {
  maxHitDamage: number;
  incomingDamage: number;
  incomingType: string;
  incomingDps: number;
  hostileIncomingDps: number;
  hitsToFaint: number;
  guardedHitsToFaint: number;
  hpAfterHit: number;
  hpAfterGuardedHit: number;
  meterCycleSeconds: number;
  meterCycleDamage: number;
  hpAfterMeterCycle: number;
  hpAfterGuardedMeterCycle: number;
  meterCyclesSurvived: number;
  guardedMeterCyclesSurvived: number;
  pressureSource: 'legal-movesets' | 'typed-benchmark';
};

export type MaxRankingEntry = {
  variant: PokemonVariant;
  displayName: string;
  maxForm: 'dynamax' | 'gigantamax' | 'special';
  role: MaxRole;
  score: number;
  fastMove: Move;
  chargedMove: Move | null;
  maxMoveName: string;
  maxMoveType: string;
  maxMovePower: number;
  maxAttackLevel: Exclude<MaxMoveLevel, 0>;
  maxGuardLevel: MaxMoveLevel;
  maxSpiritLevel: MaxMoveLevel;
  maxGuardHp: number;
  maxSpiritRate: number;
  attack: number;
  defense: number;
  hp: number;
  cp: number;
  levelLabel: string;
  ivPercent: number | null;
  personalized: boolean;
  meterSeconds: number;
  fastHitDamage: number;
  attackIndex: number;
  neutralBulk: number;
  effectiveBulk: number;
  cycleEndurance: number;
  healPerAlly: number;
  teamHeal: number;
  incomingMultiplier: number;
  outgoingMultiplier: number;
  bossBenchmark?: MaxBossBenchmark;
};

export type MaxRoleCandidates = Record<MaxRole, MaxRankingEntry[]>;

export const MAX_BATTLE_TYPES = [
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
] as const;

export const MAX_ROLE_COPY: Record<
  MaxRole,
  { label: string; shortLabel: string; description: string }
> = {
  damage: {
    label: 'Damage dealers',
    shortLabel: 'Damage',
    description: 'Max Attack power, Attack, STAB, and matchup effectiveness.',
  },
  tank: {
    label: 'Tanks',
    shortLabel: 'Tank',
    description: 'Effective bulk and Fast Move cadence across each Max Meter cycle.',
  },
  healing: {
    label: 'Healers',
    shortLabel: 'Healing',
    description: 'Max Spirit healing, with survival and cadence shown separately.',
  },
};

export const MAX_MODEL_CONSTANTS = {
  level50Cpm: 0.84029999,
  dynamaxMovePower: 350,
  gigantamaxMovePower: 450,
  stabMultiplier: 1.2,
  maxSpiritLevel3: 0.16,
  maxGroupSize: 4,
  maxGuardLevel3Hp: 60,
  benchmarkBossMovePower: 100,
  benchmarkBossActionSeconds: 2.5,
  maxMeterEnergy: 100,
} as const;

const GIGANTAMAX_MOVE_FALLBACKS: Readonly<
  Record<number, { name: string; type: string }>
> = {
  3: { name: 'G-Max Vine Lash', type: 'grass' },
  6: { name: 'G-Max Wildfire', type: 'fire' },
  9: { name: 'G-Max Cannonade', type: 'water' },
  68: { name: 'G-Max Chi Strike', type: 'fighting' },
  94: { name: 'G-Max Terror', type: 'ghost' },
  99: { name: 'G-Max Foam Burst', type: 'water' },
  131: { name: 'G-Max Resonance', type: 'ice' },
  143: { name: 'G-Max Replenish', type: 'normal' },
  812: { name: 'G-Max Drum Solo', type: 'grass' },
  815: { name: 'G-Max Fireball', type: 'fire' },
  818: { name: 'G-Max Hydrosnipe', type: 'water' },
  849: { name: 'G-Max Stun Shock', type: 'electric' },
  2275: { name: 'G-Max Stun Shock', type: 'electric' },
};

const normalizeType = (value?: string | null): string =>
  value?.trim().toLowerCase() ?? '';

const variantTypes = (variant: PokemonVariant): string[] =>
  [normalizeType(variant.type1_name), normalizeType(variant.type2_name)].filter(
    Boolean,
  );

const isGigantamax = (variant: PokemonVariant): boolean =>
  variant.variantType.toLowerCase().includes('gigantamax');

export const isMaxBattleCatalogVariant = (
  variant: PokemonVariant,
): boolean => {
  const type = variant.variantType.toLowerCase();
  return (
    type.includes('dynamax') ||
    type.includes('gigantamax') ||
    getSpecialMaxAttacker(variant) !== null
  );
};

const isShiny = (variant: PokemonVariant): boolean =>
  variant.variantType.toLowerCase().includes('shiny');

export const getMaxBattleCatalog = (
  variants: PokemonVariant[],
): PokemonVariant[] =>
  variants
    .filter(
      (variant) =>
        isMaxBattleCatalogVariant(variant) &&
        (!isShiny(variant) || Boolean(variant.instanceData)),
    )
    .sort(
      (left, right) =>
        left.pokedex_number - right.pokedex_number ||
        left.variantType.localeCompare(right.variantType),
    );

const getLegalFastMoves = (variant: PokemonVariant): Move[] =>
  (variant.moves ?? []).filter(
    (move) => Number(move.is_fast) === 1 && Number(move.raid_cooldown) > 0,
  );

const getLegalChargedMoves = (variant: PokemonVariant): Move[] =>
  (variant.moves ?? []).filter(
    (move) =>
      Number(move.is_fast) === 0 &&
      Number(move.raid_power) > 0 &&
      Number(move.raid_cooldown) > 0,
  );

const getMoveCooldownSeconds = (move: Move): number => {
  const raw = Number(move.raid_cooldown);
  return raw > 20 ? raw / 1000 : raw;
};

const getFastMoveType = (move: Move): string => {
  if (move.name.trim().toLowerCase().startsWith('hidden power')) return 'normal';
  return normalizeType(move.type_name || move.type);
};

const getMoveType = (move: Move): string =>
  normalizeType(move.type_name || move.type);

const selectMeterFastMove = (
  variant: PokemonVariant,
  fastMoves: Move[],
  boss?: PokemonVariant | null,
): Move => {
  const pokemonTypes = variantTypes(variant);
  const defendingTypes = boss ? variantTypes(boss) : [];
  const hasStab = (move: Move): boolean =>
    pokemonTypes.includes(getFastMoveType(move));
  const damageIndex = (move: Move): number => {
    const moveType = getFastMoveType(move);
    const stab = hasStab(move)
      ? MAX_MODEL_CONSTANTS.stabMultiplier
      : 1;
    const effectiveness = boss
      ? getTypeEffectivenessMultiplier(moveType, defendingTypes)
      : 1;
    return Number(move.raid_power) * stab * effectiveness;
  };

  return [...fastMoves].sort(
    (left, right) =>
      getMoveCooldownSeconds(left) - getMoveCooldownSeconds(right) ||
      Number(hasStab(right)) - Number(hasStab(left)) ||
      damageIndex(right) - damageIndex(left) ||
      right.raid_power - left.raid_power ||
      left.name.localeCompare(right.name) ||
      left.move_id - right.move_id,
  )[0];
};

const getGigantamaxMove = (
  variant: PokemonVariant,
): { name: string; type: string } | null => {
  const maxForm = variant.max?.find((form) => Number(form.gigantamax) === 1);
  const name = maxForm?.gigantamax_move_name?.trim() ?? '';
  const type = normalizeType(maxForm?.gigantamax_move_type);
  if (name && type) return { name, type };

  return GIGANTAMAX_MOVE_FALLBACKS[variant.pokemon_id] ?? null;
};

const getChargedMoveCycleScore = (
  variant: PokemonVariant,
  fastMove: Move,
  chargedMove: Move,
  boss?: PokemonVariant | null,
): number => {
  const fastEnergy = Math.max(1, Number(fastMove.raid_energy));
  const chargedEnergy = Math.max(1, Math.abs(Number(chargedMove.raid_energy)));
  const fastUses = Math.max(1, Math.ceil(chargedEnergy / fastEnergy));
  const defendingTypes = boss ? variantTypes(boss) : [];
  const pokemonTypes = variantTypes(variant);
  const damageIndex = (move: Move, uses = 1) => {
    const moveType = getMoveType(move);
    const stab = pokemonTypes.includes(moveType)
      ? MAX_MODEL_CONSTANTS.stabMultiplier
      : 1;
    const effectiveness = boss
      ? getTypeEffectivenessMultiplier(moveType, defendingTypes)
      : 1;
    return Number(move.raid_power) * uses * stab * effectiveness;
  };
  const cycleSeconds =
    getMoveCooldownSeconds(fastMove) * fastUses +
    getMoveCooldownSeconds(chargedMove);

  return (
    (damageIndex(fastMove, fastUses) + damageIndex(chargedMove)) /
    Math.max(0.1, cycleSeconds)
  );
};

const selectChargedMove = (
  variant: PokemonVariant,
  fastMove: Move,
  boss?: PokemonVariant | null,
  requiredName?: string,
): Move | null => {
  const required = requiredName?.trim().toLowerCase();
  const chargedMoves = getLegalChargedMoves(variant).filter(
    (move) => !required || move.name.trim().toLowerCase() === required,
  );

  return (
    [...chargedMoves].sort(
      (left, right) =>
        getChargedMoveCycleScore(variant, fastMove, right, boss) -
          getChargedMoveCycleScore(variant, fastMove, left, boss) ||
        left.name.localeCompare(right.name) ||
        left.move_id - right.move_id,
    )[0] ?? null
  );
};

const getIncomingMultiplier = (
  variant: PokemonVariant,
  attackingTypes: string[],
): number => {
  if (attackingTypes.length === 0) return 1;
  const defendingTypes = variantTypes(variant);
  return Math.max(
    ...attackingTypes.map((type) =>
      getTypeEffectivenessMultiplier(type, defendingTypes),
    ),
  );
};

const isPersonalized = (variant: PokemonVariant): boolean =>
  Boolean(variant.instanceData && variant.raidRoster?.source === 'caught');

const clampMaxMoveLevel = (
  value: unknown,
  fallback: MaxMoveLevel,
  minimum: MaxMoveLevel = 0,
): MaxMoveLevel => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(3, Math.max(minimum, Math.round(parsed))) as MaxMoveLevel;
};

const getMaxMoveLevels = (variant: PokemonVariant) => {
  if (!isPersonalized(variant)) {
    return {
      attack: 3 as const,
      guard: 3 as const,
      spirit: 3 as const,
    };
  }

  return {
    // Every Max-capable Pokemon starts with Max Attack unlocked at level 1.
    attack: clampMaxMoveLevel(
      variant.instanceData?.max_attack,
      1,
      1,
    ) as Exclude<MaxMoveLevel, 0>,
    guard: clampMaxMoveLevel(variant.instanceData?.max_guard, 0),
    spirit: clampMaxMoveLevel(variant.instanceData?.max_spirit, 0),
  };
};

const getMaxAttackPower = (
  levelThreePower: number,
  level: Exclude<MaxMoveLevel, 0>,
): number => levelThreePower - (3 - level) * 50;

const getMaxSpiritRate = (level: MaxMoveLevel): number =>
  level === 0 ? 0 : 0.04 + level * 0.04;

const getStats = (variant: PokemonVariant) => {
  const personalized = isPersonalized(variant);
  const ivs = getRaidAttackerIvs(variant);
  const level = resolveRaidAttackerLevel(variant, '50.0');
  const cpm = cpMultipliers[level];

  return {
    attack: (Number(variant.attack) + ivs.attack) * cpm,
    defense: (Number(variant.defense) + ivs.defense) * cpm,
    hp: Math.max(
      10,
      Math.floor((Number(variant.stamina) + ivs.stamina) * cpm),
    ),
    cp: calculateRaidAttackerCp(variant, '50.0'),
    levelLabel: getRaidAttackerLevelLabel(variant, '50.0'),
    ivPercent: getRaidAttackerIvPercent(variant),
    personalized,
  };
};

const calculateDamage = (
  power: number,
  attack: number,
  defense: number,
  stab: number,
  effectiveness: number,
): number =>
  Math.max(
    1,
    Math.floor(
      0.5 * power * (attack / Math.max(1, defense)) * stab * effectiveness,
    ) + 1,
  );

export const calculateMaxBattleMoveDamage = (
  entry: MaxRankingEntry,
  boss: PokemonVariant,
  move: Move,
): number => {
  const bossStats = getStats(boss);
  const moveType = Number(move.is_fast) === 1
    ? getFastMoveType(move)
    : getMoveType(move);
  const stab = variantTypes(entry.variant).includes(moveType)
    ? MAX_MODEL_CONSTANTS.stabMultiplier
    : 1;
  const effectiveness = getTypeEffectivenessMultiplier(
    moveType,
    variantTypes(boss),
  );

  return calculateDamage(
    Number(move.raid_power),
    entry.attack,
    bossStats.defense,
    stab,
    effectiveness,
  );
};

const getMeterCycleSeconds = (fastMoveSeconds: number): number => {
  const actionsPerPokemon = Math.ceil(
    MAX_MODEL_CONSTANTS.maxMeterEnergy / MAX_MODEL_CONSTANTS.maxGroupSize,
  );
  return actionsPerPokemon * Math.max(0.5, fastMoveSeconds);
};

const buildBossBenchmark = (
  variant: PokemonVariant,
  boss: PokemonVariant,
  stats: ReturnType<typeof getStats>,
  fastMoveSeconds: number,
  maxMovePower: number,
  maxMoveType: string,
  outgoingMultiplier: number,
  maxGuardHp: number,
): MaxBossBenchmark => {
  const bossStats = getStats(boss);
  const attackerStab = variantTypes(variant).includes(maxMoveType)
    ? MAX_MODEL_CONSTANTS.stabMultiplier
    : 1;
  const bossTypes = variantTypes(boss);
  const incomingCandidates = (bossTypes.length > 0 ? bossTypes : ['normal']).map(
    (type) => {
      const effectiveness = getTypeEffectivenessMultiplier(
        type,
        variantTypes(variant),
      );
      return {
        type,
        damage: calculateDamage(
          MAX_MODEL_CONSTANTS.benchmarkBossMovePower,
          bossStats.attack,
          stats.defense,
          MAX_MODEL_CONSTANTS.stabMultiplier,
          effectiveness,
        ),
      };
    },
  );
  const incoming = incomingCandidates.sort(
    (left, right) => right.damage - left.damage,
  )[0];
  const pressureScenarios = buildRaidIncomingPressureScenarios({
    boss,
    bossAttack: bossStats.attack,
    attackerTypes: variantTypes(variant),
    weatherBoostedType: '',
  });
  const expectedPressure = calculateRaidIncomingPressure(
    pressureScenarios,
    stats.defense,
    'expected',
  );
  const hostilePressure = calculateRaidIncomingPressure(
    pressureScenarios,
    stats.defense,
    'hostile',
  );
  const incomingDps =
    expectedPressure?.incomingDps ??
    incoming.damage / MAX_MODEL_CONSTANTS.benchmarkBossActionSeconds;
  const hostileIncomingDps = hostilePressure?.incomingDps ?? incomingDps;
  const representativeHit =
    expectedPressure?.incomingChargedDamage ?? incoming.damage;
  const guardedHp = stats.hp + maxGuardHp;
  const meterCycleSeconds = getMeterCycleSeconds(fastMoveSeconds);
  const meterCycleDamage = Math.max(
    1,
    Math.ceil(incomingDps * meterCycleSeconds),
  );

  return {
    maxHitDamage: calculateDamage(
      maxMovePower,
      stats.attack,
      bossStats.defense,
      attackerStab,
      outgoingMultiplier,
    ),
    incomingDamage: representativeHit,
    incomingType: expectedPressure ? 'mixed' : incoming.type,
    incomingDps,
    hostileIncomingDps,
    hitsToFaint: Math.max(1, Math.ceil(stats.hp / representativeHit)),
    guardedHitsToFaint: Math.max(1, Math.ceil(guardedHp / representativeHit)),
    hpAfterHit: Math.max(0, stats.hp - representativeHit),
    hpAfterGuardedHit: Math.max(0, guardedHp - representativeHit),
    meterCycleSeconds,
    meterCycleDamage,
    hpAfterMeterCycle: Math.max(0, stats.hp - meterCycleDamage),
    hpAfterGuardedMeterCycle: Math.max(0, guardedHp - meterCycleDamage),
    meterCyclesSurvived: stats.hp / meterCycleDamage,
    guardedMeterCyclesSurvived: guardedHp / meterCycleDamage,
    pressureSource: expectedPressure ? 'legal-movesets' : 'typed-benchmark',
  };
};

type RankMaxOptions = {
  role: MaxRole;
  selectedType?: string;
  boss?: PokemonVariant | null;
};

const buildEntry = (
  variant: PokemonVariant,
  fastMove: Move,
  maxMoveType: string,
  options: RankMaxOptions,
  specialMaxAttacker: SpecialMaxAttacker | null = null,
  maxMoveName = 'Max Attack',
): MaxRankingEntry => {
  const stats = getStats(variant);
  const meterSeconds = Math.max(0.5, getMoveCooldownSeconds(fastMove));
  const defendingTypes = options.boss ? variantTypes(options.boss) : [];
  const incomingTypes = options.boss
    ? variantTypes(options.boss)
    : options.selectedType && options.role !== 'damage'
      ? [options.selectedType]
      : [];
  const incomingMultiplier = getIncomingMultiplier(variant, incomingTypes);
  const outgoingMultiplier = options.boss
    ? getTypeEffectivenessMultiplier(maxMoveType, defendingTypes)
    : 1;
  const stab = variantTypes(variant).includes(maxMoveType)
    ? MAX_MODEL_CONSTANTS.stabMultiplier
    : 1;
  const maxMoveLevels = getMaxMoveLevels(variant);
  const levelThreeMaxMovePower =
    specialMaxAttacker?.movePower ??
    (isGigantamax(variant)
      ? MAX_MODEL_CONSTANTS.gigantamaxMovePower
      : MAX_MODEL_CONSTANTS.dynamaxMovePower);
  const maxMovePower = getMaxAttackPower(
    levelThreeMaxMovePower,
    maxMoveLevels.attack,
  );
  const maxGuardHp = maxMoveLevels.guard * 20;
  const maxSpiritRate = getMaxSpiritRate(maxMoveLevels.spirit);
  const attackIndex = stats.attack * maxMovePower * stab * outgoingMultiplier;
  const fastMoveType = getFastMoveType(fastMove);
  const fastMoveStab = variantTypes(variant).includes(fastMoveType)
    ? MAX_MODEL_CONSTANTS.stabMultiplier
    : 1;
  const fastMoveEffectiveness = options.boss
    ? getTypeEffectivenessMultiplier(fastMoveType, defendingTypes)
    : 1;
  const bossStats = options.boss ? getStats(options.boss) : null;
  const fastHitDamage = bossStats
    ? calculateDamage(
        Number(fastMove.raid_power),
        stats.attack,
        bossStats.defense,
        fastMoveStab,
        fastMoveEffectiveness,
      )
    : 0;
  const neutralBulk = stats.hp * stats.defense;
  const effectiveBulk = neutralBulk / Math.max(0.244, incomingMultiplier);
  const cycleEndurance = effectiveBulk / meterSeconds;
  const healPerAlly = Math.floor(stats.hp * maxSpiritRate);
  const teamHeal = healPerAlly * MAX_MODEL_CONSTANTS.maxGroupSize;
  const bossBenchmark = options.boss
    ? buildBossBenchmark(
        variant,
        options.boss,
        stats,
        meterSeconds,
        maxMovePower,
        maxMoveType,
        outgoingMultiplier,
        maxGuardHp,
      )
    : undefined;

  let score = bossBenchmark?.maxHitDamage ?? attackIndex;
  if (options.role === 'tank') {
    score = bossBenchmark
      ? bossBenchmark.meterCyclesSurvived
      : cycleEndurance;
  } else if (options.role === 'healing') {
    score = healPerAlly;
  }

  return {
    variant,
    displayName: specialMaxAttacker?.displayName ?? variant.name,
    maxForm: specialMaxAttacker
      ? 'special'
      : isGigantamax(variant)
        ? 'gigantamax'
        : 'dynamax',
    role: options.role,
    score,
    fastMove,
    chargedMove: selectChargedMove(
      variant,
      fastMove,
      options.boss,
      specialMaxAttacker?.moveName,
    ),
    maxMoveName: specialMaxAttacker?.moveName ?? maxMoveName,
    maxMoveType,
    maxMovePower,
    maxAttackLevel: maxMoveLevels.attack,
    maxGuardLevel: maxMoveLevels.guard,
    maxSpiritLevel: maxMoveLevels.spirit,
    maxGuardHp,
    maxSpiritRate,
    attack: stats.attack,
    defense: stats.defense,
    hp: stats.hp,
    cp: stats.cp,
    levelLabel: stats.levelLabel,
    ivPercent: stats.ivPercent,
    personalized: stats.personalized,
    meterSeconds,
    fastHitDamage,
    attackIndex,
    neutralBulk,
    effectiveBulk,
    cycleEndurance,
    healPerAlly,
    teamHeal,
    incomingMultiplier,
    outgoingMultiplier,
    bossBenchmark,
  };
};

const entriesForVariant = (
  variant: PokemonVariant,
  options: RankMaxOptions,
): MaxRankingEntry[] => {
  const fastMoves = getLegalFastMoves(variant);
  if (fastMoves.length === 0) return [];
  if (
    options.role === 'healing' &&
    isPersonalized(variant) &&
    getMaxMoveLevels(variant).spirit === 0
  ) {
    return [];
  }

  const specialMaxAttacker = getSpecialMaxAttacker(variant);
  if (specialMaxAttacker) {
    const hasSignatureMove = (variant.moves ?? []).some(
      (move) =>
        Number(move.is_fast) === 0 &&
        move.name.trim().toLowerCase() ===
          specialMaxAttacker.moveName.toLowerCase(),
    );
    if (!hasSignatureMove) return [];
    if (
      options.role === 'damage' &&
      options.selectedType &&
      specialMaxAttacker.moveType !== options.selectedType
    ) {
      return [];
    }

    const fastestMove = selectMeterFastMove(variant, fastMoves, options.boss);
    return [
      buildEntry(
        variant,
        fastestMove,
        specialMaxAttacker.moveType,
        options,
        specialMaxAttacker,
      ),
    ];
  }

  if (isGigantamax(variant)) {
    const gigantamaxMove = getGigantamaxMove(variant);
    if (!gigantamaxMove) return [];
    if (
      options.role === 'damage' &&
      options.selectedType &&
      gigantamaxMove.type !== options.selectedType
    ) {
      return [];
    }
    const fastestMove = selectMeterFastMove(variant, fastMoves, options.boss);
    return [
      buildEntry(
        variant,
        fastestMove,
        gigantamaxMove.type,
        options,
        null,
        gigantamaxMove.name,
      ),
    ];
  }

  if (options.role !== 'damage') {
    const fastestMove = selectMeterFastMove(variant, fastMoves, options.boss);
    return [
      buildEntry(variant, fastestMove, getFastMoveType(fastestMove), options),
    ];
  }

  return fastMoves
    .map((fastMove) => ({ fastMove, type: getFastMoveType(fastMove) }))
    .filter(({ type }) => !options.selectedType || type === options.selectedType)
    .map(({ fastMove, type }) => buildEntry(variant, fastMove, type, options));
};

const compareEntries = (
  left: MaxRankingEntry,
  right: MaxRankingEntry,
  options: RankMaxOptions,
): number => {
  if (options.role === 'healing') {
    const leftEndurance =
      left.bossBenchmark?.meterCyclesSurvived ?? left.cycleEndurance;
    const rightEndurance =
      right.bossBenchmark?.meterCyclesSurvived ?? right.cycleEndurance;
    return (
      right.healPerAlly - left.healPerAlly ||
      rightEndurance - leftEndurance ||
      left.meterSeconds - right.meterSeconds ||
      left.variant.pokedex_number - right.variant.pokedex_number
    );
  }

  return (
    right.score - left.score ||
    (options.role === 'tank'
      ? (right.bossBenchmark?.guardedMeterCyclesSurvived ??
          right.cycleEndurance) -
        (left.bossBenchmark?.guardedMeterCyclesSurvived ??
          left.cycleEndurance)
      : right.attackIndex - left.attackIndex) ||
    left.variant.pokedex_number - right.variant.pokedex_number
  );
};

export const rankMaxBattlePokemon = (
  variants: PokemonVariant[],
  options: RankMaxOptions,
): MaxRankingEntry[] => {
  const bestByVariant = new Map<string, MaxRankingEntry>();

  getMaxBattleCatalog(variants).forEach((variant) => {
    entriesForVariant(variant, options).forEach((entry) => {
      const current = bestByVariant.get(variant.variant_id);
      if (!current || compareEntries(entry, current, options) < 0) {
        bestByVariant.set(variant.variant_id, entry);
      }
    });
  });

  return [...bestByVariant.values()].sort((left, right) =>
    compareEntries(left, right, options),
  );
};
