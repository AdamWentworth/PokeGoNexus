import type { PokemonVariant } from "../../../types/pokemonVariants";
import type { Move } from "../../../types/pokemonSubTypes";
import { cpMultipliers } from "./constants";

export type RaidTierKey =
  | "tier1"
  | "tier3"
  | "community-day"
  | "mega"
  | "legendary"
  | "elite"
  | "primal"
  | "legendary-mega"
  | "super-mega"
  | "shadow-tier1"
  | "shadow-tier3"
  | "shadow-legendary";

export type FriendshipKey = "none" | "good" | "great" | "ultra" | "best";
export type MegaAllyBonusKey = "none" | "general" | "matching";
export type PartyPowerKey = "none" | "party2" | "party3" | "party4";
export type PartyPowerStrategy =
  "immediate" | "next-charged" | "strongest-charged" | "manual";
export type RaidDodgeStrategy = "none" | "charged";
export type ShadowBossMode = "normal" | "enraged" | "subdued";
export type RaidBossMovesetMode =
  "expected" | "monte-carlo" | "favorable" | "hostile";

export type RaidSimulationPercentiles = {
  p10: number;
  p50: number;
  p90: number;
};

export type RaidSimulationDistribution = {
  sampleCount: number;
  winRate: number;
  timeToWinSeconds: RaidSimulationPercentiles;
  faints: RaidSimulationPercentiles;
  relobbies: RaidSimulationPercentiles;
};

export type SuperMegaShieldCountSource = "catalog" | "curated" | "fallback";

export type SuperMegaShieldRules = {
  shieldCount: number;
  shieldCountSource: SuperMegaShieldCountSource;
  triggerHpFraction: number;
  shieldedDefenseMultiplier: number;
  enragedAttackMultiplier: number;
};

export type SuperMegaSimulationResult = {
  shieldCount: number;
  shieldsBroken: number;
  eligibleMegaTrainers: number;
  triggerHpFraction: number;
  shieldCountSource: SuperMegaShieldCountSource;
  shieldCleared: boolean;
};

export type RaidTierPreset = {
  key: RaidTierKey;
  label: string;
  shortLabel: string;
  bossHp: number;
  bossStatMultiplier: number;
  timeLimitSeconds: number;
  note: string;
};

export type RaidCounterSettings = {
  attackerLevel: keyof typeof cpMultipliers;
  friendship: FriendshipKey;
  megaAllyBonus: MegaAllyBonusKey;
  partyPower: PartyPowerKey;
  partyPowerStrategy?: PartyPowerStrategy;
  dodgeStrategy: RaidDodgeStrategy;
  weatherBoostedType: string;
  shadowBossMode: ShadowBossMode;
  bossMovesetMode: RaidBossMovesetMode;
  relobbySeconds: number;
  dodgeSuccessRate?: number;
};

export type RaidSimulationTeamMember = {
  attacker: PokemonVariant;
  fastMove: Move;
  chargedMove: Move;
};

export type RaidPartyTrainer = {
  id: string;
  label: string;
  team: RaidSimulationTeamMember[];
  settings: RaidCounterSettings;
  actionDelaySeconds: number;
};

export type RaidPartyTrainerResult = {
  id: string;
  label: string;
  damageDealt: number;
  damageShare: number;
  dps: number;
  faints: number;
  relobbies: number;
  dodges: number;
  attackerChargedMoves: number;
  partyPoweredChargedMoves: number;
};

export type RaidBossStats = {
  bossCp: number;
  attack: number;
  defense: number;
  hp: number;
  timeLimitSeconds: number;
};

export type RaidCounterScore = {
  variant: PokemonVariant;
  fastMove: Move;
  chargedMove: Move;
  cp: number;
  sustainedDps: number;
  dps: number;
  fastDamage: number;
  chargedDamage: number;
  cycleSeconds: number;
  cycleDamage: number;
  effectiveness: number;
  soloTimeSeconds: number;
  trainersNeeded: number;
  faints: number;
  relobbies: number;
  attackerChargedMoves: number;
  bossChargedMoves: number;
  dodges: number;
  partyPoweredChargedMoves: number;
  simulationWon: boolean;
  simulationDistribution: RaidSimulationDistribution | null;
};

export type RaidBattleSimulationResult = {
  damageDealt: number;
  elapsedSeconds: number;
  dps: number;
  projectedTimeToWinSeconds: number;
  faints: number;
  relobbies: number;
  attackerChargedMoves: number;
  bossChargedMoves: number;
  dodges: number;
  partyPoweredChargedMoves: number;
  won: boolean;
  distribution: RaidSimulationDistribution;
  superMega?: SuperMegaSimulationResult;
};

export type RaidPartySimulationResult = RaidBattleSimulationResult & {
  trainers: RaidPartyTrainerResult[];
};

export type RaidPartyOptimizationResult = {
  trainers: RaidPartyTrainer[];
  result: RaidPartySimulationResult;
  baselineResult: RaidPartySimulationResult;
  evaluatedLineups: number;
  changedTrainerCount: number;
  timeSavedSeconds: number;
  faintReduction: number;
  relobbyReduction: number;
  searchStrategy: "bounded-beam";
  beamWidth: number;
  trainerChanges: Array<{
    trainerId: string;
    label: string;
    reasons: string[];
  }>;
};

export type RaidTypeDpsScore = {
  variant: PokemonVariant;
  fastMove: Move;
  chargedMove: Move;
  cp: number;
  totalDps: number;
  eDps: number;
  dps: number;
  tdo: number;
  er: number;
  fastDamage: number;
  chargedDamage: number;
  fastEffectiveness: number;
  chargedEffectiveness: number;
  cycleSeconds: number;
  cycleDamage: number;
  targetEffectiveness: number;
  fastMatchesType: boolean;
  chargedMatchesType: boolean;
};

export type RaidOverallScore = {
  variant: PokemonVariant;
  fastMove: Move;
  chargedMove: Move;
  cp: number;
  eDps: number;
  dps: number;
  tdo: number;
  er: number;
  fastDamage: number;
  chargedDamage: number;
  cycleSeconds: number;
  cycleDamage: number;
};

export type RaidOverallTargetProfile = {
  types: string[];
  weight: number;
  target?: PokemonVariant;
};

export type RaidNeutralBenchmark = {
  targetDefense: number;
  incomingDamageNumerator: number;
  incomingChargedDamageNumerator: number;
};

export type RaidGroupEstimate = {
  topTeamDps: number;
  minTrainers: number;
  comfortableTrainers: number;
  soloTimeSeconds: number;
  superMega?: {
    shieldCount: number;
    shieldCountSource: SuperMegaShieldCountSource;
    assumesMegaPerTrainer: boolean;
  };
};
