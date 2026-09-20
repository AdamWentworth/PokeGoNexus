import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCachedNativeCollectionSnapshot,
  getReconciledNativeCollectionSnapshot,
  getNativePokemonMoves,
} from '../../services/collectionApi';
import { getCollectionSummary } from '../../services/collectionSummaryApi';
import { getNativeForeignCollection } from '../../services/foreignCollectionApi';
import { useNativeApiClients } from '../../services/useNativeApiClients';
import { nativeCollectionOutbox } from '../../storage/nativeCollectionOutbox';
import { nativeCollectionCache } from '../../storage/nativeCollectionCache';

export const nativeCollectionQueryKeys = {
  root: ['native', 'collection'] as const,
  summary: (userId: string) =>
    [...nativeCollectionQueryKeys.root, userId, 'summary'] as const,
  snapshot: (userId: string) =>
    [...nativeCollectionQueryKeys.root, userId, 'snapshot'] as const,
  foreign: (viewerId: string, username: string) =>
    [
      ...nativeCollectionQueryKeys.root,
      viewerId,
      'foreign',
      username.trim().toLocaleLowerCase(),
    ] as const,
  moves: ['native', 'pokemon', 'moves'] as const,
};

export const useNativeForeignCollectionQuery = (
  viewerId: string | null,
  username: string,
) => {
  const clients = useNativeApiClients();
  const normalizedUsername = username.trim();
  return useQuery({
    queryKey: nativeCollectionQueryKeys.foreign(
      viewerId ?? 'signed-out',
      normalizedUsername,
    ),
    queryFn: () => getNativeForeignCollection(
      clients.users,
      clients.pokemon,
      normalizedUsername,
    ),
    enabled: Boolean(normalizedUsername),
    staleTime: 60_000,
  });
};

export const useNativePokemonMovesQuery = (enabled: boolean) => {
  const clients = useNativeApiClients();
  return useQuery({
    queryKey: nativeCollectionQueryKeys.moves,
    queryFn: () => getNativePokemonMoves(clients.pokemon),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
  });
};

export const useNativeCollectionSummaryQuery = (
  userId: string | null,
) => {
  const clients = useNativeApiClients();
  return useQuery({
    queryKey: nativeCollectionQueryKeys.summary(userId ?? 'signed-out'),
    queryFn: () => getCollectionSummary(clients.users),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });
};

export const useNativeCollectionSnapshotQuery = (
  userId: string | null,
  enabled = true,
) => {
  const clients = useNativeApiClients();
  const queryClient = useQueryClient();
  const resolvedUserId = userId ?? 'signed-out';
  const query = useQuery({
    queryKey: nativeCollectionQueryKeys.snapshot(resolvedUserId),
    queryFn: () => getReconciledNativeCollectionSnapshot(
      clients.users,
      clients.pokemon,
      nativeCollectionOutbox,
      nativeCollectionCache,
      userId ?? '',
    ),
    enabled: Boolean(userId) && enabled,
    staleTime: 5 * 60_000,
  });
  useEffect(() => {
    if (!userId || !enabled) return undefined;
    const queryKey = nativeCollectionQueryKeys.snapshot(userId);
    if (queryClient.getQueryData(queryKey) !== undefined) return undefined;
    let cancelled = false;
    void getCachedNativeCollectionSnapshot(
      nativeCollectionOutbox,
      nativeCollectionCache,
      userId,
    ).then((cached) => {
      if (cancelled || !cached) return;
      // The network is authoritative. Never let a slower SQLite read replace a
      // response that completed while the local snapshot was being decoded.
      if (queryClient.getQueryData(queryKey) !== undefined) return;
      queryClient.setQueryData(queryKey, cached, { updatedAt: cached.cachedAt ?? 0 });
    }).catch(() => {
      // The in-flight network query and its existing offline fallback remain
      // responsible for surfacing a real error if both sources are unavailable.
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, queryClient, userId]);
  return query;
};
