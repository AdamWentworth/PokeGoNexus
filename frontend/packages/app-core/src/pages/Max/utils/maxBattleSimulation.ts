import type { MaxBattleProfile } from '@pokemongonexus/shared-contracts/pokemon';
import type { PokemonVariant } from '@pokemongonexus/shared-contracts/variants';

import {
  MAX_MODEL_CONSTANTS,
  type MaxRankingEntry,
} from './maxBattleModel';
import {
  selectMaxMeterPlan,
  type MaxMeterPlan,
  type MaxMeterTier,
} from './maxMeterModel';

export type MaxBattleSimulationTeam = {
  damage: MaxRankingEntry;
  tank: MaxRankingEntry;
  healing: MaxRankingEntry;
};

export type MaxBattleTier = MaxMeterTier;

export type MaxBattleExecution = 'standard' | 'stress-test';
export type MaxBattleProfileConfidence = 'sourced' | 'curated' | 'estimated';

// Targeted Max Battle hits deal twice the spread-hit damage. A successful
// dodge removes at least half, so standard play returns to the base pressure;
// the stress test deliberately keeps the full targeted-hit upper bound.
export const MAX_BATTLE_EXECUTION_PRESETS: Record<
  MaxBattleExecution,
  {
    label: string;
    detail: string;
    collectMeterOrbs: boolean;
    useHostileBossMoveset: boolean;
    targetedDamageMultiplier: number;
  }
> = {
  standard: {
    label: 'Standard play',
    detail: 'Collect scheduled meter orbs and dodge targeted warnings.',
    collectMeterOrbs: true,
    useHostileBossMoveset: false,
    targetedDamageMultiplier: 1,
  },
  'stress-test': {
    label: 'Stress test',
    detail: 'Miss orbs and targeted dodges against the hardest legal moveset.',
    collectMeterOrbs: false,
    useHostileBossMoveset: true,
    targetedDamageMultiplier: 2,
  },
};

export type MaxBattleBossPreset = {
  kind: 'standard' | 'legendary' | 'gigantamax';
  tier: MaxBattleTier;
  label: string;
  bossHp: number;
  defaultTrainers: number;
  maxTrainers: number;
  battleSeconds: number;
  enrageSeconds: number;
  subgroupSize: number;
  meterOrbEnergy: number;
  source: 'catalog' | 'fallback';
  profileId: number | null;
  sourceName: string | null;
  sourceUrl: string | null;
  notes: string | null;
  confidence: MaxBattleProfileConfidence;
};

export type MaxBattleSimulationOutcome =
  | 'likely-clear'
  | 'close-call'
  | 'unlikely';

export type MaxBattleSimulationResult = {
  outcome: MaxBattleSimulationOutcome;
  execution: MaxBattleExecution;
  bossHp: number;
  trainerCount: number;
  subgroupCount: number;
  lobbyDps: number;
  estimatedClearSeconds: number;
  survivalSeconds: number;
  limitingSeconds: number;
  damageBeforeLimit: number;
  damagePercent: number;
  estimatedMaxPhases: number;
  supportActionsPerGroup: number;
  incomingDps: number;
  limitedBySurvival: boolean;
  meterPlan: MaxMeterPlan;
};

export const MAX_BATTLE_SIMULATION_CONSTANTS = {
  enrageSeconds: 360,
  maxPhaseSeconds: 10,
  maxActionsPerTrainer: 3,
  meterOrbEnergy: 10,
  oneStarBossHp: 1_700,
  twoStarBossHp: 5_000,
  threeStarBossHp: 10_000,
  legendaryBossHp: 17_500,
  gigantamaxBossHp: 90_000,
  standardMaxTrainers: 4,
  gigantamaxMaxTrainers: 100,
} as const;

const FALLBACK_TIER_PRESETS: Record<MaxBattleTier, MaxBattleBossPreset> = {
  'one-star': {
    kind: 'standard',
    tier: 'one-star',
    label: 'One-star Max',
    bossHp: MAX_BATTLE_SIMULATION_CONSTANTS.oneStarBossHp,
    defaultTrainers: 1,
    maxTrainers: MAX_BATTLE_SIMULATION_CONSTANTS.standardMaxTrainers,
    battleSeconds: MAX_BATTLE_SIMULATION_CONSTANTS.enrageSeconds,
    enrageSeconds: MAX_BATTLE_SIMULATION_CONSTANTS.enrageSeconds,
    subgroupSize: MAX_MODEL_CONSTANTS.maxGroupSize,
    meterOrbEnergy: MAX_BATTLE_SIMULATION_CONSTANTS.meterOrbEnergy,
    source: 'fallback',
    profileId: null,
    sourceName: null,
    sourceUrl: null,
    notes: null,
    confidence: 'estimated',
  },
  'two-star': {
    kind: 'standard',
    tier: 'two-star',
    label: 'Two-star Max',
    bossHp: MAX_BATTLE_SIMULATION_CONSTANTS.twoStarBossHp,
    defaultTrainers: 1,
    maxTrainers: MAX_BATTLE_SIMULATION_CONSTANTS.standardMaxTrainers,
    battleSeconds: MAX_BATTLE_SIMULATION_CONSTANTS.enrageSeconds,
    enrageSeconds: MAX_BATTLE_SIMULATION_CONSTANTS.enrageSeconds,
    subgroupSize: MAX_MODEL_CONSTANTS.maxGroupSize,
    meterOrbEnergy: MAX_BATTLE_SIMULATION_CONSTANTS.meterOrbEnergy,
    source: 'fallback',
    profileId: null,
    sourceName: null,
    sourceUrl: null,
    notes: null,
    confidence: 'estimated',
  },
  'three-star': {
    kind: 'standard',
    tier: 'three-star',
    label: 'Three-star Max',
    bossHp: MAX_BATTLE_SIMULATION_CONSTANTS.threeStarBossHp,
    defaultTrainers: 2,
    maxTrainers: MAX_BATTLE_SIMULATION_CONSTANTS.standardMaxTrainers,
    battleSeconds: MAX_BATTLE_SIMULATION_CONSTANTS.enrageSeconds,
    enrageSeconds: MAX_BATTLE_SIMULATION_CONSTANTS.enrageSeconds,
    subgroupSize: MAX_MODEL_CONSTANTS.maxGroupSize,
    meterOrbEnergy: MAX_BATTLE_SIMULATION_CONSTANTS.meterOrbEnergy,
    source: 'fallback',
    profileId: null,
    sourceName: null,
    sourceUrl: null,
    notes: null,
    confidence: 'estimated',
  },
  legendary: {
    kind: 'legendary',
    tier: 'legendary',
    label: 'Legendary Max',
    bossHp: MAX_BATTLE_SIMULATION_CONSTANTS.legendaryBossHp,
    defaultTrainers: 4,
    maxTrainers: MAX_BATTLE_SIMULATION_CONSTANTS.standardMaxTrainers,
    battleSeconds: MAX_BATTLE_SIMULATION_CONSTANTS.enrageSeconds,
    enrageSeconds: MAX_BATTLE_SIMULATION_CONSTANTS.enrageSeconds,
    subgroupSize: MAX_MODEL_CONSTANTS.maxGroupSize,
    meterOrbEnergy: MAX_BATTLE_SIMULATION_CONSTANTS.meterOrbEnergy,
    source: 'fallback',
    profileId: null,
    sourceName: null,
    sourceUrl: null,
    notes: null,
    confidence: 'estimated',
  },
  gigantamax: {
    kind: 'gigantamax',
    tier: 'gigantamax',
    label: 'Six-star Gigantamax',
    bossHp: MAX_BATTLE_SIMULATION_CONSTANTS.gigantamaxBossHp,
    defaultTrainers: 12,
    maxTrainers: MAX_BATTLE_SIMULATION_CONSTANTS.gigantamaxMaxTrainers,
    battleSeconds: MAX_BATTLE_SIMULATION_CONSTANTS.enrageSeconds,
    enrageSeconds: MAX_BATTLE_SIMULATION_CONSTANTS.enrageSeconds,
    subgroupSize: MAX_MODEL_CONSTANTS.maxGroupSize,
    meterOrbEnergy: MAX_BATTLE_SIMULATION_CONSTANTS.meterOrbEnergy,
    source: 'fallback',
    profileId: null,
    sourceName: null,
    sourceUrl: null,
    notes: null,
    confidence: 'estimated',
  },
};

const TIER_ORDER: MaxBattleTier[] = [
  'one-star',
  'two-star',
  'three-star',
  'legendary',
  'gigantamax',
];

const isGigantamaxBoss = (boss: PokemonVariant): boolean =>
  boss.variantType.toLowerCase().includes('gigantamax');

const isSpecialLegendaryBoss = (boss: PokemonVariant): boolean =>
  [888, 889, 890].includes(boss.pokemon_id) ||
  /legendary|mythical|ultra beast/i.test(boss.rarity ?? '');

const profileVariantKind = (
  boss: PokemonVariant,
): MaxBattleProfile['variant_kind'] => {
  if (isGigantamaxBoss(boss)) return 'gigantamax';
  if ([888, 889, 890].includes(boss.pokemon_id)) return 'special';
  return 'dynamax';
};

const normalizedForm = (value?: string | null): string =>
  value?.trim().toLowerCase() ?? '';

const isActiveProfile = (profile: MaxBattleProfile, at: Date): boolean => {
  const timestamp = at.getTime();
  const startsAt = profile.starts_at ? Date.parse(profile.starts_at) : null;
  const endsAt = profile.ends_at ? Date.parse(profile.ends_at) : null;
  return (
    (startsAt === null || !Number.isFinite(startsAt) || startsAt <= timestamp) &&
    (endsAt === null || !Number.isFinite(endsAt) || timestamp < endsAt)
  );
};

const matchingProfiles = (boss: PokemonVariant): MaxBattleProfile[] => {
  const kind = profileVariantKind(boss);
  const form = normalizedForm(boss.form || boss.megaForm);
  return (boss.max_battle_profiles ?? [])
    .filter(
      (profile) =>
        profile.variant_kind === kind &&
        (!profile.form || normalizedForm(profile.form) === form),
    )
    .sort(
      (left, right) =>
        Number(right.priority) - Number(left.priority) ||
        Number(left.profile_id) - Number(right.profile_id),
    );
};

const preferredProfile = (
  profiles: MaxBattleProfile[],
  at: Date,
): MaxBattleProfile | null => {
  const activeOverride = profiles.find(
    (profile) =>
      (profile.starts_at !== null || profile.ends_at !== null) &&
      isActiveProfile(profile, at),
  );
  return activeOverride ?? profiles.find((profile) => profile.is_default) ?? profiles[0] ?? null;
};

const positiveInteger = (value: number, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
};

const presetFromProfile = (profile: MaxBattleProfile): MaxBattleBossPreset => {
  const fallback = FALLBACK_TIER_PRESETS[profile.tier];
  return {
    kind: profile.kind,
    tier: profile.tier,
    label: profile.label || fallback.label,
    bossHp: positiveInteger(profile.boss_hp, fallback.bossHp),
    defaultTrainers: positiveInteger(
      profile.default_trainers,
      fallback.defaultTrainers,
    ),
    maxTrainers: positiveInteger(profile.max_trainers, fallback.maxTrainers),
    battleSeconds: positiveInteger(profile.battle_seconds, fallback.battleSeconds),
    enrageSeconds: positiveInteger(profile.enrage_seconds, fallback.enrageSeconds),
    subgroupSize: positiveInteger(profile.subgroup_size, fallback.subgroupSize),
    meterOrbEnergy: Math.max(0, Number(profile.meter_orb_energy) || 0),
    source: 'catalog',
    profileId: profile.profile_id,
    sourceName: profile.source_name,
    sourceUrl: profile.source_url,
    notes: profile.notes,
    confidence: profile.source_url
      ? 'sourced'
      : profile.source_name
        ? 'curated'
        : 'estimated',
  };
};

export const getDefaultMaxBattleTier = (
  boss: PokemonVariant,
  at = new Date(),
): MaxBattleTier => {
  const profile = preferredProfile(matchingProfiles(boss), at);
  if (profile) return profile.tier;
  if (isGigantamaxBoss(boss)) return 'gigantamax';
  if (isSpecialLegendaryBoss(boss)) return 'legendary';

  const evolvesFrom = boss.evolves_from ?? boss.evolutionData?.evolves_from ?? [];
  const evolvesTo = boss.evolves_to ?? boss.evolutionData?.evolves_to ?? [];
  if (evolvesFrom.length === 0 && evolvesTo.length > 0) return 'one-star';
  if (evolvesFrom.length > 0 && evolvesTo.length > 0) return 'two-star';
  return 'three-star';
};

export const getMaxBattleTierOptions = (boss: PokemonVariant): MaxBattleTier[] => {
  const profiles = matchingProfiles(boss);
  if (profiles.length > 0) {
    const tiers = new Set(profiles.map((profile) => profile.tier));
    return TIER_ORDER.filter((tier) => tiers.has(tier));
  }

  const defaultTier = getDefaultMaxBattleTier(boss);
  if (defaultTier === 'gigantamax' || defaultTier === 'legendary') {
    return [defaultTier];
  }
  return ['one-star', 'two-star', 'three-star'];
};

export const getMaxBattleBossPreset = (
  boss: PokemonVariant,
  requestedTier?: MaxBattleTier,
  at = new Date(),
): MaxBattleBossPreset => {
  const availableTiers = getMaxBattleTierOptions(boss);
  const tier =
    requestedTier && availableTiers.includes(requestedTier)
      ? requestedTier
      : getDefaultMaxBattleTier(boss, at);
  const profile = preferredProfile(
    matchingProfiles(boss).filter((candidate) => candidate.tier === tier),
    at,
  );

  return profile ? presetFromProfile(profile) : FALLBACK_TIER_PRESETS[tier];
};

const getSubgroupSizes = (trainerCount: number, subgroupSize: number): number[] => {
  const sizes: number[] = [];
  let remaining = trainerCount;

  while (remaining > 0) {
    const size = Math.min(subgroupSize, remaining);
    sizes.push(size);
    remaining -= size;
  }

  return sizes;
};

type SubgroupEstimate = {
  dps: number;
  cycleSeconds: number;
  incomingDps: number;
  survivalSeconds: number;
  supportActions: number;
  meterPlan: MaxMeterPlan;
};

const estimateSubgroup = (
  size: number,
  team: MaxBattleSimulationTeam,
  boss: PokemonVariant,
  bossHp: number,
  preset: MaxBattleBossPreset,
  execution: MaxBattleExecution,
): SubgroupEstimate => {
  const executionPreset = MAX_BATTLE_EXECUTION_PRESETS[execution];
  const maxActions =
    size * MAX_BATTLE_SIMULATION_CONSTANTS.maxActionsPerTrainer;
  const isEasyTier = preset.tier === 'one-star' || preset.tier === 'two-star';
  const supportActions = isEasyTier
    ? 0
    : Math.min(
        Math.max(0, maxActions - 1),
        Number(team.tank.maxGuardLevel > 0) +
          Number(team.healing.maxSpiritLevel > 0),
      );
  const attackActions = Math.max(1, maxActions - supportActions);
  const maxHitDamage = Math.max(
    1,
    team.damage.bossBenchmark?.maxHitDamage ?? 1,
  );
  const meterPlan = selectMaxMeterPlan({
    boss,
    bossHp,
    entry: team.tank,
    maxPhaseDamage: maxHitDamage * attackActions,
    maxPhaseSeconds: MAX_BATTLE_SIMULATION_CONSTANTS.maxPhaseSeconds,
    collectMeterOrbs: executionPreset.collectMeterOrbs,
    meterOrbEnergy: preset.meterOrbEnergy,
    subgroupSize: size,
    tier: preset.tier,
  });
  const meterSeconds = meterPlan.meterSeconds;
  const cycleSeconds =
    meterSeconds + MAX_BATTLE_SIMULATION_CONSTANTS.maxPhaseSeconds;
  const cycleDamage = meterPlan.cycleDamage;
  const benchmark = team.tank.bossBenchmark;
  const incomingDps =
    Math.max(
      0,
      executionPreset.useHostileBossMoveset
        ? benchmark?.hostileIncomingDps ?? benchmark?.incomingDps ?? 0
        : benchmark?.incomingDps ?? 0,
    ) * executionPreset.targetedDamageMultiplier;
  const incomingDamage = incomingDps * meterSeconds;
  const guardAbsorption =
    team.tank.maxGuardLevel > 0 ? team.tank.maxGuardHp : 0;
  const healing =
    team.healing.maxSpiritLevel > 0 ? team.healing.healPerAlly * size : 0;
  const netCycleDamage = Math.max(1, incomingDamage - guardAbsorption - healing);
  const partyHp =
    size * (team.damage.hp + team.tank.hp + team.healing.hp);
  const survivalCycles = partyHp / netCycleDamage;

  return {
    dps: cycleDamage / cycleSeconds,
    cycleSeconds,
    incomingDps,
    survivalSeconds: survivalCycles * cycleSeconds,
    supportActions,
    meterPlan,
  };
};

export const simulateMaxBattle = ({
  boss,
  bossHp,
  execution = 'standard',
  trainerCount,
  team,
  tier,
}: {
  boss: PokemonVariant;
  bossHp?: number;
  execution?: MaxBattleExecution;
  trainerCount: number;
  team: MaxBattleSimulationTeam;
  tier?: MaxBattleTier;
}): MaxBattleSimulationResult => {
  const preset = getMaxBattleBossPreset(boss, tier);
  const normalizedTrainerCount = Math.min(
    preset.maxTrainers,
    Math.max(1, Math.round(trainerCount)),
  );
  const normalizedBossHp = Math.max(
    1,
    Math.round(Number.isFinite(Number(bossHp)) ? Number(bossHp) : preset.bossHp),
  );
  const subgroups = getSubgroupSizes(
    normalizedTrainerCount,
    preset.subgroupSize,
  ).map((size) =>
    estimateSubgroup(size, team, boss, normalizedBossHp, preset, execution),
  );
  const lobbyDps = subgroups.reduce((total, group) => total + group.dps, 0);
  const estimatedClearSeconds = normalizedBossHp / Math.max(0.01, lobbyDps);
  const survivalSeconds = Math.max(
    0,
    ...subgroups.map((group) => group.survivalSeconds),
  );
  const limitingSeconds = Math.min(
    preset.battleSeconds,
    preset.enrageSeconds,
    survivalSeconds,
  );
  const damageBeforeLimit = Math.min(
    normalizedBossHp,
    lobbyDps * limitingSeconds,
  );
  const damagePercent = damageBeforeLimit / normalizedBossHp;
  const averageCycleSeconds =
    subgroups.reduce((total, group) => total + group.cycleSeconds, 0) /
    subgroups.length;
  const estimatedMaxPhases = Math.max(
    1,
    Math.ceil(
      Math.min(estimatedClearSeconds, limitingSeconds) /
        Math.max(1, averageCycleSeconds),
    ),
  );
  const clears = estimatedClearSeconds <= limitingSeconds;
  const outcome: MaxBattleSimulationOutcome = clears
    ? estimatedClearSeconds <= limitingSeconds * 0.85
      ? 'likely-clear'
      : 'close-call'
    : damagePercent >= 0.85
      ? 'close-call'
      : 'unlikely';

  return {
    outcome,
    execution,
    bossHp: normalizedBossHp,
    trainerCount: normalizedTrainerCount,
    subgroupCount: subgroups.length,
    lobbyDps,
    estimatedClearSeconds,
    survivalSeconds,
    limitingSeconds,
    damageBeforeLimit,
    damagePercent,
    estimatedMaxPhases,
    supportActionsPerGroup: Math.max(
      0,
      ...subgroups.map((group) => group.supportActions),
    ),
    incomingDps: Math.max(0, ...subgroups.map((group) => group.incomingDps)),
    limitedBySurvival:
      survivalSeconds < Math.min(preset.battleSeconds, preset.enrageSeconds),
    meterPlan: subgroups[0].meterPlan,
  };
};
