import { type ReactNode, useEffect } from 'react';
import {
  BackHandler,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AccessibilityRole,
} from 'react-native';
import { useNativeModalAnimation } from '../features/settings/useNativeMotion';
import { useNativeColorScheme } from '../features/settings/useNativeColorScheme';

type Props = {
  body: string;
  children?: ReactNode;
  confirmLabel: string;
  isPending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  tone?: 'default' | 'danger';
  visible: boolean;
  presentation?: 'inline' | 'modal';
};

export const NativeConfirmationDialog = ({
  body,
  children,
  confirmLabel,
  isPending = false,
  onCancel,
  onConfirm,
  title,
  tone = 'default',
  visible,
  presentation = 'modal',
}: Props) => {
  const light = useNativeColorScheme() === 'light';
  const animationType = useNativeModalAnimation('fade');
  const inlinePresentation = presentation === 'inline' || Platform.OS === 'web';
  useEffect(() => {
    if (presentation !== 'inline' || Platform.OS === 'web' || !visible) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onCancel();
      return true;
    });
    return () => subscription.remove();
  }, [onCancel, presentation, visible]);
  if (Platform.OS === 'web' && presentation !== 'inline' && !visible) return null;
  const dialog = (
    <View
      accessibilityElementsHidden={!visible}
      accessibilityLabel={title}
      accessibilityRole={Platform.OS === 'web' ? 'dialog' as AccessibilityRole : undefined}
      accessibilityViewIsModal={Platform.OS !== 'web'}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.backdrop,
        inlinePresentation && styles.inlineBackdrop,
        inlinePresentation && !visible && styles.hiddenInline,
      ]}
    >
      <View style={[styles.card, light && styles.cardLight]} testID="native-confirmation-dialog">
        <Text style={[styles.eyebrow, light && styles.eyebrowLight]}>TRAINER ACTION</Text>
        <Text style={[styles.title, light && styles.textLight]}>{title}</Text>
        <Text style={[styles.body, light && styles.mutedLight]}>{body}</Text>
        {children}
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" disabled={isPending} onPress={onCancel} style={[styles.cancel, light && styles.cancelLight]}>
            <Text style={[styles.cancelText, light && styles.textLight]}>Cancel</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={isPending} onPress={onConfirm} style={[styles.confirm, tone === 'danger' && styles.confirmDanger, isPending && styles.disabled]}>
            <Text style={styles.confirmText}>{isPending ? 'Working…' : confirmLabel}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
  if (inlinePresentation) return dialog;
  return (
    <Modal
      animationType={animationType}
      onRequestClose={onCancel}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      {dialog}
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: '#000000aa' },
  inlineBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 90,
    elevation: 90,
  },
  hiddenInline: { opacity: 0, transform: [{ translateY: 10_000 }] },
  card: { width: '100%', maxWidth: 440, gap: 8, padding: 18, borderWidth: 1, borderColor: '#41757a', borderRadius: 16, backgroundColor: '#171f20' },
  cardLight: { borderColor: '#91aaae', backgroundColor: '#ffffff' },
  eyebrow: { color: '#37c8aa', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  eyebrowLight: { color: '#087454' },
  title: { color: '#ffffff', fontSize: 22, fontWeight: '900' },
  body: { color: '#adbbbd', fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 9 },
  cancel: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#536467', borderRadius: 24 },
  cancelLight: { borderColor: '#a5b3b5' },
  cancelText: { color: '#ffffff', fontWeight: '900' },
  confirm: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: '#36c5a4' },
  confirmDanger: { backgroundColor: '#df4d63' },
  confirmText: { color: '#041411', fontWeight: '900', textAlign: 'center' },
  disabled: { opacity: 0.55 },
  textLight: { color: '#172124' },
  mutedLight: { color: '#4b5c5f' },
});
