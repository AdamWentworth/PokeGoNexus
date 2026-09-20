import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../ui/theme';
import {
  type NativeCollectionSyncStatus,
  useNativeCollectionSync,
} from './NativeCollectionSyncProvider';
import { useNativeColorScheme } from '../settings/useNativeColorScheme';

type Props = NativeCollectionSyncStatus & {
  onRetry: () => void | Promise<void>;
};

export const NativeCollectionSyncStatusCardView = ({
  acceptedCount,
  isOffline,
  isSyncing,
  lastError,
  onRetry,
  pendingCount,
}: Props) => {
  const light = useNativeColorScheme() === 'light';
  const retainedCount = pendingCount + acceptedCount;
  if (!isOffline && !isSyncing && !lastError && retainedCount === 0) {
    return null;
  }

  let title = 'Collection synchronization';
  let body = 'Checking retained changes…';
  if (lastError) {
    title = 'Sync needs attention';
    body = lastError;
  } else if (isOffline) {
    title = 'You are offline';
    body = retainedCount > 0
      ? `${retainedCount} ${retainedCount === 1 ? 'change is' : 'changes are'} safely retained on this device.`
      : 'Your saved collection copy remains available on this device.';
  } else if (isSyncing) {
    title = 'Syncing collection changes';
    body = retainedCount > 0
      ? `Checking ${retainedCount} retained ${retainedCount === 1 ? 'change' : 'changes'}…`
      : 'Checking Receiver and server reconciliation…';
  } else if (pendingCount > 0) {
    title = 'Waiting to send';
    body = `${pendingCount} ${pendingCount === 1 ? 'change is' : 'changes are'} retained on this device.`;
  } else if (acceptedCount > 0) {
    title = 'Accepted by Receiver';
    body = `${acceptedCount} ${acceptedCount === 1 ? 'change is' : 'changes are'} waiting for server confirmation.`;
  }

  const canRetry = !isSyncing && (
    lastError != null || pendingCount > 0 || acceptedCount > 0
  );
  return (
    <View accessibilityLiveRegion="polite" style={[styles.card, light && styles.cardLight]}>
      <View style={styles.copy}>
        <Text style={[styles.title, light && styles.titleLight]}>{title}</Text>
        <Text style={[styles.body, light && styles.bodyLight]}>{body}</Text>
      </View>
      {canRetry ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void onRetry()}
          style={({ pressed }) => [styles.retry, light && styles.retryLight, pressed && styles.retryPressed]}
        >
          <Text style={[styles.retryText, light && styles.retryTextLight]}>{acceptedCount > 0 && !lastError ? 'Check' : 'Retry'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

export const NativeCollectionSyncStatusCard = ({ includeConnectionErrors = true }: { includeConnectionErrors?: boolean }) => {
  const sync = useNativeCollectionSync();
  if (!includeConnectionErrors && (sync.isOffline || sync.lastError)) return null;
  return (
    <NativeCollectionSyncStatusCardView
      acceptedCount={sync.acceptedCount}
      isOffline={sync.isOffline}
      isSyncing={sync.isSyncing}
      lastError={sync.lastError}
      onRetry={sync.retry}
      pendingCount={sync.pendingCount}
    />
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: '#43708b',
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    marginHorizontal: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
    backgroundColor: '#10283a',
  },
  cardLight: { borderColor: '#8fb8cb', backgroundColor: '#e7f5fb' },
  copy: { flex: 1, gap: 2 },
  title: { color: '#dff6ff', fontWeight: '900' },
  titleLight: { color: '#173a4b' },
  body: { color: '#9fc4d8', fontSize: theme.type.caption, lineHeight: 18 },
  bodyLight: { color: '#426b7e' },
  retry: {
    minWidth: 68,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#4f9dcc',
    borderRadius: theme.radius.md,
    backgroundColor: '#173f5b',
  },
  retryPressed: { opacity: 0.7 },
  retryText: { color: '#fff', fontWeight: '900' },
  retryLight: { borderColor: '#5094b7', backgroundColor: '#d3ebf6' },
  retryTextLight: { color: '#173a4b' },
});
