import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { runtimeConfig } from '../../config/runtimeConfig';
import type { NativeCollectionRow } from '../../features/collection/collectionModel';
import { NativeHomeScreen } from '../../screens/NativeHomeScreen';
import { NativeGuestHomeScreen } from '../../screens/NativeGuestHomeScreen';
import { NativeActionMenu } from '../../components/NativeActionMenu';
import { NativeActionMenuAnchor } from '../../components/NativeActionMenuAnchor';

const ONBOARDING_PROGRESS = {
  completed: 1,
  total: 4,
  tasks: [
    { id: 'collection' as const, title: 'Add your first Pokémon', description: 'Begin with something you have caught or already want.', action: 'Open Pokémon', to: '/pokemon', complete: true },
    { id: 'wanted' as const, title: 'Create a Wanted listing', description: 'Tell the app what you are looking for and which details matter.', action: 'Open wishlist', to: '/pokemon?filter=wanted', complete: false },
    { id: 'trade' as const, title: 'List a Pokémon For Trade', description: 'Choose an eligible caught Pokémon you would offer another trainer.', action: 'Open collection', to: '/pokemon?filter=trade', complete: false },
    { id: 'connect' as const, title: 'Make your first connection', description: 'Find a trainer, add a friend, or begin a trade proposal.', action: 'Find trainers', to: '/search', complete: false },
  ],
};

const RECENT_ROWS: NativeCollectionRow[] = [
  {
    id: 'charizard',
    pokemonId: 6,
    pokedexNumber: 6,
    name: 'Shiny Gigantamax Charizard',
    imageUri: `${runtimeConfig.api.frontendAppUrl}/images/shiny_gigantamax/shiny_gigantamax_6.png`,
    locationBackgroundUri: null,
    maxKind: 'gigantamax',
    purified: false,
    lucky: false,
    typeIconUris: [],
    status: 'trade',
    source: 'instance',
    cp: 2500,
    favorite: false,
    mostWanted: false,
  },
  {
    id: 'pikachu',
    pokemonId: 25,
    pokedexNumber: 25,
    name: 'Shiny Detective Pikachu',
    imageUri: `${runtimeConfig.api.frontendAppUrl}/images/shiny/shiny_pokemon_25.png`,
    locationBackgroundUri: null,
    maxKind: null,
    purified: false,
    lucky: false,
    typeIconUris: [],
    status: 'wanted',
    source: 'instance',
    cp: null,
    favorite: false,
    mostWanted: true,
  },
];

export default function DeviceSmokeHomeRoute() {
  const params = useLocalSearchParams<{
    guest?: string | string[];
    onboarding?: string | string[];
  }>();
  const router = useRouter();
  const [showHint, setShowHint] = useState(true);
  const [lastPath, setLastPath] = useState('');
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);
  if (!runtimeConfig.mobile.deviceSmokeMode) return <Redirect href="/" />;
  const guest = (Array.isArray(params.guest) ? params.guest[0] : params.guest) === '1';
  const onboarding = (Array.isArray(params.onboarding)
    ? params.onboarding[0]
    : params.onboarding) === '1';

  if (guest) {
    return (
      <View style={{ flex: 1 }}>
        <NativeGuestHomeScreen
          assetBaseUrl={runtimeConfig.api.frontendAppUrl}
          onDismissActionMenuHint={() => {
            setTimeout(() => setShowHint(false), 0);
          }}
          onNavigate={setLastPath}
          onOpenActionMenu={() => {
            setActionMenuOpen(true);
          }}
          showActionMenuHint={showHint}
        />
        <NativeActionMenuAnchor
          assetBaseUrl={runtimeConfig.api.frontendAppUrl}
          onPress={() => setActionMenuOpen(true)}
        />
        {actionMenuOpen ? (
          <NativeActionMenu
            assetBaseUrl={runtimeConfig.api.frontendAppUrl}
            onClose={() => setActionMenuOpen(false)}
            onNavigate={(path) => {
              setActionMenuOpen(false);
              setLastPath(path);
            }}
            signedIn={false}
            visible
          />
        ) : null}
        {lastPath ? (
          <Text accessibilityLiveRegion="polite" style={{ position: 'absolute', width: 1, height: 1, opacity: 0.01 }}>
            Navigate {lastPath}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <NativeHomeScreen
        assetBaseUrl={runtimeConfig.api.frontendAppUrl}
        collection={{ caught: 2255, favorites: 77, forTrade: 208, wanted: 168, mostWanted: 1 }}
        friendsState="ready"
        incomingFriends={1}
        onDismissActionMenuHint={() => {
          setTimeout(() => setShowHint(false), 0);
        }}
        onDismissOnboarding={() => setShowOnboarding(false)}
        onOpenActionMenu={() => {
          setActionMenuOpen(true);
        }}
        onNavigate={setLastPath}
        onRetry={() => undefined}
        onboardingProgress={onboarding && showOnboarding ? ONBOARDING_PROGRESS : null}
        pokemonGoName="NexusDemo"
        recentRows={RECENT_ROWS}
        showActionMenuHint={showHint}
        trades={{ needsResponse: 0, readyToConfirm: 1, waiting: 1, completed: 0, active: 1 }}
        username="NexusDemo"
      />
      <NativeActionMenuAnchor
        assetBaseUrl={runtimeConfig.api.frontendAppUrl}
        onPress={() => setActionMenuOpen(true)}
      />
      {actionMenuOpen ? (
        <NativeActionMenu
          assetBaseUrl={runtimeConfig.api.frontendAppUrl}
          onClose={() => setActionMenuOpen(false)}
          onNavigate={(path) => {
            setActionMenuOpen(false);
            if (path === '/pokemon') {
              router.push('/device-smoke/collection');
              return;
            }
            setLastPath(path);
          }}
          pendingFriendCount={1}
          signedIn
          visible
        />
      ) : null}
      {lastPath ? (
        <Text accessibilityLiveRegion="polite" style={{ position: 'absolute', top: 2, left: 2, width: 1, height: 1, opacity: 0.01 }}>
          Navigate {lastPath}
        </Text>
      ) : null}
    </View>
  );
}
