import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { runtimeConfig } from '../../config/runtimeConfig';
import {
  NativeCollectionSyncStatusCardView,
} from '../../features/collection/NativeCollectionSyncStatusCard';
import type {
  NativeCollectionSyncStatus,
} from '../../features/collection/NativeCollectionSyncProvider';
import { useNativeColorScheme } from '../../features/settings/useNativeColorScheme';

const idleStatus: NativeCollectionSyncStatus = {
  acceptedCount: 0,
  isOffline: false,
  isSyncing: false,
  lastError: null,
  pendingCount: 0,
};

export default function DeviceSmokeSyncRoute() {
  const light = useNativeColorScheme() === 'light';
  const [status, setStatus] = useState<NativeCollectionSyncStatus>({
    ...idleStatus,
    isOffline: true,
  });

  if (!runtimeConfig.mobile.deviceSmokeMode) {
    return <Redirect href="/native" />;
  }

  const retry = () => {
    if (status.acceptedCount > 0 && !status.lastError && status.pendingCount === 0) {
      setStatus(idleStatus);
      return;
    }
    if (status.lastError || status.pendingCount > 0) {
      setStatus({
        ...idleStatus,
        acceptedCount: Math.max(status.pendingCount, 1),
      });
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      style={[styles.screen, light && styles.screenLight]}
      testID="device-smoke-sync"
    >
      <Text style={[styles.eyebrow, light && styles.eyebrowLight]}>OFFLINE &amp; SYNC</Text>
      <Text style={[styles.title, light && styles.titleLight]}>Collection resilience</Text>
      <Text style={[styles.lede, light && styles.ledeLight]}>
        Retained device changes stay visible until Receiver acceptance and canonical confirmation.
      </Text>

      <NativeCollectionSyncStatusCardView {...status} onRetry={retry} />
      {!status.isOffline && !status.isSyncing && !status.lastError
        && status.pendingCount === 0 && status.acceptedCount === 0 ? (
          <View accessibilityLiveRegion="polite" style={[styles.upToDate, light && styles.upToDateLight]}>
            <Text style={[styles.upToDateTitle, light && styles.titleLight]}>Up to date</Text>
            <Text style={[styles.upToDateBody, light && styles.ledeLight]}>No retained collection changes remain.</Text>
          </View>
        ) : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setStatus({ ...idleStatus, isOffline: true })}
          style={({ pressed }) => [styles.action, light && styles.actionLight, pressed && styles.pressed]}
        >
          <Text style={[styles.actionText, light && styles.actionTextLight]}>Go offline</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setStatus({ ...idleStatus, isOffline: true, pendingCount: 2 })}
          style={({ pressed }) => [styles.action, light && styles.actionLight, pressed && styles.pressed]}
        >
          <Text style={[styles.actionText, light && styles.actionTextLight]}>Retain two changes</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setStatus({ ...idleStatus, pendingCount: 1, lastError: 'Receiver is temporarily unavailable.' })}
          style={({ pressed }) => [styles.action, light && styles.actionLight, pressed && styles.pressed]}
        >
          <Text style={[styles.actionText, light && styles.actionTextLight]}>Simulate sync error</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setStatus(idleStatus)}
          style={({ pressed }) => [styles.action, light && styles.actionLight, pressed && styles.pressed]}
        >
          <Text style={[styles.actionText, light && styles.actionTextLight]}>Confirm on server</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#071012' },
  screenLight: { backgroundColor: '#f8fff9' },
  content: { flexGrow: 1, gap: 14, paddingHorizontal: 12, paddingTop: 28, paddingBottom: 36 },
  eyebrow: { color: '#45d6aa', fontSize: 11, fontWeight: '900', letterSpacing: 1.4 },
  eyebrowLight: { color: '#126e59' },
  title: { color: '#f7fbfa', fontSize: 28, fontWeight: '900' },
  titleLight: { color: '#13272c' },
  lede: { color: '#9bb0b5', fontSize: 15, lineHeight: 22 },
  ledeLight: { color: '#52666b' },
  upToDate: { gap: 3, borderWidth: 1, borderColor: '#337b65', borderRadius: 12, padding: 14, backgroundColor: '#102d25' },
  upToDateLight: { borderColor: '#80b9a6', backgroundColor: '#e1f4ed' },
  upToDateTitle: { color: '#dff9ef', fontSize: 17, fontWeight: '900' },
  upToDateBody: { color: '#9fcbbb', fontSize: 13 },
  actions: { gap: 10, marginTop: 8 },
  action: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#355258', borderRadius: 12, backgroundColor: '#142225' },
  actionLight: { borderColor: '#a8b9bd', backgroundColor: '#ffffff' },
  actionText: { color: '#edf6f5', fontSize: 14, fontWeight: '900' },
  actionTextLight: { color: '#203237' },
  pressed: { opacity: 0.72 },
});
