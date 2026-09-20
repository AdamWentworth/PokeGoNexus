import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import {
  TRAINER_TITLE_OPTIONS,
  type TrainerProfile,
  type TrainerTitle,
} from '@pokemongonexus/shared-contracts/users';
import { normalizeNativeTrainerTeam, type NativeTrainerTeam } from '../search/trainerSearchModel';

const titleById = new Map(TRAINER_TITLE_OPTIONS.map((option) => [option.id, option]));

const formatNumber = (value?: number | null): string => (
  typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-US') : 'Not shared'
);

const formatDate = (value?: string | null, calendarDate = false): string => {
  if (!value) return 'Not shared';
  // The API can serialize the start date as midnight UTC. It is a calendar
  // date, so preserve its date portion instead of shifting it to device time.
  const dateValue = calendarDate ? /^\d{4}-\d{2}-\d{2}/.exec(value)?.[0] ?? value : value;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'Not shared';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: /^\d{4}-\d{2}-\d{2}$/.test(dateValue) ? 'UTC' : undefined,
  }).format(date);
};

const formatTrainerCode = (value?: string | null): string => {
  const digits = value?.replace(/\D/g, '') ?? '';
  return digits ? digits.replace(/(\d{4})(?=\d)/g, '$1 ') : 'Not shared';
};

export type NativeTrainerTitleRow = {
  id: TrainerTitle;
  label: string;
  description: string;
};

export type NativeTrainerProfileModel = {
  userId: string;
  username: string;
  pokemonGoName: string;
  avatarLabel: string;
  team: NativeTrainerTeam;
  teamLabel: string;
  trainerLevel: number | null;
  totalXpLabel: string;
  memberSinceLabel: string;
  startedLabel: string;
  locationLabel: string;
  trainerCodeLabel: string;
  titles: NativeTrainerTitleRow[];
  highlights: PokemonInstance[];
  stats: { key: 'registered' | 'caught' | 'trade' | 'wanted' | 'favorites'; label: string; value: number }[];
  relationship: TrainerProfile<PokemonInstance>['viewer']['relationship'];
  friendshipId: string | null;
  canViewCollection: boolean;
};

export const buildNativeTrainerProfileModel = (
  profile: TrainerProfile<PokemonInstance>,
): NativeTrainerProfileModel => {
  const team = normalizeNativeTrainerTeam(profile.user.team);
  const rawTeam = profile.user.team?.trim().replace(/^team\s+/i, '');
  return {
    userId: profile.user.user_id,
    username: profile.user.username.trim(),
    pokemonGoName: profile.user.pokemonGoName?.trim() || profile.user.username.trim(),
    avatarLabel: profile.user.username.trim().slice(0, 1).toLocaleUpperCase() || '?',
    team,
    teamLabel: rawTeam ? `Team ${rawTeam}` : 'Unaffiliated',
    trainerLevel: typeof profile.user.trainer_level === 'number'
      && Number.isFinite(profile.user.trainer_level)
      ? profile.user.trainer_level
      : null,
    totalXpLabel: typeof profile.user.total_xp === 'number'
      ? `${formatNumber(profile.user.total_xp)} XP`
      : 'XP not shared',
    memberSinceLabel: formatDate(profile.user.app_joined_at),
    startedLabel: formatDate(profile.user.pogo_started_on, true),
    locationLabel: profile.location?.trim() || 'Not shared',
    trainerCodeLabel: formatTrainerCode(profile.trainer_code),
    titles: profile.trainer_titles.flatMap((title) => {
      const option = titleById.get(title);
      return option ? [{ id: title, label: option.label, description: option.description }] : [];
    }),
    highlights: profile.highlights.slice(0, 6),
    stats: [
      { key: 'registered', label: 'Registered', value: profile.stats.registered },
      { key: 'caught', label: 'Caught', value: profile.stats.caught },
      { key: 'trade', label: 'For trade', value: profile.stats.for_trade },
      { key: 'wanted', label: 'Wanted', value: profile.stats.wanted },
      { key: 'favorites', label: 'Favorites', value: profile.stats.favorites },
    ],
    relationship: profile.viewer.relationship,
    friendshipId: profile.viewer.friendship_id ?? null,
    canViewCollection: profile.viewer.can_view_collection,
  };
};
