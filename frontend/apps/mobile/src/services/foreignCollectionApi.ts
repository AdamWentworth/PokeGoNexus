import { ApiClientError } from '@pokemongonexus/shared-api-client';
import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import {
  pokemonContract,
  type BasePokemon,
} from '@pokemongonexus/shared-contracts/pokemon';
import {
  usersContract,
  type UserInstancesEnvelope,
} from '@pokemongonexus/shared-contracts/users';
import { normalizeNativeInstances } from '../features/collection/nativeInstanceNormalization';
import type {
  NativePokemonApiClient,
  NativeUsersApiClient,
} from './nativeApiClients';

export type NativeForeignCollectionResult =
  | {
      type: 'success';
      username: string;
      instances: Record<string, PokemonInstance>;
      catalog: BasePokemon[];
    }
  | { type: 'not-found' }
  | { type: 'forbidden'; message: string };

const normalizedUsername = (value: string): string => value.trim().toLocaleLowerCase();

/**
 * Loads another trainer's public collection without touching the signed-in
 * user's collection cache or mutation outbox. Foreign data is deliberately
 * query-scoped so it can never be projected as owned state.
 */
export const getNativeForeignCollection = async (
  usersClient: Pick<NativeUsersApiClient, 'get'>,
  pokemonClient: Pick<NativePokemonApiClient, 'get'>,
  username: string,
): Promise<NativeForeignCollectionResult> => {
  const requestedUsername = normalizedUsername(username);
  if (!requestedUsername) return { type: 'not-found' };

  let envelope: UserInstancesEnvelope<Record<string, PokemonInstance>>;
  try {
    envelope = await usersClient.get<UserInstancesEnvelope<Record<string, PokemonInstance>>>(
      usersContract.endpoints.instancesByUsername(requestedUsername),
    );
  } catch (error) {
    if (!(error instanceof ApiClientError) || (error.status !== 403 && error.status !== 404)) {
      throw error;
    }
    try {
      envelope = await usersClient.get<UserInstancesEnvelope<Record<string, PokemonInstance>>>(
        usersContract.endpoints.publicUserByUsername(requestedUsername),
      );
    } catch (fallbackError) {
      if (fallbackError instanceof ApiClientError && fallbackError.status === 404) {
        return { type: 'not-found' };
      }
      if (fallbackError instanceof ApiClientError && fallbackError.status === 403) {
        return { type: 'forbidden', message: fallbackError.message };
      }
      throw fallbackError;
    }
  }

  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    throw new Error('The trainer collection response is invalid.');
  }
  if (envelope.instances != null && (
    typeof envelope.instances !== 'object' || Array.isArray(envelope.instances)
  )) {
    throw new Error('The trainer collection response contains invalid Pokémon data.');
  }

  const catalog = await pokemonClient.get<BasePokemon[]>(pokemonContract.endpoints.catalog);
  if (!Array.isArray(catalog)) {
    throw new Error('The Pokémon catalog response is invalid.');
  }

  const canonicalUsername = envelope.username?.trim()
    || envelope.user?.username?.trim()
    || username.trim();

  return {
    type: 'success',
    username: canonicalUsername,
    instances: normalizeNativeInstances(envelope.instances ?? {}),
    catalog,
  };
};
