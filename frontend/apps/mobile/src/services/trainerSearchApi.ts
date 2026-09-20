import type { TrainerAutocompleteEntry } from '@pokemongonexus/shared-contracts/users';
import { usersContract } from '@pokemongonexus/shared-contracts/users';
import type { NativeUsersApiClient } from './nativeApiClients';

type TrainerSearchClient = Pick<NativeUsersApiClient, 'get'>;

const isTrainerEntry = (value: unknown): value is TrainerAutocompleteEntry => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.username === 'string' && entry.username.trim().length > 0;
};

export const normalizeTrainerSearchQuery = (query: string): string => query.trim();

export const searchNativeTrainers = async (
  usersClient: TrainerSearchClient,
  query: string,
): Promise<TrainerAutocompleteEntry[]> => {
  const normalized = normalizeTrainerSearchQuery(query);
  if (normalized.length < 2) return [];

  const payload = await usersClient.get<unknown>(
    usersContract.endpoints.autocompleteTrainers(normalized),
  );
  if (!Array.isArray(payload) || payload.some((entry) => !isTrainerEntry(entry))) {
    throw new Error('The trainer search response is invalid.');
  }

  const seen = new Set<string>();
  return payload.filter((entry) => {
    const key = entry.username.trim().toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
