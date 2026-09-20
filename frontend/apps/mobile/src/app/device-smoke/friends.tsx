import { Redirect } from 'expo-router';
import { Animated, StyleSheet, View } from 'react-native';
import { useState } from 'react';
import { runtimeConfig } from '../../config/runtimeConfig';
import { NativeRouteActionMenu } from '../../components/NativeRouteActionMenu';
import type { NativeFriendsOverviewModel } from '../../features/social/nativeFriendsModel';
import {
  NativeFriendsScreen,
  type NativeFriendsScreenCommand,
  type NativeFriendsView,
} from '../../screens/NativeFriendsScreen';

const baseFriend = {
  userId: 'partner-user-001',
  friendshipId: 'friendship-harbour',
  username: 'HarbourMew',
  pokemonGoName: 'HarbourMew',
  avatarLabel: 'H',
  team: 'neutral' as const,
  teamLabel: null,
  trainerLevel: null,
};

const INITIAL_OVERVIEW: NativeFriendsOverviewModel = {
  friends: [baseFriend],
  incoming: [{
    ...baseFriend,
    userId: 'user-brock',
    friendshipId: 'friendship-brock',
    username: 'Brock',
    pokemonGoName: 'PewterLeader',
    avatarLabel: 'B',
    team: 'valor',
    teamLabel: 'Team Valor',
  }, {
    ...baseFriend,
    userId: 'user-erika',
    friendshipId: 'friendship-erika',
    username: 'Erika',
    pokemonGoName: 'CeladonLeader',
    avatarLabel: 'E',
    team: 'mystic',
    teamLabel: 'Team Mystic',
  }],
  outgoing: [{
    ...baseFriend,
    userId: 'user-blue',
    friendshipId: 'friendship-blue',
    username: 'Blue',
    pokemonGoName: 'Blue',
    avatarLabel: 'B',
    team: 'mystic',
    teamLabel: 'Team Mystic',
  }],
  blocked: [],
};

const BLOCKED_FIXTURE = {
  ...baseFriend,
  userId: 'user-rocket',
  friendshipId: 'friendship-rocket',
  username: 'Rocket',
  pokemonGoName: null,
  avatarLabel: 'R',
};

export default function DeviceSmokeFriendsRoute() {
  const [activeView, setActiveView] = useState<NativeFriendsView>('friends');
  const [overview, setOverview] = useState(INITIAL_OVERVIEW);
  const [query, setQuery] = useState('gary');
  const [feedback, setFeedback] = useState<{ tone: 'success'; text: string } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [scrollX] = useState(() => new Animated.Value(0));
  if (!runtimeConfig.mobile.deviceSmokeMode) return <Redirect href="/" />;

  const command = (action: NativeFriendsScreenCommand) => {
    if (action.action === 'accept') {
      const accepted = overview.incoming.find((row) => row.friendshipId === action.friendshipId);
      setOverview((current) => ({
        ...current,
        friends: accepted ? [...current.friends, accepted] : current.friends,
        incoming: current.incoming.filter((row) => row.friendshipId !== action.friendshipId),
      }));
      setFeedback({ tone: 'success', text: 'Friend request accepted.' });
      return;
    }
    if (action.action === 'unblock') {
      setOverview((current) => ({
        ...current,
        blocked: current.blocked.filter((row) => row.userId !== action.userId),
      }));
      setFeedback({ tone: 'success', text: 'Trainer unblocked.' });
      return;
    }
    if (action.action === 'delete-request') {
      setOverview((current) => ({
        ...current,
        incoming: current.incoming.filter((row) => row.friendshipId !== action.friendshipId),
        outgoing: current.outgoing.filter((row) => row.friendshipId !== action.friendshipId),
      }));
      setFeedback({ tone: 'success', text: action.message });
      return;
    }
    if (action.action === 'remove-friend') {
      setOverview((current) => ({
        ...current,
        friends: current.friends.filter((row) => row.userId !== action.userId),
      }));
      setFeedback({ tone: 'success', text: 'Friend removed.' });
      return;
    }
    setOverview((current) => ({
      ...current,
      outgoing: [...current.outgoing, {
        ...baseFriend,
        userId: 'user-gary',
        friendshipId: 'friendship-gary',
        username: action.username,
        pokemonGoName: 'PalletRival',
        avatarLabel: 'G',
        team: 'instinct',
        teamLabel: 'Team Instinct',
        trainerLevel: 47,
      }],
    }));
    setFeedback({ tone: 'success', text: 'Friend request sent.' });
  };
  const changeView = (view: NativeFriendsView) => {
    if (view === 'blocked') {
      setOverview((current) => current.blocked.length
        ? current
        : { ...current, blocked: [BLOCKED_FIXTURE] });
    }
    setActiveView(view);
  };

  return (
    <View style={styles.screen}>
      <NativeFriendsScreen
        activeView={activeView}
        feedback={feedback}
        isSearching={isSearching}
        onBack={() => undefined}
        onCommand={command}
        onDismissFeedback={() => setFeedback(null)}
        onOpenProfile={() => undefined}
        onOpenProfileHome={() => undefined}
        onQueryChange={setQuery}
        onRunSearch={() => {
          setIsSearching(true);
          requestAnimationFrame(() => setIsSearching(false));
        }}
        onViewChange={changeView}
        overview={overview}
        query={query}
        scrollX={scrollX}
        searchResults={[{
          username: 'GaryOak',
          pokemonGoName: 'PalletRival',
          avatarLabel: 'G',
          team: 'instinct',
          teamLabel: 'Team Instinct',
          trainerLevel: 47,
        }]}
      />
      <NativeRouteActionMenu currentPath="/profile/friends" signedIn />
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1 } });
