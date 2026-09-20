import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { BackHandler, Keyboard, StyleSheet, View } from 'react-native';
import { useNativeSession } from '../../auth/NativeSessionContext';
import { NativeActionMenu } from '../../components/NativeActionMenu';
import { NativeActionMenuAnchor } from '../../components/NativeActionMenuAnchor';
import { NativeProtectedSessionGate } from '../../components/NativeProtectedSessionGate';
import type { NativeTrainerWorkspace } from '../../components/NativeTrainerWorkspaceNav';
import { runtimeConfig } from '../../config/runtimeConfig';
import { resolveNativeActionMenuDestination } from '../../navigation/nativeActionMenuNavigation';
import { NativeTrainerWorkspaceScreen } from '../../screens/NativeTrainerWorkspaceScreen';
import { NativeFriendsPanel } from './NativeFriendsPanel';
import { NativeTrainerProfileRoute } from './NativeTrainerProfileRoute';

const SignedInWorkspace = ({ userId, username }: { userId: string; username: string }) => {
  const router = useRouter();
  const params = useLocalSearchParams<{ workspace?: string | string[] }>();
  const requestedWorkspace = (Array.isArray(params.workspace) ? params.workspace[0] : params.workspace) === 'friends'
    ? 'friends' : 'profile';
  const active: NativeTrainerWorkspace = requestedWorkspace;
  const [actionMenuOpen, setActionMenuOpen] = useState(false);

  const changeWorkspace = useCallback((workspace: NativeTrainerWorkspace) => {
    Keyboard.dismiss();
    // Update the address without pushing a screen or rebuilding either panel.
    router.setParams({ workspace });
  }, [router]);
  const leaveWorkspace = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/native');
  };
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (active !== 'friends' || actionMenuOpen) return false;
      changeWorkspace('profile');
      return true;
    });
    return () => subscription.remove();
  }, [active, actionMenuOpen, changeWorkspace]));

  const navigateFromActionMenu = (path: string) => {
    setActionMenuOpen(false);
    if (path === '/profile' || path === '/profile/friends') {
      changeWorkspace(path === '/profile' ? 'profile' : 'friends');
      return;
    }
    const destination = resolveNativeActionMenuDestination(path, active === 'friends' ? '/profile/friends' : '/profile');
    if (destination.kind === 'current') return;
    if (destination.kind === 'native') router.push(destination.pathname);
    else router.push({ pathname: '/web', params: { path: destination.path } });
  };

  return (
    <View style={styles.screen}>
      <NativeTrainerWorkspaceScreen
        active={active}
        friends={<NativeFriendsPanel userId={userId} username={username} onOpenProfileHome={() => changeWorkspace('profile')} />}
        profile={<NativeTrainerProfileRoute embedded />}
        username={username}
        onBack={() => active === 'friends' ? changeWorkspace('profile') : leaveWorkspace()}
        onChange={changeWorkspace}
      />
      <NativeActionMenuAnchor assetBaseUrl={runtimeConfig.api.frontendAppUrl} onPress={() => setActionMenuOpen(true)} />
      {actionMenuOpen ? <NativeActionMenu
        assetBaseUrl={runtimeConfig.api.frontendAppUrl}
        onClose={() => setActionMenuOpen(false)}
        onNavigate={navigateFromActionMenu}
        visible
      /> : null}
    </View>
  );
};

export const NativeTrainerWorkspaceRoute = () => {
  const session = useNativeSession();
  const params = useLocalSearchParams<{ workspace?: string; tab?: string }>();
  if (session.status === 'restoring' || session.status === 'unavailable') {
    return <NativeProtectedSessionGate message="Opening trainer profile…" onRetry={session.retrySession} status={session.status} />;
  }
  if (session.status !== 'signed-in' || !session.user) {
    const returnTo = new URLSearchParams();
    if (params.workspace === 'friends') returnTo.set('workspace', 'friends');
    if (params.tab) returnTo.set('tab', params.tab);
    return <Redirect href={{ pathname: '/native/login', params: {
      returnTo: `/native/profile${returnTo.toString() ? `?${returnTo}` : ''}`,
    } }} />;
  }
  return <SignedInWorkspace key={session.user.user_id} userId={session.user.user_id} username={session.user.username} />;
};

const styles = StyleSheet.create({ screen: { flex: 1, minHeight: 0 } });
