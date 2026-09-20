import type { PokemonInstance } from '@pokemongonexus/shared-contracts/instances';
import {
  pokemonContract,
  type BasePokemon,
  type PokemonMovesChunk,
} from '@pokemongonexus/shared-contracts/pokemon';
import {
  usersContract,
  type CustomTagsEnvelope,
  type InstanceSyncEnvelope,
} from '@pokemongonexus/shared-contracts/users';
import type {
  NativePokemonApiClient,
  NativeUsersApiClient,
} from './nativeApiClients';
import {
  projectNativeCollectionOutbox,
  reconcileAcknowledgedNativeCollectionBatches,
} from '../features/collection/collectionSyncCoordinator';
import type { nativeCollectionOutbox } from '../storage/nativeCollectionOutbox';
import type { nativeCollectionCache } from '../storage/nativeCollectionCache';
import {
  DEFAULT_NATIVE_TAGS_ENVELOPE,
  normalizeNativeTagsEnvelope,
} from '../features/collection/nativeTagsEnvelope';
import { normalizeNativeInstances } from '../features/collection/nativeInstanceNormalization';
import { runAfterNativeUiInteractions } from '../interaction/nativeUiInteractionScheduler';

export type NativeCollectionSnapshot = {
  instances: Record<string, PokemonInstance>;
  catalog: BasePokemon[];
  tags?: CustomTagsEnvelope;
  tagLoadWarning?: string;
};

export type NativeResolvedCollectionSnapshot = NativeCollectionSnapshot & {
  source: 'network' | 'cache';
  cachedAt: number | null;
};

export const getNativeCollectionSnapshot = async (
  usersClient: Pick<NativeUsersApiClient, 'get'>,
  pokemonClient: Pick<NativePokemonApiClient, 'get'>,
): Promise<NativeCollectionSnapshot> => {
  const instancesRequest = usersClient.get<InstanceSyncEnvelope<PokemonInstance>>(
    usersContract.endpoints.instanceSync,
  );
  const tagsRequest = usersClient.get<unknown>(usersContract.endpoints.tags)
    .then((value) => ({
      tags: normalizeNativeTagsEnvelope(value),
      tagLoadWarning: undefined,
    }))
    .catch((error: unknown) => ({
      tags: DEFAULT_NATIVE_TAGS_ENVELOPE,
      tagLoadWarning: `Custom tags could not be refreshed. ${errorMessage(error)}`,
    }));
  const [instanceEnvelope, catalog, tagResult] = await Promise.all([
    instancesRequest,
    pokemonClient.get<BasePokemon[]>(pokemonContract.endpoints.catalog),
    tagsRequest,
  ]);

  if (!catalog || !Array.isArray(catalog)) {
    throw new Error('The Pokémon catalog response is invalid.');
  }

  return {
    instances: normalizeNativeInstances(instanceEnvelope.instances),
    catalog,
    tags: tagResult.tags,
    ...(tagResult.tagLoadWarning
      ? { tagLoadWarning: tagResult.tagLoadWarning }
      : {}),
  };
};

type NativeCollectionOutboxPort = Pick<
  typeof nativeCollectionOutbox,
  'list' | 'removeAcknowledged'
>;

type NativeCollectionCachePort = Pick<
  typeof nativeCollectionCache,
  'read' | 'write'
>;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown error';

export const getReconciledNativeCollectionSnapshot = async (
  usersClient: Pick<NativeUsersApiClient, 'get'>,
  pokemonClient: Pick<NativePokemonApiClient, 'get'>,
  outbox: NativeCollectionOutboxPort,
  cache: NativeCollectionCachePort,
  userId: string,
): Promise<NativeResolvedCollectionSnapshot> => {
  let canonical: NativeCollectionSnapshot;
  let source: NativeResolvedCollectionSnapshot['source'] = 'network';
  let cachedAt: number | null = null;

  try {
    canonical = await getNativeCollectionSnapshot(usersClient, pokemonClient);
    if (canonical.tagLoadWarning) {
      try {
        const cached = await cache.read(userId);
        if (cached?.snapshot.tags) {
          canonical = {
            ...canonical,
            tags: normalizeNativeTagsEnvelope(cached.snapshot.tags),
          };
        }
      } catch {
        // System tags remain available if optional cached custom tags are unavailable.
      }
    }
    // JSON serialization for a full collection is synchronous even though the
    // SQLite API is async. Keep the replaceable durable copy outside the first
    // paint and any active page gesture/animation.
    runAfterNativeUiInteractions(() => {
      try {
        void cache.write(userId, {
          instances: canonical.instances,
          catalog: canonical.catalog,
          tags: canonical.tags,
        }).catch(() => undefined);
      } catch {
        // A replaceable read cache must never block a successful online collection load.
      }
    });
  } catch (networkError) {
    try {
      const cached = await cache.read(userId);
      if (!cached) throw networkError;
      canonical = {
        ...cached.snapshot,
        instances: normalizeNativeInstances(cached.snapshot.instances),
        tags: normalizeNativeTagsEnvelope(cached.snapshot.tags),
      };
      source = 'cache';
      cachedAt = cached.savedAt;
    } catch (cacheError) {
      if (cacheError === networkError) throw networkError;
      throw new Error(
        `Unable to load the collection from the network or this device. Network: ${errorMessage(networkError)} Cache: ${errorMessage(cacheError)}`,
      );
    }
  }

  await reconcileAcknowledgedNativeCollectionBatches({
    userId,
    outbox,
    canonicalInstances: canonical.instances,
  });
  const retained = await outbox.list(userId);
  return {
    ...canonical,
    instances: projectNativeCollectionOutbox(canonical.instances, retained),
    source,
    cachedAt,
  };
};

/**
 * Resolve the last durable collection immediately while the canonical network
 * query refreshes in parallel. Unlike the network reconciliation path this
 * never acknowledges outbox entries: only a server response can do that.
 */
export const getCachedNativeCollectionSnapshot = async (
  outbox: Pick<typeof nativeCollectionOutbox, 'list'>,
  cache: Pick<typeof nativeCollectionCache, 'read'>,
  userId: string,
): Promise<NativeResolvedCollectionSnapshot | null> => {
  const cached = await cache.read(userId);
  if (!cached) return null;
  const retained = await outbox.list(userId);
  return {
    ...cached.snapshot,
    instances: projectNativeCollectionOutbox(
      normalizeNativeInstances(cached.snapshot.instances),
      retained,
    ),
    tags: normalizeNativeTagsEnvelope(cached.snapshot.tags),
    source: 'cache',
    cachedAt: cached.savedAt,
  };
};

export const getNativePokemonMoves = (
  pokemonClient: Pick<NativePokemonApiClient, 'get'>,
): Promise<PokemonMovesChunk> =>
  pokemonClient.get<PokemonMovesChunk>(pokemonContract.endpoints.moves);
