import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNativeSession } from '../../auth/NativeSessionContext';
import { NativeActionMenu } from '../../components/NativeActionMenu';
import { NativeActionMenuAnchor } from '../../components/NativeActionMenuAnchor';
import { runtimeConfig } from '../../config/runtimeConfig';
import { NativeLoginScreen, type NativeLoginProvider } from '../../screens/NativeLoginScreen';
import { theme } from '../../ui/theme';
import {
  resolveNativeActionMenuDestination,
  resolveNativeLoginReturnTo,
} from '../../navigation/nativeActionMenuNavigation';
import { useState } from 'react';
import { nativeLoginOAuthNotice } from '../../features/auth/nativeAuthRouteFeedback';
import { useNativeColorScheme } from '../../features/settings/useNativeColorScheme';
import { NativePasswordResetOverlay } from '../../components/NativePasswordResetOverlay';
import { mobileSessionApi } from '../../auth/mobileSessionApi';

export default function NativeLoginRoute() {
  const router = useRouter();
  const light = useNativeColorScheme() === 'light';
  const params = useLocalSearchParams<{
    notice?: string | string[];
    oauth?: string | string[];
    returnTo?: string | string[];
  }>();
  const {
    authenticateWithOAuth,
    clearSession,
    retrySession,
    signIn,
    status,
    user,
  } = useNativeSession();
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [passwordResetOpen, setPasswordResetOpen] = useState(false);
  const [passwordResetNotice, setPasswordResetNotice] = useState<string | null>(null);
  const requestedReturnTo = Array.isArray(params.returnTo)
    ? params.returnTo[0]
    : params.returnTo;
  const explicitNotice = Array.isArray(params.notice) ? params.notice[0] : params.notice;
  const oauthStatus = Array.isArray(params.oauth) ? params.oauth[0] : params.oauth;
  const notice = passwordResetNotice
    ?? explicitNotice
    ?? nativeLoginOAuthNotice(oauthStatus?.trim() || null);
  const returnTo = resolveNativeLoginReturnTo(requestedReturnTo);
  const returnHref = returnTo as Parameters<typeof router.replace>[0];

  if (status === 'restoring') {
    return (
      <View style={[styles.centered, light && styles.centeredLight]}>
        <ActivityIndicator color="#5ed8ff" size="large" />
        <Text style={[styles.body, light && styles.bodyLight]}>Checking your secure session…</Text>
      </View>
    );
  }

  if (status === 'unavailable') {
    return (
      <View style={[styles.centered, light && styles.centeredLight]}>
        <Text accessibilityRole="header" style={[styles.title, light && styles.titleLight]}>Session check unavailable</Text>
        <Text style={[styles.body, light && styles.bodyLight]}>
          Your saved sign-in was kept securely. Check your connection and retry,
          or clear it only if you need to use another account.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void retrySession()}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Retry</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => void clearSession()}
          style={[styles.secondaryButton, light && styles.secondaryButtonLight]}
        >
          <Text style={[styles.secondaryButtonText, light && styles.titleLight]}>Use another account</Text>
        </Pressable>
      </View>
    );
  }

  if (user) return <Redirect href={returnHref} />;

  const authenticateWithProvider = async (provider: NativeLoginProvider) => {
    const result = await authenticateWithOAuth(provider, 'login');
    if (!result) throw new Error('Provider sign-in was canceled.');
    if (result.status === 'authenticated') return;
    if (result.status === 'account-not-found') {
      throw new Error('No account uses that provider email yet. Create an account instead.');
    }
    if (result.status === 'account-exists') {
      throw new Error('An account already exists for that email. Sign in instead.');
    }
    throw new Error('Provider sign-in could not be completed.');
  };
  const navigateFromActionMenu = (path: string) => {
    setActionMenuOpen(false);
    const destination = resolveNativeActionMenuDestination(path, '/login');
    if (destination.kind === 'current') return;
    if (destination.kind === 'native') {
      router.push(destination.pathname);
      return;
    }
    router.push({ pathname: '/web', params: { path: destination.path } });
  };

  return (
    <View style={styles.screen}>
      <NativeLoginScreen
        notice={notice}
        onOpenPasswordReset={() => setPasswordResetOpen(true)}
        onSignIn={signIn}
        onSignedIn={() => router.replace(returnHref)}
        onSocialSignIn={authenticateWithProvider}
      />
      {passwordResetOpen ? (
        <NativePasswordResetOverlay
          onClose={() => setPasswordResetOpen(false)}
          onRequest={(identifier) => mobileSessionApi.requestPasswordReset({ identifier })}
          onRequested={() => {
            setPasswordResetOpen(false);
            setPasswordResetNotice('If that account exists, reset instructions are on the way.');
          }}
          visible
        />
      ) : null}
      <NativeActionMenuAnchor
        assetBaseUrl={runtimeConfig.api.frontendAppUrl}
        onPress={() => setActionMenuOpen(true)}
      />
      {actionMenuOpen ? (
        <NativeActionMenu
          assetBaseUrl={runtimeConfig.api.frontendAppUrl}
          onClose={() => setActionMenuOpen(false)}
          onNavigate={navigateFromActionMenu}
          visible
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: 0 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.xl,
    backgroundColor: 'transparent',
  },
  centeredLight: { backgroundColor: 'transparent' },
  title: { color: '#fff', fontSize: theme.type.title, fontWeight: '800', textAlign: 'center' },
  titleLight: { color: '#102129' },
  body: { maxWidth: 420, color: '#cbd5e1', fontSize: theme.type.body, lineHeight: 21, textAlign: 'center' },
  bodyLight: { color: '#536970' },
  primaryButton: {
    minHeight: 48,
    minWidth: 240,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.selectedBorder,
  },
  primaryButtonText: { color: '#fff', fontWeight: '800' },
  secondaryButton: {
    minHeight: 48,
    minWidth: 240,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#64748b',
    borderRadius: theme.radius.md,
  },
  secondaryButtonLight: { borderColor: '#a9bbc2', backgroundColor: '#fff' },
  secondaryButtonText: { color: '#e2e8f0', fontWeight: '700' },
});
