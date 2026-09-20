import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { NativePvpScreen } from '../../screens/NativePvpScreen';
import { useNativeSession } from '../../auth/NativeSessionContext';
import { runtimeConfig } from '../../config/runtimeConfig';
import { useNativeCollectionSnapshotQuery } from '../../features/collection/collectionQueries';
import { hydrateNativeToolCatalog } from '../../features/tools/nativeBattleModels';
import { useNativeMovesDataQuery, useNativePvpDataQuery, useNativeToolCatalogQuery } from '../../features/tools/nativeToolQueries';
import { NativeActionMenu } from '../../components/NativeActionMenu';
import { NativeActionMenuAnchor } from '../../components/NativeActionMenuAnchor';
import { resolveNativeActionMenuDestination } from '../../navigation/nativeActionMenuNavigation';

export default function NativePvpRoute() {
  const router = useRouter();
  const session = useNativeSession();
  const [menu, setMenu] = useState(false);
  const [catalogRequested, setCatalogRequested] = useState(false);
  const [ownedDataRequested, setOwnedDataRequested] = useState(false);
  const catalogQuery = useNativeToolCatalogQuery(catalogRequested);
  const movesQuery = useNativeMovesDataQuery(catalogRequested);
  const rankingsQuery = useNativePvpDataQuery();
  const collectionQuery = useNativeCollectionSnapshotQuery(
    session.user?.user_id ?? null,
    ownedDataRequested,
  );
  const requestCatalog = useCallback(() => setCatalogRequested(true), []);
  const requestOwnedData = useCallback(() => {
    setCatalogRequested(true);
    setOwnedDataRequested(true);
  }, []);
  const catalog = useMemo(
    () => hydrateNativeToolCatalog(catalogQuery.data ?? [], movesQuery.data ?? []),
    [catalogQuery.data, movesQuery.data],
  );
  const error = [
    catalogRequested ? catalogQuery.error : null,
    catalogRequested ? movesQuery.error : null,
    rankingsQuery.error,
    ownedDataRequested ? collectionQuery.error : null,
  ]
    .find((value): value is Error => value instanceof Error)?.message ?? null;
  const navigate = (path: string) => {
    setMenu(false);
    const destination = resolveNativeActionMenuDestination(path, '/pvp');
    if (destination.kind === 'current') return;
    if (destination.kind === 'native') router.push(destination.pathname);
    else router.push({ pathname: '/web', params: { path: destination.path } });
  };

  return (
    <>
      <NativePvpScreen
        assetBaseUrl={runtimeConfig.api.frontendAppUrl}
        catalog={catalog}
        error={error}
        instances={collectionQuery.data?.instances ?? {}}
        isLoading={rankingsQuery.isPending
          || Boolean(catalogRequested && catalogQuery.isPending)
          || Boolean(catalogRequested && movesQuery.isPending)
          || Boolean(session.user && ownedDataRequested && collectionQuery.isPending)}
        onBack={() => router.canGoBack() ? router.back() : router.replace('/native')}
        onCatalogNeeded={requestCatalog}
        onMethodology={() => router.push('/native/pvp-methodology')}
        onOwnedDataNeeded={requestOwnedData}
        onRetry={() => {
          void rankingsQuery.refetch();
          if (catalogRequested) void catalogQuery.refetch();
          if (catalogRequested) void movesQuery.refetch();
          if (session.user && ownedDataRequested) void collectionQuery.refetch();
        }}
        payload={rankingsQuery.data ?? null}
        signedIn={Boolean(session.user)}
      />
      <NativeActionMenuAnchor assetBaseUrl={runtimeConfig.api.frontendAppUrl} onPress={() => setMenu(true)} />
      {menu ? <NativeActionMenu assetBaseUrl={runtimeConfig.api.frontendAppUrl} onClose={() => setMenu(false)} onNavigate={navigate} visible /> : null}
    </>
  );
}
