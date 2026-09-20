import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeActionMenu } from '../../components/NativeActionMenu';
import { NativeActionMenuAnchor } from '../../components/NativeActionMenuAnchor';
import { runtimeConfig } from '../../config/runtimeConfig';
import { useNativeDevicePreferences } from '../../features/settings/NativeDevicePreferencesProvider';
import { resolveNativeActionMenuDestination } from '../../navigation/nativeActionMenuNavigation';

const firstParam = (value: string | string[] | undefined): string => (
  Array.isArray(value) ? value[0] ?? '' : value ?? ''
);

export default function NativeNotFoundRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ path?: string | string[] }>();
  const preferences = useNativeDevicePreferences();
  const light = preferences.colorTheme === 'light';
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const requestedPath = firstParam(params.path);
  const navigate = (path: string) => {
    setMenuOpen(false);
    const destination = resolveNativeActionMenuDestination(path);
    if (destination.kind === 'native') router.replace(destination.pathname);
    else if (destination.kind === 'web') {
      router.replace({ pathname: '/web', params: { path: destination.path } });
    }
  };

  return (
    <View style={[styles.root, { paddingTop: 34 + insets.top, paddingBottom: 116 + insets.bottom }, light && styles.rootLight]} testID="native-not-found-screen">
      <View style={[styles.card, light && styles.cardLight]}>
        <Image fadeDuration={0}
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={{ uri: `${runtimeConfig.api.frontendAppUrl.replace(/\/$/, '')}/images/logo/lockup.png` }}
          style={styles.logo}
        />
        <Text style={[styles.code, light && styles.accentLight]}>404</Text>
        <Text accessibilityRole="header" style={[styles.title, light && styles.titleLight]}>
          That route wandered off.
        </Text>
        <Text style={[styles.copy, light && styles.copyLight]}>
          No Pokémon Go Nexus page matches {requestedPath || 'this address'}. The link may be outdated, incomplete, or mistyped.
        </Text>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/native')} style={styles.primary}>
            <Text style={styles.primaryText}>⌂  Return home</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.canGoBack() ? router.back() : router.replace('/native')}
            style={[styles.secondary, light && styles.secondaryLight]}
          >
            <Text style={[styles.secondaryText, light && styles.titleLight]}>←  Go back</Text>
          </Pressable>
        </View>
        <View style={styles.recoveryLinks}>
          {[
            ['Getting Started', '/getting-started'],
            ['Frequently asked questions', '/faq'],
            ['Help & information', '/help'],
          ].map(([label, path]) => (
            <Pressable accessibilityRole="link" key={path} onPress={() => navigate(path)} style={styles.recoveryLink}>
              <Text style={[styles.recoveryLinkText, light && styles.accentLight]}>◉  {label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <NativeActionMenuAnchor
        assetBaseUrl={runtimeConfig.api.frontendAppUrl}
        onPress={() => setMenuOpen(true)}
      />
      {menuOpen ? (
        <NativeActionMenu
          assetBaseUrl={runtimeConfig.api.frontendAppUrl}
          onClose={() => setMenuOpen(false)}
          onNavigate={navigate}
          visible
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 34, paddingHorizontal: 9, paddingBottom: 116, backgroundColor: '#06131d' },
  rootLight: { backgroundColor: '#f8fff9' },
  card: { width: '100%', maxWidth: 520, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#314b58', borderRadius: 22, paddingHorizontal: 14, paddingTop: 22, paddingBottom: 36, backgroundColor: '#121e25' },
  cardLight: { borderColor: '#b8c7ce', backgroundColor: '#fff' },
  logo: { width: '82%', height: 118 },
  code: { marginTop: 2, color: '#269df4', fontSize: 12, lineHeight: 17, fontWeight: '900', letterSpacing: 3 },
  accentLight: { color: '#005bb5' },
  title: { color: '#f5fbfd', fontSize: 25, fontWeight: '900', textAlign: 'center' },
  titleLight: { color: '#102129' },
  copy: { maxWidth: 400, color: '#a8bac2', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  copyLight: { color: '#536970' },
  actions: { width: '100%', gap: 10, marginTop: 8 },
  primary: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#168ff0' },
  primaryText: { color: '#04131f', fontWeight: '900' },
  secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#4b626c', borderRadius: 12, backgroundColor: '#19272e' },
  secondaryLight: { borderColor: '#a9bbc2', backgroundColor: '#f4f8f9' },
  secondaryText: { color: '#eef6f8', fontWeight: '800' },
  recoveryLinks: { width: '100%', gap: 6, marginTop: 8, borderTopWidth: 1, borderTopColor: '#314b58', paddingTop: 14 },
  recoveryLink: { minHeight: 38, alignItems: 'center', justifyContent: 'center' },
  recoveryLinkText: { color: '#168ff0', fontSize: 12, fontWeight: '900' },
});
