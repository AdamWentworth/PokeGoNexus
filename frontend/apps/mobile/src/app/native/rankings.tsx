import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useNetInfo } from '@react-native-community/netinfo';
import { buildPokemonCatalogEntries } from '@pokemongonexus/shared-domain/catalog';

import { useNativeSession } from '../../auth/NativeSessionContext';
import { NativeActionMenu } from '../../components/NativeActionMenu';
import { NativeActionMenuAnchor } from '../../components/NativeActionMenuAnchor';
import { runtimeConfig } from '../../config/runtimeConfig';
import { useNativeCollectionSnapshotQuery } from '../../features/collection/collectionQueries';
import type {
  NativeRankingCategory,
  NativeRankingCollectionFilter,
  NativeRankingMode,
} from '../../features/tools/nativeRankingsModel';
import {
  buildNativeRankingRows,
  countNativeRankingCollectionFilters,
  filterNativeRankingRowsByCollection,
  getNativeRankingCollectionDestination,
  getNativeRankingsErrorMessage,
} from '../../features/tools/nativeRankingsModel';
import {
  useNativeCommunityRankingsQuery,
  useNativeToolCatalogQuery,
} from '../../features/tools/nativeToolQueries';
import { parseNativeRankingsRouteState } from '../../features/tools/nativeToolRouteState';
import { resolveNativeActionMenuDestination } from '../../navigation/nativeActionMenuNavigation';
import { NativeRankingsScreen } from '../../screens/NativeRankingsScreen';

type RouteParam = string | string[] | undefined;

export default function NativeRankingsRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    category?: RouteParam;
    collection?: RouteParam;
    search?: RouteParam;
    view?: RouteParam;
  }>();
  const session = useNativeSession();
  const network = useNetInfo();
  const routeState = parseNativeRankingsRouteState(params, Boolean(session.user));
  const catalogQuery = useNativeToolCatalogQuery();
  const rankingsQuery = useNativeCommunityRankingsQuery();
  const snapshotQuery = useNativeCollectionSnapshotQuery(session.user?.user_id ?? null);
  const [mode, setMode] = useState<NativeRankingMode>(routeState.mode);
  const [category, setCategory] = useState<NativeRankingCategory>(routeState.category);
  const [collectionFilter, setCollectionFilter] = useState<NativeRankingCollectionFilter>(
    routeState.collectionFilter,
  );
  const [query, setQuery] = useState(routeState.query);
  const [menu, setMenu] = useState(false);
  const rankingCatalog = useMemo(
    () => buildPokemonCatalogEntries(catalogQuery.data ?? []),
    [catalogQuery.data],
  );
  const workspaces = useMemo(() => Object.fromEntries(
    (['wanted', 'rarest'] as const).map((workspaceMode) => {
      const selectedCategory = workspaceMode === 'wanted' && category === 'shadow' ? 'all' : category;
      const unfiltered = buildNativeRankingRows({
        catalog: rankingCatalog,
        category: selectedCategory,
        collectionFilter: 'all',
        instances: snapshotQuery.data?.instances,
        mode: workspaceMode,
        payload: rankingsQuery.data,
        query,
      });
      return [workspaceMode, {
        collectionFilterCounts: countNativeRankingCollectionFilters(unfiltered),
        rows: filterNativeRankingRowsByCollection(unfiltered, session.user ? collectionFilter : 'all'),
        selectedCategory,
      }];
    }),
  ) as NonNullable<React.ComponentProps<typeof NativeRankingsScreen>['workspaces']>, [category, collectionFilter, query, rankingCatalog, rankingsQuery.data, session.user, snapshotQuery.data?.instances]);
  const { rows, collectionFilterCounts } = workspaces[mode];
  const error = [
    catalogQuery.error,
    rankingsQuery.error,
    snapshotQuery.error,
  ].find((value): value is Error => value instanceof Error)?.message ?? null;
  const online = network.isConnected !== false && network.isInternetReachable !== false;
  const actionableError = error ? getNativeRankingsErrorMessage(error, online) : null;
  const updatedAt = rankingsQuery.data?.snapshot.updated_at;
  const snapshotLabel = updatedAt && !Number.isNaN(new Date(updatedAt).getTime())
    ? `Updated ${new Date(updatedAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })}`
    : 'Recently updated';

  const navigate = (path: string) => {
    setMenu(false);
    const destination = resolveNativeActionMenuDestination(path, '/rankings');
    if (destination.kind === 'current') return;
    if (destination.kind === 'native') {
      router.push(destination.pathname);
      return;
    }
    router.push({ pathname: '/web', params: { path: destination.path } });
  };
  const retry = () => {
    void catalogQuery.refetch();
    void rankingsQuery.refetch();
    if (session.user) void snapshotQuery.refetch();
  };
  const updateRouteState = useCallback((patch: {
    category?: NativeRankingCategory;
    collectionFilter?: NativeRankingCollectionFilter;
    mode?: NativeRankingMode;
    query?: string;
  }) => {
    const next: Record<string, string | undefined> = {};
    if ('mode' in patch) next.view = patch.mode === 'wanted' ? undefined : patch.mode;
    if ('category' in patch) next.category = patch.category === 'all' ? undefined : patch.category;
    if ('collectionFilter' in patch) next.collection = patch.collectionFilter === 'all' ? undefined : patch.collectionFilter;
    if ('query' in patch) next.search = patch.query || undefined;
    router.setParams(next);
  }, [router]);
  const openRankingEntry = ({ entry, personal }: (typeof rows)[number]) => {
    router.push({
      pathname: '/native/collection',
      params: getNativeRankingCollectionDestination({ entry, personal }),
    });
  };

  return <>
    <NativeRankingsScreen
      assetBaseUrl={runtimeConfig.api.frontendAppUrl}
      workspaces={workspaces}
      collectionFilterCounts={collectionFilterCounts}
      collectorCount={Math.max(
        rankingsQuery.data?.snapshot.collector_users ?? 0,
        rankingsQuery.data?.snapshot.wishlist_users ?? 0,
      )}
      error={actionableError}
      hasSnapshot={Boolean(rankingsQuery.data)}
      query={query}
      isLoading={catalogQuery.isPending
        || rankingsQuery.isPending
        || Boolean(session.user && snapshotQuery.isPending)}
      isRefreshing={catalogQuery.isFetching
        || rankingsQuery.isFetching
        || Boolean(session.user && snapshotQuery.isFetching)}
      onBack={() => router.canGoBack() ? router.back() : router.replace('/native')}
      onChangeCategory={(next) => {
        setCategory(next);
        updateRouteState({ category: next });
      }}
      onChangeCollectionFilter={(next) => {
        setCollectionFilter(next);
        updateRouteState({ collectionFilter: next });
      }}
      onChangeMode={(next) => {
        setMode(next);
        const nextCategory = next === 'wanted' && category === 'shadow' ? 'all' : category;
        updateRouteState({ category: nextCategory, mode: next });
      }}
      onChangeQuery={(next) => {
        setQuery(next);
        updateRouteState({ query: next });
      }}
      onOpenEntry={openRankingEntry}
      onOpenPokemon={(filter) => router.push({
        pathname: '/native/collection',
        params: filter ? { filter } : {},
      })}
      onRetry={retry}
      privacyThreshold={rankingsQuery.data?.privacy_threshold ?? 3}
      rows={rows}
      selectedCategory={workspaces[mode].selectedCategory}
      selectedCollectionFilter={collectionFilter}
      selectedMode={mode}
      showCollectionFilters={Boolean(session.user)}
      snapshotLabel={snapshotLabel}
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
