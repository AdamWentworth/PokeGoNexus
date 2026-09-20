import {
  TRADE_PREFERENCE_ENCOUNTER_RULE_KEYS,
  TRADE_PREFERENCE_QUALITY_RULE_KEYS,
} from '@pokemongonexus/shared-domain/trade-preferences';

export const EXCLUDE_IMAGES_wanted = [
  '/images/community_day.png',
  '/images/field_research.png',
  '/images/raid_day.png',
  '/images/legendary_raid.png',
  '/images/mega_raid.png',
  '/images/permaboosted.png',
] as const;

export const INCLUDE_IMAGES_wanted = [
  '/images/shiny_icon.png',
  '/images/costume_icon.png',
  '/images/legendary.png',
  '/images/regional.png',
  '/images/location.png',
] as const;

export const EXCLUDE_IMAGES_trade = [
  '/images/shiny_icon.png',
  '/images/costume_icon.png',
  '/images/legendary.png',
  '/images/regional.png',
  '/images/location.png',
] as const;

export const INCLUDE_IMAGES_trade = [
  '/images/community_day.png',
  '/images/field_research.png',
  '/images/raid_day.png',
  '/images/legendary_raid.png',
  '/images/mega_raid.png',
  '/images/permaboosted.png',
] as const;

export const FILTER_NAMES = [
  ...TRADE_PREFERENCE_ENCOUNTER_RULE_KEYS,
  ...TRADE_PREFERENCE_QUALITY_RULE_KEYS,
] as const;

export const FILTER_NAMES_TRADE = [
  ...TRADE_PREFERENCE_QUALITY_RULE_KEYS,
  ...TRADE_PREFERENCE_ENCOUNTER_RULE_KEYS,
] as const;
