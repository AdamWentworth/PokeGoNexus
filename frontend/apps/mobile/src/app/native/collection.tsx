import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';
import {
  buildNativeCatalogRows,
  buildNativeCollectionRows,
  buildNativeTagSummaries,
  type NativeCollectionRow,
} from '../../features/collection/collectionModel';
import { useNativeCollectionSnapshotQuery } from '../../features/collection/collectionQueries';
import { runtimeConfig } from '../../config/runtimeConfig';
import { useNativeSession } from '../../auth/NativeSessionContext';
import { DEFAULT_NATIVE_TAGS_ENVELOPE } from '../../features/collection/nativeTagsEnvelope';
import { useNativeTagMutations } from '../../features/collection/useNativeTagMutations';
import { useNativePokemonOrganizerMutation } from '../../features/collection/useNativePokemonOrganizerMutation';
import { NativeCollectionHubScreen } from '../../screens/NativeCollectionHubScreen';
import { setNativeInstanceNavigationContext } from '../../features/collection/nativeInstanceNavigationContext';
import { resolveNativeActionMenuDestination } from '../../navigation/nativeActionMenuNavigation';
import { nativeCollectionTagKeyForFilter } from '../../features/collection/nativeCollectionRouteFilter';
import { NativeCollectionSyncStatusCard } from '../../features/collection/NativeCollectionSyncStatusCard';
import { NativeProtectedSessionGate } from '../../components/NativeProtectedSessionGate';
import {
  patchNativeCollectionSession,
  readNativeCollectionSession,
  readNativeCollectionSessionRevision,
  subscribeNativeCollectionSession,
} from '../../features/collection/nativeCollectionSessionCache';
import { markNativeUiPerformance } from '../../observability/nativeUiPerformanceTrace';

const firstParam = (value: string | string[] | undefined): string => (
  Array.isArray(value) ? value[0] ?? '' : value ?? ''
);

export default function NativeCollectionRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    filter?: string | string[];
    instanceId?: string | string[];
    search?: string | string[];
    tag?: string | string[];
  }>();
  const session = useNativeSession();
  const filter = firstParam(params.filter) || firstParam(params.tag);
  const instanceId = firstParam(params.instanceId).trim();
  const search = firstParam(params.search);
  const sessionOwnerKey = session.user ? `self:${session.user.user_id}` : 'signed-out';
  const subscribeToSession = useCallback(
    (listener: () => void) => subscribeNativeCollectionSession(sessionOwnerKey, listener),
    [sessionOwnerKey],
  );
  const getSessionRevision = useCallback(
    () => readNativeCollectionSessionRevision(sessionOwnerKey),
    [sessionOwnerKey],
  );
  const sessionRevision = useSyncExternalStore(
    subscribeToSession,
    getSessionRevision,
    getSessionRevision,
  );
  // `sessionRevision` subscribes this route to externally primed collection
  // state. Read the tiny in-memory snapshot directly on that rerender; wrapping
  // the read in useMemo obscures the intentional revision dependency.
  const restoredCollectionSession = readNativeCollectionSession(sessionOwnerKey);
  const initialTagKey = nativeCollectionTagKeyForFilter(filter)
    ?? restoredCollectionSession?.selectedTagKey
    ?? null;
  const initialQuery = search || restoredCollectionSession?.query || '';
  const initialView = filter || search
    ? 'pokemon'
    : restoredCollectionSession?.activeView ?? 'pokemon';
  const snapshotQuery = useNativeCollectionSnapshotQuery(session.user?.user_id ?? null);
  const tagMutations = useNativeTagMutations(session.user?.user_id ?? 'signed-out');
  const pokemonOrganizer = useNativePokemonOrganizerMutation(
    session.user?.user_id ?? 'signed-out',
  );
  const organizePokemonMutation = pokemonOrganizer.mutateAsync;
  const refetchSnapshot = snapshotQuery.refetch;
  const instanceRows = useMemo<NativeCollectionRow[]>(() => {
    if (!snapshotQuery.data) return [];
    return buildNativeCollectionRows(
      snapshotQuery.data.instances,
      snapshotQuery.data.catalog,
      runtimeConfig.api.frontendAppUrl,
    );
  }, [snapshotQuery.data]);
  const catalogRows = useMemo<NativeCollectionRow[]>(() => {
    if (!snapshotQuery.data) return [];
    return buildNativeCatalogRows(
      snapshotQuery.data.catalog,
      runtimeConfig.api.frontendAppUrl,
    );
  }, [snapshotQuery.data]);
  const inventoryTags = useMemo(() => {
    if (!snapshotQuery.data) return [];
    return buildNativeTagSummaries(
      instanceRows,
      snapshotQuery.data.instances,
      snapshotQuery.data.tags ?? DEFAULT_NATIVE_TAGS_ENVELOPE,
      'caught',
    );
  }, [instanceRows, snapshotQuery.data]);
  const wishlistTags = useMemo(() => {
    if (!snapshotQuery.data) return [];
    return buildNativeTagSummaries(
      instanceRows,
      snapshotQuery.data.instances,
      snapshotQuery.data.tags ?? DEFAULT_NATIVE_TAGS_ENVELOPE,
      'wanted',
    );
  }, [instanceRows, snapshotQuery.data]);
  const updateCollectionContext = useCallback(
    (patch: Parameters<typeof patchNativeCollectionSession>[1]) => {
      patchNativeCollectionSession(sessionOwnerKey, patch);
    },
    [sessionOwnerKey],
  );
  const openEntry = useCallback((
    row: NativeCollectionRow,
    orderedRows: NativeCollectionRow[],
  ) => {
    setNativeInstanceNavigationContext(orderedRows.map((entry) => entry.id));
    router.push(row.source === 'catalog' ? {
      pathname: '/native/collection/catalog/[variantId]',
      params: { variantId: row.id },
    } : {
      pathname: '/native/collection/[instanceId]',
      params: { instanceId: row.id },
    });
  }, [router]);
  const navigateFromActionMenu = useCallback((path: string) => {
    const destination = resolveNativeActionMenuDestination(path, '/pokemon');
    if (destination.kind === 'current') return;
    if (destination.kind === 'native') {
      router.push(destination.pathname);
      return;
    }
    router.push({ pathname: '/web', params: { path: destination.path } });
  }, [router]);
  const organizePokemon = useCallback(
    (request: Parameters<typeof organizePokemonMutation>[0]) =>
      organizePokemonMutation(request),
    [organizePokemonMutation],
  );
  const retrySnapshot = useCallback(
    () => { void refetchSnapshot(); },
    [refetchSnapshot],
  );
  const syncStatus = useMemo(() => <NativeCollectionSyncStatusCard includeConnectionErrors={false} />, []);

  useLayoutEffect(() => {
    markNativeUiPerformance('collection_route_committed', {
      catalogRows: catalogRows.length,
      filter: filter || null,
      hasSnapshot: Boolean(snapshotQuery.data),
      initialTagKey,
      instanceRows: instanceRows.length,
      firstInstanceImageUri: instanceRows[0]?.imageUri ?? null,
      isPending: snapshotQuery.isPending,
      queryStatus: snapshotQuery.status,
      sessionStatus: session.status,
    });
  }, [
    catalogRows.length,
    filter,
    initialTagKey,
    instanceRows,
    session.status,
    snapshotQuery.data,
    snapshotQuery.isPending,
    snapshotQuery.status,
  ]);

  if (session.status === 'restoring' || session.status === 'unavailable') {
    return (
      <NativeProtectedSessionGate
        message="Loading your collection…"
        onRetry={session.retrySession}
        status={session.status}
      />
    );
  }

  if (session.status !== 'signed-in' || !session.user) {
    const returnParams = new URLSearchParams();
    if (filter) returnParams.set('filter', filter);
    if (search) returnParams.set('search', search);
    const returnTo = returnParams.size
      ? `/native/collection?${returnParams.toString()}`
      : '/native/collection';
    return <Redirect href={`/native/login?returnTo=${encodeURIComponent(returnTo)}`} />;
  }

  if (instanceId) {
    return <Redirect href={`/native/collection/${encodeURIComponent(instanceId)}`} />;
  }

  return (
    <NativeCollectionHubScreen
      catalog={snapshotQuery.data?.catalog}
      assetBaseUrl={runtimeConfig.api.frontendAppUrl}
      catalogRows={catalogRows}
      error={snapshotQuery.error instanceof Error ? snapshotQuery.error.message : null}
      inventoryTags={inventoryTags}
      instances={snapshotQuery.data?.instances ?? {}}
      initialTagKey={initialTagKey}
      initialQuery={initialQuery}
      initialScrollOffset={restoredCollectionSession?.scrollOffset ?? 0}
      initialShowEvolutionaryLine={restoredCollectionSession?.showEvolutionaryLine ?? false}
      initialSort={restoredCollectionSession?.sort ?? 'number'}
      initialSortDirection={restoredCollectionSession?.sortDirection ?? 'ascending'}
      initialView={initialView}
      key={`${filter || 'restored'}:${search}:${sessionRevision}`}
      isLoading={snapshotQuery.isPending}
      onActionMenuNavigate={navigateFromActionMenu}
      onOpenEntry={openEntry}
      onOrganizePokemon={organizePokemon}
      onRetry={retrySnapshot}
      onCreateTag={tagMutations.createTag}
      onDeleteTag={tagMutations.deleteTag}
      onSaveTagOrder={tagMutations.saveOrder}
      onUpdateTag={tagMutations.updateTag}
      isSavingTags={tagMutations.isPending}
      isOrganizingPokemon={pokemonOrganizer.isPending}
      organizerError={pokemonOrganizer.error instanceof Error
        ? pokemonOrganizer.error.message
        : null}
      onContextChange={updateCollectionContext}
      syncStatus={syncStatus}
      warning={snapshotQuery.data?.tagLoadWarning ?? null}
      wishlistTags={wishlistTags}
    />
  );
}
