import { Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useNativeSession } from '../../auth/NativeSessionContext';
import { NativeRouteActionMenu } from '../../components/NativeRouteActionMenu';
import { runtimeConfig } from '../../config/runtimeConfig';
import {
  buildNativeCollectionRows,
} from '../../features/collection/collectionModel';
import { useNativeCollectionSnapshotQuery } from '../../features/collection/collectionQueries';
import { useNativeTrainerProfileQuery } from '../../features/social/socialQueries';
import { buildNativeTradeBoardModel } from '../../features/tradeBoard/nativeTradeBoardModel';
import { NativeTradeBoardScreen } from '../../screens/NativeTradeBoardScreen';
import { NativeProtectedSessionGate } from '../../components/NativeProtectedSessionGate';

export default function NativeTradeBoardRoute() {
  const router = useRouter();
  const session = useNativeSession();
  const [generatedAt] = useState(() => new Date().toISOString());
  const userId = session.user?.user_id ?? null;
  const snapshotQuery = useNativeCollectionSnapshotQuery(userId);
  const profileQuery = useNativeTrainerProfileQuery(userId);
  const rows = useMemo(() => snapshotQuery.data ? buildNativeCollectionRows(
    snapshotQuery.data.instances,
    snapshotQuery.data.catalog,
    runtimeConfig.api.frontendAppUrl,
  ) : [], [snapshotQuery.data]);
  const model = useMemo(() => {
    if (!snapshotQuery.data || !session.user) return null;
    const username = session.user.username;
    return buildNativeTradeBoardModel({
      boardUrl: `${runtimeConfig.api.frontendAppUrl.replace(/\/$/, '')}/trade-board/${encodeURIComponent(username)}`,
      generatedAt,
      instances: snapshotQuery.data.instances,
      pokemonGoName: profileQuery.data?.user.pokemonGoName ?? session.user.pokemonGoName,
      rows,
      username,
    });
  }, [generatedAt, profileQuery.data?.user.pokemonGoName, rows, session.user, snapshotQuery.data]);

  if (session.status === 'restoring' || session.status === 'unavailable') {
    return (
      <NativeProtectedSessionGate
        message="Preparing your Trade Board…"
        onRetry={session.retrySession}
        status={session.status}
      />
    );
  }

  if (session.status !== 'signed-in' || !session.user) {
    return <Redirect href="/native/login?returnTo=%2Fnative%2Ftrade-board" />;
  }

  // The authenticated session already owns the optional Pokémon GO name.
  // Profile enrichment must not hold up or disable a board built entirely
  // from the authoritative collection snapshot.
  const error = snapshotQuery.error instanceof Error ? snapshotQuery.error.message : null;

  return (
    <>
      <NativeTradeBoardScreen
        assetBaseUrl={runtimeConfig.api.frontendAppUrl}
        error={error}
        isLoading={snapshotQuery.isPending}
        model={model}
        onBack={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/native/trades');
        }}
        onOpenLiveBoard={() => router.push({
          pathname: '/native/trade-board/[username]',
          params: { username: session.user?.username ?? '' },
        })}
        onOpenCollection={() => router.push('/native/collection')}
        onRetry={() => {
          void snapshotQuery.refetch();
          void profileQuery.refetch();
        }}
      />
      <NativeRouteActionMenu currentPath="/trade-board" signedIn />
    </>
  );
}
