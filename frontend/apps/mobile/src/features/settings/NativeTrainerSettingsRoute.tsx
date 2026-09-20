import { Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNativeSession } from '../../auth/NativeSessionContext';
import { NativeActionMenu } from '../../components/NativeActionMenu';
import { NativeActionMenuAnchor } from '../../components/NativeActionMenuAnchor';
import { NativeProtectedSessionGate } from '../../components/NativeProtectedSessionGate';
import { runtimeConfig } from '../../config/runtimeConfig';
import { useNativeCollectionSync } from '../collection/NativeCollectionSyncProvider';
import {
  useNativeTrainerPreferencesMutation,
  useNativeTrainerPreferencesQuery,
} from '../social/socialQueries';
import {
  createNativeTrainerPreferencesDraft,
  type NativeTrainerPreferencesDraft,
} from '../social/nativeTrainerPreferencesModel';
import { resolveNativeActionMenuDestination } from '../../navigation/nativeActionMenuNavigation';
import { NativeTrainerSettingsScreen } from '../../screens/NativeTrainerSettingsScreen';
import { useNativeDevicePreferences } from './NativeDevicePreferencesProvider';
import { summarizeNativeSyncSettings } from './nativeSyncSettingsModel';
import { useNativeColorScheme } from './useNativeColorScheme';

type Feedback = { tone: 'success' | 'error'; text: string };

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'The trainer settings request could not be completed.';

type PreferenceGroup = 'coordination' | 'privacy';

export const mergeNativeTrainerPreferenceGroup = ({
  base,
  draft,
  group,
}: {
  base: NativeTrainerPreferencesDraft;
  draft: NativeTrainerPreferencesDraft;
  group: PreferenceGroup;
}): NativeTrainerPreferencesDraft => group === 'privacy'
  ? {
      ...base,
      collectionVisibility: draft.collectionVisibility,
      friendRequestPermission: draft.friendRequestPermission,
      profileVisibility: draft.profileVisibility,
      showLocation: draft.showLocation,
      showPokemonGoName: draft.showPokemonGoName,
      trainerCodeVisibility: draft.trainerCodeVisibility,
    }
  : {
      ...base,
      coordinationHandle: draft.coordinationHandle,
      coordinationMethod: draft.coordinationMethod,
      shareTradeContact: draft.shareTradeContact,
    };

export const NativeTrainerSettingsRoute = () => {
  const router = useRouter();
  const light = useNativeColorScheme() === 'light';
  const session = useNativeSession();
  const viewerId = session.user?.user_id ?? null;
  const preferencesQuery = useNativeTrainerPreferencesQuery(viewerId);
  const preferencesMutation = useNativeTrainerPreferencesMutation(viewerId ?? 'signed-out');
  const collectionSync = useNativeCollectionSync();
  const devicePreferences = useNativeDevicePreferences();
  const [draftOverride, setDraftOverride] = useState<NativeTrainerPreferencesDraft | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);

  const draft = draftOverride ?? (preferencesQuery.data
    ? createNativeTrainerPreferencesDraft(preferencesQuery.data)
    : null);

  const syncSummary = useMemo(() => summarizeNativeSyncSettings(collectionSync), [collectionSync]);

  if (session.status === 'restoring' || session.status === 'unavailable') {
    return (
      <NativeProtectedSessionGate
        message="Opening settings…"
        onRetry={session.retrySession}
        status={session.status}
      />
    );
  }

  if (session.status !== 'signed-in' || !session.user) {
    return <Redirect href="/native/login?returnTo=%2Fnative%2Fsettings" />;
  }

  const saveGroup = async (group: PreferenceGroup) => {
    if (!draft || !preferencesQuery.data) return;
    setFeedback(null);
    const base = createNativeTrainerPreferencesDraft(preferencesQuery.data);
    try {
      const saved = await preferencesMutation.mutateAsync(
        mergeNativeTrainerPreferenceGroup({ base, draft, group }),
      );
      setDraftOverride(createNativeTrainerPreferencesDraft(saved));
      setFeedback({
        tone: 'success',
        text: group === 'privacy'
          ? 'Privacy settings saved.'
          : 'Trade coordination settings saved.',
      });
    } catch (error) {
      setFeedback({ tone: 'error', text: errorMessage(error) });
    }
  };

  const retryPreferences = async () => {
    setFeedback(null);
    const result = await preferencesQuery.refetch();
    if (result.data) setDraftOverride(createNativeTrainerPreferencesDraft(result.data));
  };

  const navigateFromActionMenu = (path: string) => {
    setActionMenuOpen(false);
    const destination = resolveNativeActionMenuDestination(path, '/settings');
    if (destination.kind === 'current') return;
    if (destination.kind === 'native') {
      router.push(destination.pathname);
      return;
    }
    router.push({ pathname: '/web', params: { path: destination.path } });
  };

  return (
    <View style={[styles.root, light && styles.rootLight]}>
      <NativeTrainerSettingsScreen
        colorTheme={devicePreferences.colorTheme}
        draft={draft}
        error={preferencesQuery.error ? errorMessage(preferencesQuery.error) : null}
        feedback={feedback}
        isLoading={preferencesQuery.isPending}
        isSaving={preferencesMutation.isPending}
        onBack={() => router.canGoBack() ? router.back() : router.replace('/native/collection')}
        onChange={(next) => { setDraftOverride(next); setFeedback(null); }}
        onChangeColorTheme={devicePreferences.setColorTheme}
        onChangeReduceMotion={devicePreferences.setReduceMotion}
        onDismissFeedback={() => setFeedback(null)}
        onOpenAccount={() => router.push('/native/account')}
        onRetry={() => void retryPreferences()}
        onRetrySync={() => void collectionSync.retry()}
        onSaveCoordination={() => void saveGroup('coordination')}
        onSavePrivacy={() => void saveGroup('privacy')}
        reduceMotion={devicePreferences.reduceMotion}
        syncSummary={syncSummary}
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
