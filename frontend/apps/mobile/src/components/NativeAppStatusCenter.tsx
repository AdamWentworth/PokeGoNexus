import NetInfo, { useNetInfo } from '@react-native-community/netinfo';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNativeSession } from '../auth/NativeSessionContext';
import { useNativeCollectionSync } from '../features/collection/NativeCollectionSyncProvider';
import { useNativeColorScheme } from '../features/settings/useNativeColorScheme';

export const NativeAppStatusCenter = () => {
  const network = useNetInfo();
  const session = useNativeSession();
  const sync = useNativeCollectionSync();
  const insets = useSafeAreaInsets();
  const light = useNativeColorScheme() === 'light';
  const offline = network.isConnected === false || network.isInternetReachable === false;
  const signedIn = session.status === 'signed-in';
  const [connection, setConnection] = useState({ offline, restored: false });
  const { restored } = connection;
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const checkingRef = useRef(false);
  if (connection.offline !== offline && (offline || network.isConnected === true)) {
    setConnection({ offline, restored: !offline });
    if (!offline) setCheckError(null);
  }
  useEffect(() => {
    if (!restored) return undefined;
    const timer = setTimeout(() => setConnection((current) => ({ ...current, restored: false })), 4_000);
    return () => clearTimeout(timer);
  }, [restored]);

  const retry = async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    setChecking(true); setCheckError(null);
    try {
      // Refresh performs a new reachability check; fetch alone can return cached state.
      const current = await NetInfo.refresh();
      if (signedIn && current.isConnected !== false && current.isInternetReachable !== false) await sync.retry();
    } catch {
      setCheckError('The connection check failed. Please try again.');
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  };

  const retained = signedIn ? sync.pendingCount + sync.acceptedCount : 0;
  const syncError = signedIn && Boolean(sync.lastError);
  if (!offline && !syncError && !restored && !checkError) return null;
  const title = offline ? 'You’re offline' : syncError ? 'Collection sync needs attention' : checkError ? 'Connection check failed' : 'Back online';
  const body = checkError ?? (offline
    ? retained > 0 ? `${retained} collection ${retained === 1 ? 'change is' : 'changes are'} safe on this device and will sync after reconnecting.`
      : 'Collection data already loaded on this device remains available. Searches and account actions need a connection.'
    : syncError ? retained > 0 ? `${retained} local ${retained === 1 ? 'change is' : 'changes are'} still safe and waiting to sync.`
      : 'The server check failed. Your saved collection remains available on this device.'
      : signedIn ? 'Resuming collection synchronization.' : 'Online features are available again.');
  return (
    <View style={[styles.position, { paddingBottom: insets.bottom + 12, paddingLeft: insets.left + 12, paddingRight: insets.right + 12, backgroundColor: light ? '#f8fff9' : '#101a19' }]}>
      <View accessibilityLiveRegion="polite" style={[styles.banner, light && styles.bannerLight, !offline && !syncError && !checkError && styles.success]} testID="native-app-status-center">
        <View style={styles.copy}>
          <Text accessibilityRole={offline || syncError || checkError ? 'alert' : undefined} style={[styles.title, light && styles.textLight]}>{title}</Text>
          <Text style={[styles.body, light && styles.bodyLight]}>{body}</Text>
        </View>
        {offline || syncError || checkError ? <Pressable accessibilityRole="button" disabled={checking || sync.isSyncing}
          onPress={() => void retry()} style={styles.retry}>
          <Text style={styles.retryText}>{checking || sync.isSyncing ? 'Checking…' : offline || checkError ? 'Check again' : 'Retry sync'}</Text>
        </Pressable> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Reserve space so offline notices never cover a picker’s Save/Cancel controls.
  position: { flexShrink: 0, paddingTop: 12, alignItems: 'center' },
  banner: { width: '100%', maxWidth: 620, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#bd934c', backgroundColor: '#30291f' },
  bannerLight: { backgroundColor: '#fff5e0', borderColor: '#a57c37' }, success: { borderColor: '#2ca58c' },
  copy: { flex: 1, gap: 4 }, title: { color: '#fff0cf', fontWeight: '900', fontSize: 14 }, body: { color: '#ecdec4', fontSize: 12, lineHeight: 17 },
  textLight: { color: '#473314' }, bodyLight: { color: '#665133' }, retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#735625' }, retryText: { color: '#fff', fontWeight: '800', fontSize: 12 },
});
