export type RaidTierKey =
  | 'tier1'
  | 'tier3'
  | 'community-day'
  | 'mega'
  | 'legendary'
  | 'elite'
  | 'primal'
  | 'legendary-mega'
  | 'super-mega'
  | 'shadow-tier1'
  | 'shadow-tier3'
  | 'shadow-legendary';

export type RaidFriendshipKey = 'none' | 'good' | 'great' | 'ultra' | 'best';
export type RaidMegaAllyBonusKey = 'none' | 'general' | 'matching';
export type RaidPartyPowerKey = 'none' | 'party2' | 'party3' | 'party4';

export type RaidTierPreset = {
  bossHp: number;
  bossStatMultiplier: number;
  key: RaidTierKey;
  label: string;
  note: string;
  shortLabel: string;
  timeLimitSeconds: number;
};

export const RAID_TIER_PRESETS: Record<RaidTierKey, RaidTierPreset> = {
  tier1: {
    bossHp: 600,
    bossStatMultiplier: .5974,
    key: 'tier1',
    label: 'One-star Raid',
    note: 'Low HP Gym raid, usually soloable.',
    shortLabel: '1-star',
    timeLimitSeconds: 180,
  },
  tier3: {
    bossHp: 3600,
    bossStatMultiplier: .73,
    key: 'tier3',
    label: 'Three-star Raid',
    note: 'Mid-tier Gym raid with the post-2020 reward tier.',
    shortLabel: '3-star',
    timeLimitSeconds: 180,
  },
  'community-day': {
    bossHp: 9000,
    bossStatMultiplier: .79,
    key: 'community-day',
    label: 'Community Day Raid',
    note: 'Local-only post-Community-Day style raid.',
    shortLabel: '4-star',
    timeLimitSeconds: 180,
  },
  mega: {
    bossHp: 9000,
    bossStatMultiplier: .79,
    key: 'mega',
    label: 'Mega Raid',
    note: 'Standard Mega raid awarding Mega Energy by speed.',
    shortLabel: 'Mega',
    timeLimitSeconds: 300,
  },
  legendary: {
    bossHp: 15000,
    bossStatMultiplier: .79,
    key: 'legendary',
    label: 'Legendary Raid',
    note: 'Normal five-star Legendary, Ultra Beast, or Fusion raid baseline.',
    shortLabel: '5-star',
    timeLimitSeconds: 300,
  },
  elite: {
    bossHp: 20000,
    bossStatMultiplier: .79,
    key: 'elite',
    label: 'Elite Raid',
    note: 'Local-only Elite raid durability.',
    shortLabel: 'Elite',
    timeLimitSeconds: 300,
  },
  primal: {
    bossHp: 22500,
    bossStatMultiplier: .79,
    key: 'primal',
    label: 'Primal Raid',
    note: 'Primal Groudon and Primal Kyogre durability.',
    shortLabel: 'Primal',
    timeLimitSeconds: 300,
  },
  'legendary-mega': {
    bossHp: 22500,
    bossStatMultiplier: .79,
    key: 'legendary-mega',
    label: 'Mega Legendary Raid',
    note: 'Legendary or Mythical Mega raid durability.',
    shortLabel: 'Mega Legendary',
    timeLimitSeconds: 300,
  },
  'super-mega': {
    bossHp: 25000,
    bossStatMultiplier: .79,
    key: 'super-mega',
    label: 'Super Mega Raid',
    note: 'Enrages mid-battle; each Trainer needs a Mega charged attack to break one shield.',
    shortLabel: 'Super Mega',
    timeLimitSeconds: 300,
  },
  'shadow-tier1': {
    bossHp: 600,
    bossStatMultiplier: .5974,
    key: 'shadow-tier1',
    label: 'Shadow One-star Raid',
    note: 'Team GO Rocket one-star Shadow raid with enrage and Purified Gem mechanics.',
    shortLabel: 'Shadow 1-star',
    timeLimitSeconds: 180,
  },
  'shadow-tier3': {
    bossHp: 3600,
    bossStatMultiplier: .73,
    key: 'shadow-tier3',
    label: 'Shadow Three-star Raid',
    note: 'Team GO Rocket three-star Shadow raid with enrage and Purified Gem mechanics.',
    shortLabel: 'Shadow 3-star',
    timeLimitSeconds: 180,
  },
  'shadow-legendary': {
    bossHp: 15000,
    bossStatMultiplier: .79,
    key: 'shadow-legendary',
    label: 'Shadow Legendary Raid',
    note: 'Five-star Shadow Legendary raid with enrage and Purified Gem mechanics.',
    shortLabel: 'Shadow 5-star',
    timeLimitSeconds: 300,
  },
};

export const RAID_ATTACKER_TEAM_SIZE = 6;
export const RAID_PARTY_MAX_TRAINERS = 20;
export const RAID_PARTY_OPTIMIZER_MAX_EVALUATIONS = 160;
export const RAID_PARTY_OPTIMIZER_MAX_TEAM_OPTIONS = 12;
export const RAID_PARTY_OPTIMIZER_MAX_BEAM_WIDTH = 6;
export const DEFAULT_RAID_RELOBBY_SECONDS = 10;
export const RAID_SAFETY_FACTOR = .82;
export const COMFORTABLE_SAFETY_FACTOR = .68;
export const RAID_DODGE_DAMAGE_MULTIPLIER = .25;
export const RAID_SIMULATION_DODGE_SECONDS = .5;
export const RAID_BOSS_ACTION_DELAY_SECONDS = 1.75;
export const RAID_SIMULATION_BOSS_ACTION_DELAY_SECONDS = 2;
export const RAID_SIMULATION_ATTACKER_SWAP_SECONDS = 1;
export const RAID_SIMULATION_ENERGY_CAP = 100;
export const RAID_SIMULATION_BOSS_DELAY_OPTIONS_SECONDS = [1.5, 2, 2.5] as const;
export const RAID_SIMULATION_MODEL_VERSION = 13;
export const RAID_MONTE_CARLO_MIN_SAMPLES = 32;
export const RAID_MONTE_CARLO_MAX_SAMPLES = 64;
export const RAID_COUNTER_SIMULATION_VARIANT_LIMIT = 384;
export const PARTY_POWER_METER_MAX = 18;
export const PARTY_POWER_ACTIVATION_DELAY_SECONDS = 1;
export const PARTY_POWER_ACTIVE_CHARGED_MULTIPLIER = 2;
export const SHADOW_ATTACKER_DAMAGE_BONUS = 1.2;
export const SHADOW_ATTACKER_DEFENSE_MULTIPLIER = .8333333;
export const WEATHER_DAMAGE_BONUS = 1.2;
export const STAB_DAMAGE_BONUS = 1.2;
export const SHADOW_BOSS_ENRAGED_ATTACK_MULTIPLIER = 1.81;
export const SHADOW_BOSS_ENRAGED_DEFENSE_MULTIPLIER = 3;
export const TYPE_DPS_TARGET_DEFENSE = 180;
export const TYPE_DPS_INCOMING_DAMAGE_NUMERATOR = 1340;
export const TYPE_DPS_INCOMING_CHARGED_DAMAGE_NUMERATOR = 11670;
export const TYPE_DPS_ER_TDO_EXPONENT = .25;

export const FRIENDSHIP_DAMAGE_BONUS: Record<RaidFriendshipKey, number> = {
  none: 1,
  good: 1.03,
  great: 1.05,
  ultra: 1.07,
  best: 1.1,
};

export const MEGA_ALLY_DAMAGE_BONUS: Record<RaidMegaAllyBonusKey, number> = {
  none: 1,
  general: 1.1,
  matching: 1.3,
};

export const PARTY_POWER_CHARGED_DAMAGE_BONUS: Record<RaidPartyPowerKey, number> = {
  none: 1,
  party2: 1.18,
  party3: 1.35,
  party4: 1.5,
};

export const PARTY_POWER_GROUP_SIZE: Record<RaidPartyPowerKey, number> = {
  none: 1,
  party2: 2,
  party3: 3,
  party4: 4,
};

export const PARTY_POWER_POINTS_PER_MOVE: Record<RaidPartyPowerKey, number> = {
  none: 0,
  party2: 1,
  party3: 2,
  party4: 3,
};

const normalizeTier = (value: string): string => value
  .trim()
  .toLocaleLowerCase()
  .replace(/[\s-]+/g, '_');

export const resolveRaidTierKey = (
  value: string,
  context = '',
): RaidTierKey => {
  const tier = normalizeTier(value);
  const description = normalizeTier(`${value} ${context}`);
  if (tier === 'shadow_1' || description.includes('shadow_one_star')) return 'shadow-tier1';
  if (tier === 'shadow_3' || description.includes('shadow_three_star')) return 'shadow-tier3';
  if (tier === 'shadow_5' || description.includes('shadow_legend')) return 'shadow-legendary';
  if (tier === 'fusion_5') return 'legendary';
  if (tier === 'super_mega' || description.includes('super_mega')) return 'super-mega';
  if (tier === 'mega_legendary') return description.includes('primal') ? 'primal' : 'legendary-mega';
  if (description.includes('primal')) return 'primal';
  if (tier === 'mega' || description.includes('mega_raid')) return 'mega';
  if (tier === 'ex' || description.includes('elite')) return 'elite';
  if (tier === '6' || tier === '5' || description.includes('legendary') || description.includes('five_star')) return 'legendary';
  if (tier === '4' || description.includes('community_day') || description.includes('four_star')) return 'community-day';
  if (tier === '3' || description.includes('three_star')) return 'tier3';
  return 'tier1';
};

export const isShadowRaidTier = (tier: RaidTierKey): boolean => (
  tier === 'shadow-tier1'
  || tier === 'shadow-tier3'
  || tier === 'shadow-legendary'
);
