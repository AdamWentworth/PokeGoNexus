import { describe, expect, it } from 'vitest';
import {
  candidateMatchesTradePreferenceRule,
  filterTradePreferenceCandidates,
  resolveTradePreferenceRuleGroups,
} from '@pokemongonexus/shared-domain/trade-preferences';

const candidates = {
  communityShiny: {
    variantType: 'shiny',
    shiny_rarity: 'community_day',
    rarity: 'normal',
    location_card: null,
  },
  legendaryCostume: {
    variantType: 'shiny costume',
    shiny_rarity: 'full_odds',
    rarity: 'legendary',
    location_card: 'seattle',
  },
  regional: {
    variantType: 'default',
    shiny_rarity: 'full_odds',
    rarity: 'regional',
    location_card: null,
  },
};

describe('shared trade preference rules', () => {
  it('keeps the mirrored rule groups distinct for desired returns and offers', () => {
    expect(resolveTradePreferenceRuleGroups('wanted-targets')).toMatchObject({
      exclude: expect.arrayContaining(['communityDayFilter']),
      require: expect.arrayContaining(['shinyIconFilter']),
    });
    expect(resolveTradePreferenceRuleGroups('trade-offers')).toMatchObject({
      exclude: expect.arrayContaining(['shinyIconFilter']),
      require: expect.arrayContaining(['communityDayFilter']),
    });
  });

  it('uses union semantics within required rules after exclusions', () => {
    expect(Object.keys(filterTradePreferenceCandidates(
      candidates,
      'wanted-targets',
      {
        communityDayFilter: true,
        legendaryIconFilter: true,
        regionalIconFilter: true,
      },
    ))).toEqual(['legendaryCostume', 'regional']);
  });

  it('applies the inverse groups to candidates offered for a wanted entry', () => {
    expect(Object.keys(filterTradePreferenceCandidates(
      candidates,
      'trade-offers',
      {
        locationIconFilter: true,
        communityDayFilter: true,
      },
    ))).toEqual(['communityShiny']);
  });

  it('normalizes variant and rarity text without weakening encounter rules', () => {
    expect(candidateMatchesTradePreferenceRule(
      { variantType: 'SHINY', rarity: 'Ultra Beast' },
      'legendaryIconFilter',
    )).toBe(true);
    expect(candidateMatchesTradePreferenceRule(
      { variantType: 'shiny costume', shiny_rarity: 'community_day' },
      'communityDayFilter',
    )).toBe(false);
  });
});
