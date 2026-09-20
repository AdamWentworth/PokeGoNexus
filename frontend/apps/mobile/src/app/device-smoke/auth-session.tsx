import * as SecureStore from 'expo-secure-store';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiClientError } from '@pokemongonexus/shared-api-client';
import type { MobileSessionResponse } from '@pokemongonexus/shared-contracts/auth';
import { NativeSessionProvider, useNativeSession } from '../../auth/NativeSessionContext';
import type { MobileSessionApi } from '../../auth/mobileSessionApi';
import { NativeLoginScreen } from '../../screens/NativeLoginScreen';
import { runtimeConfig } from '../../config/runtimeConfig';
import { useNativeColorScheme } from '../../features/settings/useNativeColorScheme';

const FIXTURE_REFRESH_TOKEN_KEY = 'pokegonexus.device-smoke.auth-refresh-token';

const fixtureSession = (source: 'login' | 'restored'): MobileSessionResponse => ({
  accessToken: `fixture-access-${source}`,
  refreshToken: source === 'login' ? 'fixture-refresh-login' : 'fixture-refresh-rotated',
  accessTokenExpiry: '2030-01-01T00:00:00.000Z',
  refreshTokenExpiry: '2030-02-01T00:00:00.000Z',
  user: {
    user_id: 'device-smoke-auth-user',
    username: 'LifecycleTrainer',
    email: 'lifecycle@example.invalid',
    pokemonGoName: 'LifecycleTrainer',
    trainerCode: null,
    allowLocation: false,
    location: null,
    coordinates: null,
  },
});

const fixtureApi: MobileSessionApi = {
  login: async (request) => {
    if (request.username !== 'LifecycleTrainer' || request.password !== 'Strong_password_42') {
      throw new ApiClientError(401, 'Invalid credentials', { message: 'Invalid credentials' });
    }
    return fixtureSession('login');
  },
  refresh: async (token) => {
    if (token !== 'fixture-refresh-login' && token !== 'fixture-refresh-rotated') {
      throw new ApiClientError(401, 'Invalid token', { message: 'Invalid token' });
    }
    return fixtureSession('restored');
  },
  logout: async () => undefined,
  register: async () => fixtureSession('login'),
  requestPasswordReset: async () => undefined,
  confirmPasswordReset: async () => undefined,
  startOAuth: async (request) => ({
    authorizationUrl: 'https://example.invalid',
    intent: request.intent,
    provider: request.provider,
  }),
  exchangeOAuth: async () => ({ provider: 'google', status: 'account-not-found' }),
  completeOAuthRegistration: async () => ({ provider: 'google', status: 'authenticated', session: fixtureSession('login') }),
};

const fixturePersistence = {
  read: () => SecureStore.getItemAsync(FIXTURE_REFRESH_TOKEN_KEY),
  store: (token: string) => SecureStore.setItemAsync(FIXTURE_REFRESH_TOKEN_KEY, token),
  clear: () => SecureStore.deleteItemAsync(FIXTURE_REFRESH_TOKEN_KEY),
};

const SessionSurface = () => {
  const session = useNativeSession();
  const light = useNativeColorScheme() === 'light';
  const insets = useSafeAreaInsets();

  if (session.status === 'restoring') {
    return <View style={[styles.center, light && styles.rootLight]}><Text style={[styles.message, light && styles.textLight]}>Checking your secure session…</Text></View>;
  }
  if (session.status === 'unavailable') {
    return (
      <View style={[styles.center, light && styles.rootLight]}>
        <Text accessibilityRole="header" style={[styles.title, light && styles.textLight]}>Session check unavailable</Text>
        <Pressable accessibilityRole="button" onPress={() => void session.retrySession()} style={styles.button}><Text style={styles.buttonText}>Retry</Text></Pressable>
      </View>
    );
  }
  if (!session.user) {
    return (
      <NativeLoginScreen
        onOpenPasswordReset={() => undefined}
        onSignIn={session.signIn}
        onSignedIn={() => undefined}
        onSocialSignIn={async () => undefined}
      />
    );
  }

  const restored = session.getAccessToken() === 'fixture-access-restored';
  return (
    <View style={[styles.center, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }, light && styles.rootLight]} testID="device-smoke-auth-session">
      <Text accessibilityRole="header" style={[styles.title, light && styles.textLight]}>Signed in as @{session.user.username}</Text>
      <Text accessibilityLiveRegion="polite" style={[styles.message, light && styles.mutedLight]}>
        {restored ? 'Secure session restored and refresh token rotated.' : 'Secure session saved.'}
      </Text>
      <Pressable accessibilityRole="button" onPress={() => void session.signOut()} style={styles.button}>
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </View>
  );
};

export default function DeviceSmokeAuthSessionRoute() {
  const params = useLocalSearchParams<{ reset?: string | string[] }>();
  const reset = (Array.isArray(params.reset) ? params.reset[0] : params.reset) === '1';
  const [ready, setReady] = useState(!reset);

  useEffect(() => {
    if (!reset) return;
    void SecureStore.deleteItemAsync(FIXTURE_REFRESH_TOKEN_KEY).finally(() => setReady(true));
  }, [reset]);

  if (!runtimeConfig.mobile.deviceSmokeMode) return <Redirect href="/" />;
  if (!ready) return <View style={styles.center}><Text style={styles.message}>Resetting session fixture…</Text></View>;
  return (
    <NativeSessionProvider api={fixtureApi} getDeviceId={async () => 'device-smoke-auth-device'} persistence={fixturePersistence}>
      <SessionSurface />
    </NativeSessionProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 28, backgroundColor: '#0f0f0f' },
  rootLight: { backgroundColor: '#f8fff9' },
  title: { color: '#fff', fontSize: 24, lineHeight: 31, fontWeight: '900', textAlign: 'center' },
  message: { color: '#dbe8ec', fontSize: 15, lineHeight: 22, fontWeight: '700', textAlign: 'center' },
  textLight: { color: '#142126' },
  mutedLight: { color: '#5e7077' },
  button: { minWidth: 220, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#0b86ee' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '900' },
});
