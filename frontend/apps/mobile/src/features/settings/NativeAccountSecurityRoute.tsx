import type { OAuthProvider } from '@pokemongonexus/shared-contracts/auth';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNativeSession } from '../../auth/NativeSessionContext';
import { NativeActionMenu } from '../../components/NativeActionMenu';
import { NativeActionMenuAnchor } from '../../components/NativeActionMenuAnchor';
import { NativeProtectedSessionGate } from '../../components/NativeProtectedSessionGate';
import { runtimeConfig } from '../../config/runtimeConfig';
import { resolveNativeActionMenuDestination } from '../../navigation/nativeActionMenuNavigation';
import { NativeAccountSecurityScreen } from '../../screens/NativeAccountSecurityScreen';
import {
  requestNativeEmailChange,
  unlinkNativeAccountProvider,
  updateNativeSecondaryUsername,
} from '../../services/nativeAccountSecurityApi';
import { useNativeApiClients } from '../../services/useNativeApiClients';
import {
  buildNativeEmailChangeRequest,
  buildNativePasswordUpdateRequest,
  buildNativeSensitiveActionProof,
  buildNativeUsernameUpdateRequest,
  createNativeAccountSecurityDraft,
  nativeOAuthProviderLabel,
  type NativeAccountSecurityDraft,
} from './nativeAccountSecurityModel';
import { useNativeAccountSecurityQuery } from './nativeAccountSecurityQueries';
import {
  changeNativePasswordAndClearSession,
  deleteNativeAccountGraph,
  revokeNativeSessionsAndClearSession,
  saveNativeUsernameGraph,
} from './nativeAccountSecurityCommands';
import { connectNativeOAuthProvider, exchangeNativeOAuthLinkCode } from './nativeOAuthProviderLink';
import { nativeAccountOAuthFeedback } from '../auth/nativeAuthRouteFeedback';
import { useNativeColorScheme } from './useNativeColorScheme';

type Feedback = { tone: 'success' | 'error'; text: string };

const errorMessage = (error: unknown): string =>
  error instanceof Error && error.message
    ? error.message
    : 'The account-security request could not be completed.';

const firstParam = (value: string | string[] | undefined): string | null => {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
};

export const NativeAccountSecurityRoute = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{
    oauth?: string | string[];
    oauth_code?: string | string[];
    oauth_error?: string | string[];
  }>();
  const light = useNativeColorScheme() === 'light';
  const session = useNativeSession();
  const clients = useNativeApiClients();
  const user = session.user;
  const securityQuery = useNativeAccountSecurityQuery(user?.user_id ?? null);
  const [draftOverride, setDraftOverride] = useState<NativeAccountSecurityDraft | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [pendingSecondaryUsername, setPendingSecondaryUsername] = useState<string | null>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const processedOAuthReturnRef = useRef<string | null>(null);
  const processedCanonicalOAuthRef = useRef<string | null>(null);

  const oauthStatus = firstParam(params.oauth);
  const oauthCode = firstParam(params.oauth_code);
  const oauthError = firstParam(params.oauth_error);

  useEffect(() => {
    if (session.status !== 'signed-in' || !oauthStatus
        || processedCanonicalOAuthRef.current === oauthStatus) return;
    processedCanonicalOAuthRef.current = oauthStatus;
    router.setParams({ oauth: undefined });
    const canonicalFeedback = nativeAccountOAuthFeedback(oauthStatus);
    let active = true;
    void Promise.resolve().then(() => {
      if (active && canonicalFeedback) setFeedback(canonicalFeedback);
    });
    return () => { active = false; };
  }, [oauthStatus, router, session.status]);

  useEffect(() => {
    const resultKey = oauthCode ? `code:${oauthCode}` : oauthError ? `error:${oauthError}` : null;
    if (session.status !== 'signed-in' || !resultKey
        || processedOAuthReturnRef.current === resultKey) return;
    processedOAuthReturnRef.current = resultKey;
    router.setParams({ oauth_code: undefined, oauth_error: undefined });
    let active = true;
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      if (oauthError) {
        setFeedback({
          tone: 'error',
          text: 'The provider authorization expired or was not completed.',
        });
        return;
      }
      if (!oauthCode) return;

      setPendingAction('provider-return');
      setFeedback(null);
      try {
        const result = await exchangeNativeOAuthLinkCode({ client: clients.auth, code: oauthCode });
        const refreshed = await securityQuery.refetch();
        if (!refreshed.data) throw new Error('The updated sign-in methods could not be loaded.');
        if (!active) return;
        setFeedback({
          tone: 'success',
          text: `${nativeOAuthProviderLabel(result.provider)} connected.`,
        });
      } catch (error) {
        if (active) setFeedback({ tone: 'error', text: errorMessage(error) });
      } finally {
        if (active) setPendingAction(null);
      }
    })();
    return () => { active = false; };
  }, [clients.auth, oauthCode, oauthError, router, securityQuery, session.status]);

  if (session.status === 'restoring' || session.status === 'unavailable') {
    return (
      <NativeProtectedSessionGate
        message="Restoring account security…"
        onRetry={session.retrySession}
        status={session.status}
      />
    );
  }

  if (session.status !== 'signed-in' || !user) {
    return <Redirect href="/native/login?returnTo=%2Fnative%2Faccount" />;
  }

  const security = securityQuery.data ?? null;
  const draft = draftOverride ?? createNativeAccountSecurityDraft({
    email: security?.email ?? user.email,
    username: user.username,
  });

  const run = async (action: string, command: () => Promise<void>) => {
    if (pendingAction) return;
    setFeedback(null);
    setPendingAction(action);
    try {
      await command();
    } catch (error) {
      setFeedback({ tone: 'error', text: errorMessage(error) });
    } finally {
      setPendingAction(null);
    }
  };

  const updateAccount = () => run('account', async () => {
    if (!security) throw new Error('Account security is still loading.');
    const normalized = draft.username.trim();
    const usernameRequest = buildNativeUsernameUpdateRequest({
      currentEmail: user.email,
      currentUsername: user.username,
      username: draft.username,
    });
    const emailRequest = buildNativeEmailChangeRequest({
      currentEmail: security.email,
      currentPassword: draft.currentPassword,
      email: draft.email,
      hasPassword: security.hasPassword,
    });
    const passwordRequest = buildNativePasswordUpdateRequest({
      confirmNewPassword: draft.confirmNewPassword,
      currentEmail: security.email,
      currentPassword: draft.currentPassword,
      currentUsername: usernameRequest?.username ?? user.username,
      hasPassword: security.hasPassword,
      newPassword: draft.newPassword,
    });
    let changed = false;

    if (pendingSecondaryUsername === normalized) {
      await updateNativeSecondaryUsername(clients.users, user.user_id, normalized);
      setPendingSecondaryUsername(null);
      changed = true;
    } else if (usernameRequest) {
      let committedUsername: string | null = null;
      try {
        await saveNativeUsernameGraph({
          auth: clients.auth,
          onAuthUpdated: (updated) => {
            committedUsername = updated.username;
            session.replaceSessionUser(updated);
            setDraftOverride((current) => ({
              ...(current ?? draft),
              username: updated.username,
            }));
            setPendingSecondaryUsername(updated.username);
          },
          request: usernameRequest,
          userId: user.user_id,
          users: clients.users,
        });
        setPendingSecondaryUsername(null);
        changed = true;
      } catch (error) {
        if (!committedUsername) throw error;
        throw new Error(`Your sign-in username changed, but profile synchronization needs another try. ${errorMessage(error)}`);
      }
    }

    if (emailRequest) {
      await requestNativeEmailChange(clients.auth, emailRequest);
      changed = true;
    }

    if (passwordRequest) {
      await changeNativePasswordAndClearSession({
        auth: clients.auth,
        clearSession: session.clearSession,
        request: passwordRequest,
        userId: user.user_id,
      });
      router.replace({
        pathname: '/native/login',
        params: { notice: 'Password updated. Sign in again on this device.' },
      });
      return;
    }

    setDraftOverride({
      ...draft,
      currentPassword: '',
      confirmNewPassword: '',
      newPassword: '',
    });
    setFeedback({
      tone: 'success',
      text: emailRequest
        ? `Account updated. Verification sent to ${emailRequest.email}.`
        : changed ? 'Account updated.' : 'Account is already up to date.',
    });
  });

  const proof = () => {
    if (!security) throw new Error('Account security is still loading.');
    return buildNativeSensitiveActionProof({
      currentPassword: draft.currentPassword,
      hasPassword: security.hasPassword,
    });
  };

  const unlinkProvider = (provider: OAuthProvider) => run(`provider-${provider}`, async () => {
    await unlinkNativeAccountProvider(clients.auth, provider, proof());
    const result = await securityQuery.refetch();
    if (!result.data) throw new Error('The updated sign-in methods could not be loaded.');
    setDraftOverride({ ...draft, currentPassword: '' });
    setFeedback({ tone: 'success', text: `${nativeOAuthProviderLabel(provider)} disconnected.` });
  });

  const connectProvider = (provider: OAuthProvider) => run(`provider-${provider}`, async () => {
    const result = await connectNativeOAuthProvider({ client: clients.auth, provider });
    if (!result) {
      setFeedback({
        tone: 'error',
        text: `${nativeOAuthProviderLabel(provider)} connection was cancelled. No changes were made.`,
      });
      return;
    }
    const refreshed = await securityQuery.refetch();
    if (!refreshed.data) throw new Error('The updated sign-in methods could not be loaded.');
    setFeedback({
      tone: 'success',
      text: `${nativeOAuthProviderLabel(result.provider)} connected.`,
    });
  });

  const revokeSessions = () => run('sessions', async () => {
    await revokeNativeSessionsAndClearSession({
      auth: clients.auth,
      clearSession: session.clearSession,
      proof: proof(),
    });
    router.replace({
      pathname: '/native/login',
      params: { notice: 'Every device was signed out. Sign in again to continue.' },
    });
  });

  const deleteAccount = () => run('delete', async () => {
    const actionProof = proof();
    await deleteNativeAccountGraph({
      auth: clients.auth,
      clearSession: session.clearSession,
      proof: actionProof,
      userId: user.user_id,
      users: clients.users,
    });
    router.replace({
      pathname: '/native/login',
      params: { notice: 'Your Pokémon Go Nexus account was deleted.' },
    });
  });

  const signOut = () => run('sign-out', async () => {
    await session.signOut();
    router.replace({
      pathname: '/native/login',
      params: { notice: 'Signed out from this device.' },
    });
  });

  const retry = async () => {
    setFeedback(null);
    await securityQuery.refetch();
  };

  const navigateFromActionMenu = (path: string) => {
    setActionMenuOpen(false);
    const destination = resolveNativeActionMenuDestination(path, '/settings/account');
    if (destination.kind === 'current') return;
    if (destination.kind === 'native') {
      router.push(destination.pathname);
      return;
    }
    router.push({ pathname: '/web', params: { path: destination.path } });
  };

  return (
    <View style={[styles.root, light && styles.rootLight]}>
      <NativeAccountSecurityScreen
        draft={draft}
        error={securityQuery.error ? errorMessage(securityQuery.error) : null}
        feedback={feedback}
        isLoading={securityQuery.isPending}
        onBack={() => router.canGoBack() ? router.back() : router.replace('/native/settings')}
        onChange={(next) => { setDraftOverride(next); setFeedback(null); }}
        onConnectProvider={(provider) => void connectProvider(provider)}
        onDeleteAccount={() => void deleteAccount()}
        onDismissFeedback={() => setFeedback(null)}
        onOpenSettings={() => router.replace('/native/settings')}
        onRetry={() => void retry()}
        onRevokeAllSessions={() => void revokeSessions()}
        onSignOut={() => void signOut()}
        onUnlinkProvider={(provider) => void unlinkProvider(provider)}
        onUpdateAccount={() => void updateAccount()}
        pendingAction={pendingAction}
        security={security}
      />
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
};

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0, backgroundColor: '#081012' },
  rootLight: { backgroundColor: '#f8fff9' },
});
