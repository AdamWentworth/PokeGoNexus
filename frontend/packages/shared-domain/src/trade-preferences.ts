export const TRADE_PREFERENCE_ENCOUNTER_RULE_KEYS = [
  'communityDayFilter',
  'researchDayFilter',
  'raidDayFilter',
  'legendaryMythicalUltraBeastRaidFilter',
  'megaRaidFilter',
  'permaboostedFilter',
] as const;

export const TRADE_PREFERENCE_QUALITY_RULE_KEYS = [
  'shinyIconFilter',
  'costumeIconFilter',
  'legendaryIconFilter',
  'regionalIconFilter',
  'locationIconFilter',
] as const;

export const TRADE_PREFERENCE_RULE_KEYS = [
  ...TRADE_PREFERENCE_ENCOUNTER_RULE_KEYS,
  ...TRADE_PREFERENCE_QUALITY_RULE_KEYS,
] as const;

export type TradePreferenceRuleKey = typeof TRADE_PREFERENCE_RULE_KEYS[number];
export type TradePreferenceContext = 'wanted-targets' | 'trade-offers';
export type TradePreferenceFilters = Partial<Record<TradePreferenceRuleKey, boolean>>;

export type TradePreferenceCandidate = {
  location_card?: unknown;
  rarity?: unknown;
  shiny_rarity?: unknown;
  variantType?: unknown;
};

export type TradePreferenceRuleGroups = {
  exclude: readonly TradePreferenceRuleKey[];
  require: readonly TradePreferenceRuleKey[];
};

const SHINY_ENCOUNTER_VARIANTS = new Set(['shiny', 'default']);
const LEGENDARY_RAID_RARITIES = new Set([
  'legendary_raid',
  'mythical_raid',
  'ultra_beast_raid',
]);

const normalizedText = (value: unknown): string => (
  typeof value === 'string' ? value.toLocaleLowerCase() : ''
);

export const resolveTradePreferenceRuleGroups = (
  context: TradePreferenceContext,
): TradePreferenceRuleGroups => context === 'wanted-targets'
  ? {
      exclude: TRADE_PREFERENCE_ENCOUNTER_RULE_KEYS,
      require: TRADE_PREFERENCE_QUALITY_RULE_KEYS,
    }
  : {
      exclude: TRADE_PREFERENCE_QUALITY_RULE_KEYS,
      require: TRADE_PREFERENCE_ENCOUNTER_RULE_KEYS,
    };

export const candidateMatchesTradePreferenceRule = (
  candidate: TradePreferenceCandidate,
  rule: TradePreferenceRuleKey,
): boolean => {
  const variantType = normalizedText(candidate.variantType);
  const rarity = normalizedText(candidate.rarity);
  const shinyRarity = normalizedText(candidate.shiny_rarity);
  const eligibleEncounterVariant = SHINY_ENCOUNTER_VARIANTS.has(variantType);

  switch (rule) {
    case 'communityDayFilter':
      return shinyRarity === 'community_day' && eligibleEncounterVariant;
    case 'researchDayFilter':
      return shinyRarity === 'research_day' && eligibleEncounterVariant;
    case 'raidDayFilter':
      return shinyRarity === 'raid_day' && eligibleEncounterVariant;
    case 'legendaryMythicalUltraBeastRaidFilter':
      return LEGENDARY_RAID_RARITIES.has(shinyRarity) && eligibleEncounterVariant;
    case 'megaRaidFilter':
      return shinyRarity === 'mega_raid' && eligibleEncounterVariant;
    case 'permaboostedFilter':
      return shinyRarity === 'permaboosted' && eligibleEncounterVariant;
    case 'shinyIconFilter':
      return variantType.includes('shiny');
    case 'costumeIconFilter':
      return variantType.includes('costume');
    case 'legendaryIconFilter':
      return rarity.includes('legendary') || rarity.includes('ultra beast');
    case 'regionalIconFilter':
      return rarity.includes('regional');
    case 'locationIconFilter':
      return candidate.location_card != null;
  }
};

export const filterTradePreferenceCandidates = <T extends TradePreferenceCandidate>(
  candidates: Record<string, T>,
  context: TradePreferenceContext,
  filters: TradePreferenceFilters,
): Record<string, T> => {
  const groups = resolveTradePreferenceRuleGroups(context);
  const activeExclude = groups.exclude.filter((rule) => filters[rule]);
  const activeRequire = groups.require.filter((rule) => filters[rule]);

  return Object.fromEntries(Object.entries(candidates).filter(([, candidate]) => {
    if (activeExclude.some((rule) => candidateMatchesTradePreferenceRule(candidate, rule))) {
      return false;
    }
    return activeRequire.length === 0
      || activeRequire.some((rule) => candidateMatchesTradePreferenceRule(candidate, rule));
  }));
};
