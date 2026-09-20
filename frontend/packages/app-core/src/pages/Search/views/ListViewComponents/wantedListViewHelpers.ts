import type { WantedSizePreferences } from '@/types/pokemonInstance';

export type WantedTradeEntry = {
  dynamax?: boolean;
  gigantamax?: boolean;
  match?: boolean;
  form?: string;
  name?: string;
  [key: string]: unknown;
};

export type WantedListItem = {
  username?: string;
  instance_id?: string;
  distance?: number;
  latitude?: number;
  longitude?: number;
  cp?: number | null;
  pref_lucky?: boolean;
  dynamax?: boolean;
  gigantamax?: boolean;
  gender?: string;
  friendship_level?: number | null;
  weight?: number | null;
  height?: number | null;
  wanted_size_preferences?: WantedSizePreferences | null;
  fast_move_id?: number | null;
  charged_move1_id?: number | null;
  charged_move2_id?: number | null;
  location_caught?: string;
  date_caught?: string;
  pokemonInfo?: {
    name?: string;
    moves?: Array<{
      move_id: number;
      name: string;
      type: string;
      type_name: string;
      legacy?: boolean;
    }> | null;
    [key: string]: unknown;
  };
  trade_list?: Record<string, WantedTradeEntry> | null;
  [key: string]: unknown;
};

export type MatchedPokemon = {
  currentImage?: string;
  name?: string;
  form?: string | null;
};

type WantedGender = 'Male' | 'Female' | 'Both' | 'Any' | 'Genderless';

const allowedGenders: WantedGender[] = [
  'Male',
  'Female',
  'Both',
  'Any',
  'Genderless',
];

export const toWantedGender = (gender?: string): WantedGender | null =>
  gender && allowedGenders.includes(gender as WantedGender)
    ? (gender as WantedGender)
    : null;

export const formatDateOnlySafe = (
  dateString?: string | null,
  fallback = 'Unknown',
): string => {
  if (!dateString) return fallback;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toISOString().slice(0, 10);
};

export const formatWantedDate = (dateString?: string): string => {
  return formatDateOnlySafe(dateString, 'Unknown');
};

export const hasWantedAdditionalDetails = (item: WantedListItem): boolean =>
  Boolean(
    item.friendship_level ||
      item.pref_lucky ||
      item.weight ||
      item.height ||
      item.wanted_size_preferences?.weight ||
      item.wanted_size_preferences?.height ||
      item.fast_move_id ||
      item.charged_move1_id ||
      item.charged_move2_id ||
      item.location_caught ||
      item.date_caught,
  );

export const getWantedTradeEntries = (
  tradeList: WantedListItem['trade_list'],
): Array<[string, WantedTradeEntry]> => Object.entries(tradeList ?? {});
