import { type Href, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNativeSession } from '../../auth/NativeSessionContext';
import { NativeActionMenu } from '../../components/NativeActionMenu';
import { NativeActionMenuAnchor } from '../../components/NativeActionMenuAnchor';
import { useNativeAppLoading } from '../../components/NativeAppLoadingProvider';
import { runtimeConfig } from '../../config/runtimeConfig';
import { buildNativeCollectionRows } from '../../features/collection/collectionModel';
import { useNativeCollectionSnapshotQuery } from '../../features/collection/collectionQueries';
import { primeNativeCollectionSession } from '../../features/collection/nativeCollectionSessionCache';
import {
  EMPTY_NATIVE_HOME_COLLECTION,
  EMPTY_NATIVE_HOME_TRADES,
  buildNativeHomeOnboardingProgress,
  selectNativeHomeRecentRows,
  summarizeNativeHomeCollection,
  summarizeNativeHomeTrades,
} from '../../features/home/nativeHomeDashboardModel';
import {
  dismissNativeHomeActionMenuHint,
  dismissNativeHomeOnboarding,
  isNativeHomeActionMenuHintDismissed,
  isNativeHomeOnboardingDismissed,
} from '../../features/home/nativeHomePreferences';
import { useNativeFriendsQuery } from '../../features/social/socialQueries';
import { useNativeTradesQuery } from '../../features/trades/tradeQueries';
import { isNativeInformationSlug } from '../../features/information/nativeInformationContent';
import { resolveNativeActionMenuDestination } from '../../navigation/nativeActionMenuNavigation';
import {
  resolveNativeHomeCollectionEntry,
  runNativeHomeNavigationWithLoading,
} from '../../navigation/nativeHomeNavigation';
import { NativeGuestHomeScreen } from '../../screens/NativeGuestHomeScreen';
import { NativeHomeScreen } from '../../screens/NativeHomeScreen';
import { useNativeColorScheme } from '../../features/settings/useNativeColorScheme';
import { markNativeUiPerformance } from '../../observability/nativeUiPerformanceTrace';

export default function NativeHomeRoute() {
  const router = useRouter();
  const session = useNativeSession();
  const { runWithLoading } = useNativeAppLoading();
  const light = useNativeColorScheme() === 'light';
  const userId = session.user?.user_id ?? null;
  const onboardingOwnerKey = session.user
    ? session.user.user_id || session.user.username
    : null;
  const collectionQuery = useNativeCollectionSnapshotQuery(userId);
  const tradesQuery = useNativeTradesQuery(userId);
  const friendsQuery = useNativeFriendsQuery(userId);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [showActionMenuHint, setShowActionMenuHint] = useState(false);
  const [onboardingPreference, setOnboardingPreference] = useState<{
    dismissed: boolean;
    ownerKey: string;
  } | null>(null);
  const onboardingDismissed = onboardingPreference?.ownerKey === onboardingOwnerKey
    ? onboardingPreference.dismissed
    : null;

  const navigate = (path: string) => {
    setActionMenuOpen(false);
    const [pathname = '/', search = ''] = path.split('?');
    const params = new URLSearchParams(search);
    markNativeUiPerformance('home_link_pressed', {
      canonicalPath: path,
      collectionHasData: Boolean(collectionQuery.data),
      collectionIsPending: collectionQuery.isPending,
    });

    if (pathname === '/') return;
    runNativeHomeNavigationWithLoading(runWithLoading, () => {
      if (isNativeInformationSlug(pathname.slice(1))) {
        router.push({ pathname: '/native/info/[slug]', params: { slug: pathname.slice(1) } });
        return;
      }
      if (pathname === '/login') {
        router.push('/native/login');
        return;
      }
      if (pathname === '/register') {
        router.push('/native/register');
        return;
      }
      if (pathname === '/pokemon') {
        const collectionEntry = resolveNativeHomeCollectionEntry(path);
        if (collectionEntry.selectedTagKey && session.user) {
          primeNativeCollectionSession(`self:${session.user.user_id}`, {
            activeView: 'pokemon',
            query: '',
            scrollOffset: 0,
            selectedTagKey: collectionEntry.selectedTagKey,
          });
        }
        markNativeUiPerformance('home_collection_navigation_started', {
          destination: collectionEntry.destination,
          selectedTagKey: collectionEntry.selectedTagKey,
        });
        router.push(collectionEntry.destination as Href);
        return;
      }
      if (pathname === '/pokedex') {
        router.push('/native/pokedex');
        return;
      }
      if (pathname === '/trades') {
        const section = params.get('section');
        router.push(section
          ? { pathname: '/native/trades', params: { section } }
          : '/native/trades');
        return;
      }
      if (pathname === '/profile/friends') {
        router.push('/native/friends');
        return;
      }
      if (pathname === '/friends') {
        router.push('/native/friends');
        return;
      }
      if (pathname === '/profile') {
        router.push('/native/profile');
        return;
      }
      if (pathname === '/search') {
        router.push('/native/search');
        return;
      }
      if (pathname === '/settings') {
        router.push('/native/settings');
        return;
      }
      if (pathname === '/settings/account') {
        router.push('/native/account');
        return;
      }
      if (pathname === '/trade-board') {
        router.push('/native/trade-board');
        return;
      }
      const destination = resolveNativeActionMenuDestination(pathname);
      if (destination.kind === 'native') {
        router.push(destination.pathname);
        return;
      }
      if (destination.kind === 'current') return;
      router.push({ pathname: '/web', params: { path } });
    });
  };
  const navigateFromActionMenu = (path: string) => {
    const destination = resolveNativeActionMenuDestination(path, '/');
    if (destination.kind === 'current') {
      setActionMenuOpen(false);
      return;
    }
    if (destination.kind === 'native') {
      setActionMenuOpen(false);
      router.push(destination.pathname);
      return;
    }
    navigate(destination.path);
  };

  useEffect(() => {
    let active = true;
    void isNativeHomeActionMenuHintDismissed(userId)
      .then((dismissed) => { if (active) setShowActionMenuHint(!dismissed); })
      .catch(() => { if (active) setShowActionMenuHint(true); });
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    let active = true;
    if (!onboardingOwnerKey) {
      return () => { active = false; };
    }
    void isNativeHomeOnboardingDismissed(onboardingOwnerKey)
      .then((dismissed) => {
        if (active) setOnboardingPreference({ dismissed, ownerKey: onboardingOwnerKey });
      })
      .catch(() => {
        if (active) setOnboardingPreference({ dismissed: false, ownerKey: onboardingOwnerKey });
      });
    return () => { active = false; };
  }, [onboardingOwnerKey]);

  // The Home query already warms collection data. Expo Router route preloading
  // also mounts the full destination tree offscreen, which duplicates the
  // collection/Pokédex UI and competes with Home and action-menu interactions.
  const rows = useMemo(() => {
    if (!collectionQuery.data) return [];
    return buildNativeCollectionRows(
      collectionQuery.data.instances,
      collectionQuery.data.catalog,
      runtimeConfig.api.frontendAppUrl,
    );
  }, [collectionQuery.data]);
  const collection = useMemo(() => (
    collectionQuery.data
      ? summarizeNativeHomeCollection(collectionQuery.data.instances)
      : EMPTY_NATIVE_HOME_COLLECTION
  ), [collectionQuery.data]);
  const trades = useMemo(() => (
    tradesQuery.data && session.user
      ? summarizeNativeHomeTrades(tradesQuery.data.trades, session.user.username)
      : EMPTY_NATIVE_HOME_TRADES
  ), [session.user, tradesQuery.data]);
  const recentRows = useMemo(() => (
    collectionQuery.data
      ? selectNativeHomeRecentRows(rows, collectionQuery.data.instances)
      : []
  ), [collectionQuery.data, rows]);
  const onboardingProgress = useMemo(() => buildNativeHomeOnboardingProgress(
    collection,
    (friendsQuery.data?.friends.length ?? 0)
      + (friendsQuery.data?.incoming.length ?? 0)
      + (friendsQuery.data?.outgoing.length ?? 0)
      + (tradesQuery.data?.trades.length ?? 0),
  ), [collection, friendsQuery.data, tradesQuery.data]);

  if (session.status === 'restoring') {
    return (
      <View style={[styles.status, light && styles.statusLight]}>
        <ActivityIndicator color="#299cf5" size="large" />
        <Text style={[styles.statusText, light && styles.statusTextLight]}>Opening Pokémon Go Nexus…</Text>
      </View>
    );
  }

  if (session.status === 'unavailable') {
    return (
      <View style={[styles.status, light && styles.statusLight]}>
        <Text accessibilityRole="header" style={[styles.statusTitle, light && styles.statusTextLight]}>Session check unavailable</Text>
        <Text style={[styles.statusText, light && styles.statusMutedLight]}>Your saved session is still secure. Retry when you are online.</Text>
        <Pressable accessibilityRole="button" onPress={() => void session.retrySession()} style={styles.retry}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!session.user) {
    const dismissGuestActionMenuHint = () => {
      void dismissNativeHomeActionMenuHint(null);
    };
    const openGuestActionMenu = () => {
      setShowActionMenuHint(false);
      void dismissNativeHomeActionMenuHint(null);
      setActionMenuOpen(true);
    };
    return (
      <View style={styles.root}>
        <NativeGuestHomeScreen
          assetBaseUrl={runtimeConfig.api.frontendAppUrl}
          onDismissActionMenuHint={dismissGuestActionMenuHint}
          onNavigate={navigate}
          onOpenActionMenu={() => setActionMenuOpen(true)}
          showActionMenuHint={showActionMenuHint}
        />
        <NativeActionMenuAnchor assetBaseUrl={runtimeConfig.api.frontendAppUrl} onPress={openGuestActionMenu} />
        <NativeActionMenu
          assetBaseUrl={runtimeConfig.api.frontendAppUrl}
          onClose={() => setActionMenuOpen(false)}
          onNavigate={navigateFromActionMenu}
          visible={actionMenuOpen}
        />
      </View>
    );
  }
  if (onboardingDismissed === null) {
    return (
      <View style={[styles.status, light && styles.statusLight]}>
        <ActivityIndicator color="#299cf5" size="large" />
        <Text style={[styles.statusText, light && styles.statusTextLight]}>Preparing your trainer dashboard…</Text>
      </View>
    );
  }
  const signedInUser = session.user;
  const dismissActionMenuHint = () => {
    void dismissNativeHomeActionMenuHint(signedInUser.user_id);
  };
  const openSignedInActionMenu = () => {
    setShowActionMenuHint(false);
    void dismissNativeHomeActionMenuHint(signedInUser.user_id);
    setActionMenuOpen(true);
  };
  const dismissOnboarding = () => {
    const ownerKey = signedInUser.user_id || signedInUser.username;
    setOnboardingPreference({ dismissed: true, ownerKey });
    void dismissNativeHomeOnboarding(ownerKey);
  };
  const queryErrors = [collectionQuery.error, tradesQuery.error]
    .filter((error): error is Error => error instanceof Error)
    .map((error) => error.message)
    .filter(Boolean);

  return (
    <View style={styles.root}>
      <NativeHomeScreen
        assetBaseUrl={runtimeConfig.api.frontendAppUrl}
        collection={collection}
        error={queryErrors.length ? queryErrors.join(' ') : null}
        friendsState={friendsQuery.isPending ? 'loading' : friendsQuery.isError ? 'error' : 'ready'}
        incomingFriends={friendsQuery.data?.incoming.length ?? 0}
        isCollectionLoading={collectionQuery.isPending}
        isRecentLoading={collectionQuery.isPending}
        onDismissActionMenuHint={dismissActionMenuHint}
        onDismissOnboarding={dismissOnboarding}
        onOpenActionMenu={() => setActionMenuOpen(true)}
        onNavigate={navigate}
        onRetry={() => {
          void collectionQuery.refetch();
          void tradesQuery.refetch();
          void friendsQuery.refetch();
        }}
        onboardingProgress={
          !collectionQuery.isPending
          && onboardingDismissed === false
          && onboardingProgress.completed < onboardingProgress.total
            ? onboardingProgress
            : null
        }
        pokemonGoName={signedInUser.pokemonGoName}
        recentRows={recentRows}
        showActionMenuHint={showActionMenuHint}
        trades={trades}
        username={signedInUser.username}
      />
      <NativeActionMenuAnchor
        assetBaseUrl={runtimeConfig.api.frontendAppUrl}
        onPress={openSignedInActionMenu}
      />
      <NativeActionMenu
        assetBaseUrl={runtimeConfig.api.frontendAppUrl}
        onClose={() => setActionMenuOpen(false)}
        onNavigate={navigateFromActionMenu}
        visible={actionMenuOpen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  status: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, backgroundColor: '#071012' },
  statusLight: { backgroundColor: '#f8fff9' },
  statusTitle: { color: '#f4fbfd', fontSize: 23, fontWeight: '900', textAlign: 'center' },
  statusText: { maxWidth: 420, color: '#bac8ca', fontSize: 15, lineHeight: 21, textAlign: 'center' },
  statusTextLight: { color: '#193d40' },
  statusMutedLight: { color: '#597073' },
  retry: { minWidth: 210, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#299cf5' },
  retryText: { color: '#071012', fontWeight: '900' },
});
