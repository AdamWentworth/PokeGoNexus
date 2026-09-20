import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NativeRouteActionMenu } from '../../components/NativeRouteActionMenu';
import { runtimeConfig } from '../../config/runtimeConfig';
import type { NativeCollectionRow } from '../../features/collection/collectionModel';
import type { NativeTrainerProfileModel } from '../../features/social/nativeTrainerProfileModel';
import { NativeTrainerProfileScreen } from '../../screens/NativeTrainerProfileScreen';

const ASSET_BASE_URL = runtimeConfig.api.frontendAppUrl;

const MODEL: NativeTrainerProfileModel = {
  userId: 'public-misty',
  username: 'Misty',
  pokemonGoName: 'CeruleanLeader',
  avatarLabel: 'M',
  team: 'mystic',
  teamLabel: 'Team Mystic',
  trainerLevel: 50,
  totalXpLabel: '98,765,432 XP',
  memberSinceLabel: 'Mar 4, 2026',
  startedLabel: 'Jul 6, 2016',
  locationLabel: 'Cerulean City',
  trainerCodeLabel: 'Not shared',
  titles: [
    { id: 'shiny-hunter', label: 'Shiny Hunter', description: 'Hunting shiny Pokémon' },
    { id: 'lucky-trader', label: 'Lucky Trader', description: 'Trading and Lucky Pokémon' },
  ],
  highlights: [],
  stats: [
    { key: 'registered', label: 'Registered', value: 842 },
    { key: 'caught', label: 'Caught', value: 410 },
    { key: 'trade', label: 'For trade', value: 62 },
    { key: 'wanted', label: 'Wanted', value: 31 },
    { key: 'favorites', label: 'Favorites', value: 14 },
  ],
  relationship: 'none',
  friendshipId: null,
  canViewCollection: true,
};

const HIGHLIGHTS: NativeCollectionRow[] = [{
  id: 'public-highlight-charizard',
  pokemonId: 6,
  pokedexNumber: 6,
  name: 'Shiny Gigantamax Charizard',
  imageUri: `${ASSET_BASE_URL}/images/shiny_gigantamax/shiny_gigantamax_6.png`,
  locationBackgroundUri: null,
  maxKind: 'gigantamax',
  purified: false,
  lucky: false,
  typeIconUris: [],
  status: 'caught',
  cp: 3000,
  favorite: true,
  mostWanted: false,
}];

export default function DeviceSmokePublicProfileRoute() {
  const [notice, setNotice] = useState('');
  if (!runtimeConfig.mobile.deviceSmokeMode) return <Redirect href="/" />;
  return (
    <View style={styles.screen}>
      <NativeTrainerProfileScreen
        assetBaseUrl={ASSET_BASE_URL}
        highlights={HIGHLIGHTS}
        isOwner={false}
        model={MODEL}
        onBack={() => setNotice('Return home')}
        onOpenCollection={(filter) => setNotice(`Open Misty collection${filter ? `: ${filter}` : ''}`)}
        onOpenFriends={() => setNotice('Open sign in for Friends')}
      />
      {notice ? (
        <View accessibilityLiveRegion="polite" style={styles.notice}>
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}
      <NativeRouteActionMenu currentPath="/profile/Misty" signedIn={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: 0 },
  notice: { position: 'absolute', zIndex: 30, right: 12, bottom: 142, left: 12, borderRadius: 10, padding: 12, backgroundColor: '#123b37' },
  noticeText: { color: '#ccfbf1', fontSize: 14, fontWeight: '900', textAlign: 'center' },
});
