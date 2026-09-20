import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeUiIcon } from './NativeUiIcon';
import { useNativeColorScheme } from '../features/settings/useNativeColorScheme';
import { markNativeUiPerformanceAfterPaint } from '../observability/nativeUiInteractionTiming';

type Props = {
  initialIdentifier?: string;
  onClose: () => void;
  onRequest: (identifier: string) => Promise<void>;
  onRequested: () => void;
  visible: boolean;
};

export const NativePasswordResetOverlay = ({
  initialIdentifier = '',
  onClose,
  onRequest,
  onRequested,
  visible,
}: Props) => {
  const light = useNativeColorScheme() === 'light';
  const insets = useSafeAreaInsets();
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (submitting) return;
    const normalizedIdentifier = identifier.trim();
    if (!normalizedIdentifier) {
      setError('Please enter your username or email.');
      return;
    }
    setError(null);
    setSubmitting(true);
    const startedAt = Date.now();
    try {
      await onRequest(normalizedIdentifier);
      onRequested();
      markNativeUiPerformanceAfterPaint('auth_recovery_request_result_painted', startedAt);
    } catch (caught) {
      setError(caught instanceof Error
        ? caught.message
        : 'Failed to reset password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;
  const content = (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.backdrop, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}
      >
        <Pressable
          accessibilityLabel="Close password reset"
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityLabel="Password reset"
          role="dialog"
          style={[styles.card, light && styles.cardLight]}
          testID="native-password-reset-overlay"
        >
          <Pressable
            accessibilityLabel="Close password reset"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <Text style={[styles.closeText, light && styles.textLight]}>×</Text>
          </Pressable>
          <View style={styles.icon}>
            <NativeUiIcon color="#2098ff" name="key" size={25} />
          </View>
          <Text style={[styles.eyebrow, light && styles.accentLight]}>ACCOUNT RECOVERY</Text>
          <Text accessibilityRole="header" style={[styles.title, light && styles.textLight]}>
            Reset your password
          </Text>
          <Text style={[styles.intro, light && styles.mutedLight]}>
            Enter the username or email attached to your account. We’ll email a secure, single-use link that expires after 30 minutes.
          </Text>
          <Text style={[styles.label, light && styles.textLight]}>Username or email</Text>
          <TextInput
            accessibilityLabel="Recovery username or email"
            autoCapitalize="none"
            autoComplete="username"
            autoFocus={!initialIdentifier}
            editable={!submitting}
            onChangeText={(value) => {
              setIdentifier(value);
              setError(null);
            }}
            onSubmitEditing={() => void submit()}
            placeholder="you@example.com"
            placeholderTextColor="#718087"
            returnKeyType="send"
            style={[styles.input, light && styles.inputLight]}
            value={identifier}
          />
          {error ? <Text accessibilityRole="alert" style={[styles.error, light && styles.errorLight]}>{error}</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={submitting}
            onPress={() => void submit()}
            style={[styles.primary, submitting && styles.disabled]}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Email reset link</Text>}
          </Pressable>
          <Text style={[styles.privacy, light && styles.mutedLight]}>
            For your privacy, we show the same confirmation whether or not an account matches what you entered.
          </Text>
        </View>
      </KeyboardAvoidingView>
  );
  if (Platform.OS === 'web') {
    return <View style={[StyleSheet.absoluteFill, styles.webOverlay]}>{content}</View>;
  }
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible
    >
      {content}
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  webOverlay: { zIndex: 100 },
  card: {
    width: '100%',
    maxWidth: 480,
    borderWidth: 1,
    borderColor: '#4179a1',
    borderRadius: 18,
    padding: 22,
    backgroundColor: '#202428',
    elevation: 18,
  },
  cardLight: { borderColor: '#9bc2df', backgroundColor: '#fff' },
  close: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 2,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  closeText: { color: '#fff', fontSize: 32, lineHeight: 34, fontWeight: '400' },
  pressed: { opacity: 0.65 },
  icon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    borderRadius: 24,
    backgroundColor: '#103b61',
  },
  eyebrow: { color: '#58abff', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  accentLight: { color: '#005bb5' },
  title: { marginTop: 5, color: '#fff', fontSize: 27, lineHeight: 33, fontWeight: '900' },
  intro: { marginTop: 9, marginBottom: 20, color: '#b3bec5', fontSize: 13, lineHeight: 19 },
  label: { marginBottom: 6, color: '#f7fafb', fontSize: 13, fontWeight: '900' },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#59666d',
    borderRadius: 11,
    paddingHorizontal: 14,
    color: '#f7fafb',
    backgroundColor: '#14191c',
    fontSize: 16,
  },
  inputLight: { borderColor: '#aebdc4', color: '#152126', backgroundColor: '#fff' },
  error: { marginTop: 10, color: '#ffd5dc', fontSize: 12, lineHeight: 17, fontWeight: '800' },
  errorLight: { color: '#8f2638' },
  primary: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    borderRadius: 11,
    backgroundColor: '#0067c9',
  },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  privacy: { marginTop: 15, color: '#a7b6bd', fontSize: 11, lineHeight: 16, textAlign: 'center' },
  textLight: { color: '#142126' },
  mutedLight: { color: '#5e7077' },
});
