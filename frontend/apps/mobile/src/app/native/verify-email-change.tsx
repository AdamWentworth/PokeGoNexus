import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNativeSession } from '../../auth/NativeSessionContext';
import { NativeRouteActionMenu } from '../../components/NativeRouteActionMenu';
import { confirmNativeEmailChange } from '../../services/nativeAccountSecurityApi';
import { useNativeApiClients } from '../../services/useNativeApiClients';
import { useNativeDevicePreferences } from '../../features/settings/NativeDevicePreferencesProvider';

type ConfirmationState = 'working' | 'success' | 'error';

const firstParam = (value: string | string[] | undefined): string => (
  Array.isArray(value) ? value[0] ?? '' : value ?? ''
);

export default function NativeVerifyEmailChangeRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = firstParam(params.token);
  const clients = useNativeApiClients();
  const session = useNativeSession();
  const preferences = useNativeDevicePreferences();
  const light = preferences.colorTheme === 'light';
  const insets = useSafeAreaInsets();
  const submittedToken = useRef<string | null>(null);
  const [state, setState] = useState<ConfirmationState>(token ? 'working' : 'error');
  const [message, setMessage] = useState(
    token ? 'Confirming your new email…' : 'This verification link is incomplete.',
  );

  useEffect(() => {
    if (!token || submittedToken.current === token) return;
    submittedToken.current = token;
    void confirmNativeEmailChange(clients.auth, token)
      .then(async () => {
        await session.clearSession();
        setState('success');
        setMessage('Your email has been updated. Sign in again with your new address.');
      })
      .catch((caught: unknown) => {
        setState('error');
        setMessage(caught instanceof Error
          ? caught.message
          : 'This verification link is invalid or expired.');
      });
  }, [clients.auth, session, token]);

  return (
    <View style={styles.screen}>
      <View style={[styles.root, { paddingTop: 20 + insets.top, paddingBottom: 20 + insets.bottom }, light && styles.rootLight]} testID="native-verify-email-change-screen">
        <View accessibilityLiveRegion="polite" style={[styles.card, light && styles.cardLight]}>
        <Text style={[styles.brand, light && styles.brandLight]}>POKÉMON GO NEXUS</Text>
        <View style={[styles.icon, state === 'error' && styles.iconError]}>
          {state === 'working'
            ? <ActivityIndicator color="#06162f" size="small" />
            : <Text style={styles.iconText}>{state === 'success' ? '✓' : '!'}</Text>}
        </View>
        <Text accessibilityRole="header" style={[styles.title, light && styles.titleLight]}>
          {state === 'working'
            ? 'Confirming email'
            : state === 'success'
              ? 'Email updated'
              : 'Email not updated'}
        </Text>
        <Text style={[styles.message, light && styles.messageLight]}>{message}</Text>
        {state !== 'working' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/native/login')}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Continue to login</Text>
          </Pressable>
        ) : null}
        </View>
      </View>
      <NativeRouteActionMenu />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#06162f',
  },
  rootLight: { backgroundColor: '#f8fff9' },
  card: {
    width: '100%',
    maxWidth: 480,
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: '#315b75',
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingVertical: 30,
    backgroundColor: '#111f2d',
  },
  cardLight: { borderColor: '#afc3ce', backgroundColor: '#fff' },
  brand: { color: '#39aaff', fontSize: 11, fontWeight: '900', letterSpacing: 1.7 },
  brandLight: { color: '#005bb5' },
  icon: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 27,
    backgroundColor: '#62e1c0',
  },
  iconError: { backgroundColor: '#ff6b7d' },
  iconText: { color: '#06162f', fontSize: 28, fontWeight: '900' },
  title: { color: '#fff', fontSize: 26, fontWeight: '900', textAlign: 'center' },
  titleLight: { color: '#10212b' },
  message: { maxWidth: 380, color: '#b8c8d3', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  messageLight: { color: '#526872' },
  button: {
    width: '100%',
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    borderRadius: 13,
    backgroundColor: '#168ff0',
  },
  buttonText: { color: '#04131f', fontSize: 15, fontWeight: '900' },
});
