import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Animated, StyleSheet, View } from 'react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  NativeHorizontalPageSlider,
  type NativeHorizontalPageSliderHandle,
} from '../../components/NativeHorizontalPageSlider';
import { useNativeSession } from '../../auth/NativeSessionContext';
import { runtimeConfig } from '../../config/runtimeConfig';
import {
  useNativeCollectionSnapshotQuery,
  useNativePokemonMovesQuery,
} from '../../features/collection/collectionQueries';
import {
  NativeTradeHubHeader,
  type NativeTradeHubView,
} from '../../features/trades/NativeTradeHubHeader';
import { buildNativeTradeActivityRows } from '../../features/trades/nativeTradeActivityRows';
import {
  executeNativeTradeActivityAction,
} from '../../features/trades/nativeTradeActivityCommands';
import {
  buildNativeTradePreferenceEntrySets,
  resolveNativeTradePreferenceDraftCandidates,
  type NativeTradePreferenceMode,
} from '../../features/trades/nativeTradePreferencesModel';
import {
  useNativeTradeCommand,
  useNativeTradesQuery,
  useNativeTradeSatisfactionMutation,
} from '../../features/trades/tradeQueries';
import {
  useNativeTradePreferenceMutation,
} from '../../features/trades/useNativeTradePreferenceMutation';
import { getNativeTradePartnerInfo } from '../../services/tradeApi';
import { useNativeApiClients } from '../../services/useNativeApiClients';
import { NativeTradeActivityScreen } from '../../screens/NativeTradeActivityScreen';
import { NativeTradePreferencesScreen } from '../../screens/NativeTradePreferencesScreen';
import { NativeActionMenu } from '../../components/NativeActionMenu';
import { NativeActionMenuAnchor } from '../../components/NativeActionMenuAnchor';
import { resolveNativeActionMenuDestination } from '../../navigation/nativeActionMenuNavigation';
import { useNativeColorScheme } from '../../features/settings/useNativeColorScheme';
import { NativeProtectedSessionGate } from '../../components/NativeProtectedSessionGate';
import { markNativeUiPerformanceAfterPaint } from '../../observability/nativeUiInteractionTiming';

const TRADE_VIEWS: NativeTradeHubView[] = ['preferences', 'activity'];

const firstParam = (value: string | string[] | undefined): string => (
  Array.isArray(value) ? value[0] ?? '' : value ?? ''
);

const initialTradeView = (value: string): NativeTradeHubView => (
  TRADE_VIEWS.includes(value as NativeTradeHubView)
    ? value as NativeTradeHubView
    : 'preferences'
);

const initialPreferenceMode = (value: string): NativeTradePreferenceMode => (
  value === 'wanted' ? 'wanted' : 'trade'
);

export default function NativeTradesRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    instance?: string | string[];
    mode?: string | string[];
    section?: string | string[];
  }>();
  const session = useNativeSession();
  const clients = useNativeApiClients();
  const light = useNativeColorScheme() === 'light';
  const userId = session.user?.user_id ?? 'signed-out';
  const tradesQuery = useNativeTradesQuery(session.user?.user_id ?? null);
  const collectionQuery = useNativeCollectionSnapshotQuery(session.user?.user_id ?? null);
  const movesQuery = useNativePokemonMovesQuery(Boolean(session.user));
  const preferencesMutation = useNativeTradePreferenceMutation(userId);
  const accept = useNativeTradeCommand(userId, 'accept');
  const deny = useNativeTradeCommand(userId, 'deny');
  const cancel = useNativeTradeCommand(userId, 'cancel');
  const complete = useNativeTradeCommand(userId, 'complete');
  const repropose = useNativeTradeCommand(userId, 'repropose');
  const satisfaction = useNativeTradeSatisfactionMutation(userId);
  const [activeView, setActiveView] = useState<NativeTradeHubView>(() => (
    initialTradeView(firstParam(params.section))
  ));
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [pageScrollX] = useState(() => new Animated.Value(0));
  const sliderRef = useRef<NativeHorizontalPageSliderHandle>(null);
  const activeIndex = TRADE_VIEWS.indexOf(activeView);
  const preferenceMode = initialPreferenceMode(firstParam(params.mode));
  const preferenceEntryId = firstParam(params.instance) || null;

  const changeView = useCallback((view: NativeTradeHubView) => {
    const startedAt = Date.now();
    setActiveView(view);
    sliderRef.current?.setPage(TRADE_VIEWS.indexOf(view));
    // Vite's contract records the first painted active panel, not the end of
    // the decorative slide. Keep the native readiness boundary identical.
    markNativeUiPerformanceAfterPaint('trade_section_result_painted', startedAt);
  }, []);
  const activityRows = useMemo(() => {
    if (!tradesQuery.data || !collectionQuery.data) return [];
    return buildNativeTradeActivityRows({
      assetOrigin: runtimeConfig.api.frontendAppUrl,
      catalog: collectionQuery.data.catalog,
      currentUsername: session.user?.username ?? '',
      envelope: tradesQuery.data,
      moves: movesQuery.data ?? [],
    });
  }, [collectionQuery.data, movesQuery.data, session.user?.username, tradesQuery.data]);
  const preferenceEntries = useMemo(() => {
    const snapshot = collectionQuery.data;
    if (!snapshot) return { trade: [], wanted: [] };
    return buildNativeTradePreferenceEntrySets({
      assetOrigin: runtimeConfig.api.frontendAppUrl,
      catalog: snapshot.catalog,
      instances: snapshot.instances,
    });
  }, [collectionQuery.data]);
  const preferenceSelectionState = preferenceEntryId
    ? preferenceEntries[preferenceMode].some((entry) => entry.collectionKey === preferenceEntryId)
      ? 'selected'
      : collectionQuery.isPending ? 'loading' : 'missing'
    : collectionQuery.isPending ? 'loading' : 'default';

  if (session.status === 'restoring' || session.status === 'unavailable') {
    return (
      <NativeProtectedSessionGate
        message="Opening trades…"
        onRetry={session.retrySession}
        status={session.status}
      />
    );
  }

  if (session.status !== 'signed-in' || !session.user) {
    return <Redirect href="/native/login?returnTo=%2Fnative%2Ftrades" />;
  }

  const activityErrors = [tradesQuery.error, collectionQuery.error]
    .filter((error): error is Error => error instanceof Error)
    .map((error) => error.message);
  const collectionError = collectionQuery.error instanceof Error
    ? collectionQuery.error.message
    : null;
  const navigateFromActionMenu = (path: string) => {
    setActionMenuOpen(false);
    const destination = resolveNativeActionMenuDestination(path, '/trades');
    if (destination.kind === 'current') return;
    if (destination.kind === 'native') {
      router.push(destination.pathname);
      return;
    }
    router.push({ pathname: '/web', params: { path: destination.path } });
  };

  return (
    <View style={[styles.screen, light && styles.screenLight]} testID="native-trades-hub">
      <NativeTradeHubHeader
        activeView={activeView}
        assetBaseUrl={runtimeConfig.api.frontendAppUrl}
        onOpenTradeBoard={() => router.push('/native/trade-board')}
        onViewChange={changeView}
        scrollX={pageScrollX}
      />
      <NativeHorizontalPageSlider
        activeIndex={activeIndex}
        onIndexChange={(index) => setActiveView(TRADE_VIEWS[index] ?? 'preferences')}
        ref={sliderRef}
        scrollX={pageScrollX}
      >
        <NativeTradePreferencesScreen
          key={`${preferenceMode}:${preferenceEntryId ?? 'default'}:${preferenceSelectionState}`}
          assetBaseUrl={runtimeConfig.api.frontendAppUrl}
          entries={preferenceEntries}
          error={collectionError}
          initialEntryId={preferenceEntryId}
          initialMode={preferenceMode}
          isLoading={collectionQuery.isPending}
          onOpenActivity={() => changeView('activity')}
          onSave={async (entry, draft) => {
            const candidates = resolveNativeTradePreferenceDraftCandidates({
              entry,
              filters: draft.filters,
              manuallyExcludedIds: new Set(draft.manuallyExcludedIds),
              mirror: draft.mirror,
            });
            await preferencesMutation.mutateAsync({
              filteredOutIds: candidates
                .filter((candidate) => candidate.excludedByRule)
                .map((candidate) => candidate.collectionKey),
              filters: draft.filters,
              manuallyExcludedIds: draft.manuallyExcludedIds,
              mirror: draft.mirror,
              mode: entry.mode,
              selectedInstanceId: entry.collectionKey,
            });
          }}
          showModeTabs={false}
        />
        <NativeTradeActivityScreen
          assetBaseUrl={runtimeConfig.api.frontendAppUrl}
          error={activityErrors.length ? activityErrors.join(' ') : null}
          isLoading={tradesQuery.isPending || collectionQuery.isPending}
          onAction={(model, action) => executeNativeTradeActivityAction(
            model.tradeId,
            action,
            {
              accept: accept.mutateAsync,
              cancel: cancel.mutateAsync,
              complete: complete.mutateAsync,
              deny: deny.mutateAsync,
              repropose: repropose.mutateAsync,
              satisfy: (tradeId) => satisfaction.mutateAsync({ tradeId, satisfied: true }),
            },
          )}
          onOpenPreferences={() => changeView('preferences')}
          onRetry={() => {
            void tradesQuery.refetch();
            void collectionQuery.refetch();
          }}
          onRevealPartner={(tradeId) => getNativeTradePartnerInfo(clients.users, tradeId)}
          rows={activityRows}
          showModeTabs={false}
        />
      </NativeHorizontalPageSlider>
      <NativeActionMenuAnchor
        assetBaseUrl={runtimeConfig.api.frontendAppUrl}
        onPress={() => setActionMenuOpen(true)}
      />
      {actionMenuOpen ? (
        <NativeActionMenu
          assetBaseUrl={runtimeConfig.api.frontendAppUrl}
          onClose={() => setActionMenuOpen(false)}
          onNavigate={navigateFromActionMenu}
          visible
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: 0, backgroundColor: '#071012' },
  screenLight: { backgroundColor: '#f8fff9' },
});
