import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { NativeRouteActionMenu } from '../../components/NativeRouteActionMenu';
import { runtimeConfig } from '../../config/runtimeConfig';
import type { NativeTrainerPreferencesDraft } from '../../features/social/nativeTrainerPreferencesModel';
import { useNativeDevicePreferences } from '../../features/settings/NativeDevicePreferencesProvider';
import { NativeTrainerSettingsScreen } from '../../screens/NativeTrainerSettingsScreen';

const INITIAL_DRAFT: NativeTrainerPreferencesDraft = {
  collectionVisibility: 'public',
  coordinationHandle: '',
  coordinationMethod: 'none',
  friendRequestPermission: 'everyone',
  profileVisibility: 'public',
  shareTradeContact: false,
  showLocation: true,
  showPokemonGoName: true,
  trainerCodeVisibility: 'friends',
};

export default function DeviceSmokeSettingsRoute() {
  const [draft, setDraft] = useState(INITIAL_DRAFT);
  const devicePreferences = useNativeDevicePreferences();
  const [feedback, setFeedback] = useState<{ tone: 'success'; text: string } | null>(null);
  if (!runtimeConfig.mobile.deviceSmokeMode) return <Redirect href="/" />;
  return (
    <View style={styles.screen}>
      <NativeTrainerSettingsScreen
        colorTheme={devicePreferences.colorTheme}
        draft={draft}
        feedback={feedback}
        onBack={() => undefined}
        onChange={setDraft}
        onChangeColorTheme={devicePreferences.setColorTheme}
        onChangeReduceMotion={devicePreferences.setReduceMotion}
        onDismissFeedback={() => setFeedback(null)}
        onOpenAccount={() => undefined}
        onRetry={() => undefined}
        onRetrySync={() => setFeedback({ tone: 'success', text: 'Collection synchronization checked.' })}
        onSaveCoordination={() => setFeedback({ tone: 'success', text: 'Trade coordination settings saved.' })}
        onSavePrivacy={() => setFeedback({ tone: 'success', text: 'Privacy settings saved.' })}
        reduceMotion={devicePreferences.reduceMotion}
        syncSummary={{ canRetry: true, detail: 'No collection changes are waiting on this device.', title: 'Up to date' }}
      />
      <NativeRouteActionMenu currentPath="/settings" signedIn />
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, minHeight: 0 } });
