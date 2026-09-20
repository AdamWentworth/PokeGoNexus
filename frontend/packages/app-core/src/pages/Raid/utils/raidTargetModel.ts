import type { PokemonVariant } from "../../../types/pokemonVariants";
import {
  getRaidAttackerIvs,
  resolveRaidAttackerLevel,
} from "./raidAttackerModel";
import { cpMultipliers } from "./constants";
import {
  buildRaidIncomingPressureScenarios,
  calculateRaidBossStats,
  calculateRaidIncomingPressure,
  type RaidIncomingPressureScenario,
} from "./raidCombat";
import {
  getRaidTierKeyForVariant,
  getVariantTypeNames,
  isShadowRaidTier,
} from "./raidCatalog";
import {
  DEFAULT_RAID_NEUTRAL_BENCHMARK,
  RAID_TIER_PRESETS,
  SHADOW_ATTACKER_DEFENSE_MULTIPLIER,
} from "./raidRules";
import type {
  RaidCounterSettings,
  RaidNeutralBenchmark,
  RaidOverallTargetProfile,
} from "./raidTypes";

export type RaidAttackerBattleStats = {
  attack: number;
  defense: number;
  hp: number;
};

export type RaidTargetCombatContext = {
  profile: RaidOverallTargetProfile;
  targetDefense: number;
  incomingDps: number;
  incomingChargedDamage: number;
  timeToFaintSeconds: number;
};

type PreparedRaidTargetContext = {
  profile: RaidOverallTargetProfile;
  targetDefense: number;
  incomingPressureScenarios: RaidIncomingPressureScenario[];
};

const preparedTargetContextCache = new WeakMap<
  RaidOverallTargetProfile[],
  Map<string, PreparedRaidTargetContext[]>
>();

export const calculateRaidAttackerBattleStats = (
  attacker: PokemonVariant,
  settings: RaidCounterSettings,
): RaidAttackerBattleStats => {
  const cpMultiplier =
    cpMultipliers[resolveRaidAttackerLevel(attacker, settings.attackerLevel)];
  const ivs = getRaidAttackerIvs(attacker);
  const shadowDefense = attacker.variantType.toLowerCase().includes("shadow")
    ? SHADOW_ATTACKER_DEFENSE_MULTIPLIER
    : 1;

  return {
    attack: (attacker.attack + ivs.attack) * cpMultiplier,
    defense:
      (attacker.defense + ivs.defense) * cpMultiplier * shadowDefense,
    hp: Math.max(
      1,
      Math.floor((attacker.stamina + ivs.stamina) * cpMultiplier),
    ),
  };
};

const prepareRaidTargetContexts = (
  profiles: RaidOverallTargetProfile[],
  attackerTypes: string[],
  weatherBoostedType: string,
  neutralBenchmark: RaidNeutralBenchmark,
): PreparedRaidTargetContext[] => {
  const benchmarkKey = [
    neutralBenchmark.targetDefense,
    neutralBenchmark.incomingDamageNumerator,
    neutralBenchmark.incomingChargedDamageNumerator,
  ].join("/");
  const cacheKey = `${[...attackerTypes].sort().join("/")}|${weatherBoostedType}|${benchmarkKey}`;
  const profileCache =
    preparedTargetContextCache.get(profiles) ??
    new Map<string, PreparedRaidTargetContext[]>();
  preparedTargetContextCache.set(profiles, profileCache);

  const cached = profileCache.get(cacheKey);
  if (cached) return cached;

  const prepared = profiles.map((profile) => {
    if (!profile.target) {
      return {
        profile,
        targetDefense: neutralBenchmark.targetDefense,
        incomingPressureScenarios: [],
      };
    }

    const target = profile.target;
    const tierKey = getRaidTierKeyForVariant(target);
    const tier = tierKey ? RAID_TIER_PRESETS[tierKey] : null;
    const bossStats = tier
      ? calculateRaidBossStats(
          target,
          tier,
          isShadowRaidTier(tier.key) ? "subdued" : "normal",
        )
      : null;

    return {
      profile,
      targetDefense: bossStats?.defense ?? neutralBenchmark.targetDefense,
      incomingPressureScenarios: bossStats
        ? buildRaidIncomingPressureScenarios({
            boss: target,
            bossAttack: bossStats.attack,
            attackerTypes,
            weatherBoostedType,
          })
        : [],
    };
  });

  profileCache.set(cacheKey, prepared);
  return prepared;
};

export const buildRaidTargetCombatContexts = (
  attacker: PokemonVariant,
  settings: RaidCounterSettings,
  profiles: RaidOverallTargetProfile[],
  attackerStats = calculateRaidAttackerBattleStats(attacker, settings),
  neutralBenchmark: RaidNeutralBenchmark = DEFAULT_RAID_NEUTRAL_BENCHMARK,
): RaidTargetCombatContext[] =>
  prepareRaidTargetContexts(
    profiles,
    getVariantTypeNames(attacker),
    settings.weatherBoostedType,
    neutralBenchmark,
  ).map((prepared) => {
    const pressure = calculateRaidIncomingPressure(
      prepared.incomingPressureScenarios,
      attackerStats.defense,
      settings.bossMovesetMode === "monte-carlo"
        ? "expected"
        : settings.bossMovesetMode,
    );
    const incomingDps =
      pressure?.incomingDps ??
      neutralBenchmark.incomingDamageNumerator / attackerStats.defense;
    const incomingChargedDamage =
      pressure?.incomingChargedDamage ??
      neutralBenchmark.incomingChargedDamageNumerator / attackerStats.defense;

    return {
      profile: prepared.profile,
      targetDefense: prepared.targetDefense,
      incomingDps,
      incomingChargedDamage,
      timeToFaintSeconds: attackerStats.hp / incomingDps,
    };
  });
