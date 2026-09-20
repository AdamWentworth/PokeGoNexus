import type { MobileSessionUser } from '@pokemongonexus/shared-contracts/auth';
import {
  TRAINER_TITLE_OPTIONS,
  type TrainerProfile,
  type TrainerTitle,
  type UpdateTrainerProfileRequest,
} from '@pokemongonexus/shared-contracts/users';
import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';

const validTitleIds = new Set<string>(TRAINER_TITLE_OPTIONS.map(({ id }) => id));
const validTeams = new Set(['', 'Mystic', 'Valor', 'Instinct']);
const calendarDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export type NativeTrainerProfileDraft = {
  trainerTitles: TrainerTitle[];
  pokemonGoName: string;
  trainerCode: string;
  team: string;
  trainerLevel: string;
  totalXp: string;
  startedOn: string;
  location: string;
  highlightInstanceIds: string[];
};

export type NativeTrainerProfileSavePlan = {
  authUpdate: {
    pokemonGoName: string | null;
    trainerCode: string | null;
    location: string | null;
  } | null;
  profileUpdate: UpdateTrainerProfileRequest;
};

export class NativeTrainerProfileValidationError extends Error {
  readonly field: keyof NativeTrainerProfileDraft;

  constructor(field: keyof NativeTrainerProfileDraft, message: string) {
    super(message);
    this.name = 'NativeTrainerProfileValidationError';
    this.field = field;
  }
}

const fail = (
  field: keyof NativeTrainerProfileDraft,
  message: string,
): never => {
  throw new NativeTrainerProfileValidationError(field, message);
};

const normalizeOptionalInteger = (
  value: string,
  field: 'trainerLevel' | 'totalXp',
  label: string,
): number | undefined => {
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (!/^\d+$/.test(normalized)) fail(field, `${label} must be a whole number.`);
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed)) fail(field, `${label} is too large.`);
  return parsed;
};

const isRealCalendarDate = (value: string): boolean => {
  if (!calendarDatePattern.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year
    && candidate.getUTCMonth() === month - 1
    && candidate.getUTCDate() === day;
};

export const createNativeTrainerProfileDraft = (
  profile: TrainerProfile<PokemonInstance>,
): NativeTrainerProfileDraft => ({
  trainerTitles: [...profile.trainer_titles],
  pokemonGoName: profile.user.pokemonGoName ?? '',
  trainerCode: profile.trainer_code ?? '',
  team: profile.user.team ?? '',
  trainerLevel: profile.user.trainer_level?.toString() ?? '',
  totalXp: profile.user.total_xp?.toString() ?? '',
  startedOn: profile.user.pogo_started_on?.slice(0, 10) ?? '',
  location: profile.location ?? '',
  highlightInstanceIds: profile.highlights.flatMap((entry) => (
    entry.instance_id ? [entry.instance_id] : []
  )).slice(0, 6),
});

export const buildNativeTrainerProfileSavePlan = (
  draft: NativeTrainerProfileDraft,
  sessionUser: MobileSessionUser,
): NativeTrainerProfileSavePlan => {
  const pokemonGoName = draft.pokemonGoName.trim();
  if (pokemonGoName && (pokemonGoName.length < 3 || pokemonGoName.length > 64)) {
    fail('pokemonGoName', 'Pokémon GO name must be between 3 and 64 characters.');
  }

  const trainerCode = draft.trainerCode.replace(/\s+/g, '');
  if (trainerCode && !/^\d{12}$/.test(trainerCode)) {
    fail('trainerCode', 'Trainer code must contain exactly 12 digits.');
  }

  const location = draft.location.trim();
  if (location.length > 255) fail('location', 'Location must be 255 characters or fewer.');

  const team = draft.team.trim();
  if (!validTeams.has(team)) fail('team', 'Choose a valid team.');

  const trainerLevel = normalizeOptionalInteger(
    draft.trainerLevel,
    'trainerLevel',
    'Trainer level',
  );
  if (trainerLevel !== undefined && (trainerLevel < 1 || trainerLevel > 80)) {
    fail('trainerLevel', 'Trainer level must be between 1 and 80.');
  }

  const totalXp = normalizeOptionalInteger(draft.totalXp, 'totalXp', 'Total XP');

  const startedOn = draft.startedOn.trim();
  if (startedOn && !isRealCalendarDate(startedOn)) {
    fail('startedOn', 'Started playing must be a valid date.');
  }

  if (draft.trainerTitles.length > 3) {
    fail('trainerTitles', 'Choose up to three trainer titles.');
  }
  const uniqueTitles = new Set(draft.trainerTitles);
  if (uniqueTitles.size !== draft.trainerTitles.length
      || draft.trainerTitles.some((title) => !validTitleIds.has(title))) {
    fail('trainerTitles', 'Choose up to three valid, unique trainer titles.');
  }

  const highlightInstanceIds = draft.highlightInstanceIds
    .map((id) => id.trim())
    .filter(Boolean);
  if (highlightInstanceIds.length > 6
      || new Set(highlightInstanceIds).size !== highlightInstanceIds.length) {
    fail('highlightInstanceIds', 'Choose up to six unique profile highlights.');
  }

  const normalizedIdentity = {
    pokemonGoName: pokemonGoName || null,
    trainerCode: trainerCode || null,
    location: location || null,
  };
  const currentIdentity = {
    pokemonGoName: sessionUser.pokemonGoName?.trim() || null,
    trainerCode: sessionUser.trainerCode?.replace(/\s+/g, '') || null,
    location: sessionUser.location?.trim() || null,
  };
  const authChanged = normalizedIdentity.pokemonGoName !== currentIdentity.pokemonGoName
    || normalizedIdentity.trainerCode !== currentIdentity.trainerCode
    || normalizedIdentity.location !== currentIdentity.location;

  return {
    authUpdate: authChanged ? normalizedIdentity : null,
    profileUpdate: {
      trainer_titles: [...draft.trainerTitles],
      pokemonGoName,
      trainer_code: trainerCode,
      team,
      location,
      trainer_level: trainerLevel,
      total_xp: totalXp,
      pogo_started_on: startedOn || undefined,
      highlight_instance_ids: highlightInstanceIds,
    },
  };
};
