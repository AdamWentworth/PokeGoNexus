import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { useNativeSession } from '../../../../../auth/NativeSessionContext';
import {
  buildNativeCollectionRows,
  buildNativeTagSummaries,
  type NativeCollectionRow,
} from '../../../../../features/collection/collectionModel';
import { useNativeForeignCollectionQuery } from '../../../../../features/collection/collectionQueries';
import { DEFAULT_NATIVE_TAGS_ENVELOPE } from '../../../../../features/collection/nativeTagsEnvelope';
import { setNativeInstanceNavigationContext } from '../../../../../features/collection/nativeInstanceNavigationContext';
import { nativeCollectionTagKeyForFilter } from '../../../../../features/collection/nativeCollectionRouteFilter';
import { NativeProtectedSessionGate } from '../../../../../components/NativeProtectedSessionGate';
import {
  patchNativeCollectionSession,
  readNativeCollectionSession,
} from '../../../../../features/collection/nativeCollectionSessionCache';
import { runtimeConfig } from '../../../../../config/runtimeConfig';
import { NativeCollectionHubScreen } from '../../../../../screens/NativeCollectionHubScreen';
import { resolveNativeActionMenuDestination } from '../../../../../navigation/nativeActionMenuNavigation';

const firstParam = (value: string | string[] | undefined): string => (
  Array.isArray(value) ? value[0] ?? '' : value ?? ''
);

export default function NativeForeignCollectionRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    filter?: string | string[];
    instanceId?: string | string[];
    tag?: string | string[];
    username?: string | string[];
  }>();
  const session = useNativeSession();
  const username = firstParam(params.username).trim();
  const foreignQuery = useNativeForeignCollectionQuery(
    session.user?.user_id ?? null,
    username,
  );
  const refetchForeignCollection = foreignQuery.refetch;
  const success = foreignQuery.data?.type === 'success' ? foreignQuery.data : null;
  const rows = useMemo<NativeCollectionRow[]>(() => {
    if (!success) return [];
    return buildNativeCollectionRows(
      success.instances,
      success.catalog,
      runtimeConfig.api.frontendAppUrl,
    );
  }, [success]);
  const inventoryTags = useMemo(() => buildNativeTagSummaries(
    rows,
    success?.instances ?? {},
    DEFAULT_NATIVE_TAGS_ENVELOPE,
    'caught',
  ), [rows, success?.instances]);
  const wishlistTags = useMemo(() => buildNativeTagSummaries(
    rows,
    success?.instances ?? {},
    DEFAULT_NATIVE_TAGS_ENVELOPE,
    'wanted',
  ), [rows, success?.instances]);
  const requestedFilter = firstParam(params.filter) || firstParam(params.tag);
  const requestedInstanceId = firstParam(params.instanceId).trim();
  const sessionOwnerKey = `foreign:${session.user?.user_id ?? 'signed-out'}:${username.toLocaleLowerCase()}`;
  const restoredCollectionSession = useMemo(
    () => readNativeCollectionSession(sessionOwnerKey),
    [sessionOwnerKey],
  );
  const initialTagKey = nativeCollectionTagKeyForFilter(requestedFilter)
    ?? restoredCollectionSession?.selectedTagKey
    ?? 'system:caught';
  const initialView = requestedFilter
    ? 'pokemon'
    : restoredCollectionSession?.activeView ?? 'pokemon';
  const resultError = foreignQuery.error instanceof Error
    ? foreignQuery.error.message
    : foreignQuery.data?.type === 'forbidden'
      ? foreignQuery.data.message
      : foreignQuery.data?.type === 'not-found'
        ? 'This trainer could not be found.'
        : null;
  const updateCollectionContext = useCallback(
    (patch: Parameters<typeof patchNativeCollectionSession>[1]) => {
      patchNativeCollectionSession(sessionOwnerKey, patch);
    },
    [sessionOwnerKey],
  );
  const returnToContext = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/native/collection');
  }, [router]);
  const openEntry = useCallback((
    row: NativeCollectionRow,
    orderedRows: NativeCollectionRow[],
  ) => {
    if (row.source === 'catalog') return;
    setNativeInstanceNavigationContext(orderedRows.map((entry) => entry.id));
    router.push({
      pathname: '/native/collection/trainer/[username]/[instanceId]',
      params: { username: success?.username ?? username, instanceId: row.id },
    });
  }, [router, success?.username, username]);
  const navigateFromActionMenu = useCallback((path: string) => {
    const destination = resolveNativeActionMenuDestination(path);
    if (destination.kind === 'current') return;
    if (destination.kind === 'native') {
      router.push(destination.pathname);
      return;
    }
    router.push({ pathname: '/web', params: { path: destination.path } });
  }, [router]);
  const retryCollection = useCallback(
    () => { void refetchForeignCollection(); },
    [refetchForeignCollection],
  );

  if (session.status === 'restoring' || session.status === 'unavailable') {
    return (
      <NativeProtectedSessionGate
        message="Opening trainer catalog…"
        onRetry={session.retrySession}
        status={session.status}
      />
    );
  }

  if (requestedInstanceId) {
    return (
      <Redirect
        href={`/native/collection/trainer/${encodeURIComponent(username)}/${encodeURIComponent(requestedInstanceId)}`}
      />
    );
  }

  return (
    <NativeCollectionHubScreen
      assetBaseUrl={runtimeConfig.api.frontendAppUrl}
      catalogOwner={success?.username ?? username}
      catalogRows={rows}
      error={resultError}
      initialTagKey={initialTagKey}
      initialQuery={restoredCollectionSession?.query ?? ''}
      initialScrollOffset={restoredCollectionSession?.scrollOffset ?? 0}
      initialShowEvolutionaryLine={restoredCollectionSession?.showEvolutionaryLine ?? false}
      initialSort={restoredCollectionSession?.sort ?? 'number'}
      initialSortDirection={restoredCollectionSession?.sortDirection ?? 'ascending'}
      initialView={initialView}
      instances={success?.instances ?? {}}
      inventoryTags={inventoryTags}
      isLoading={foreignQuery.isPending}
      key={`${requestedFilter || 'restored'}:${username.toLocaleLowerCase()}`}
      onActionMenuNavigate={navigateFromActionMenu}
      onOpenEntry={openEntry}
      onRetry={retryCollection}
      onReturnToContext={returnToContext}
      requireTagSelection
      signedIn={Boolean(session.user)}
      onContextChange={updateCollectionContext}
      wishlistTags={wishlistTags}
    />
  );
}
