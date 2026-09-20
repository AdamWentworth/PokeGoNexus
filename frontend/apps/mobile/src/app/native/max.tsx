import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { useNativeSession } from '../../auth/NativeSessionContext';
import { NativeActionMenu } from '../../components/NativeActionMenu';
import { NativeActionMenuAnchor } from '../../components/NativeActionMenuAnchor';
import { runtimeConfig } from '../../config/runtimeConfig';
import { useNativeCollectionSnapshotQuery } from '../../features/collection/collectionQueries';
import { hydrateNativeMaxCatalog } from '../../features/tools/nativeBattleModels';
import {
  useNativeMaxDataQuery,
  useNativeMovesDataQuery,
  useNativeToolCatalogQuery,
} from '../../features/tools/nativeToolQueries';
import { parseNativeMaxRouteState } from '../../features/tools/nativeToolRouteState';
import { resolveNativeActionMenuDestination } from '../../navigation/nativeActionMenuNavigation';
import { NativeMaxScreen, type NativeMaxRoutePatch } from '../../screens/NativeMaxScreen';

type RouteParam = string | string[] | undefined;

export default function NativeMaxRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    boss?: RouteParam;
    difficulty?: RouteParam;
    role?: RouteParam;
    scope?: RouteParam;
    trainers?: RouteParam;
    type?: RouteParam;
    view?: RouteParam;
  }>();
  const session = useNativeSession();
  const [menu, setMenu] = useState(false);
  const catalogQuery = useNativeToolCatalogQuery();
  const movesQuery = useNativeMovesDataQuery();
  const maxQuery = useNativeMaxDataQuery();
  const snapshotQuery = useNativeCollectionSnapshotQuery(session.user?.user_id ?? null);
  const routeState = parseNativeMaxRouteState(params, Boolean(session.user));
  const catalog = useMemo(
    () => hydrateNativeMaxCatalog(
      catalogQuery.data ?? [],
      maxQuery.data ?? [],
      movesQuery.data ?? [],
    ),
    [catalogQuery.data, maxQuery.data, movesQuery.data],
  );
  const error = [
    catalogQuery.error,
    movesQuery.error,
    maxQuery.error,
    snapshotQuery.error,
  ].find((value): value is Error => value instanceof Error)?.message ?? null;

  const navigate = (path: string) => {
    setMenu(false);
    const destination = resolveNativeActionMenuDestination(path, '/max');
    if (destination.kind === 'current') return;
    if (destination.kind === 'native') {
      router.push(destination.pathname);
      return;
    }
    router.push({ pathname: '/web', params: { path: destination.path } });
  };
  const updateRouteState = useCallback((patch: NativeMaxRoutePatch) => {
    const next: Record<string, string | undefined> = {};
    if ('view' in patch) next.view = patch.view === 'rankings' ? undefined : patch.view;
    if ('role' in patch) next.role = patch.role === 'damage' ? undefined : patch.role;
    if ('scope' in patch) {
      const defaultScope = session.user ? 'owned' : 'catalog';
      next.scope = patch.scope === defaultScope ? undefined : patch.scope;
    }
    if ('selectedType' in patch) next.type = patch.selectedType || undefined;
    if ('bossId' in patch) next.boss = patch.bossId || undefined;
    if ('difficulty' in patch) next.difficulty = patch.difficulty ?? undefined;
    if ('trainerCount' in patch) next.trainers = patch.trainerCount == null
      ? undefined
      : String(patch.trainerCount);
    router.setParams(next);
  }, [router, session.user]);

  return <>
    <NativeMaxScreen
      assetBaseUrl={runtimeConfig.api.frontendAppUrl}
      catalog={catalog}
      error={error}
      initialBossId={routeState.bossId}
      initialDifficulty={routeState.difficulty}
      initialRole={routeState.role}
      initialScope={routeState.scope}
      initialSelectedType={routeState.selectedType}
      initialTrainerCount={routeState.trainerCount}
      initialView={routeState.view}
      instances={snapshotQuery.data?.instances}
      isLoading={catalogQuery.isPending
        || movesQuery.isPending
        || maxQuery.isPending
        || Boolean(session.user && snapshotQuery.isPending)}
      onBack={() => router.canGoBack() ? router.back() : router.replace('/native')}
      onOpenPokemon={(entry) => {
        if (entry.sourceInstanceId) {
          router.push({
            pathname: '/native/collection/[instanceId]',
            params: { instanceId: entry.sourceInstanceId },
          });
          return;
        }
        const variantId = entry.variantId ?? `${String(entry.pokemonId).padStart(4, '0')}-default`;
        router.push({
          pathname: '/native/pokedex/[variantId]',
          params: { variantId },
        });
      }}
      onRetry={() => {
        void catalogQuery.refetch();
        void movesQuery.refetch();
        void maxQuery.refetch();
        if (session.user) void snapshotQuery.refetch();
      }}
      onRouteStateChange={updateRouteState}
      signedIn={Boolean(session.user)}
    />
    <NativeActionMenuAnchor
      assetBaseUrl={runtimeConfig.api.frontendAppUrl}
      onPress={() => setMenu(true)}
    />
    {menu ? <NativeActionMenu
      assetBaseUrl={runtimeConfig.api.frontendAppUrl}
      onClose={() => setMenu(false)}
      onNavigate={navigate}
      visible
    /> : null}
  </>;
}
