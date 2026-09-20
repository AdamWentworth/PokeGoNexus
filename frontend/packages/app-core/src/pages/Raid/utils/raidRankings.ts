import type { PokemonVariant } from "../../../types/pokemonVariants";
import type { Move } from "../../../types/pokemonSubTypes";
import { getTypeEffectivenessMultiplier } from "./typeEffectiveness";
import type {
  RaidCounterScore,
  RaidCounterSettings,
  RaidBattleSimulationResult,
  RaidGroupEstimate,
  RaidNeutralBenchmark,
  RaidOverallScore,
  RaidOverallTargetProfile,
  RaidTierKey,
  RaidTierPreset,
  RaidTypeDpsScore,
} from "./raidTypes";
import {
  COMFORTABLE_SAFETY_FACTOR,
  DEFAULT_RAID_NEUTRAL_BENCHMARK,
  FALLBACK_OVERALL_TARGET_PROFILES,
  PARTY_POWER_GROUP_SIZE,
  RAID_COUNTER_SIMULATION_VARIANT_LIMIT,
  RAID_SAFETY_FACTOR,
  TYPE_DPS_ER_TDO_EXPONENT,
} from "./raidRules";
import {
  getLegalRaidChargedMoves,
  getLegalRaidFastMoves,
  getRaidOverallCoverageProfiles,
  getRaidOverallTargetProfiles,
  getRaidTypeTargetProfiles,
  getRaidTierKeyForVariant,
  getVariantTypeNames,
  isEligibleRaidAttacker,
  normalizeTypeName,
} from "./raidCatalog";
import {
  calculateComprehensiveTypeDps,
  calculateEffectiveRaidDps,
  calculatePokemonCpForLevel,
  calculateRaidBossStats,
  calculateRaidMoveDamage,
  calculateTypeDpsMoveDamage,
  compareRaidOverallScores,
  compareRaidTypeDpsScores,
  getProcessedRaidMoveSeconds,
  getRaidMoveCooldown,
  getRaidMoveEnergy,
  getTypeDpsEffectiveness,
} from "./raidCombat";
import {
  buildRaidTargetCombatContexts,
  calculateRaidAttackerBattleStats,
  type RaidTargetCombatContext,
} from "./raidTargetModel";
import {
  simulateRaidCounterAcrossBossMovesets,
  simulateRaidTeamAcrossBossMovesets,
} from "./raidSimulation";
import { compareRaidCounterScores } from "./raidCounterRanking";
import { selectLegalRaidTeamCounters } from "./raidTeamSelection";
import { getSuperMegaShieldRules } from "./superMegaRaid";

export type {
  FriendshipKey,
  MegaAllyBonusKey,
  PartyPowerKey,
  RaidBossMovesetMode,
  RaidBossStats,
  RaidCounterScore,
  RaidCounterSettings,
  RaidDodgeStrategy,
  RaidGroupEstimate,
  RaidNeutralBenchmark,
  RaidOverallScore,
  RaidTierKey,
  RaidTierPreset,
  RaidTypeDpsScore,
  ShadowBossMode,
} from "./raidTypes";

export {
  DEFAULT_RAID_NEUTRAL_BENCHMARK,
  DEFAULT_RAID_RELOBBY_SECONDS,
  FRIENDSHIP_DAMAGE_BONUS,
  MEGA_ALLY_DAMAGE_BONUS,
  RAID_ATTACKER_TEAM_SIZE,
  RAID_COLD_ROUTE_READY_BUDGET_MS,
  RAID_ROUTE_READY_MEASURE,
  RAID_SIMULATION_MODEL_VERSION,
  RAID_TIER_PRESETS,
  RAID_WARM_ROUTE_READY_BUDGET_MS,
} from "./raidRules";

export {
  getPrimaryRaidMetadataForVariant,
  getRaidMetadataForVariant,
  getRaidTierKeyForVariant,
  getVariantTypeNames,
  isEligibleRaidAttacker,
  isEligibleRaidBoss,
  isMaxBattleVariant,
  isRaidCosmeticVariant,
  isShadowRaidTier,
} from "./raidCatalog";

export {
  calculateEffectiveRaidDps,
  calculatePokemonCpForLevel,
  calculateRaidBossCp,
  calculateRaidBossStats,
  calculateRaidMoveDamage,
} from "./raidCombat";

const calculateMoveCycleEstimate = (
  attacker: PokemonVariant,
  fastMove: Move,
  chargedMove: Move,
  boss: PokemonVariant,
  tier: RaidTierPreset,
  settings: RaidCounterSettings,
): RaidCounterScore => {
  const attackerAttack = calculateRaidAttackerBattleStats(
    attacker,
    settings,
  ).attack;
  const bossTypes = getVariantTypeNames(boss);
  const bossStats = calculateRaidBossStats(boss, tier, settings.shadowBossMode);

  const fastDamage = calculateRaidMoveDamage({
    move: fastMove,
    attacker,
    attackerAttack,
    bossDefense: bossStats.defense,
    bossTypes,
    settings,
    charged: false,
  });
  const chargedDamage = calculateRaidMoveDamage({
    move: chargedMove,
    attacker,
    attackerAttack,
    bossDefense: bossStats.defense,
    bossTypes,
    settings,
    charged: true,
  });
  const fastEnergy = Math.max(1, getRaidMoveEnergy(fastMove));
  const chargedEnergyCost = Math.max(
    1,
    Math.abs(getRaidMoveEnergy(chargedMove)),
  );
  const fastUses = Math.max(1, Math.ceil(chargedEnergyCost / fastEnergy));
  const fastSeconds = Math.max(0.5, getRaidMoveCooldown(fastMove) / 1000);
  const chargedSeconds = Math.max(0.5, getRaidMoveCooldown(chargedMove) / 1000);
  const cycleSeconds = fastUses * fastSeconds + chargedSeconds;
  const cycleDamage = fastUses * fastDamage + chargedDamage;
  const sustainedDps = cycleDamage / cycleSeconds;
  const soloTimeSeconds = bossStats.hp / sustainedDps;

  return {
    variant: attacker,
    fastMove,
    chargedMove,
    cp: calculatePokemonCpForLevel(attacker, settings.attackerLevel),
    sustainedDps,
    dps: sustainedDps,
    fastDamage,
    chargedDamage,
    cycleSeconds,
    cycleDamage,
    effectiveness: getTypeEffectivenessMultiplier(
      normalizeTypeName(chargedMove.type_name || chargedMove.type),
      bossTypes,
    ),
    soloTimeSeconds,
    trainersNeeded: Math.max(
      1,
      Math.ceil(
        bossStats.hp /
          (sustainedDps * bossStats.timeLimitSeconds * RAID_SAFETY_FACTOR),
      ),
    ),
    faints: 0,
    relobbies: 0,
    attackerChargedMoves: 0,
    bossChargedMoves: 0,
    dodges: 0,
    partyPoweredChargedMoves: 0,
    simulationWon: false,
    simulationDistribution: null,
  };
};

export const calculateRaidCounterScore = (
  attacker: PokemonVariant,
  fastMove: Move,
  chargedMove: Move,
  boss: PokemonVariant,
  tier: RaidTierPreset,
  settings: RaidCounterSettings,
): RaidCounterScore => {
  const estimate = calculateMoveCycleEstimate(
    attacker,
    fastMove,
    chargedMove,
    boss,
    tier,
    settings,
  );
  const simulation = simulateRaidCounterAcrossBossMovesets({
    attacker,
    attackerFastMove: fastMove,
    attackerChargedMove: chargedMove,
    boss,
    tier,
    settings,
  });
  if (!simulation) return estimate;

  const bossStats = calculateRaidBossStats(boss, tier, settings.shadowBossMode);
  return {
    ...estimate,
    dps: simulation.dps,
    soloTimeSeconds: simulation.projectedTimeToWinSeconds,
    trainersNeeded: Math.max(
      1,
      Math.ceil(
        bossStats.hp /
          (simulation.dps * bossStats.timeLimitSeconds * RAID_SAFETY_FACTOR),
      ),
    ),
    faints: simulation.faints,
    relobbies: simulation.relobbies,
    attackerChargedMoves: simulation.attackerChargedMoves,
    bossChargedMoves: simulation.bossChargedMoves,
    dodges: simulation.dodges,
    partyPoweredChargedMoves: simulation.partyPoweredChargedMoves,
    simulationWon: simulation.won,
    simulationDistribution: simulation.distribution,
  };
};

export const scoreRaidCounters = (
  attackers: PokemonVariant[],
  boss: PokemonVariant,
  tier: RaidTierPreset,
  settings: RaidCounterSettings,
): RaidCounterScore[] => {
  const finalists = selectRaidCounterFinalists(attackers, boss, tier, settings);
  return scoreRaidCounterFinalists(finalists, boss, tier, settings);
};

export const selectRaidCounterFinalists = (
  attackers: PokemonVariant[],
  boss: PokemonVariant,
  tier: RaidTierPreset,
  settings: RaidCounterSettings,
): PokemonVariant[] => {
  const estimates = attackers
    .filter(isEligibleRaidAttacker)
    .flatMap((attacker) => {
      const fastMoves = getLegalRaidFastMoves(attacker);
      const chargedMoves = getLegalRaidChargedMoves(attacker);

      return fastMoves.flatMap((fastMove) =>
        chargedMoves.map((chargedMove) =>
          calculateMoveCycleEstimate(
            attacker,
            fastMove,
            chargedMove,
            boss,
            tier,
            settings,
          ),
        ),
      );
    });
  const estimatesByVariant = new Map<string, RaidCounterScore[]>();
  estimates.forEach((estimate) => {
    const key =
      estimate.variant.variant_id ||
      `${estimate.variant.pokemon_id}-${estimate.variant.variantType}`;
    const current = estimatesByVariant.get(key) ?? [];
    current.push(estimate);
    estimatesByVariant.set(key, current);
  });

  return Array.from(estimatesByVariant.values())
    .map((variantScores) => variantScores.sort((a, b) => b.dps - a.dps))
    .sort((a, b) => (b[0]?.dps ?? 0) - (a[0]?.dps ?? 0))
    .slice(0, RAID_COUNTER_SIMULATION_VARIANT_LIMIT)
    .map((variantScores) => variantScores[0].variant);
};

export const scoreRaidCounterFinalists = (
  finalists: PokemonVariant[],
  boss: PokemonVariant,
  tier: RaidTierPreset,
  settings: RaidCounterSettings,
): RaidCounterScore[] =>
  finalists
    .flatMap((attacker) => {
      const fastMoves = getLegalRaidFastMoves(attacker);
      const chargedMoves = getLegalRaidChargedMoves(attacker);
      return fastMoves.flatMap((fastMove) =>
        chargedMoves.map((chargedMove) =>
          calculateRaidCounterScore(
            attacker,
            fastMove,
            chargedMove,
            boss,
            tier,
            settings,
          ),
        ),
      );
    })
    .sort(compareRaidCounterScores);

export const calculateOverallMoveCycleScore = (
  attacker: PokemonVariant,
  fastMove: Move,
  chargedMove: Move,
  settings: RaidCounterSettings,
  targetProfiles: RaidOverallTargetProfile[] = FALLBACK_OVERALL_TARGET_PROFILES,
  preparedTargetContexts?: RaidTargetCombatContext[],
  neutralBenchmark: RaidNeutralBenchmark = DEFAULT_RAID_NEUTRAL_BENCHMARK,
): RaidOverallScore => {
  const attackerStats = calculateRaidAttackerBattleStats(attacker, settings);
  const targetContexts =
    preparedTargetContexts ??
    buildRaidTargetCombatContexts(
      attacker,
      settings,
      targetProfiles,
      attackerStats,
      neutralBenchmark,
    );
  const attackerAttack = attackerStats.attack;
  const attackerHp = attackerStats.hp;
  const fastEnergy = Math.max(1, getRaidMoveEnergy(fastMove));
  const chargedEnergyCost = Math.max(
    1,
    Math.abs(getRaidMoveEnergy(chargedMove)),
  );
  const fastUses = Math.max(1, Math.ceil(chargedEnergyCost / fastEnergy));
  const fastSeconds = getProcessedRaidMoveSeconds(fastMove);
  const chargedSeconds = getProcessedRaidMoveSeconds(chargedMove);
  const cycleSeconds = fastUses * fastSeconds + chargedSeconds;

  let scoreWeight = 0;
  let fastDamageSum = 0;
  let chargedDamageSum = 0;
  let cycleDamageSum = 0;
  let dpsSum = 0;
  let tdoSum = 0;
  let erSum = 0;
  let eDpsSum = 0;

  for (const targetContext of targetContexts) {
    const targetProfile = targetContext.profile;
    const targetTypes = targetProfile.types;
    const weight = targetProfile.weight;
    const fastDamage = calculateTypeDpsMoveDamage({
      move: fastMove,
      attacker,
      attackerAttack,
      selectedType: "",
      targetTypes,
      targetDefense: targetContext.targetDefense,
      settings,
      charged: false,
    });
    const chargedDamage = calculateTypeDpsMoveDamage({
      move: chargedMove,
      attacker,
      attackerAttack,
      selectedType: "",
      targetTypes,
      targetDefense: targetContext.targetDefense,
      settings,
      charged: true,
    });
    const dps = calculateComprehensiveTypeDps({
      fastDamage,
      chargedDamage,
      fastMove,
      chargedMove,
      attackerHp,
      incomingDps: targetContext.incomingDps,
      incomingChargedDamage: targetContext.incomingChargedDamage,
    });
    const tdo = dps * targetContext.timeToFaintSeconds;
    const er =
      dps > 0 && tdo > 0
        ? Math.pow(dps, 1 - TYPE_DPS_ER_TDO_EXPONENT) *
          Math.pow(tdo, TYPE_DPS_ER_TDO_EXPONENT)
        : 0;
    const eDps = calculateEffectiveRaidDps({
      dps,
      tdo,
      relobbySeconds: settings.relobbySeconds,
    });

    scoreWeight += weight;
    fastDamageSum += fastDamage * weight;
    chargedDamageSum += chargedDamage * weight;
    cycleDamageSum += (fastUses * fastDamage + chargedDamage) * weight;
    dpsSum += dps * weight;
    tdoSum += tdo * weight;
    erSum += er * weight;
    eDpsSum += eDps * weight;
  }

  const averageWeight = Math.max(1, scoreWeight);
  const fastDamage = fastDamageSum / averageWeight;
  const chargedDamage = chargedDamageSum / averageWeight;
  const cycleDamage = cycleDamageSum / averageWeight;
  const dps = dpsSum / averageWeight;
  const tdo = tdoSum / averageWeight;
  const er = erSum / averageWeight;
  const eDps = eDpsSum / averageWeight;

  return {
    variant: attacker,
    fastMove,
    chargedMove,
    cp: calculatePokemonCpForLevel(attacker, settings.attackerLevel),
    eDps,
    dps,
    tdo,
    er,
    fastDamage,
    chargedDamage,
    cycleSeconds,
    cycleDamage,
  };
};

export const scoreRaidOverallAttackers = (
  attackers: PokemonVariant[],
  settings: RaidCounterSettings,
  neutralBenchmark: RaidNeutralBenchmark = DEFAULT_RAID_NEUTRAL_BENCHMARK,
): RaidOverallScore[] => {
  const targetProfiles = getRaidOverallTargetProfiles();

  return attackers
    .filter(isEligibleRaidAttacker)
    .flatMap((attacker) => {
      const fastMoves = getLegalRaidFastMoves(attacker);
      const chargedMoves = getLegalRaidChargedMoves(attacker);
      const targetContexts = buildRaidTargetCombatContexts(
        attacker,
        settings,
        targetProfiles,
        undefined,
        neutralBenchmark,
      );

      return fastMoves.flatMap((fastMove) =>
        chargedMoves.map((chargedMove) =>
          calculateOverallMoveCycleScore(
            attacker,
            fastMove,
            chargedMove,
            settings,
            targetProfiles,
            targetContexts,
            neutralBenchmark,
          ),
        ),
      );
    })
    .sort(compareRaidOverallScores);
};

export const scoreBestRaidOverallAttackers = (
  attackers: PokemonVariant[],
  settings: RaidCounterSettings,
  hiddenPowerCoverageTargets?: PokemonVariant[],
  neutralBenchmark: RaidNeutralBenchmark = DEFAULT_RAID_NEUTRAL_BENCHMARK,
): RaidOverallScore[] => {
  const targetProfiles = getRaidOverallTargetProfiles();
  const hiddenPowerCoverageProfiles = getRaidOverallCoverageProfiles(
    hiddenPowerCoverageTargets,
  );
  const hiddenPowerCoverageByType = new Map<string, number>();
  const getHiddenPowerCoverage = (move: Move): number => {
    const moveType = normalizeTypeName(move.type_name || move.type);
    const cached = hiddenPowerCoverageByType.get(moveType);
    if (cached !== undefined) return cached;

    const coverage = hiddenPowerCoverageProfiles.reduce(
      (total, profile) =>
        total +
        getTypeEffectivenessMultiplier(moveType, profile.types) *
          profile.weight,
      0,
    );
    hiddenPowerCoverageByType.set(moveType, coverage);
    return coverage;
  };
  const targetWeight = Math.max(
    1,
    targetProfiles.reduce((sum, profile) => sum + profile.weight, 0),
  );
  const bestByVariant = new Map<string, RaidOverallScore>();

  attackers.filter(isEligibleRaidAttacker).forEach((attacker) => {
    const fastMoves = getLegalRaidFastMoves(attacker);
    const chargedMoves = getLegalRaidChargedMoves(attacker);
    const key =
      attacker.variant_id || `${attacker.pokemon_id}-${attacker.variantType}`;
    const attackerStats = calculateRaidAttackerBattleStats(attacker, settings);
    const attackerAttack = attackerStats.attack;
    const attackerHp = attackerStats.hp;
    const targetContexts = buildRaidTargetCombatContexts(
      attacker,
      settings,
      targetProfiles,
      attackerStats,
      neutralBenchmark,
    );
    const cp = calculatePokemonCpForLevel(attacker, settings.attackerLevel);
    const prepareMoveDamages = (moves: Move[], charged: boolean) =>
      moves.map((move) => ({
        move,
        damages: targetContexts.map((targetContext) =>
          calculateTypeDpsMoveDamage({
            move,
            attacker,
            attackerAttack,
            selectedType: "",
            targetTypes: targetContext.profile.types,
            targetDefense: targetContext.targetDefense,
            settings,
            charged,
          }),
        ),
      }));
    const fastMoveDamages = prepareMoveDamages(fastMoves, false);
    const chargedMoveDamages = prepareMoveDamages(chargedMoves, true);

    fastMoveDamages.forEach(({ move: fastMove, damages: fastDamages }) => {
      chargedMoveDamages.forEach(
        ({ move: chargedMove, damages: chargedDamages }) => {
          const fastEnergy = Math.max(1, getRaidMoveEnergy(fastMove));
          const chargedEnergyCost = Math.max(
            1,
            Math.abs(getRaidMoveEnergy(chargedMove)),
          );
          const fastUses = Math.max(
            1,
            Math.ceil(chargedEnergyCost / fastEnergy),
          );
          const fastSeconds = getProcessedRaidMoveSeconds(fastMove);
          const chargedSeconds = getProcessedRaidMoveSeconds(chargedMove);
          const cycleSeconds = fastUses * fastSeconds + chargedSeconds;

          let fastDamageSum = 0;
          let chargedDamageSum = 0;
          let cycleDamageSum = 0;
          let dpsSum = 0;
          let tdoSum = 0;
          let erSum = 0;
          let eDpsSum = 0;

          targetContexts.forEach((targetContext, index) => {
            const targetProfile = targetContext.profile;
            const weight = targetProfile.weight;
            const fastDamage = fastDamages[index] ?? 0;
            const chargedDamage = chargedDamages[index] ?? 0;
            const dps = calculateComprehensiveTypeDps({
              fastDamage,
              chargedDamage,
              fastMove,
              chargedMove,
              attackerHp,
              incomingDps: targetContext.incomingDps,
              incomingChargedDamage: targetContext.incomingChargedDamage,
            });
            const tdo = dps * targetContext.timeToFaintSeconds;
            const er =
              dps > 0 && tdo > 0
                ? Math.pow(dps, 1 - TYPE_DPS_ER_TDO_EXPONENT) *
                  Math.pow(tdo, TYPE_DPS_ER_TDO_EXPONENT)
                : 0;
            const eDps = calculateEffectiveRaidDps({
              dps,
              tdo,
              relobbySeconds: settings.relobbySeconds,
            });

            fastDamageSum += fastDamage * weight;
            chargedDamageSum += chargedDamage * weight;
            cycleDamageSum += (fastUses * fastDamage + chargedDamage) * weight;
            dpsSum += dps * weight;
            tdoSum += tdo * weight;
            erSum += er * weight;
            eDpsSum += eDps * weight;
          });

          const score: RaidOverallScore = {
            variant: attacker,
            fastMove,
            chargedMove,
            cp,
            eDps: eDpsSum / targetWeight,
            dps: dpsSum / targetWeight,
            tdo: tdoSum / targetWeight,
            er: erSum / targetWeight,
            fastDamage: fastDamageSum / targetWeight,
            chargedDamage: chargedDamageSum / targetWeight,
            cycleSeconds,
            cycleDamage: cycleDamageSum / targetWeight,
          };
          const current = bestByVariant.get(key);
          const scoreComparison = current
            ? compareRaidOverallScores(score, current)
            : -1;
          const bothHiddenPower =
            current?.fastMove.name.toLowerCase().startsWith("hidden power") &&
            fastMove.name.toLowerCase().startsWith("hidden power");
          const winsHiddenPowerCoverageTie =
            current !== undefined &&
            scoreComparison === 0 &&
            bothHiddenPower &&
            getHiddenPowerCoverage(fastMove) >
              getHiddenPowerCoverage(current.fastMove);

          if (!current || scoreComparison < 0 || winsHiddenPowerCoverageTie) {
            bestByVariant.set(key, score);
          }
        },
      );
    });
  });

  return Array.from(bestByVariant.values()).sort(compareRaidOverallScores);
};

export const calculateTypeMoveCycleScore = (
  attacker: PokemonVariant,
  fastMove: Move,
  chargedMove: Move,
  typeName: string,
  settings: RaidCounterSettings,
  targetProfiles: RaidOverallTargetProfile[] = [],
  preparedTargetContexts?: RaidTargetCombatContext[],
): RaidTypeDpsScore => {
  const targetType = normalizeTypeName(typeName);
  const fastType = normalizeTypeName(fastMove.type_name || fastMove.type);
  const chargedType = normalizeTypeName(
    chargedMove.type_name || chargedMove.type,
  );
  const attackerStats = calculateRaidAttackerBattleStats(attacker, settings);
  const attackerAttack = attackerStats.attack;
  const attackerHp = attackerStats.hp;
  const fastEnergy = Math.max(1, getRaidMoveEnergy(fastMove));
  const chargedEnergyCost = Math.max(
    1,
    Math.abs(getRaidMoveEnergy(chargedMove)),
  );
  const fastUses = Math.max(1, Math.ceil(chargedEnergyCost / fastEnergy));
  const fastSeconds = getProcessedRaidMoveSeconds(fastMove);
  const chargedSeconds = getProcessedRaidMoveSeconds(chargedMove);
  const cycleSeconds = fastUses * fastSeconds + chargedSeconds;
  const effectiveProfiles =
    targetProfiles.length > 0
      ? targetProfiles
      : [{ types: [], weight: 1 } satisfies RaidOverallTargetProfile];
  const targetContexts =
    preparedTargetContexts ??
    buildRaidTargetCombatContexts(
      attacker,
      settings,
      effectiveProfiles,
      attackerStats,
    );

  let totalWeight = 0;
  let fastDamageSum = 0;
  let chargedDamageSum = 0;
  let fastEffectivenessSum = 0;
  let chargedEffectivenessSum = 0;
  let targetEffectivenessSum = 0;
  let cycleDamageSum = 0;
  let dpsSum = 0;
  let tdoSum = 0;
  let eDpsSum = 0;
  let erSum = 0;

  targetContexts.forEach((targetContext) => {
    const targetProfile = targetContext.profile;
    const useRealTarget = targetProfile.types.length > 0;
    const fastEffectiveness = useRealTarget
      ? getTypeEffectivenessMultiplier(fastType, targetProfile.types)
      : getTypeDpsEffectiveness(fastType, targetType);
    const chargedEffectiveness = useRealTarget
      ? getTypeEffectivenessMultiplier(chargedType, targetProfile.types)
      : getTypeDpsEffectiveness(chargedType, targetType);
    const targetEffectiveness = useRealTarget
      ? getTypeEffectivenessMultiplier(targetType, targetProfile.types)
      : targetType === "normal"
        ? 1
        : 1.6;
    const fastDamage = calculateTypeDpsMoveDamage({
      move: fastMove,
      attacker,
      attackerAttack,
      selectedType: targetType,
      targetTypes: useRealTarget ? targetProfile.types : undefined,
      targetDefense: targetContext.targetDefense,
      settings,
      charged: false,
    });
    const chargedDamage = calculateTypeDpsMoveDamage({
      move: chargedMove,
      attacker,
      attackerAttack,
      selectedType: targetType,
      targetTypes: useRealTarget ? targetProfile.types : undefined,
      targetDefense: targetContext.targetDefense,
      settings,
      charged: true,
    });
    const dps = calculateComprehensiveTypeDps({
      fastDamage,
      chargedDamage,
      fastMove,
      chargedMove,
      attackerHp,
      incomingDps: targetContext.incomingDps,
      incomingChargedDamage: targetContext.incomingChargedDamage,
    });
    const tdo = dps * targetContext.timeToFaintSeconds;
    const eDps = calculateEffectiveRaidDps({
      dps,
      tdo,
      relobbySeconds: settings.relobbySeconds,
    });
    const er =
      dps > 0 && tdo > 0
        ? Math.pow(dps, 1 - TYPE_DPS_ER_TDO_EXPONENT) *
          Math.pow(tdo, TYPE_DPS_ER_TDO_EXPONENT)
        : 0;
    const weight = targetProfile.weight;

    totalWeight += weight;
    fastDamageSum += fastDamage * weight;
    chargedDamageSum += chargedDamage * weight;
    fastEffectivenessSum += fastEffectiveness * weight;
    chargedEffectivenessSum += chargedEffectiveness * weight;
    targetEffectivenessSum += targetEffectiveness * weight;
    cycleDamageSum += (fastUses * fastDamage + chargedDamage) * weight;
    dpsSum += dps * weight;
    tdoSum += tdo * weight;
    eDpsSum += eDps * weight;
    erSum += er * weight;
  });

  const averageWeight = Math.max(1, totalWeight);
  const fastDamage = fastDamageSum / averageWeight;
  const chargedDamage = chargedDamageSum / averageWeight;
  const dps = dpsSum / averageWeight;
  const tdo = tdoSum / averageWeight;

  return {
    variant: attacker,
    fastMove,
    chargedMove,
    cp: calculatePokemonCpForLevel(attacker, settings.attackerLevel),
    totalDps: dps,
    eDps: eDpsSum / averageWeight,
    dps,
    tdo,
    er: erSum / averageWeight,
    fastDamage,
    chargedDamage,
    fastEffectiveness: fastEffectivenessSum / averageWeight,
    chargedEffectiveness: chargedEffectivenessSum / averageWeight,
    cycleSeconds,
    cycleDamage: cycleDamageSum / averageWeight,
    targetEffectiveness: targetEffectivenessSum / averageWeight,
    fastMatchesType: fastType === targetType,
    chargedMatchesType: chargedType === targetType,
  };
};

export const scoreRaidTypeDps = (
  attackers: PokemonVariant[],
  typeName: string,
  settings: RaidCounterSettings,
  targets?: PokemonVariant[],
): RaidTypeDpsScore[] => {
  const targetType = normalizeTypeName(typeName);
  if (!targetType) return [];
  const targetProfiles = getRaidTypeTargetProfiles(targetType, targets);

  return attackers
    .filter(isEligibleRaidAttacker)
    .flatMap((attacker) => {
      const fastMoves = getLegalRaidFastMoves(attacker);
      const chargedMoves = getLegalRaidChargedMoves(attacker);
      const effectiveProfiles =
        targetProfiles.length > 0
          ? targetProfiles
          : [{ types: [], weight: 1 } satisfies RaidOverallTargetProfile];
      const targetContexts = buildRaidTargetCombatContexts(
        attacker,
        settings,
        effectiveProfiles,
      );

      return fastMoves.flatMap((fastMove) =>
        chargedMoves
          .filter((chargedMove) => {
            const fastType = normalizeTypeName(
              fastMove.type_name || fastMove.type,
            );
            const chargedType = normalizeTypeName(
              chargedMove.type_name || chargedMove.type,
            );
            return fastType === targetType || chargedType === targetType;
          })
          .map((chargedMove) =>
            calculateTypeMoveCycleScore(
              attacker,
              fastMove,
              chargedMove,
              targetType,
              settings,
              targetProfiles,
              targetContexts,
            ),
          ),
      );
    })
    .sort(compareRaidTypeDpsScores);
};

export const dedupeBestCounterPerVariant = (
  scores: RaidCounterScore[],
): RaidCounterScore[] => {
  const bestByVariant = new Map<string, RaidCounterScore>();
  scores.forEach((score) => {
    const key =
      score.variant.variant_id ||
      `${score.variant.pokemon_id}-${score.variant.variantType}`;
    const current = bestByVariant.get(key);
    if (!current || compareRaidCounterScores(score, current) < 0) {
      bestByVariant.set(key, score);
    }
  });

  return Array.from(bestByVariant.values()).sort(compareRaidCounterScores);
};

export const dedupeBestTypeDpsPerVariant = (
  scores: RaidTypeDpsScore[],
): RaidTypeDpsScore[] => {
  const bestByVariant = new Map<string, RaidTypeDpsScore>();
  scores.forEach((score) => {
    const key =
      score.variant.variant_id ||
      `${score.variant.pokemon_id}-${score.variant.variantType}`;
    const current = bestByVariant.get(key);
    if (!current || compareRaidTypeDpsScores(score, current) < 0) {
      bestByVariant.set(key, score);
    }
  });

  return Array.from(bestByVariant.values()).sort(compareRaidTypeDpsScores);
};

export const dedupeBestOverallAttackerPerVariant = (
  scores: RaidOverallScore[],
): RaidOverallScore[] => {
  const bestByVariant = new Map<string, RaidOverallScore>();
  scores.forEach((score) => {
    const key =
      score.variant.variant_id ||
      `${score.variant.pokemon_id}-${score.variant.variantType}`;
    const current = bestByVariant.get(key);
    if (!current || compareRaidOverallScores(score, current) < 0) {
      bestByVariant.set(key, score);
    }
  });

  return Array.from(bestByVariant.values()).sort(compareRaidOverallScores);
};

export const estimateRaidGroup = (
  scores: RaidCounterScore[],
  boss: PokemonVariant,
  tier: RaidTierPreset,
  settings: RaidCounterSettings,
): RaidGroupEstimate => {
  const superMegaRules = getSuperMegaShieldRules(boss, tier);
  const bestCounters = selectLegalRaidTeamCounters(
    dedupeBestCounterPerVariant(scores),
    undefined,
    { requireSuperMegaShieldBreaker: Boolean(superMegaRules) },
  );
  const fallbackTeamDps =
    bestCounters.length > 0
      ? bestCounters.reduce((sum, counter) => sum + counter.dps, 0) /
        bestCounters.length
      : 0;
  const teamSimulation = simulateRaidTeamAcrossBossMovesets({
    team: bestCounters.map((counter) => ({
      attacker: counter.variant,
      fastMove: counter.fastMove,
      chargedMove: counter.chargedMove,
    })),
    boss,
    tier,
    settings,
  });
  const topTeamDps = teamSimulation?.dps ?? fallbackTeamDps;
  const bossStats = calculateRaidBossStats(boss, tier, settings.shadowBossMode);

  if (topTeamDps <= 0) {
    return {
      topTeamDps: 0,
      minTrainers: 0,
      comfortableTrainers: 0,
      soloTimeSeconds: 0,
    };
  }

  const minimumPartySize = PARTY_POWER_GROUP_SIZE[settings.partyPower];
  let simulatedMinimum = 0;
  let simulatedComfortable = 0;
  for (
    let trainerCount = Math.max(
      minimumPartySize,
      superMegaRules?.shieldCount ?? 1,
    );
    trainerCount <= 20;
    trainerCount += 1
  ) {
    const groupSimulation = simulateRaidTeamAcrossBossMovesets({
      team: bestCounters.map((counter) => ({
        attacker: counter.variant,
        fastMove: counter.fastMove,
        chargedMove: counter.chargedMove,
      })),
      boss,
      tier,
      settings,
      trainerCount,
      modelSuperMegaMechanics: Boolean(superMegaRules),
    });
    if (!groupSimulation?.won) continue;
    if (simulatedMinimum === 0) simulatedMinimum = trainerCount;
    if (
      groupSimulation.elapsedSeconds <=
      bossStats.timeLimitSeconds * COMFORTABLE_SAFETY_FACTOR
    ) {
      simulatedComfortable = trainerCount;
      break;
    }
  }

  const fallbackMinimum = Math.max(
    minimumPartySize,
    superMegaRules?.shieldCount ?? 1,
    Math.ceil(
      bossStats.hp /
        (topTeamDps * bossStats.timeLimitSeconds * RAID_SAFETY_FACTOR),
    ),
  );
  const minTrainers = simulatedMinimum || fallbackMinimum;
  const comfortableTrainers = Math.max(
    minTrainers,
    simulatedComfortable ||
      Math.ceil(
        bossStats.hp /
          (topTeamDps * bossStats.timeLimitSeconds * COMFORTABLE_SAFETY_FACTOR),
      ),
  );

  return {
    topTeamDps,
    minTrainers,
    comfortableTrainers,
    soloTimeSeconds:
      teamSimulation?.projectedTimeToWinSeconds ?? bossStats.hp / topTeamDps,
    superMega: superMegaRules
      ? {
          shieldCount: superMegaRules.shieldCount,
          shieldCountSource: superMegaRules.shieldCountSource,
          assumesMegaPerTrainer: true,
        }
      : undefined,
  };
};

export const simulateRaidGroupAtTrainerCount = (
  scores: RaidCounterScore[],
  boss: PokemonVariant,
  tier: RaidTierPreset,
  settings: RaidCounterSettings,
  trainerCount: number,
): RaidBattleSimulationResult | null => {
  const superMegaRules = getSuperMegaShieldRules(boss, tier);
  const bestCounters = selectLegalRaidTeamCounters(
    dedupeBestCounterPerVariant(scores),
    undefined,
    { requireSuperMegaShieldBreaker: Boolean(superMegaRules) },
  );
  if (bestCounters.length === 0) return null;

  return simulateRaidTeamAcrossBossMovesets({
    team: bestCounters.map((counter) => ({
      attacker: counter.variant,
      fastMove: counter.fastMove,
      chargedMove: counter.chargedMove,
    })),
    boss,
    tier,
    settings,
    trainerCount: Math.min(20, Math.max(1, Math.floor(trainerCount))),
    modelSuperMegaMechanics: Boolean(superMegaRules),
  });
};

export const inferRaidTierFromMetadata = (
  variant: PokemonVariant,
): RaidTierKey | null => {
  return getRaidTierKeyForVariant(variant);
};

export const formatSeconds = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return "-";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (minutes <= 0) return `${remainingSeconds}s`;
  return `${minutes}m ${remainingSeconds.toString().padStart(2, "0")}s`;
};
