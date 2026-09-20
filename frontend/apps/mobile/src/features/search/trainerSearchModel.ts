import type { TrainerAutocompleteEntry } from '@pokemongonexus/shared-contracts/users';

export type NativeTrainerTeam = 'instinct' | 'mystic' | 'valor' | 'neutral';

export type NativeTrainerSearchRow = {
  username: string;
  pokemonGoName: string | null;
  team: NativeTrainerTeam;
  teamLabel: string | null;
  trainerLevel: number | null;
  avatarLabel: string;
};

export const normalizeNativeTrainerTeam = (
  team?: string | null,
): NativeTrainerTeam => {
  const normalized = team?.trim().toLocaleLowerCase().replace(/^team\s+/, '');
  return normalized === 'instinct' || normalized === 'mystic' || normalized === 'valor'
    ? normalized
    : 'neutral';
};

export const buildNativeTrainerSearchRows = (
  entries: TrainerAutocompleteEntry[],
): NativeTrainerSearchRow[] => entries.map((entry) => {
  const rawTeam = entry.team?.trim().replace(/^team\s+/i, '') ?? '';
  const pokemonGoName = entry.pokemonGoName?.trim() || null;
  const trainerLevel = typeof entry.trainer_level === 'number'
    && Number.isFinite(entry.trainer_level)
    && entry.trainer_level > 0
    ? entry.trainer_level
    : null;
  return {
    username: entry.username.trim(),
    pokemonGoName,
    team: normalizeNativeTrainerTeam(entry.team),
    teamLabel: rawTeam ? `Team ${rawTeam}` : null,
    trainerLevel,
    avatarLabel: entry.username.trim().slice(0, 1).toLocaleUpperCase() || '?',
  };
});
