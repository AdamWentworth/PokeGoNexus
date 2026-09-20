import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeCollectionRow } from '../features/collection/collectionModel';
import type { NativeCatalogDestination } from '../features/collection/nativeCatalogMutation';
import { useNativeColorScheme } from '../features/settings/useNativeColorScheme';

type Props = {
  row: NativeCollectionRow | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  notice: string | null;
  onBack: () => void;
  onAdd: (destination: NativeCatalogDestination) => void;
};

export const NativeCatalogDetailScreen = ({
  row,
  isLoading,
  isSaving,
  error,
  notice,
  onBack,
  onAdd,
}: Props) => {
  const light = useNativeColorScheme() === 'light';
  const insets = useSafeAreaInsets();
  if (isLoading) {
    return (
      <View style={[styles.centered, light && styles.screenLight]}>
        <ActivityIndicator color="#42d4c4" size="large" />
        <Text style={[styles.loading, light && styles.textLight]}>Loading Pokémon…</Text>
      </View>
    );
  }
  if (!row) {
    return (
      <View style={[styles.centered, light && styles.screenLight]}>
        <Text style={[styles.title, light && styles.textLight]}>Pokémon unavailable</Text>
        <Text style={[styles.body, light && styles.secondaryLight]}>{error ?? 'This catalog entry was not found.'}</Text>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Back to Pokémon</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: 14 + insets.top, paddingBottom: 36 + insets.bottom }]}
      style={[styles.screen, light && styles.screenLight]}
      testID="native-catalog-detail-screen"
    >
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Back to Pokémon" accessibilityRole="button" onPress={onBack} style={styles.closeButton}>
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>
      <View style={[styles.hero, light && styles.cardLight]}>
        <Text style={[styles.dex, light && styles.secondaryLight]}>
          #{String(row.pokedexNumber).padStart(4, '0')}
        </Text>
        <View style={styles.imageStage}>
          {row.imageUri ? (
            <Image fadeDuration={0} accessibilityLabel={row.name} resizeMode="contain" source={{ uri: row.imageUri }} style={styles.image} />
          ) : null}
          {row.maxKind ? (
            <Image fadeDuration={0}
              accessibilityLabel={row.maxKind === 'gigantamax' ? 'Gigantamax' : 'Dynamax'}
              resizeMode="contain"
              source={{ uri: `https://pokegonexus.com/images/${row.maxKind}.png` }}
              style={styles.maxBadge}
            />
          ) : null}
        </View>
        <Text accessibilityRole="header" style={[styles.name, light && styles.textLight]}>{row.name}</Text>
        <View style={styles.types}>
          {row.typeIconUris.map((uri) => (
            <Image fadeDuration={0} accessibilityElementsHidden key={uri} source={{ uri }} style={styles.typeIcon} />
          ))}
        </View>
      </View>

      <View style={[styles.organizer, light && styles.cardLight]}>
        <Text style={styles.eyebrow}>ADD POKÉMON</Text>
        <Text style={[styles.sectionTitle, light && styles.textLight]}>Where should this Pokémon go?</Text>
        <Text style={[styles.body, light && styles.secondaryLight]}>
          Create a real collection instance now. You can edit its exact details afterward.
        </Text>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={() => onAdd('caught')}
            style={[styles.actionButton, styles.caughtButton]}
          >
            <Text style={styles.actionTitle}>Caught</Text>
            <Text style={styles.actionBody}>Add to your collection</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={() => onAdd('trade')}
            style={[styles.actionButton, styles.tradeButton]}
          >
            <Text style={styles.actionTitle}>For Trade</Text>
            <Text style={styles.actionBody}>List a caught copy for trade</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={() => onAdd('wanted')}
            style={[styles.actionButton, styles.wantedButton]}
          >
            <Text style={styles.actionTitle}>Wanted</Text>
            <Text style={styles.actionBody}>Add to your wishlist</Text>
          </Pressable>
        </View>
        {isSaving ? <ActivityIndicator color="#42d4c4" /> : null}
        {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#07110f' },
  screenLight: { backgroundColor: '#f8fff9' },
  content: { flexGrow: 1, gap: 14, padding: 14, paddingBottom: 36 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: '#07110f' },
  loading: { color: '#dbe7e3', fontSize: 15, fontWeight: '700' },
  topBar: { minHeight: 48, alignItems: 'flex-start', justifyContent: 'center' },
  closeButton: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#79d7cf', borderRadius: 23, backgroundColor: '#f2ffff' },
  closeText: { color: '#157a76', fontSize: 30, lineHeight: 32 },
  hero: { alignItems: 'center', borderRadius: 18, padding: 18, backgroundColor: '#2f3331' },
  cardLight: { backgroundColor: '#fff', borderColor: '#c9d9d3', borderWidth: 1 },
  dex: { color: '#aab8b4', fontSize: 13, fontWeight: '800' },
  imageStage: { width: '72%', maxWidth: 320, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  maxBadge: { position: 'absolute', top: '8%', right: '8%', width: '25%', height: '25%' },
  name: { color: '#eef8f4', fontSize: 31, fontWeight: '800', textAlign: 'center' },
  textLight: { color: '#304944' },
  secondaryLight: { color: '#58706b' },
  types: { minHeight: 28, flexDirection: 'row', gap: 8, marginTop: 4 },
  typeIcon: { width: 26, height: 26 },
  organizer: { gap: 10, borderRadius: 18, padding: 16, backgroundColor: '#242927' },
  eyebrow: { color: '#42d4c4', fontSize: 11, fontWeight: '900', letterSpacing: 1.3 },
  sectionTitle: { color: '#fff', fontSize: 22, fontWeight: '900' },
  title: { color: '#fff', fontSize: 24, fontWeight: '900', textAlign: 'center' },
  body: { color: '#b7c4c0', fontSize: 14, lineHeight: 20 },
  actions: { gap: 9, marginTop: 4 },
  actionButton: { minHeight: 62, justifyContent: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 15 },
  caughtButton: { borderColor: '#4f9dff', backgroundColor: 'rgba(47, 126, 231, 0.22)' },
  tradeButton: { borderColor: '#3ccd78', backgroundColor: 'rgba(42, 170, 96, 0.22)' },
  wantedButton: { borderColor: '#ef5b72', backgroundColor: 'rgba(221, 82, 96, 0.22)' },
  actionTitle: { color: '#fff', fontSize: 17, fontWeight: '900' },
  actionBody: { color: '#c6d2ce', fontSize: 12 },
  notice: { color: '#7ef0c7', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  error: { color: '#ff91a2', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  secondaryButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#6f8883', borderRadius: 10, paddingHorizontal: 18 },
  secondaryButtonText: { color: '#dce8e4', fontWeight: '900' },
});
