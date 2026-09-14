import { useLocalSearchParams, useRouter } from 'expo-router';
import { Animated, StyleSheet, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { useNativeTrainerSearchQuery } from '../search/searchQueries';
import {
  buildNativeFriendsOverviewModel,
  EMPTY_NATIVE_FRIENDS_OVERVIEW,
  filterNativeFriendSearchResults,
} from './nativeFriendsModel';
import {
  useNativeFriendsMutation,
  useNativeFriendsQuery,
} from './socialQueries';
import {
  hydrateNativeFriendsSession,
  patchNativeFriendsSession,
  readNativeFriendsSession,
  writeNativeFriendsSession,
} from './nativeFriendsSessionCache';
import {
  NativeFriendsScreen,
  type NativeFriendsScreenCommand,
  type NativeFriendsView,
} from '../../screens/NativeFriendsScreen';

const FRIEND_VIEWS: NativeFriendsView[] = ['friends', 'requests', 'find', 'blocked'];

const firstParam = (value: string | string[] | undefined): string => (
  Array.isArray(value) ? value[0] ?? '' : value ?? ''
);

const validView = (value: string): NativeFriendsView | null => (
  FRIEND_VIEWS.includes(value as NativeFriendsView) ? value as NativeFriendsView : null
);

const errorMessage = (error: unknown, fallback: string): string => (
  error instanceof Error && error.message.trim() ? error.message : fallback
);

export const NativeFriendsPanel = ({
  userId,
  username,
  onOpenProfileHome,
}: {
  userId: string;
  username: string;
  onOpenProfileHome: () => void;
}) => {
  const params = useLocalSearchParams<{ tab?: string | string[] }>();
  const router = useRouter();
  const requestedView = validView(firstParam(params.tab));
  const [initialSession] = useState(() => readNativeFriendsSession(userId));
  const [sessionHydrated, setSessionHydrated] = useState(Boolean(initialSession));
  const [activeView, setActiveView] = useState<NativeFriendsView>(() => (
    requestedView ?? initialSession?.activeView ?? 'friends'
  ));
  const [pageScrollX] = useState(() => new Animated.Value(0));
  const [query, setQuery] = useState(initialSession?.query ?? '');
  const [executedQuery, setExecutedQuery] = useState(initialSession?.executedQuery ?? '');
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  const friendsQuery = useNativeFriendsQuery(userId);
  const friendsMutation = useNativeFriendsMutation(userId);
  const trainerSearch = useNativeTrainerSearchQuery(executedQuery, executedQuery.length >= 2);
  const overview = useMemo(() => (
    friendsQuery.data
      ? buildNativeFriendsOverviewModel(friendsQuery.data)
      : EMPTY_NATIVE_FRIENDS_OVERVIEW
  ), [friendsQuery.data]);
  const searchResults = useMemo(() => filterNativeFriendSearchResults({
    entries: trainerSearch.data ?? [],
    username,
  }), [trainerSearch.data, username]);

  useEffect(() => {
    if (initialSession) return;
    let cancelled = false;
    void hydrateNativeFriendsSession(userId).then((restored) => {
      if (cancelled) return;
      if (restored) {
        setActiveView(requestedView ?? restored.activeView);
        setQuery(restored.query);
        setExecutedQuery(restored.executedQuery);
      }
      setSessionHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [initialSession, requestedView, userId]);

  useEffect(() => {
    if (!sessionHydrated) return;
    if (!readNativeFriendsSession(userId)) {
      writeNativeFriendsSession({
        activeView,
        executedQuery,
        ownerKey: userId,
        query,
      });
      return;
    }
    patchNativeFriendsSession(userId, { activeView, executedQuery, query });
  }, [activeView, executedQuery, query, sessionHydrated, userId]);

  const runCommand = async (command: NativeFriendsScreenCommand) => {
    try {
      const message = await friendsMutation.mutateAsync(command);
      await friendsQuery.refetch();
      setFeedback({ tone: 'success', text: message });
    } catch (error) {
      setFeedback({ tone: 'error', text: errorMessage(error, 'That trainer action could not be completed.') });
    }
  };
  const runSearch = () => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setFeedback({ tone: 'info', text: 'Enter at least two characters.' });
      return;
    }
    setFeedback(null);
    if (normalized === executedQuery) {
      void trainerSearch.refetch();
      return;
    }
    setExecutedQuery(normalized);
  };

  return (
    <View style={styles.screen} testID="native-friends-route">
      <NativeFriendsScreen
        embedded
        activeView={activeView}
        error={friendsQuery.error ? errorMessage(friendsQuery.error, 'Could not load friends.') : null}
        feedback={feedback}
        isCommandPending={friendsMutation.isPending}
        isLoading={friendsQuery.isPending}
        isSearching={trainerSearch.isFetching}
        onBack={onOpenProfileHome}
        onCommand={(command) => void runCommand(command)}
        onDismissFeedback={() => setFeedback(null)}
        onOpenProfile={(trainerUsername) => router.push({
          pathname: '/native/profile/[username]',
          params: { username: trainerUsername },
        })}
        onOpenProfileHome={onOpenProfileHome}
        onQueryChange={setQuery}
        onRetry={() => void friendsQuery.refetch()}
        onRunSearch={runSearch}
        onViewChange={setActiveView}
        overview={overview}
        query={query}
        scrollX={pageScrollX}
        searchError={trainerSearch.error ? errorMessage(trainerSearch.error, 'Trainer search failed.') : null}
        searchResults={executedQuery ? searchResults : []}
      />
    </View>
  );
};

const styles = StyleSheet.create({ screen: { flex: 1, minHeight: 0 } });
