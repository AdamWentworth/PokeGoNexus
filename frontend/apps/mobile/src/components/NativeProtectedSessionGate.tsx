import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeSessionStatus } from '../auth/NativeSessionContext';
import { useNativeColorScheme } from '../features/settings/useNativeColorScheme';

type Props = {
  message?: string;
  onRetry: () => Promise<void>;
  status: Extract<NativeSessionStatus, 'restoring' | 'unavailable'>;
};

/**
 * Holds an authenticated route in place while SecureStore/session recovery is
 * still resolving. Redirecting during this state loses deep links and makes a
 * valid signed-in user land on Home or Login before their token can restore.
 */
export const NativeProtectedSessionGate = ({
  message = 'Restoring your secure session…',
  onRetry,
  status,
}: Props) => {
  const light = useNativeColorScheme() === 'light';

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.root, light && styles.rootLight]}
      testID="native-protected-session-gate"
    >
      {status === 'restoring' ? (
        <>
          <ActivityIndicator color="#299cf5" size="large" />
          <Text style={[styles.message, light && styles.messageLight]}>{message}</Text>
        </>
      ) : (
        <>
          <Text accessibilityRole="header" style={[styles.title, light && styles.titleLight]}>
            Session check unavailable
          </Text>
          <Text style={[styles.message, light && styles.messageLight]}>
            Your saved sign-in is still secure. Check your connection and try again.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void onRetry()}
            style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: 'transparent',
  },
  rootLight: { backgroundColor: 'transparent' },
  title: { color: '#f6fbfc', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  titleLight: { color: '#102129' },
  message: { maxWidth: 380, color: '#a8b9bc', fontSize: 14, lineHeight: 21, fontWeight: '700', textAlign: 'center' },
  messageLight: { color: '#5f7074' },
  retry: {
    minWidth: 132,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#299cf5',
  },
  retryText: { color: '#04131d', fontSize: 15, fontWeight: '900' },
  pressed: { opacity: 0.78 },
});
