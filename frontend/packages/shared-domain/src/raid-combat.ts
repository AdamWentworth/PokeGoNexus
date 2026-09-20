import type { Move } from '@pokemongonexus/shared-contracts/pokemon';
import type { PokemonVariant } from '@pokemongonexus/shared-contracts/variants';
import { cpMultipliers, getPokemonCpMultiplier } from './combat-power';
import {
  FRIENDSHIP_DAMAGE_BONUS,
  MEGA_ALLY_DAMAGE_BONUS,
  PARTY_POWER_CHARGED_DAMAGE_BONUS,
  RAID_ATTACKER_TEAM_SIZE,
  RAID_BOSS_ACTION_DELAY_SECONDS,
  RAID_DODGE_DAMAGE_MULTIPLIER,
  SHADOW_ATTACKER_DAMAGE_BONUS,
  SHADOW_ATTACKER_DEFENSE_MULTIPLIER,
  SHADOW_BOSS_ENRAGED_ATTACK_MULTIPLIER,
  SHADOW_BOSS_ENRAGED_DEFENSE_MULTIPLIER,
  STAB_DAMAGE_BONUS,
  WEATHER_DAMAGE_BONUS,
  type RaidFriendshipKey,
  type RaidMegaAllyBonusKey,
  type RaidPartyPowerKey,
  type RaidTierPreset,
} from './raid-rules';
import { getTypeEffectivenessMultiplier } from './type-effectiveness';

export type SharedRaidDodgeStrategy = 'none' | 'charged';
export type SharedRaidShadowBossMode = 'normal' | 'enraged' | 'subdued';
export type SharedRaidBossMovesetMode = 'expected' | 'favorable' | 'hostile';

export type SharedRaidCounterSettings = {
  attackerLevel: string;
  dodgeStrategy: SharedRaidDodgeStrategy;
  dodgeSuccessRate?: number;
  friendship: RaidFriendshipKey;
  megaAllyBonus: RaidMegaAllyBonusKey;
  partyPower: RaidPartyPowerKey;
  relobbySeconds: number;
  shadowBossMode: SharedRaidShadowBossMode;
  weatherBoostedType: string;
};

export type SharedRaidAttackerBattleStats = {
  attack: number;
  defense: number;
  hp: number;
};

export type SharedRaidBossStats = {
  attack: number;
  bossCp: number;
  defense: number;
  hp: number;
  timeLimitSeconds: number;
};

const clampIv = (value: unknown): number => {
  if (value == null || value === '') return 15;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(15, Math.max(0, parsed)) : 15;
};

export const getSharedRaidAttackerIvs = (attacker: PokemonVariant) => ({
  attack: clampIv(attacker.instanceData?.attack_iv),
  defense: clampIv(attacker.instanceData?.defense_iv),
  stamina: clampIv(attacker.instanceData?.stamina_iv),
});

const supportedLevels = Object.keys(cpMultipliers).map(Number) as Array<
  keyof typeof cpMultipliers
>;

const closestSupportedLevel = (
  level: number,
): keyof typeof cpMultipliers => supportedLevels.reduce(
  (closest, candidate) => (
    Math.abs(candidate - level) < Math.abs(closest - level) ? candidate : closest
  ),
  supportedLevels[0] ?? 1,
);

const calculateCpAtLevel = (attacker: PokemonVariant, level: number): number => {
  const multiplier = getPokemonCpMultiplier(level) ?? getPokemonCpMultiplier(50) ?? 1;
  const ivs = getSharedRaidAttackerIvs(attacker);
  return Math.max(10, Math.floor(
    ((attacker.attack + ivs.attack)
      * Math.sqrt(attacker.defense + ivs.defense)
      * Math.sqrt(attacker.stamina + ivs.stamina)
      * multiplier ** 2) / 10,
  ));
};

const inferLevelFromCp = (
  attacker: PokemonVariant,
): keyof typeof cpMultipliers | null => {
  const cp = Number(attacker.instanceData?.cp);
  if (!Number.isFinite(cp) || cp <= 0) return null;
  return supportedLevels.reduce((closest, candidate) => (
    Math.abs(calculateCpAtLevel(attacker, candidate) - cp)
      < Math.abs(calculateCpAtLevel(attacker, closest) - cp)
      ? candidate
      : closest
  ), supportedLevels[0] ?? 1);
};

export const resolveSharedRaidAttackerLevel = (
  attacker: PokemonVariant,
  fallback: string,
): keyof typeof cpMultipliers => {
  const recorded = Number(attacker.instanceData?.level);
  if (Number.isFinite(recorded) && recorded > 0) return closestSupportedLevel(recorded);
  return inferLevelFromCp(attacker) ?? closestSupportedLevel(Number(fallback) || 50);
};

export const calculateSharedRaidAttackerCp = (
  attacker: PokemonVariant,
  fallbackLevel: string,
): number => {
  const recorded = Number(attacker.instanceData?.cp);
  if (
    attacker.raidRoster?.cpSource !== 'calculated'
    && Number.isFinite(recorded)
    && recorded > 0
  ) return Math.round(recorded);
  return calculateCpAtLevel(attacker, resolveSharedRaidAttackerLevel(attacker, fallbackLevel));
};

export const getSharedRaidAttackerLevelLabel = (
  attacker: PokemonVariant,
  fallback: string,
): string => String(resolveSharedRaidAttackerLevel(attacker, fallback)).replace(/\.0$/, '');

export const getSharedRaidAttackerIvPercent = (
  attacker: PokemonVariant,
): number | null => {
  if (attacker.raidRoster?.ivSource !== 'recorded') return null;
  const ivs = getSharedRaidAttackerIvs(attacker);
  return Math.round(((ivs.attack + ivs.defense + ivs.stamina) / 45) * 100);
};

export const calculateSharedRaidAttackerBattleStats = (
  attacker: PokemonVariant,
  settings: SharedRaidCounterSettings,
): SharedRaidAttackerBattleStats => {
  const multiplier = getPokemonCpMultiplier(
    resolveSharedRaidAttackerLevel(attacker, settings.attackerLevel),
  ) ?? 1;
  const ivs = getSharedRaidAttackerIvs(attacker);
  const shadowDefense = attacker.variantType.toLocaleLowerCase().includes('shadow')
    ? SHADOW_ATTACKER_DEFENSE_MULTIPLIER
    : 1;
  return {
    attack: (attacker.attack + ivs.attack) * multiplier,
    defense: (attacker.defense + ivs.defense) * multiplier * shadowDefense,
    hp: Math.max(1, Math.floor((attacker.stamina + ivs.stamina) * multiplier)),
  };
};

export const calculateSharedRaidBossCp = (
  variant: PokemonVariant,
  bossHp: number,
): number => Math.floor(
  ((variant.attack + 15) * Math.sqrt(variant.defense + 15) * Math.sqrt(bossHp)) / 10,
);

export const calculateSharedRaidBossStats = (
  variant: PokemonVariant,
  tier: RaidTierPreset,
  shadowBossMode: SharedRaidShadowBossMode,
): SharedRaidBossStats => {
  const defenseMultiplier = shadowBossMode === 'enraged'
    ? SHADOW_BOSS_ENRAGED_DEFENSE_MULTIPLIER
    : 1;
  const attackMultiplier = shadowBossMode === 'enraged'
    ? SHADOW_BOSS_ENRAGED_ATTACK_MULTIPLIER
    : 1;
  return {
    attack: (variant.attack + 15) * tier.bossStatMultiplier * attackMultiplier,
    bossCp: calculateSharedRaidBossCp(variant, tier.bossHp),
    defense: (variant.defense + 15) * tier.bossStatMultiplier * defenseMultiplier,
    hp: tier.bossHp,
    timeLimitSeconds: tier.timeLimitSeconds,
  };
};

export const normalizeSharedRaidTypeName = (value?: string | null): string => {
  const normalized = value?.trim().toLocaleLowerCase() ?? '';
  return normalized === 'none' || normalized === 'unknown' ? '' : normalized;
};

export const getSharedRaidVariantTypeNames = (variant: PokemonVariant): string[] => [
  normalizeSharedRaidTypeName(variant.type1_name),
  normalizeSharedRaidTypeName(variant.type2_name),
].filter(Boolean);

export const getSharedRaidMovePower = (move: Move): number => move.raid_power;
export const getSharedRaidMoveEnergy = (move: Move): number => move.raid_energy;
export const getSharedRaidMoveCooldown = (move: Move): number => move.raid_cooldown;

export const getSharedProcessedRaidMoveSeconds = (move: Move): number => {
  const rawSeconds = Math.max(.5, getSharedRaidMoveCooldown(move) / 1000);
  return Math.max(.5, Math.round(rawSeconds * 2) / 2);
};

const getProcessedRaidMovePower = (move: Move): number => {
  const power = getSharedRaidMovePower(move);
  const rawSeconds = Math.max(.5, getSharedRaidMoveCooldown(move) / 1000);
  const processedSeconds = getSharedProcessedRaidMoveSeconds(move);
  const timingAdjustment = (processedSeconds - rawSeconds) / processedSeconds;
  return Math.abs(timingAdjustment) >= .199 ? power * (1 + timingAdjustment) : power;
};

const getSharedLegalRaidMoves = (variant: PokemonVariant): Move[] => {
  const moves = variant.moves ?? [];
  if (variant.raidRoster?.moveSource !== 'recorded') return moves;

  const recordedIds = new Set([
    variant.instanceData?.fast_move_id,
    variant.instanceData?.charged_move1_id,
    variant.instanceData?.charged_move2_id,
  ].filter((moveId): moveId is number => moveId != null));
  const recordedMoves = moves.filter((move) => recordedIds.has(move.move_id));
  return recordedMoves.some((move) => Number(move.is_fast) === 1)
    && recordedMoves.some((move) => Number(move.is_fast) === 0)
    ? recordedMoves
    : moves;
};

const getSharedLegalRaidFastMoves = (variant: PokemonVariant): Move[] =>
  getSharedLegalRaidMoves(variant).filter(
    (move) => Number(move.is_fast) === 1 && Number(move.raid_power) > 0,
  );

const getSharedLegalRaidChargedMoves = (variant: PokemonVariant): Move[] =>
  getSharedLegalRaidMoves(variant).filter(
    (move) => Number(move.is_fast) === 0 && Number(move.raid_power) > 0,
  );

const calculateSharedIncomingRaidMoveDamageCoefficient = ({
  attackerTypes,
  boss,
  bossAttack,
  move,
  weatherBoostedType,
}: {
  attackerTypes: string[];
  boss: PokemonVariant;
  bossAttack: number;
  move: Move;
  weatherBoostedType: string;
}): number => {
  const moveType = normalizeSharedRaidTypeName(move.type_name || move.type);
  const stab = getSharedRaidVariantTypeNames(boss).includes(moveType)
    ? STAB_DAMAGE_BONUS
    : 1;
  const effectiveness = getTypeEffectivenessMultiplier(moveType, attackerTypes);
  const weather = weatherBoostedType === moveType ? WEATHER_DAMAGE_BONUS : 1;
  return .5
    * getProcessedRaidMovePower(move)
    * bossAttack
    * stab
    * effectiveness
    * weather;
};

export type SharedRaidIncomingPressureScenario = {
  fastDamageCoefficient: number;
  chargedDamageCoefficient: number;
  fastUsesPerChargedMove: number;
  cycleSeconds: number;
};

export type SharedRaidIncomingPressure = {
  incomingDps: number;
  incomingChargedDamage: number;
};

export const buildSharedRaidIncomingPressureScenarios = ({
  attackerTypes,
  boss,
  bossAttack,
  weatherBoostedType,
}: {
  attackerTypes: string[];
  boss: PokemonVariant;
  bossAttack: number;
  weatherBoostedType: string;
}): SharedRaidIncomingPressureScenario[] => {
  const fastMoves = getSharedLegalRaidFastMoves(boss);
  const chargedMoves = getSharedLegalRaidChargedMoves(boss);
  if (!fastMoves.length || !chargedMoves.length) return [];

  return fastMoves.flatMap((fastMove) => chargedMoves.map((chargedMove) => {
    const fastDamageCoefficient = calculateSharedIncomingRaidMoveDamageCoefficient({
      attackerTypes,
      boss,
      bossAttack,
      move: fastMove,
      weatherBoostedType,
    });
    const chargedDamageCoefficient = calculateSharedIncomingRaidMoveDamageCoefficient({
      attackerTypes,
      boss,
      bossAttack,
      move: chargedMove,
      weatherBoostedType,
    });
    const chargedEnergyCost = Math.max(1, Math.abs(getSharedRaidMoveEnergy(chargedMove)));
    const fastUsesPerChargedMove = chargedEnergyCost >= 100
      ? 3
      : chargedEnergyCost >= 50
        ? 1.5
        : 1;
    const cycleSeconds = fastUsesPerChargedMove
      * (getSharedProcessedRaidMoveSeconds(fastMove) + RAID_BOSS_ACTION_DELAY_SECONDS)
      + getSharedProcessedRaidMoveSeconds(chargedMove)
      + RAID_BOSS_ACTION_DELAY_SECONDS;
    return {
      chargedDamageCoefficient,
      cycleSeconds,
      fastDamageCoefficient,
      fastUsesPerChargedMove,
    };
  }));
};

export const calculateSharedRaidIncomingPressure = (
  scenarios: SharedRaidIncomingPressureScenario[],
  attackerDefense: number,
  mode: SharedRaidBossMovesetMode = 'expected',
): SharedRaidIncomingPressure | null => {
  if (!scenarios.length || attackerDefense <= 0) return null;
  const pressures = scenarios.map((scenario) => {
    const fastDamage = Math.floor(scenario.fastDamageCoefficient / attackerDefense) + 1;
    const chargedDamage = Math.floor(scenario.chargedDamageCoefficient / attackerDefense) + 1;
    return {
      incomingChargedDamage: chargedDamage,
      incomingDps: (
        scenario.fastUsesPerChargedMove * fastDamage + chargedDamage
      ) / scenario.cycleSeconds,
    };
  });

  if (mode !== 'expected') {
    return pressures.reduce((selected, candidate) => {
      const replace = mode === 'hostile'
        ? candidate.incomingDps > selected.incomingDps
        : candidate.incomingDps < selected.incomingDps;
      return replace ? candidate : selected;
    });
  }

  return {
    incomingChargedDamage: pressures.reduce(
      (sum, pressure) => sum + pressure.incomingChargedDamage,
      0,
    ) / pressures.length,
    incomingDps: pressures.reduce(
      (sum, pressure) => sum + pressure.incomingDps,
      0,
    ) / pressures.length,
  };
};

export const calculateSharedRaidMoveDamage = ({
  attacker,
  attackerAttack,
  bossDefense,
  bossTypes,
  charged,
  move,
  partyPowerMultiplierOverride,
  settings,
}: {
  attacker: PokemonVariant;
  attackerAttack: number;
  bossDefense: number;
  bossTypes: string[];
  charged: boolean;
  move: Move;
  partyPowerMultiplierOverride?: number;
  settings: SharedRaidCounterSettings;
}): number => {
  const moveType = normalizeSharedRaidTypeName(move.type_name || move.type);
  const stab = getSharedRaidVariantTypeNames(attacker).includes(moveType)
    ? STAB_DAMAGE_BONUS
    : 1;
  const effectiveness = getTypeEffectivenessMultiplier(moveType, bossTypes);
  const weather = settings.weatherBoostedType === moveType ? WEATHER_DAMAGE_BONUS : 1;
  const shadow = attacker.variantType.toLocaleLowerCase().includes('shadow')
    ? SHADOW_ATTACKER_DAMAGE_BONUS
    : 1;
  const partyPower = charged
    ? (partyPowerMultiplierOverride ?? PARTY_POWER_CHARGED_DAMAGE_BONUS[settings.partyPower])
    : 1;
  const multiplier = stab
    * effectiveness
    * weather
    * shadow
    * FRIENDSHIP_DAMAGE_BONUS[settings.friendship]
    * MEGA_ALLY_DAMAGE_BONUS[settings.megaAllyBonus]
    * partyPower;
  return Math.max(1, Math.floor(
    .5 * getSharedRaidMovePower(move) * (attackerAttack / bossDefense) * multiplier,
  ) + 1);
};

export const calculateSharedRaidBossMoveDamage = ({
  attacker,
  attackerDefense,
  boss,
  bossAttack,
  dodged = false,
  move,
  weatherBoostedType,
}: {
  attacker: PokemonVariant;
  attackerDefense: number;
  boss: PokemonVariant;
  bossAttack: number;
  dodged?: boolean;
  move: Move;
  weatherBoostedType: string;
}): number => {
  const moveType = normalizeSharedRaidTypeName(move.type_name || move.type);
  const stab = getSharedRaidVariantTypeNames(boss).includes(moveType) ? STAB_DAMAGE_BONUS : 1;
  const effectiveness = getTypeEffectivenessMultiplier(
    moveType,
    getSharedRaidVariantTypeNames(attacker),
  );
  const weather = weatherBoostedType === moveType ? WEATHER_DAMAGE_BONUS : 1;
  return Math.max(1, Math.floor(
    .5
      * getSharedRaidMovePower(move)
      * (bossAttack / attackerDefense)
      * stab
      * effectiveness
      * weather
      * (dodged ? RAID_DODGE_DAMAGE_MULTIPLIER : 1),
  ) + 1);
};

export const calculateSharedEffectiveRaidDps = ({
  dps,
  relobbySeconds,
  tdo,
  teamSize = RAID_ATTACKER_TEAM_SIZE,
}: {
  dps: number;
  relobbySeconds: number;
  tdo: number;
  teamSize?: number;
}): number => {
  if (!Number.isFinite(dps) || !Number.isFinite(tdo) || dps <= 0 || tdo <= 0) return 0;
  const activeSeconds = (tdo / dps) * Math.max(1, Math.floor(teamSize));
  return (dps * activeSeconds) / (activeSeconds + Math.max(0, relobbySeconds));
};

export const calculateSharedTypeDpsMoveDamage = ({
  attacker,
  attackerAttack,
  charged,
  move,
  selectedType,
  settings,
  targetDefense,
  targetTypes,
}: {
  attacker: PokemonVariant;
  attackerAttack: number;
  charged: boolean;
  move: Move;
  selectedType: string;
  settings: SharedRaidCounterSettings;
  targetDefense: number;
  targetTypes?: string[];
}): number => {
  const moveType = normalizeSharedRaidTypeName(move.type_name || move.type);
  const stab = getSharedRaidVariantTypeNames(attacker).includes(moveType) ? STAB_DAMAGE_BONUS : 1;
  const effectiveness = targetTypes && targetTypes.length > 0
    ? getTypeEffectivenessMultiplier(moveType, targetTypes)
    : selectedType !== 'normal' && moveType === selectedType ? 1.6 : 1;
  const weather = settings.weatherBoostedType === moveType ? WEATHER_DAMAGE_BONUS : 1;
  const shadow = attacker.variantType.toLocaleLowerCase().includes('shadow')
    ? SHADOW_ATTACKER_DAMAGE_BONUS
    : 1;
  const partyPower = charged ? PARTY_POWER_CHARGED_DAMAGE_BONUS[settings.partyPower] : 1;
  const multiplier = stab
    * effectiveness
    * weather
    * shadow
    * FRIENDSHIP_DAMAGE_BONUS[settings.friendship]
    * MEGA_ALLY_DAMAGE_BONUS[settings.megaAllyBonus]
    * partyPower;
  return Math.max(1, Math.floor(
    .5 * getProcessedRaidMovePower(move) * (attackerAttack / targetDefense) * multiplier,
  ) + 1);
};
