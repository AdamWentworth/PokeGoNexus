import {
  estimateRaidGroup,
  simulateRaidGroupAtTrainerCount,
  type RaidCounterScore,
  type RaidGroupEstimate,
} from '@pokemongonexus/app-core/raid-model';
import {
  applyRaidPartyTrainersToDrafts,
  buildRaidPartyTrainers,
  createRaidPartyTrainerDraft,
  getDefaultRaidPartyMemberIds,
  getRaidPartyScenarioKey,
  getRaidPartyScoreKey,
  type RaidPartyTrainerDraft,
} from '@pokemongonexus/app-core/raid-party';
import { optimizeRaidParty } from '@pokemongonexus/app-core/raid-party-optimizer';
import { simulateHeterogeneousRaidPartyAcrossBossMovesets } from '@pokemongonexus/app-core/raid-party-simulation';
import { variantUsesRaidMegaSlot } from '@pokemongonexus/app-core/raid-team-selection';
import type {
  RaidBattleSimulationResult,
  RaidPartyOptimizationResult,
  RaidPartySimulationResult,
  RaidTierPreset,
} from '@pokemongonexus/app-core/raid-types';
import { RAID_TIER_PRESETS, resolveRaidTierKey } from '@pokemongonexus/shared-domain/raid-rules';
import {
  DEFAULT_NATIVE_RAID_SETTINGS,
  canonicalNativeRaidSettings,
  type NativeCombatEntry,
  type NativeRaidBossEntry,
  type NativeRaidSettings,
} from './nativeBattleModels';

export type NativeRaidTier = RaidTierPreset;
export type NativeRaidGroupEstimate = RaidGroupEstimate;
export type NativeRaidPartyTrainerDraft = RaidPartyTrainerDraft;
export type NativeRaidPartyResult = RaidPartySimulationResult;
export type NativeRaidPartyOptimizationResult = RaidPartyOptimizationResult;
export type NativeRaidLobbyResult = RaidBattleSimulationResult;

const canonicalScores = (scores: NativeCombatEntry[]): RaidCounterScore[] => (
  scores.flatMap((score) => score.raidCounterScore ? [score.raidCounterScore] : [])
);

const resolvedSettings = (settings?: NativeRaidSettings) => (
  canonicalNativeRaidSettings(settings ?? DEFAULT_NATIVE_RAID_SETTINGS)
);

export const resolveNativeRaidTier = (boss: NativeRaidBossEntry | null): NativeRaidTier => {
  if (boss?.tier) return boss.tier;
  const tier = String(boss?.boss.tier || boss?.boss.type || '5');
  const context = [boss?.name, boss?.boss.form, boss?.boss.type].filter(Boolean).join(' ');
  return RAID_TIER_PRESETS[resolveRaidTierKey(tier, context)];
};

export const getNativeRaidScoreKey = (score: NativeCombatEntry): string => (
  score.raidCounterScore
    ? getRaidPartyScoreKey(score.raidCounterScore)
    : score.variantId ?? score.id
);

export const nativeRaidEntryUsesMegaSlot = (score: NativeCombatEntry): boolean => (
  Boolean(score.raidCounterScore && variantUsesRaidMegaSlot(score.raidCounterScore.variant))
);

export const getNativeRaidTeam = (scores: NativeCombatEntry[]): NativeCombatEntry[] => {
  const scoreByKey = new Map(scores.map((score) => [getNativeRaidScoreKey(score), score]));
  return getDefaultRaidPartyMemberIds(canonicalScores(scores))
    .flatMap((id) => scoreByKey.get(id) ?? []);
};

export const createNativeRaidPartyTrainer = (
  index: number,
  scores: NativeCombatEntry[],
  settings: NativeRaidSettings = DEFAULT_NATIVE_RAID_SETTINGS,
): NativeRaidPartyTrainerDraft => createRaidPartyTrainerDraft(
  index,
  canonicalScores(scores),
  resolvedSettings(settings),
);

export const createNativeRaidParty = (
  scores: NativeCombatEntry[],
  settings: NativeRaidSettings = DEFAULT_NATIVE_RAID_SETTINGS,
  trainerCount = 2,
): NativeRaidPartyTrainerDraft[] => Array.from(
  { length: Math.max(1, Math.min(20, trainerCount)) },
  (_, index) => createNativeRaidPartyTrainer(index, scores, settings),
);

type NativeRaidPartyRequest = {
  boss: NativeRaidBossEntry;
  drafts: NativeRaidPartyTrainerDraft[];
  scores: NativeCombatEntry[];
  settings: NativeRaidSettings;
  tier?: NativeRaidTier;
};

const buildCanonicalParty = ({ drafts, scores, settings }: NativeRaidPartyRequest) => {
  const raidScores = canonicalScores(scores);
  const trainers = buildRaidPartyTrainers(drafts, raidScores, resolvedSettings(settings));
  return { raidScores, trainers };
};

export const simulateNativeRaidParty = (
  request: NativeRaidPartyRequest,
): NativeRaidPartyResult | null => {
  const { trainers } = buildCanonicalParty(request);
  if (trainers.length !== request.drafts.length) return null;
  return simulateHeterogeneousRaidPartyAcrossBossMovesets({
    trainers,
    boss: request.boss.variant,
    tier: request.tier ?? resolveNativeRaidTier(request.boss),
  });
};

export const optimizeNativeRaidParty = (
  request: NativeRaidPartyRequest,
): NativeRaidPartyOptimizationResult | null => {
  const { raidScores, trainers } = buildCanonicalParty(request);
  if (trainers.length !== request.drafts.length) return null;
  return optimizeRaidParty({
    trainers,
    scores: raidScores.slice(0, 80),
    boss: request.boss.variant,
    tier: request.tier ?? resolveNativeRaidTier(request.boss),
  });
};

export const applyNativeRaidOptimization = (
  drafts: NativeRaidPartyTrainerDraft[],
  optimization: NativeRaidPartyOptimizationResult,
): NativeRaidPartyTrainerDraft[] => applyRaidPartyTrainersToDrafts(
  drafts,
  optimization.trainers,
);

export const getNativeRaidPartyScenarioKey = (
  request: NativeRaidPartyRequest,
): string | null => {
  const { trainers } = buildCanonicalParty(request);
  return trainers.length === request.drafts.length
    ? getRaidPartyScenarioKey(trainers)
    : null;
};

export const estimateNativeRaidGroup = (
  scores: NativeCombatEntry[],
  boss: NativeRaidBossEntry,
  settings: NativeRaidSettings,
  tier: NativeRaidTier = resolveNativeRaidTier(boss),
): NativeRaidGroupEstimate | null => {
  const raidScores = canonicalScores(scores);
  if (raidScores.length === 0) return null;
  return estimateRaidGroup(
    raidScores,
    boss.variant,
    tier,
    resolvedSettings(settings),
  );
};

export const simulateNativeRaidLobby = (
  scores: NativeCombatEntry[],
  boss: NativeRaidBossEntry,
  settings: NativeRaidSettings,
  trainerCount: number,
  tier: NativeRaidTier = resolveNativeRaidTier(boss),
): NativeRaidLobbyResult | null => simulateRaidGroupAtTrainerCount(
  canonicalScores(scores),
  boss.variant,
  tier,
  resolvedSettings(settings),
  trainerCount,
);
