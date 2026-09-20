import type { PokemonVariant } from "../../../types/pokemonVariants";
import type { Move } from "../../../types/pokemonSubTypes";
import { cpMultipliers } from "./constants";
import {
  getLegalRaidChargedMoves,
  getLegalRaidFastMoves,
  getVariantTypeNames,
  normalizeTypeName,
} from "./raidCatalog";
import {
  FRIENDSHIP_DAMAGE_BONUS,
  MEGA_ALLY_DAMAGE_BONUS,
  PARTY_POWER_CHARGED_DAMAGE_BONUS,
  RAID_ATTACKER_TEAM_SIZE,
  RAID_BOSS_ACTION_DELAY_SECONDS,
  RAID_DODGE_DAMAGE_MULTIPLIER,
  SHADOW_ATTACKER_DAMAGE_BONUS,
  SHADOW_BOSS_ENRAGED_ATTACK_MULTIPLIER,
  SHADOW_BOSS_ENRAGED_DEFENSE_MULTIPLIER,
  STAB_DAMAGE_BONUS,
  TYPE_DPS_TARGET_DEFENSE,
  WEATHER_DAMAGE_BONUS,
} from "./raidRules";
import type {
  RaidBossMovesetMode,
  RaidBossStats,
  RaidCounterSettings,
  RaidOverallScore,
  RaidTierPreset,
  RaidTypeDpsScore,
  ShadowBossMode,
} from "./raidTypes";
import { getTypeEffectivenessMultiplier } from "./typeEffectiveness";
import { calculateRaidAttackerCp } from "./raidAttackerModel";

export const getRaidMovePower = (move: Move): number => move.raid_power;

export const getRaidMoveEnergy = (move: Move): number => move.raid_energy;

export const getRaidMoveCooldown = (move: Move): number => move.raid_cooldown;

export const calculateRaidBossCp = (
  variant: PokemonVariant,
  bossHp: number,
): number => {
  const attack = variant.attack + 15;
  const defense = variant.defense + 15;
  return Math.floor((attack * Math.sqrt(defense) * Math.sqrt(bossHp)) / 10);
};

export const calculatePokemonCpForLevel = (
  variant: PokemonVariant,
  level: keyof typeof cpMultipliers,
): number => calculateRaidAttackerCp(variant, level);

export const calculateRaidBossStats = (
  variant: PokemonVariant,
  tier: RaidTierPreset,
  shadowBossMode: ShadowBossMode,
): RaidBossStats => {
  const enrageDefenseMultiplier =
    shadowBossMode === "enraged" ? SHADOW_BOSS_ENRAGED_DEFENSE_MULTIPLIER : 1;
  const enrageAttackMultiplier =
    shadowBossMode === "enraged" ? SHADOW_BOSS_ENRAGED_ATTACK_MULTIPLIER : 1;

  return {
    bossCp: calculateRaidBossCp(variant, tier.bossHp),
    attack:
      (variant.attack + 15) * tier.bossStatMultiplier * enrageAttackMultiplier,
    defense:
      (variant.defense + 15) *
      tier.bossStatMultiplier *
      enrageDefenseMultiplier,
    hp: tier.bossHp,
    timeLimitSeconds: tier.timeLimitSeconds,
  };
};

type MoveDamageInput = {
  move: Move;
  attacker: PokemonVariant;
  attackerAttack: number;
  bossDefense: number;
  bossTypes: string[];
  settings: RaidCounterSettings;
  charged: boolean;
  partyPowerMultiplierOverride?: number;
};

export const calculateRaidMoveDamage = ({
  move,
  attacker,
  attackerAttack,
  bossDefense,
  bossTypes,
  settings,
  charged,
  partyPowerMultiplierOverride,
}: MoveDamageInput): number => {
  const moveType = normalizeTypeName(move.type_name || move.type);
  const attackerTypes = getVariantTypeNames(attacker);
  const stab = attackerTypes.includes(moveType) ? STAB_DAMAGE_BONUS : 1;
  const effectiveness = getTypeEffectivenessMultiplier(moveType, bossTypes);
  const weather =
    settings.weatherBoostedType === moveType ? WEATHER_DAMAGE_BONUS : 1;
  const shadow = attacker.variantType.toLowerCase().includes("shadow")
    ? SHADOW_ATTACKER_DAMAGE_BONUS
    : 1;
  const partyPower = charged
    ? (partyPowerMultiplierOverride ??
        PARTY_POWER_CHARGED_DAMAGE_BONUS[settings.partyPower])
    : 1;
  const damageMultiplier =
    stab *
    effectiveness *
    weather *
    shadow *
    FRIENDSHIP_DAMAGE_BONUS[settings.friendship] *
    MEGA_ALLY_DAMAGE_BONUS[settings.megaAllyBonus] *
    partyPower;

  return Math.max(
    1,
    Math.floor(
      0.5 *
        getRaidMovePower(move) *
        (attackerAttack / bossDefense) *
        damageMultiplier,
    ) + 1,
  );
};

type TypeDpsMoveDamageInput = Omit<
  MoveDamageInput,
  "bossTypes" | "bossDefense"
> & {
  selectedType: string;
  targetTypes?: string[];
  targetDefense?: number;
};

export const calculateRaidBossMoveDamage = ({
  move,
  boss,
  bossAttack,
  attacker,
  attackerDefense,
  weatherBoostedType,
  dodged = false,
}: {
  move: Move;
  boss: PokemonVariant;
  bossAttack: number;
  attacker: PokemonVariant;
  attackerDefense: number;
  weatherBoostedType: string;
  dodged?: boolean;
}): number => {
  const moveType = normalizeTypeName(move.type_name || move.type);
  const stab = getVariantTypeNames(boss).includes(moveType)
    ? STAB_DAMAGE_BONUS
    : 1;
  const effectiveness = getTypeEffectivenessMultiplier(
    moveType,
    getVariantTypeNames(attacker),
  );
  const weather =
    weatherBoostedType === moveType ? WEATHER_DAMAGE_BONUS : 1;

  return Math.max(
    1,
    Math.floor(
      0.5 *
        getRaidMovePower(move) *
        (bossAttack / attackerDefense) *
        stab *
        effectiveness *
        weather *
        (dodged ? RAID_DODGE_DAMAGE_MULTIPLIER : 1),
    ) + 1,
  );
};

export const getProcessedRaidMoveSeconds = (move: Move): number => {
  const rawSeconds = Math.max(0.5, getRaidMoveCooldown(move) / 1000);
  return Math.max(0.5, Math.round(rawSeconds * 2) / 2);
};

const getProcessedRaidMovePower = (move: Move): number => {
  const power = getRaidMovePower(move);
  const rawSeconds = Math.max(0.5, getRaidMoveCooldown(move) / 1000);
  const processedSeconds = getProcessedRaidMoveSeconds(move);
  const timingAdjustment = (processedSeconds - rawSeconds) / processedSeconds;

  return Math.abs(timingAdjustment) >= 0.199
    ? power * (1 + timingAdjustment)
    : power;
};

export const getTypeDpsEffectiveness = (
  moveType: string,
  selectedType: string,
): number => (selectedType !== "normal" && moveType === selectedType ? 1.6 : 1);

export const calculateTypeDpsMoveDamage = ({
  move,
  attacker,
  attackerAttack,
  selectedType,
  targetTypes,
  targetDefense = TYPE_DPS_TARGET_DEFENSE,
  settings,
  charged,
}: TypeDpsMoveDamageInput): number => {
  const moveType = normalizeTypeName(move.type_name || move.type);
  const attackerTypes = getVariantTypeNames(attacker);
  const stab = attackerTypes.includes(moveType) ? STAB_DAMAGE_BONUS : 1;
  const effectiveness =
    targetTypes && targetTypes.length > 0
      ? getTypeEffectivenessMultiplier(moveType, targetTypes)
      : getTypeDpsEffectiveness(moveType, selectedType);
  const weather =
    settings.weatherBoostedType === moveType ? WEATHER_DAMAGE_BONUS : 1;
  const shadow = attacker.variantType.toLowerCase().includes("shadow")
    ? SHADOW_ATTACKER_DAMAGE_BONUS
    : 1;
  const partyPower = charged
    ? PARTY_POWER_CHARGED_DAMAGE_BONUS[settings.partyPower]
    : 1;
  const damageMultiplier =
    stab *
    effectiveness *
    weather *
    shadow *
    FRIENDSHIP_DAMAGE_BONUS[settings.friendship] *
    MEGA_ALLY_DAMAGE_BONUS[settings.megaAllyBonus] *
    partyPower;

  return Math.max(
    1,
    Math.floor(
      0.5 *
        getProcessedRaidMovePower(move) *
        (attackerAttack / targetDefense) *
        damageMultiplier,
    ) + 1,
  );
};

const calculateIncomingRaidMoveDamageCoefficient = ({
  move,
  boss,
  bossAttack,
  attackerTypes,
  weatherBoostedType,
}: {
  move: Move;
  boss: PokemonVariant;
  bossAttack: number;
  attackerTypes: string[];
  weatherBoostedType: string;
}): number => {
  const moveType = normalizeTypeName(move.type_name || move.type);
  const stab = getVariantTypeNames(boss).includes(moveType)
    ? STAB_DAMAGE_BONUS
    : 1;
  const effectiveness = getTypeEffectivenessMultiplier(
    moveType,
    attackerTypes,
  );
  const weather =
    weatherBoostedType === moveType ? WEATHER_DAMAGE_BONUS : 1;

  return (
    0.5 *
    getProcessedRaidMovePower(move) *
    bossAttack *
    stab *
    effectiveness *
    weather
  );
};

export type RaidIncomingPressureScenario = {
  fastDamageCoefficient: number;
  chargedDamageCoefficient: number;
  fastUsesPerChargedMove: number;
  cycleSeconds: number;
};

export type RaidIncomingPressure = {
  incomingDps: number;
  incomingChargedDamage: number;
};

export const buildRaidIncomingPressureScenarios = ({
  boss,
  bossAttack,
  attackerTypes,
  weatherBoostedType,
}: {
  boss: PokemonVariant;
  bossAttack: number;
  attackerTypes: string[];
  weatherBoostedType: string;
}): RaidIncomingPressureScenario[] => {
  const fastMoves = getLegalRaidFastMoves(boss);
  const chargedMoves = getLegalRaidChargedMoves(boss);
  if (fastMoves.length === 0 || chargedMoves.length === 0) return [];

  return fastMoves.flatMap((fastMove) =>
    chargedMoves.map((chargedMove) => {
      const fastDamageCoefficient =
        calculateIncomingRaidMoveDamageCoefficient({
          move: fastMove,
          boss,
          bossAttack,
          attackerTypes,
          weatherBoostedType,
        });
      const chargedDamageCoefficient =
        calculateIncomingRaidMoveDamageCoefficient({
          move: chargedMove,
          boss,
          bossAttack,
          attackerTypes,
          weatherBoostedType,
        });
      const chargedEnergyCost = Math.max(
        1,
        Math.abs(getRaidMoveEnergy(chargedMove)),
      );
      const fastUsesPerChargedMove =
        chargedEnergyCost >= 100 ? 3 : chargedEnergyCost >= 50 ? 1.5 : 1;
      const fastActionSeconds =
        getProcessedRaidMoveSeconds(fastMove) +
        RAID_BOSS_ACTION_DELAY_SECONDS;
      const chargedActionSeconds =
        getProcessedRaidMoveSeconds(chargedMove) +
        RAID_BOSS_ACTION_DELAY_SECONDS;
      const cycleSeconds =
        fastUsesPerChargedMove * fastActionSeconds + chargedActionSeconds;

      return {
        fastDamageCoefficient,
        chargedDamageCoefficient,
        fastUsesPerChargedMove,
        cycleSeconds,
      };
    }),
  );
};

export const calculateRaidIncomingPressure = (
  scenarios: RaidIncomingPressureScenario[],
  attackerDefense: number,
  mode: RaidBossMovesetMode = "expected",
): RaidIncomingPressure | null => {
  if (scenarios.length === 0 || attackerDefense <= 0) return null;

  let incomingDps = 0;
  let incomingChargedDamage = 0;

  const pressures = scenarios.map((scenario) => {
    const fastDamage =
      Math.floor(scenario.fastDamageCoefficient / attackerDefense) + 1;
    const chargedDamage =
      Math.floor(scenario.chargedDamageCoefficient / attackerDefense) + 1;

    return {
      incomingDps:
        (scenario.fastUsesPerChargedMove * fastDamage + chargedDamage) /
        scenario.cycleSeconds,
      incomingChargedDamage: chargedDamage,
    };
  });

  if (mode !== "expected") {
    const compare =
      mode === "hostile"
        ? (candidate: RaidIncomingPressure, current: RaidIncomingPressure) =>
            candidate.incomingDps > current.incomingDps
        : (candidate: RaidIncomingPressure, current: RaidIncomingPressure) =>
            candidate.incomingDps < current.incomingDps;

    return pressures.reduce((selected, candidate) =>
      compare(candidate, selected) ? candidate : selected,
    );
  }

  pressures.forEach((pressure) => {
    incomingDps += pressure.incomingDps;
    incomingChargedDamage += pressure.incomingChargedDamage;
  });

  return {
    incomingDps: incomingDps / scenarios.length,
    incomingChargedDamage: incomingChargedDamage / scenarios.length,
  };
};

export const calculateComprehensiveTypeDps = ({
  fastDamage,
  chargedDamage,
  fastMove,
  chargedMove,
  attackerHp,
  incomingDps,
  incomingChargedDamage,
}: {
  fastDamage: number;
  chargedDamage: number;
  fastMove: Move;
  chargedMove: Move;
  attackerHp: number;
  incomingDps: number;
  incomingChargedDamage: number;
}): number => {
  const fastSeconds = getProcessedRaidMoveSeconds(fastMove);
  const chargedSeconds = getProcessedRaidMoveSeconds(chargedMove);
  const fastEnergy = Math.max(1, getRaidMoveEnergy(fastMove));
  const chargedEnergyCost = Math.max(
    1,
    Math.abs(getRaidMoveEnergy(chargedMove)),
  );
  const fastDps = fastDamage / fastSeconds;
  const chargedDps = chargedDamage / chargedSeconds;
  const fastEps = fastEnergy / fastSeconds;
  let chargedEps = chargedEnergyCost / chargedSeconds;

  if (chargedEnergyCost >= 100) {
    chargedEps = (chargedEnergyCost + 0.5 * fastEnergy) / chargedSeconds;
  }

  if (fastDps >= chargedDps || fastEps <= 0 || chargedEps <= 0) {
    return Math.max(0, fastDps);
  }

  const expectedOverflowEnergy =
    0.5 * chargedEnergyCost + 0.5 * fastEnergy + 0.5 * incomingChargedDamage;
  const baselineDps =
    (fastDps * chargedEps + chargedDps * fastEps) / (chargedEps + fastEps);
  const incomingEnergyAdjustment =
    ((chargedDps - fastDps) / (chargedEps + fastEps)) *
    (0.5 - expectedOverflowEnergy / attackerHp) *
    incomingDps;
  const dps = baselineDps + incomingEnergyAdjustment;

  return Math.max(0, fastDps, dps);
};

export const calculateEffectiveRaidDps = ({
  dps,
  tdo,
  relobbySeconds,
  teamSize = RAID_ATTACKER_TEAM_SIZE,
}: {
  dps: number;
  tdo: number;
  relobbySeconds: number;
  teamSize?: number;
}): number => {
  if (!Number.isFinite(dps) || !Number.isFinite(tdo) || dps <= 0 || tdo <= 0)
    return 0;

  const validTeamSize = Math.max(1, Math.floor(teamSize));
  const activeSeconds = (tdo / dps) * validTeamSize;
  const downtimeSeconds = Math.max(0, relobbySeconds);

  return (dps * activeSeconds) / (activeSeconds + downtimeSeconds);
};

export const compareRaidTypeDpsScores = (
  a: RaidTypeDpsScore,
  b: RaidTypeDpsScore,
): number => {
  const aPureMoveset = a.fastMatchesType && a.chargedMatchesType ? 1 : 0;
  const bPureMoveset = b.fastMatchesType && b.chargedMatchesType ? 1 : 0;
  const aChargedMatch = a.chargedMatchesType ? 1 : 0;
  const bChargedMatch = b.chargedMatchesType ? 1 : 0;

  return (
    b.eDps - a.eDps ||
    b.er - a.er ||
    b.dps - a.dps ||
    bPureMoveset - aPureMoveset ||
    bChargedMatch - aChargedMatch ||
    b.tdo - a.tdo ||
    b.totalDps - a.totalDps
  );
};

export const compareRaidOverallScores = (
  a: RaidOverallScore,
  b: RaidOverallScore,
): number =>
  b.eDps - a.eDps ||
  b.er - a.er ||
  b.dps - a.dps ||
  b.tdo - a.tdo ||
  b.cp - a.cp;
