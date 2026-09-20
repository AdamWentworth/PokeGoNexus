import type { AccountSecuritySummary, OAuthProvider } from '@pokemongonexus/shared-contracts/auth';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { NativeRouteActionMenu } from '../../components/NativeRouteActionMenu';
import { runtimeConfig } from '../../config/runtimeConfig';
import {
  createNativeAccountSecurityDraft,
  nativeOAuthProviderLabel,
  type NativeAccountSecurityDraft,
} from '../../features/settings/nativeAccountSecurityModel';
import { NativeAccountSecurityScreen } from '../../screens/NativeAccountSecurityScreen';

const INITIAL_SECURITY: AccountSecuritySummary = {
  activeSessions: 2,
  email: 'demo@pokegonexus.local',
  hasPassword: true,
  providers: (['google'] as OAuthProvider[]).map((provider) => ({
    email: 'demo@pokegonexus.local',
    emailVerified: true,
    linkedAt: provider === 'google' ? '2026-07-01T00:00:00.000Z' : '2026-07-02T00:00:00.000Z',
    provider,
  })),
};

const OAUTH_ONLY_SECURITY: AccountSecuritySummary = {
  activeSessions: 2,
  email: 'trainer@example.com',
  hasPassword: false,
  providers: (['google', 'discord', 'facebook'] as OAuthProvider[]).map((provider) => ({
    email: `${provider}@example.com`,
    emailVerified: true,
    linkedAt: '2026-08-24T12:00:00.000Z',
    provider,
  })),
};

export default function DeviceSmokeAccountRoute() {
  const params = useLocalSearchParams<{ oauthOnly?: string | string[] }>();
  const oauthOnly = (Array.isArray(params.oauthOnly) ? params.oauthOnly[0] : params.oauthOnly) === '1';
  const [draft, setDraft] = useState<NativeAccountSecurityDraft>(() => createNativeAccountSecurityDraft({
    email: INITIAL_SECURITY.email,
    username: 'NexusDemo',
  }));
  const [security, setSecurity] = useState(() => oauthOnly ? OAUTH_ONLY_SECURITY : INITIAL_SECURITY);
  const [feedback, setFeedback] = useState<{ tone: 'success'; text: string } | null>(null);
  if (!runtimeConfig.mobile.deviceSmokeMode) return <Redirect href="/" />;

  const connectProvider = (provider: OAuthProvider) => {
    setSecurity((current) => ({
      ...current,
      providers: [...current.providers, {
        email: `${provider}@example.com`,
        emailVerified: true,
        linkedAt: new Date().toISOString(),
        provider,
      }],
    }));
    setFeedback({ tone: 'success', text: `${nativeOAuthProviderLabel(provider)} connected.` });
  };

  return (
    <View style={styles.screen}>
      <NativeAccountSecurityScreen
        draft={draft}
        feedback={feedback}
        onBack={() => undefined}
        onChange={setDraft}
        onConnectProvider={connectProvider}
        onDeleteAccount={() => setFeedback({ tone: 'success', text: 'Account deletion confirmed.' })}
        onDismissFeedback={() => setFeedback(null)}
        onOpenSettings={() => undefined}
        onRetry={() => undefined}
        onRevokeAllSessions={() => {
          setSecurity((current) => ({ ...current, activeSessions: 0 }));
          setFeedback({ tone: 'success', text: 'All sessions revoked.' });
        }}
        onSignOut={() => setFeedback({ tone: 'success', text: 'This device signed out.' })}
        onUnlinkProvider={(provider) => {
          setSecurity((current) => ({
            ...current,
            providers: current.providers.filter((identity) => identity.provider !== provider),
          }));
          setFeedback({ tone: 'success', text: `${nativeOAuthProviderLabel(provider)} disconnected.` });
        }}
        onUpdateAccount={() => setFeedback({ tone: 'success', text: 'Account updated.' })}
        security={security}
      />
      <NativeRouteActionMenu currentPath="/settings/account" signedIn />
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, minHeight: 0 } });
